import Foundation

protocol VideoProvider { func stream(for episode: Episode) async throws -> StreamSource }
enum VideoProviderError: LocalizedError { case unavailable; var errorDescription: String? { "This episode is currently unavailable." } }

struct LocalVideoProvider: VideoProvider {
    func stream(for episode: Episode) async throws -> StreamSource { throw VideoProviderError.unavailable }
}
struct DirectURLVideoProvider: VideoProvider {
    let sources: [String: StreamSource]
    func stream(for episode: Episode) async throws -> StreamSource { guard let source = sources[episode.id] else { throw VideoProviderError.unavailable }; return source }
}
struct AuthorizedRemoteProvider: VideoProvider {
    let endpoint: URL
    func stream(for episode: Episode) async throws -> StreamSource { throw VideoProviderError.unavailable }
}
