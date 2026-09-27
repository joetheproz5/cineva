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
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit")
            ]
        )
    ]
)
