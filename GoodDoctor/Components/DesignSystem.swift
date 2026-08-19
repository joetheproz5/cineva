import SwiftUI

enum AppTheme { static let background = Color(red: 0.025, green: 0.055, blue: 0.07); static let panel = Color(red: 0.055, green: 0.09, blue: 0.11); static let accent = Color(red: 0.80, green: 1.0, blue: 0.28); static let muted = Color.white.opacity(0.62) }

struct Artwork: View {
    let title: String; var height: CGFloat = 180
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [.indigo.opacity(0.78), .teal.opacity(0.36), .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle().fill(AppTheme.accent.opacity(0.22)).frame(width: height * 1.1).blur(radius: 35).offset(x: height * 0.4, y: -height * 0.25)
            Text(title).font(.system(size: max(18, height / 8), weight: .bold, design: .rounded)).padding(18).foregroundStyle(.white)
        }.frame(maxWidth: .infinity).frame(height: height).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct ProgressBar: View {
    let value: Double
    var body: some View { GeometryReader { proxy in
        ZStack(alignment: .leading) { Capsule().fill(.white.opacity(0.18)); Capsule().fill(AppTheme.accent).frame(width: max(4, proxy.size.width * value)) }
    }.frame(height: 4) }
}

struct PillButton: View {
    let title: String; let icon: String; var filled = false; let action: () -> Void
    var body: some View { Button(action: action) { Label(title, systemImage: icon).font(.headline).frame(maxWidth: filled ? .infinity : nil).padding(.horizontal, 18).padding(.vertical, 13).background(filled ? AppTheme.accent : .white.opacity(0.10)).foregroundStyle(filled ? .black : .white).clipShape(Capsule()) } }
}

struct EmptyState: View { let icon: String; let title: String; let message: String
    var body: some View { ContentUnavailableView { Label(title, systemImage: icon) } description: { Text(message) }.foregroundStyle(.white) }
}
