# Drift — authorized streaming demo for iPhone

Drift is a native SwiftUI streaming-app starter with a polished dark interface, focused in version 1 on a single series catalog entry, *The Good Doctor*. It is an engineering demo: it does **not** include, discover, scrape, or bypass access controls for copyrighted episodes.

## What works

- Premium home, series, seasons, episode browsing, and search
- AVPlayer / AVPlayerViewController playback (native seek, full screen, AirPlay and PiP controls when supported)
- Resume progress stored in `UserDefaults`; episodes are marked finished at 90%
- Previous/next episode routes and 10-second seek controls
- Error and retry state for unavailable streams
- Local favorites, settings, and download-library UI architecture
- Provider abstraction: `LocalVideoProvider`, `DirectURLVideoProvider`, and `AuthorizedRemoteProvider`

## Requirements

- macOS with current Xcode (iOS 17.0+ deployment target)
- An Apple ID for device signing

## Open and install on an iPhone

1. Copy the project to a Mac and open `GoodDoctor.xcodeproj` in Xcode.
2. Select the **Drift** target, then set a unique Bundle Identifier and your Team under **Signing & Capabilities**.
3. Connect your iPhone, choose it as the run destination, and press Run.
4. If prompted on the device, trust the developer certificate in Settings → General → VPN & Device Management.

Free Apple development signing is sufficient for personal testing, but provisions expire periodically and some capabilities may require a paid Apple Developer membership.

## Configure authorized streams

Edit [VideoSources.swift](GoodDoctor/Streaming/VideoSources.swift). The included Apple HLS URL is a **public development demo** so player UI works without a media account. Replace the mapping with URLs you are licensed/authorized to play:

```swift
"the-good-doctor-s01e01": StreamSource(
    url: URL(string: "https://your-authorized-cdn.example/episode.m3u8")!,
    headers: [:], subtitles: [], qualities: []
)
```

Do not use the third-party host names displayed in the supplied image unless you independently control the content and have every necessary right to distribute it. Drift does not implement host extraction, scraping, DRM bypass, or embedded unauthorized streams.

## Architecture

```
GoodDoctor/
  App/            app entry, navigation
  Models/         catalog, episode, stream and persistence models
  Home/ Series/ Episodes/  browsing features
  Player/         AVPlayer integration and playback lifecycle
  Streaming/      provider abstraction and authorized URL configuration
  Downloads/      offline-library presentation architecture
  Persistence/    UserDefaults-backed history, favorites, settings
  Components/     reusable visual components
```

### Add content

Add a `Series` plus `Season` and `Episode` records to a catalog source such as `CatalogData`. Map its episode identifiers in `VideoSources` (or provide them from your authorized backend). The UI uses generic models and is not coupled to a particular host.

### Metadata and downloads

For production, implement a `MetadataService` using a rights-compliant API and cache its Codable response on disk. Use `AVAssetDownloadURLSession` behind the existing downloads model for legitimate offline HLS downloads; entitlement and server support may be required.

## Security

Copy `Config.example.xcconfig` to `Config.xcconfig` for future secrets. The actual config is ignored by Git. Never commit signing certificates, provisioning profiles, or private stream credentials.

## Limitations

This repository intentionally ships placeholder artwork and public demo media only. Real-series artwork, metadata enrichment, content licenses, server authentication, and HLS offline download execution are external product responsibilities.
