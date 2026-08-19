import SwiftUI

struct SettingsView: View { @EnvironmentObject private var settings: SettingsStore; @EnvironmentObject private var library: LibraryStore
    var body: some View { Form { Section("Playback") { Toggle("Autoplay next episode", isOn: $settings.autoplay); Toggle("Remember playback position", isOn: $settings.rememberPosition); Toggle("Cellular playback", isOn: $settings.cellularPlayback); Picker("Default quality", selection: $settings.quality) { Text("Auto").tag("Auto"); Text("High").tag("High"); Text("Data Saver").tag("Data Saver") } } Section("Library") { Button("Clear playback progress", role: .destructive) { library.clearProgress() }; Button("Reset watch history", role: .destructive) { library.clearProgress() } } Section("About") { LabeledContent("App", value: "Drift 1.0"); Text("A local, authorized-stream demo player.").foregroundStyle(AppTheme.muted) } }.scrollContentBackground(.hidden).background(AppTheme.background).navigationTitle("Settings") }
}
