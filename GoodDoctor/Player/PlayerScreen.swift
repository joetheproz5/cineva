import SwiftUI
import AVKit

struct PlayerScreen: View {
    let episode: Episode; let playlist: [Episode]
    @EnvironmentObject private var library: LibraryStore; @EnvironmentObject private var settings: SettingsStore
    @StateObject private var model: PlayerViewModel
    @State private var autoplayEpisode: Episode?
    @Environment(\.dismiss) private var dismiss
    init(episode: Episode, playlist: [Episode]) { self.episode = episode; self.playlist = playlist; _model = StateObject(wrappedValue: PlayerViewModel(episode: episode, playlist: playlist)) }
    var body: some View { ZStack {
        AppTheme.background.ignoresSafeArea()
        VStack(spacing: 0) {
            if let player = model.player { NativePlayerView(player: player).aspectRatio(16/9, contentMode: .fit) } else if model.isLoading { ProgressView("Loading stream…").frame(maxWidth: .infinity, maxHeight: 250) } else { playerError }
            VStack(alignment: .leading, spacing: 13) { Text(episode.code).font(.caption.weight(.semibold)).foregroundStyle(AppTheme.accent); Text(episode.title).font(.title.bold()); Text(episode.synopsis).foregroundStyle(AppTheme.muted)
                HStack { Button { model.seek(by: -10) } label: { Label("10", systemImage: "gobackward.10") }; Spacer(); Button { model.seek(by: 10) } label: { Label("10", systemImage: "goforward.10") } }.buttonStyle(.bordered).tint(AppTheme.accent)
                HStack { if let previous = model.previous { NavigationLink { PlayerScreen(episode: previous, playlist: playlist) } label: { Label("Previous", systemImage: "backward.end.fill") }.buttonStyle(.bordered) }; Spacer(); if let next = model.next { NavigationLink { PlayerScreen(episode: next, playlist: playlist) } label: { Label("Next", systemImage: "forward.end.fill") }.buttonStyle(.borderedProminent).tint(AppTheme.accent) } }
            }.padding(20); Spacer()
        }
    }.navigationBarTitleDisplayMode(.inline).navigationDestination(item: $autoplayEpisode) { PlayerScreen(episode: $0, playlist: playlist) }.task { await model.load(resume: settings.rememberPosition ? library.entry(for: episode)?.seconds : nil) }.onDisappear { model.stop { time, duration in if settings.rememberPosition { library.update(episode, seconds: time, duration: duration) } } }.onReceive(model.progress) { time in library.update(episode, seconds: time.seconds, duration: time.duration) }.onReceive(model.ended) { if settings.autoplay { autoplayEpisode = model.next } } }
    private var playerError: some View { VStack(spacing: 14) { Image(systemName: "exclamationmark.triangle").font(.largeTitle); Text(model.errorMessage ?? "This episode is currently unavailable.").multilineTextAlignment(.center); Button("Retry") { Task { await model.load(resume: nil) } }.buttonStyle(.borderedProminent).tint(AppTheme.accent) }.frame(maxWidth: .infinity, minHeight: 250).padding() }
}

struct NativePlayerView: UIViewControllerRepresentable {
    let player: AVPlayer
    func makeUIViewController(context: Context) -> AVPlayerViewController { let controller = AVPlayerViewController(); controller.player = player; controller.allowsPictureInPicturePlayback = true; controller.canStartPictureInPictureAutomaticallyFromInline = true; return controller }
    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) { controller.player = player }
}
