import Foundation

enum ContentKind: String, Codable { case series, movie, documentary }

struct Series: Identifiable, Codable, Hashable {
    let id: String; let title: String; let tagline: String; let synopsis: String
    let year: String; let rating: String; let genres: [String]; let seasons: [Season]
    let artworkURL: URL?
    var kind: ContentKind { .series }
    var allEpisodes: [Episode] { seasons.flatMap(\.episodes) }
}

struct Season: Identifiable, Codable, Hashable {
    let number: Int; let episodes: [Episode]
    var id: Int { number }
}

struct Episode: Identifiable, Codable, Hashable {
    let id: String; let season: Int; let number: Int; let title: String
    let synopsis: String; let runtimeMinutes: Int; let artworkURL: URL?
    var code: String { String(format: "S%02dE%02d", season, number) }
}

struct PlaybackProgress: Codable, Hashable {
    var seconds: Double; var duration: Double; var lastPlayed: Date; var isFinished: Bool
    var fraction: Double { duration > 0 ? min(seconds / duration, 1) : 0 }
}

struct SubtitleTrack: Identifiable, Codable, Hashable { let id: String; let label: String; let url: URL? }
struct VideoQuality: Identifiable, Codable, Hashable { let id: String; let label: String; let url: URL }
struct StreamSource: Codable, Hashable { let url: URL; let headers: [String:String]; let subtitles: [SubtitleTrack]; let qualities: [VideoQuality] }

enum DownloadState: String, Codable { case queued, downloading, downloaded, failed }
struct DownloadItem: Identifiable, Codable, Hashable { let episodeID: String; var progress: Double; var state: DownloadState; var id: String { episodeID } }
