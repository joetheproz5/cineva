import Foundation

/// The account holder is responsible for confirming content rights and provider terms before enabling this integration.
enum VidkingConfiguration {
    static let host = URL(string: "https://www.vidking.net")!
    /// The Good Doctor's TMDB TV identifier. Change this for another authorized series.
    static let seriesTMDBID = "71712"
    static let primaryColor = "d1ff47"

    static func embedURL(for episode: Episode, resumeAt seconds: Double?) -> URL {
        var components = URLComponents(url: host.appending(path: "embed/tv/\(seriesTMDBID)/\(episode.season)/\(episode.number)"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "color", value: primaryColor),
            URLQueryItem(name: "autoPlay", value: "true"),
            URLQueryItem(name: "nextEpisode", value: "true"),
            URLQueryItem(name: "episodeSelector", value: "true")
        ]
        if let seconds, seconds > 5 { components.queryItems?.append(URLQueryItem(name: "progress", value: String(Int(seconds)))) }
        return components.url!
    }
}
