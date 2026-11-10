// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SEVEN",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "SEVEN", targets: ["SEVEN"])
    ],
    targets: [
        .executableTarget(
            name: "SEVEN",
            path: "Sources",
            resources: [.copy("Resources")],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit")
            ]
        )
    ]
)
