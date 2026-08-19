import SwiftUI

/// Host screen for the configured, authorized embedded player.
struct PlayerScreen: View {
    let episode: Episode
    let playlist: [Episode]
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var settings: SettingsStore
    @State private var autoplayEpisode: Episode?

    private var previous: Episode? { guard let index = playlist.firstIndex(of: episode), index > 0 else { return nil }; return playlist[index - 1] }
    private var next: Episode? { guard let index = playlist.firstIndex(of: episode), index < playlist.count - 1 else { return nil }; return playlist[index + 1] }
    private var embedURL: URL { VidkingConfiguration.embedURL(for: episode, resumeAt: settings.rememberPosition ? library.entry(for: episode)?.seconds : nil) }

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                VidkingPlayerView(url: embedURL) { event in
                    guard let currentTime = event.currentTime, let duration = event.duration, duration > 0 else { return }
                    library.update(episode, seconds: currentTime, duration: duration)
                    if event.event == "ended", settings.autoplay { autoplayEpisode = next }
                }
                .aspectRatio(16 / 9, contentMode: .fit)

                VStack(alignment: .leading, spacing: 13) {
                    Text(episode.code).font(.caption.weight(.semibold)).foregroundStyle(AppTheme.accent)
                    Text(episode.title).font(.title.bold())
                    Text(episode.synopsis).foregroundStyle(AppTheme.muted)
                    HStack {
                        if let previous { NavigationLink { PlayerScreen(episode: previous, playlist: playlist) } label: { Label("Previous", systemImage: "backward.end.fill") }.buttonStyle(.bordered) }
                        Spacer()
                        if let next { NavigationLink { PlayerScreen(episode: next, playlist: playlist) } label: { Label("Next", systemImage: "forward.end.fill") }.buttonStyle(.borderedProminent).tint(AppTheme.accent) }
                    }
                }.padding(20)
                Spacer()
            }
        }
        .navigationTitle("Now Playing")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $autoplayEpisode) { PlayerScreen(episode: $0, playlist: playlist) }
    }
}
