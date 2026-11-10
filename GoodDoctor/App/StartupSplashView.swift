import AVFoundation
import SwiftUI
import UIKit
import WebKit

enum SEVENStartupSplashSpec {
    static let background = Color(red: 2.0 / 255, green: 2.0 / 255, blue: 3.0 / 255)
    static let dateKey = "seven.startup.splash.v2.date"
    static let soundKey = "seven.startup.sound.enabled"

    private static func todayKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    static func launchVersion() -> String {
        UserDefaults.standard.string(forKey: dateKey) == todayKey() ? "short" : "full"
    }

    static func markLaunchedToday() {
        UserDefaults.standard.set(todayKey(), forKey: dateKey)
    }
}

struct SEVENStartupSplashView: UIViewRepresentable {
    let version: String
    let reducedMotion: Bool
    let soundEnabled: Bool
    let onExitStart: (_ delay: Double, _ duration: Double) -> Void
    let onFinish: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onExitStart: onExitStart, onFinish: onFinish) }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        let options: [String: Any] = [
            "version": version,
            "scale": 1,
            "reducedMotion": reducedMotion,
            "debug": false,
        ]
        let json = (try? JSONSerialization.data(withJSONObject: options))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let soundFlag = soundEnabled ? "true" : "false"
        let script = "window.__SEVEN_SPLASH_OPTIONS__ = \(json); window.__SEVEN_STARTUP_SOUND_ENABLED__ = \(soundFlag); window.SEVEN_SPLASH_PATH = 'seven-wordmark.svg#seven-wordmark-shape';"
        controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.add(context.coordinator, name: "sevenSplashNative")
        controller.add(context.coordinator, name: "sevenSplashAudio")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 2.0 / 255, green: 2.0 / 255, blue: 3.0 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.accessibilityElementsHidden = true

        if let page = Bundle.main.url(forResource: "native-splash", withExtension: "html") {
            webView.loadFileURL(page, allowingReadAccessTo: Bundle.main.bundleURL)
        } else {
            context.coordinator.finish()
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onExitStart = onExitStart
        context.coordinator.onFinish = onFinish
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler {
        var onExitStart: (_ delay: Double, _ duration: Double) -> Void
        var onFinish: () -> Void
        private let audio = SEVENStartupAudio()
        private var didFinish = false

        init(onExitStart: @escaping (_ delay: Double, _ duration: Double) -> Void, onFinish: @escaping () -> Void) {
            self.onExitStart = onExitStart
            self.onFinish = onFinish
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "sevenSplashAudio" {
                audio.playIfAvailable(enabled: UserDefaults.standard.object(forKey: SEVENStartupSplashSpec.soundKey) as? Bool ?? true)
                return
            }
            guard let payload = message.body as? [String: Any], let type = payload["type"] as? String else { return }
            switch type {
            case "started":
                SEVENStartupSplashSpec.markLaunchedToday()
            case "exitStart":
                let delay = (payload["screenDelayWallMs"] as? NSNumber)?.doubleValue ?? 150
                let duration = (payload["screenFadeWallMs"] as? NSNumber)?.doubleValue ?? 350
                onExitStart(delay, duration)
            case "finish":
                finish()
            default:
                break
            }
        }

        func finish() {
            guard !didFinish else { return }
            didFinish = true
            DispatchQueue.main.async { self.onFinish() }
        }
    }
}

@MainActor
private final class SEVENStartupAudio {
    private var player: AVAudioPlayer?

    func playIfAvailable(enabled: Bool) {
        guard enabled,
              !AVAudioSession.sharedInstance().isOtherAudioPlaying,
              let url = Bundle.main.url(forResource: "splash_sting", withExtension: "m4a", subdirectory: "audio") else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.ambient, mode: .default, options: [])
            player = try AVAudioPlayer(contentsOf: url)
            player?.prepareToPlay()
            let startAt = player!.deviceCurrentTime + max(0, session.outputLatency)
            player?.play(atTime: startAt)
        } catch {
            player = nil
        }
    }
}
