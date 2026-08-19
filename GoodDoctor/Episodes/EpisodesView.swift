import SwiftUI

struct EpisodesView: View {
    @State private var query = ""; private let series = CatalogData.theGoodDoctor
    private var results: [Episode] { guard !query.isEmpty else { return series.allEpisodes }; return series.allEpisodes.filter { $0.title.localizedCaseInsensitiveContains(query) || $0.code.localizedCaseInsensitiveContains(query) || "Season \($0.season)".localizedCaseInsensitiveContains(query) } }
    var body: some View { List {
        Section { NavigationLink { SeriesView(series: series) } label: { SeriesCard(series: series) }.listRowBackground(AppTheme.background) }
        Section("Episodes") { ForEach(results) { episode in NavigationLink { PlayerScreen(episode: episode, playlist: series.allEpisodes) } label: { VStack(alignment: .leading) { Text("\(episode.code) · \(episode.title)"); Text(episode.synopsis).font(.caption).lineLimit(1).foregroundStyle(AppTheme.muted) } }.listRowBackground(AppTheme.panel) } }
    }.scrollContentBackground(.hidden).background(AppTheme.background).navigationTitle("Episodes").searchable(text: $query, prompt: "Search episodes") }
}
