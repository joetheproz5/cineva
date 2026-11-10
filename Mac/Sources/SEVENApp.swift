import AppKit
import AuthenticationServices
import AVFoundation
import Combine
import SwiftUI
import WebKit

private let sevenHomeURL = URL(string: "https://seven-9fm.pages.dev/")!
private let sevenHost = "seven-9fm.pages.dev"

private final class SevenScriptMessageHandlerProxy: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

@MainActor
private final class SevenBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
    let webView: WKWebView

    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false
    private var splashPlayer: AVAudioPlayer?
    private var oauthSession: ASWebAuthenticationSession?

    override init() {
        let messageProxy = SevenScriptMessageHandlerProxy()
        let configuration = WKWebViewConfiguration()
        let userContent = WKUserContentController()
        userContent.add(messageProxy, name: "sevenSplashAudio")
        userContent.add(messageProxy, name: "sevenNativeAuth")
        configuration.userContentController = userContent
        configuration.websiteDataStore = .default()
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        messageProxy.delegate = self
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
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == sevenHost else { return }
        if message.name == "sevenNativeAuth",
           let body = message.body as? [String: Any],
           body["type"] as? String == "startOAuth",
           let rawURL = body["url"] as? String {
            startNativeOAuth(rawURL)
            return
        }
        guard message.name == "sevenSplashAudio", (message.body as? String) == "play",
              let url = Bundle.module.url(forResource: "splash_sting", withExtension: "wav", subdirectory: "Resources/audio") else { return }
        do {
            splashPlayer = try AVAudioPlayer(contentsOf: url)
            splashPlayer?.volume = 0.251
            splashPlayer?.prepareToPlay()
            splashPlayer?.play()
        } catch { splashPlayer = nil }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        webView.window ?? NSApp.keyWindow ?? NSWindow()
    }

    private func startNativeOAuth(_ rawURL: String) {
        guard let url = URL(string: rawURL),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              url.scheme?.lowercased() == "https",
              url.host?.lowercased().hasSuffix(".supabase.co") == true,
              url.path == "/auth/v1/authorize",
              let provider = components.queryItems?.first(where: { $0.name == "provider" })?.value,
              ["google", "discord"].contains(provider),
              let rawRedirect = components.queryItems?.first(where: { $0.name == "redirect_to" })?.value,
              let redirect = URLComponents(string: rawRedirect),
              redirect.scheme == "tv.seven.app", redirect.host == "oauth", redirect.path == "/callback" else {
            deliverNativeOAuthCallback(URL(string: "tv.seven.app://oauth/callback?error=launch_failed")!)
            return
        }

        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "tv.seven.app") { [weak self] callbackURL, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.oauthSession = nil
                if let callbackURL, callbackURL.scheme == "tv.seven.app", callbackURL.host == "oauth", callbackURL.path == "/callback" {
                    self.deliverNativeOAuthCallback(callbackURL)
                } else if error != nil {
                    self.deliverNativeOAuthCallback(URL(string: "tv.seven.app://oauth/callback?error=cancelled")!)
                }
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        oauthSession = session
        if !session.start() {
            oauthSession = nil
            deliverNativeOAuthCallback(URL(string: "tv.seven.app://oauth/callback?error=launch_failed")!)
        }
    }

    private func deliverNativeOAuthCallback(_ url: URL) {
        guard let data = try? JSONSerialization.data(withJSONObject: url.absoluteString, options: [.fragmentsAllowed]),
              let serialized = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.SEVENNativeAuthCallback?.(\(serialized))")
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
