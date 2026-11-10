import SwiftUI

struct RootView: View {
    enum Tab: Hashable { case home, episodes, downloads, settings }
    @EnvironmentObject private var settings: SettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selection: Tab = .home
    @State private var showStartupSplash = UserDefaults.standard.object(forKey: "seven.startup.intro.enabled") as? Bool ?? true
    @State private var homeOpacity = 0.0
    @State private var homeScale = 1.02
    @State private var splashVersion = SEVENStartupSplashSpec.launchVersion()

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { HomeView() }.tabItem { Label("Home", systemImage: "house.fill") }.tag(Tab.home)
            NavigationStack { EpisodesView() }.tabItem { Label("Episodes", systemImage: "rectangle.stack.fill") }.tag(Tab.episodes)
            NavigationStack { DownloadsView() }.tabItem { Label("Downloads", systemImage: "arrow.down.circle.fill") }.tag(Tab.downloads)
            NavigationStack { SettingsView() }.tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag(Tab.settings)
        }
        .opacity(showStartupSplash ? homeOpacity : 1)
        .scaleEffect(showStartupSplash ? homeScale : 1)
        .accessibilityHidden(showStartupSplash)
        .tint(AppTheme.accent)
        .toolbarBackground(AppTheme.background, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .background(SEVENStartupSplashSpec.background.ignoresSafeArea())
        .overlay {
            if showStartupSplash {
                SEVENStartupSplashView(
                    version: splashVersion,
                    reducedMotion: reduceMotion,
                    soundEnabled: settings.startupSound,
                    onExitStart: { delay, duration in
                        DispatchQueue.main.asyncAfter(deadline: .now() + delay / 1_000) {
                            withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: duration / 1_000)) {
                                homeOpacity = 1
                                homeScale = 1
                            }
                        }
                    },
                    onFinish: {
                        showStartupSplash = false
                        UIAccessibility.post(notification: .screenChanged, argument: nil)
                    }
                )
                .background(SEVENStartupSplashSpec.background)
                .ignoresSafeArea()
                .zIndex(10)
            }
        }
    }
}
