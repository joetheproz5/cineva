import SwiftUI

struct RootView: View {
    enum Tab: Hashable { case home, episodes, downloads, settings }
    @State private var selection: Tab = .home
    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { HomeView() }.tabItem { Label("Home", systemImage: "house.fill") }.tag(Tab.home)
            NavigationStack { EpisodesView() }.tabItem { Label("Episodes", systemImage: "rectangle.stack.fill") }.tag(Tab.episodes)
            NavigationStack { DownloadsView() }.tabItem { Label("Downloads", systemImage: "arrow.down.circle.fill") }.tag(Tab.downloads)
            NavigationStack { SettingsView() }.tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag(Tab.settings)
        }.tint(AppTheme.accent).toolbarBackground(AppTheme.background, for: .tabBar).toolbarBackground(.visible, for: .tabBar)
    }
}
