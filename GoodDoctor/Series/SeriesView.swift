import SwiftUI

struct SeriesView: View {
    let series: Series; @EnvironmentObject private var library: LibraryStore; @State private var season = 1
    private var selected: Season { series.seasons.first(where: { $0.number == season }) ?? series.seasons[0] }
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 21) {
        Artwork(title: series.title, height: 300).overlay(alignment: .bottom) { LinearGradient(colors: [.clear, AppTheme.background], startPoint: .center, endPoint: .bottom).frame(height: 160) }
        VStack(alignment: .leading, spacing: 12) { Text(series.title).font(.largeTitle.bold()); Text("\(series.year)   \(series.rating)   \(series.genres.joined(separator: " · "))").font(.subheadline).foregroundStyle(AppTheme.muted); Text(series.synopsis).foregroundStyle(AppTheme.muted); HStack { NavigationLink { PlayerScreen(episode: series.allEpisodes[0], playlist: series.allEpisodes) } label: { Label("Play", systemImage: "play.fill").frame(maxWidth: .infinity).padding(14).background(AppTheme.accent).foregroundStyle(.black).clipShape(Capsule()) }; Button { library.toggleFavorite(series) } label: { Image(systemName: library.favorites.contains(series.id) ? "checkmark" : "plus").frame(width: 48, height: 48).background(.white.opacity(0.1)).clipShape(Circle()) } } }.padding(.horizontal, 20).padding(.top, -45)
        Picker("Season", selection: $season) { ForEach(series.seasons) { Text("Season \($0.number)").tag($0.number) } }.pickerStyle(.segmented).padding(.horizontal, 20)
        LazyVStack(spacing: 14) { ForEach(selected.episodes) { EpisodeCard(episode: $0, playlist: series.allEpisodes) } }.padding(.horizontal, 20)
    }.padding(.bottom, 30) }.background(AppTheme.background.ignoresSafeArea()).navigationBarTitleDisplayMode(.inline) }
}

struct EpisodeCard: View { @EnvironmentObject private var library: LibraryStore; let episode: Episode; let playlist: [Episode]
    var body: some View { NavigationLink { PlayerScreen(episode: episode, playlist: playlist) } label: { HStack(spacing: 12) { ZStack(alignment: .bottom) { Artwork(title: episode.code, height: 94); Image(systemName: "play.circle.fill").font(.title).symbolRenderingMode(.hierarchical); if let progress = library.entry(for: episode) { ProgressBar(value: progress.fraction).padding(8) } }.frame(width: 138); VStack(alignment: .leading, spacing: 6) { Text("\(episode.code)  \(episode.title)").font(.subheadline.bold()); Text("\(episode.runtimeMinutes) min").font(.caption).foregroundStyle(AppTheme.muted); Text(episode.synopsis).font(.caption).lineLimit(3).foregroundStyle(AppTheme.muted) }; Spacer(minLength: 0) }.padding(9).background(AppTheme.panel).clipShape(RoundedRectangle(cornerRadius: 17)) }.buttonStyle(.plain) }
}
