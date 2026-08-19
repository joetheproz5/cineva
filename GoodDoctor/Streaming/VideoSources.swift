import Foundation

/// Development-only public sample HLS stream. Replace entries with streams you are authorized to play.
enum VideoSources {
    private static let demoURL = URL(string: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8")!
    static let provider = DirectURLVideoProvider(sources: Dictionary(uniqueKeysWithValues: CatalogData.theGoodDoctor.allEpisodes.map {
        ($0.id, StreamSource(url: demoURL, headers: [:], subtitles: [], qualities: [VideoQuality(id: "auto", label: "Auto", url: demoURL)]))
    }))
}
