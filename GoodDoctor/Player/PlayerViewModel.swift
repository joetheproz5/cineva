import AVFoundation
import Combine

@MainActor final class PlayerViewModel: ObservableObject {
    struct Tick { let seconds: Double; let duration: Double }
    @Published var player: AVPlayer?; @Published var isLoading = true; @Published var errorMessage: String?
    let episode: Episode; let playlist: [Episode]; private var observer: Any?; private var endObserver: NSObjectProtocol?; private let progressSubject = PassthroughSubject<Tick, Never>(); private let endedSubject = PassthroughSubject<Void, Never>(); var progress: AnyPublisher<Tick, Never> { progressSubject.eraseToAnyPublisher() }; var ended: AnyPublisher<Void, Never> { endedSubject.eraseToAnyPublisher() }
    init(episode: Episode, playlist: [Episode]) { self.episode = episode; self.playlist = playlist }
    var previous: Episode? { guard let index = playlist.firstIndex(of: episode), index > 0 else { return nil }; return playlist[index - 1] }
    var next: Episode? { guard let index = playlist.firstIndex(of: episode), index < playlist.count - 1 else { return nil }; return playlist[index + 1] }
    func load(resume: Double?) async { stop(save: { _, _ in }); isLoading = true; errorMessage = nil
        do { let source = try await VideoSources.provider.stream(for: episode); let item = AVPlayerItem(url: source.url); let newPlayer = AVPlayer(playerItem: item); player = newPlayer
            observer = newPlayer.addPeriodicTimeObserver(forInterval: CMTime(seconds: 2, preferredTimescale: 600), queue: .main) { [weak self] time in guard let self, let item = self.player?.currentItem else { return }; let duration = item.duration.seconds.isFinite ? item.duration.seconds : 0; self.progressSubject.send(Tick(seconds: max(0, time.seconds), duration: duration)) }
            endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in self?.endedSubject.send() }
            if let resume, resume > 5 { newPlayer.seek(to: CMTime(seconds: resume, preferredTimescale: 600)) }; newPlayer.play(); isLoading = false
        } catch { errorMessage = error.localizedDescription; isLoading = false }
    }
    func seek(by seconds: Double) { guard let player else { return }; let value = max(0, player.currentTime().seconds + seconds); player.seek(to: CMTime(seconds: value, preferredTimescale: 600)) }
    func stop(save: (Double, Double) -> Void) { guard let player else { return }; let time = player.currentTime().seconds; let duration = player.currentItem?.duration.seconds ?? 0; if let observer { player.removeTimeObserver(observer); self.observer = nil }; if let endObserver { NotificationCenter.default.removeObserver(endObserver); self.endObserver = nil }; player.pause(); save(time.isFinite ? time : 0, duration.isFinite ? duration : 0); self.player = nil }
}
