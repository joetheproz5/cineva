import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var library: LibraryStore
    private let series = CatalogData.theGoodDoctor
    private var continueEpisodes: [Episode] { series.allEpisodes.filter { (library.entry(for: $0)?.fraction ?? 0) > 0 && library.entry(for: $0)?.isFinished == false }.sorted { (library.entry(for: $0)?.lastPlayed ?? .distantPast) > (library.entry(for: $1)?.lastPlayed ?? .distantPast) } }
    private var watchedEpisodes: [Episode] { series.allEpisodes.filter { library.entry(for: $0)?.isFinished == true } }
    var body: some View { ScrollView(showsIndicators: false) {
        VStack(alignment: .leading, spacing: 28) {
            NavigationLink { SeriesView(series: series) } label: { HeroView(series: series) }.buttonStyle(.plain)
            if !continueEpisodes.isEmpty { EpisodeRail(title: "Continue Watching", episodes: continueEpisodes) }
            if !watchedEpisodes.isEmpty { EpisodeRail(title: "Recently Watched", episodes: watchedEpisodes) }
            VStack(alignment: .leading, spacing: 12) { Text("Featured").font(.title2.bold()); NavigationLink { SeriesView(series: series) } label: { SeriesCard(series: series) }.buttonStyle(.plain) }
        }.padding(.bottom, 38)
    }.background(AppTheme.background.ignoresSafeArea()).navigationTitle("DRIFT").navigationBarTitleDisplayMode(.inline) }
}

struct HeroView: View {
    let series: Series
    var body: some View { VStack(alignment: .leading, spacing: 14) {
        Artwork(title: series.title, height: 310).overlay(alignment: .bottom) { LinearGradient(colors: [.clear, AppTheme.background], startPoint: .center, endPoint: .bottom).frame(height: 180) }
        VStack(alignment: .leading, spacing: 9) { Text(series.title.uppercased()).font(.system(size: 27, weight: .black, design: .rounded)); Text(series.tagline).foregroundStyle(AppTheme.muted); HStack { PillButton(title: "Play", icon: "play.fill", filled: true) {}; PillButton(title: "Episodes", icon: "list.bullet") {} } }.padding(.horizontal, 20).padding(.top, -50)
    } }
}

struct SeriesCard: View { let series: Series
    var body: some View { HStack(spacing: 14) { Artwork(title: series.title, height: 112).frame(width: 150); VStack(alignment: .leading, spacing: 7) { Text(series.title).font(.headline); Text("\(series.year)  •  \(series.genres.joined(separator: " · "))").font(.caption).foregroundStyle(AppTheme.muted); Text(series.synopsis).font(.caption).lineLimit(3).foregroundStyle(AppTheme.muted) }; Spacer() }.padding(10).background(AppTheme.panel).clipShape(RoundedRectangle(cornerRadius: 22)) }
}

struct EpisodeRail: View { let title: String; let episodes: [Episode]
    var body: some View { VStack(alignment: .leading, spacing: 12) { Text(title).font(.title3.bold()).padding(.horizontal, 20); ScrollView(.horizontal, showsIndicators: false) { LazyHStack(spacing: 14) { ForEach(episodes) { episode in NavigationLink { PlayerScreen(episode: episode, playlist: CatalogData.theGoodDoctor.allEpisodes) } label: { CompactEpisodeCard(episode: episode) }.buttonStyle(.plain) }.padding(.horizontal, 20) } } } }
}

struct CompactEpisodeCard: View { @EnvironmentObject private var library: LibraryStore; let episode: Episode
    var body: some View { VStack(alignment: .leading, spacing: 8) { Artwork(title: episode.code, height: 105).frame(width: 190).overlay(alignment: .bottom) { if let progress = library.entry(for: episode) { ProgressBar(value: progress.fraction).padding(10) } }; Text(episode.title).font(.subheadline.weight(.semibold)).lineLimit(1); Text(episode.code).font(.caption).foregroundStyle(AppTheme.muted) }.frame(width: 190) }
}
