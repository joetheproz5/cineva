import Foundation
import Combine

@MainActor final class LibraryStore: ObservableObject {
    @Published private(set) var progress: [String: PlaybackProgress] = [:] { didSet { save() } }
    @Published private(set) var downloads: [DownloadItem] = [] { didSet { saveDownloads() } }
    @Published var favorites: Set<String> = [] { didSet { UserDefaults.standard.set(Array(favorites), forKey: "favorites") } }
    private let progressKey = "playback.progress.v1", downloadsKey = "downloads.v1"
    init() {
        if let data = UserDefaults.standard.data(forKey: progressKey), let stored = try? JSONDecoder().decode([String: PlaybackProgress].self, from: data) { progress = stored }
        if let data = UserDefaults.standard.data(forKey: downloadsKey), let stored = try? JSONDecoder().decode([DownloadItem].self, from: data) { downloads = stored }
        favorites = Set(UserDefaults.standard.stringArray(forKey: "favorites") ?? [])
    }
    func entry(for episode: Episode) -> PlaybackProgress? { progress[episode.id] }
    func update(_ episode: Episode, seconds: Double, duration: Double) { progress[episode.id] = PlaybackProgress(seconds: seconds, duration: duration, lastPlayed: .now, isFinished: duration > 0 && seconds / duration >= 0.9) }
    func clearProgress() { progress = [:] }
    func toggleFavorite(_ series: Series) { favorites.formSymmetricDifference([series.id]) }
    func queueDownload(_ episode: Episode) { guard !downloads.contains(where: { $0.episodeID == episode.id }) else { return }; downloads.append(DownloadItem(episodeID: episode.id, progress: 0, state: .queued)) }
    func removeDownload(_ item: DownloadItem) { downloads.removeAll { $0.id == item.id } }
    private func save() { if let data = try? JSONEncoder().encode(progress) { UserDefaults.standard.set(data, forKey: progressKey) } }
    private func saveDownloads() { if let data = try? JSONEncoder().encode(downloads) { UserDefaults.standard.set(data, forKey: downloadsKey) } }
}

@MainActor final class SettingsStore: ObservableObject {
    @Published var autoplay = UserDefaults.standard.object(forKey: "autoplay") as? Bool ?? true { didSet { UserDefaults.standard.set(autoplay, forKey: "autoplay") } }
    @Published var rememberPosition = UserDefaults.standard.object(forKey: "remember") as? Bool ?? true { didSet { UserDefaults.standard.set(rememberPosition, forKey: "remember") } }
    @Published var cellularPlayback = UserDefaults.standard.object(forKey: "cellular") as? Bool ?? true { didSet { UserDefaults.standard.set(cellularPlayback, forKey: "cellular") } }
    @Published var quality = UserDefaults.standard.string(forKey: "quality") ?? "Auto" { didSet { UserDefaults.standard.set(quality, forKey: "quality") } }
}
