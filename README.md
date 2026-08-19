# Cineva

Cineva is a personal iPhone and Android streaming client for content the account holder is authorized to show. Version 1 provides a premium dark catalog for *The Good Doctor*, episode browsing, watch-progress storage, and an embedded Vidking player.

## Platforms

- **iPhone:** [GoodDoctor.xcodeproj](GoodDoctor.xcodeproj) — the Xcode target and on-device name are **Cineva**.
- **Android:** [Android](Android) — a native Kotlin/Jetpack Compose project with the same player URL configuration.

## Embedded-player configuration

The iPhone configuration is in [VidkingConfiguration.swift](GoodDoctor/Streaming/VidkingConfiguration.swift). It constructs the provider-documented TV route:

```
https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}
```

The current `seriesTMDBID` is `71712` and the brand color is Cineva lime. Change only that identifier if you are authorized to display a different series. iOS passes the documented `color`, `autoPlay`, `nextEpisode`, `episodeSelector`, and saved `progress` parameters. The Android equivalent is in [MainActivity.kt](Android/app/src/main/java/com/example/cineva/MainActivity.kt).

The embedded page controls native playback/full-screen behavior. Cineva listens for the documented browser player events and stores time/duration locally so an episode resumes from its last position.

## Run on iPhone

1. Copy the repository to a Mac and open `GoodDoctor.xcodeproj` with Xcode 16 or later.
2. Select the **Cineva** target, set a unique bundle identifier, and choose your Apple ID under **Signing & Capabilities**.
3. Connect your iPhone, select it as the run destination, and press Run.

## Run on Android

1. Open the `Android` directory in current Android Studio and allow Gradle sync to download dependencies.
2. If Android Studio asks, install Android SDK Platform 35.
3. Connect an Android phone with USB debugging enabled, select it, then press Run.

## Project structure

```
GoodDoctor/   SwiftUI iOS app, WebKit player bridge, persistence, catalog UI
Android/      Kotlin/Compose Android app and WebView player bridge
```

## Important

You are responsible for maintaining the necessary content rights and complying with the embedded provider’s terms. Cineva does not scrape sites, extract stream URLs, bypass DRM, or circumvent access controls.
