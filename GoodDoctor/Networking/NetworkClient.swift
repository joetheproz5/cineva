import Foundation

protocol NetworkClientProtocol { func data(from url: URL) async throws -> Data }
struct NetworkClient: NetworkClientProtocol {
    func data(from url: URL) async throws -> Data {
        var request = URLRequest(url: url); request.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { throw URLError(.badServerResponse) }
        return data
    }
}
