import SwiftUI
import WebKit

struct VidkingPlayerView: UIViewRepresentable {
    let url: URL
    let onPlayerEvent: (PlayerEvent) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onPlayerEvent: onPlayerEvent) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let controller = configuration.userContentController
        controller.add(context.coordinator, name: "cinevaPlayer")
        let expectedOrigin = VidkingConfiguration.host.absoluteString
        controller.addUserScript(WKUserScript(source: """
        window.addEventListener('message', function(event) {
          try {
            if (event.origin !== '\(expectedOrigin)') return;
            var payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            var data = payload && payload.data;
            if (!payload || payload.type !== 'PLAYER_EVENT' || !data || typeof data.event !== 'string' || !Number.isFinite(data.currentTime) || data.currentTime < 0 || !Number.isFinite(data.duration) || data.duration <= 0 || data.duration > 172800 || data.currentTime > data.duration + 5) return;
            window.webkit.messageHandlers.cinevaPlayer.postMessage(JSON.stringify(payload));
          } catch (_) {}
        });
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = .black; webView.isOpaque = false; webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.load(URLRequest(url: url)); return webView
    }
    func updateUIView(_ webView: WKWebView, context: Context) { }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        let onPlayerEvent: (PlayerEvent) -> Void
        init(onPlayerEvent: @escaping (PlayerEvent) -> Void) { self.onPlayerEvent = onPlayerEvent }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == VidkingConfiguration.host.host,
                  let text = message.body as? String,
                  let data = text.data(using: .utf8),
                  let envelope = try? JSONDecoder().decode(PlayerEventEnvelope.self, from: data),
                  envelope.type == "PLAYER_EVENT",
                  envelope.data.isValid else { return }
            onPlayerEvent(envelope.data)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // Never turn player popups or a cross-site top-level redirect into an in-app page.
            guard navigationAction.targetFrame != nil else { decisionHandler(.cancel); return }
            if navigationAction.targetFrame?.isMainFrame == true {
                let url = navigationAction.request.url
                let isExpectedPlayer = url?.scheme == "https" && url?.host == VidkingConfiguration.host.host
                decisionHandler(isExpectedPlayer ? .allow : .cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            nil
        }
    }
}

struct PlayerEventEnvelope: Decodable { let type: String; let data: PlayerEvent }
struct PlayerEvent: Decodable {
    let event: String
    let currentTime: Double?
    let duration: Double?

    var isValid: Bool {
        guard !event.isEmpty, event.count <= 64,
              let currentTime, currentTime.isFinite, currentTime >= 0,
              let duration, duration.isFinite, duration > 0, duration <= 172800 else { return false }
        return currentTime <= duration + 5
    }
}
