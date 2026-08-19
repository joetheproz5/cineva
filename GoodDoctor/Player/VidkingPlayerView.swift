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
        controller.addUserScript(WKUserScript(source: """
        window.addEventListener('message', function(event) {
          try { window.webkit.messageHandlers.cinevaPlayer.postMessage(typeof event.data === 'string' ? event.data : JSON.stringify(event.data)); } catch (_) {}
        });
        """, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = .black; webView.isOpaque = false; webView.scrollView.isScrollEnabled = false
        webView.load(URLRequest(url: url)); return webView
    }
    func updateUIView(_ webView: WKWebView, context: Context) { }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onPlayerEvent: (PlayerEvent) -> Void
        init(onPlayerEvent: @escaping (PlayerEvent) -> Void) { self.onPlayerEvent = onPlayerEvent }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let text = message.body as? String, let data = text.data(using: .utf8), let envelope = try? JSONDecoder().decode(PlayerEventEnvelope.self, from: data), envelope.type == "PLAYER_EVENT" else { return }
            onPlayerEvent(envelope.data)
        }
    }
}

struct PlayerEventEnvelope: Decodable { let type: String; let data: PlayerEvent }
struct PlayerEvent: Decodable { let event: String; let currentTime: Double?; let duration: Double? }
