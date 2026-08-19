import SwiftUI

@main
struct CinevaApp: App {
    @StateObject private var library = LibraryStore()
    @StateObject private var settings = SettingsStore()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(library)
                .environmentObject(settings)
                .preferredColorScheme(.dark)
        }
    }
}
