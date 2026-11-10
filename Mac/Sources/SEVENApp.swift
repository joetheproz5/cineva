import AppKit
import AVFoundation
import Combine
import SwiftUI
import WebKit

private let sevenHomeURL = URL(string: "https://seven-9fm.pages.dev/")!
private let sevenHost = "seven-9fm.pages.dev"

@MainActor
private final class SevenBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let webView: WKWebView

    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false
    private var splashPlayer: AVAudioPlayer?

    override init() {
        let configuration = WKWebViewConfiguration()
        let userContent = WKUserContentController()
        userContent.add(self, name: "sevenSplashAudio")
        configuration.userContentController = userContent
        configuration.websiteDataStore = .default()
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = false
        webView.pageZoom = 1.0
        webView.underPageBackgroundColor = NSColor(calibratedRed: 2.0 / 255.0, green: 2.0 / 255.0, blue: 3.0 / 255.0, alpha: 1)
        webView.load(URLRequest(url: sevenHomeURL))
    }

    func goBack() {
        guard webView.canGoBack else { return }
        webView.goBack()
    }

    func goForward() {
        guard webView.canGoForward else { return }
        webView.goForward()
    }

    func reload() {
        webView.reload()
    }

    func openInBrowser() {
        NSWorkspace.shared.open(webView.url ?? sevenHomeURL)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Let embedded players load normally, but keep top-level browsing inside SEVEN.
        guard navigationAction.targetFrame?.isMainFrame != false else {
            decisionHandler(.allow)
            return
        }

        guard let url = navigationAction.request.url,
              url.scheme?.lowercased() == "https",
              url.host?.lowercased() == sevenHost else {
            if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                NSWorkspace.shared.open(url)
            }
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
        refreshNavigationState()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshNavigationState()
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        refreshNavigationState()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "sevenSplashAudio",
              (message.body as? String) == "play",
              message.frameInfo.securityOrigin.host == sevenHost,
              let url = Bundle.module.url(forResource: "splash_sting", withExtension: "wav", subdirectory: "Resources/audio") else { return }
        do {
            splashPlayer = try AVAudioPlayer(contentsOf: url)
            splashPlayer?.volume = 0.251
            splashPlayer?.prepareToPlay()
            splashPlayer?.play()
        } catch {
            splashPlayer = nil
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    private func refreshNavigationState() {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
    }
}

@main
@MainActor
struct SEVENApp: App {
    var body: some Scene {
        WindowGroup("SEVEN") {
            SEVENWindow()
                .frame(minWidth: 860, minHeight: 560)
        }
        .defaultSize(width: 1440, height: 900)
    }
}

@MainActor
private struct SEVENWindow: View {
    @StateObject private var browser = SevenBrowser()

    var body: some View {
        WebContent(webView: browser.webView)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(red: 2.0 / 255, green: 2.0 / 255, blue: 3.0 / 255))
            .background(WindowFrameAutosave())
            .preferredColorScheme(.dark)
            .toolbar {
                ToolbarItemGroup(placement: .navigation) {
                    Text("SEVEN")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .tracking(1.4)
                        .foregroundStyle(Color(red: 0.91, green: 0.04, blue: 0.10))
                        .padding(.trailing, 8)

                    Button(action: browser.goBack) {
                        Image(systemName: "chevron.left")
                    }
                    .help("Back")
                    .accessibilityLabel("Back")
                    .keyboardShortcut("[", modifiers: .command)
                    .disabled(!browser.canGoBack)

                    Button(action: browser.goForward) {
                        Image(systemName: "chevron.right")
                    }
                    .help("Forward")
                    .accessibilityLabel("Forward")
                    .keyboardShortcut("]", modifiers: .command)
                    .disabled(!browser.canGoForward)

                    Button(action: browser.reload) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .help("Reload SEVEN")
                    .accessibilityLabel("Reload SEVEN")
                    .keyboardShortcut("r", modifiers: .command)
                }

                ToolbarItem(placement: .principal) {
                    Text("MOVIES  ·  SERIES  ·  YOURS")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(.secondary)
                }

                ToolbarItem(placement: .primaryAction) {
                    Button(action: browser.openInBrowser) {
                        Label("Open in browser", systemImage: "arrow.up.right.square")
                    }
                    .help("Open SEVEN in your default browser")
                }
            }
            .toolbarBackground(.visible, for: .windowToolbar)
    }
}

private struct WebContent: NSViewRepresentable {
    let webView: WKWebView

    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ nsView: WKWebView, context: Context) { }
}

private struct WindowFrameAutosave: NSViewRepresentable {
    func makeNSView(context: Context) -> AutosaveView { AutosaveView() }
    func updateNSView(_ nsView: AutosaveView, context: Context) { }

    final class AutosaveView: NSView {
        private var didSetAutosaveName = false
        private var didPaintInitialFrame = false

        override func draw(_ dirtyRect: NSRect) {
            super.draw(dirtyRect)
            NSColor(calibratedRed: 2.0 / 255.0, green: 2.0 / 255.0, blue: 3.0 / 255.0, alpha: 1).setFill()
            dirtyRect.fill()
            guard !didPaintInitialFrame else { return }
            didPaintInitialFrame = true
            DispatchQueue.main.async { [weak self] in self?.window?.alphaValue = 1 }
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard let window else { return }
            window.backgroundColor = NSColor(calibratedRed: 2.0 / 255.0, green: 2.0 / 255.0, blue: 3.0 / 255.0, alpha: 1)
            window.isOpaque = true
            if !didPaintInitialFrame { window.alphaValue = 0 }
            if !didSetAutosaveName {
                didSetAutosaveName = true
                _ = window.setFrameAutosaveName("SEVEN.MainWindow")
            }
        }
    }
}
