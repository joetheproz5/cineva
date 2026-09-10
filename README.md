# Cineva

Cineva is a personal iPhone and Android streaming client for content the account holder is authorized to show. Version 1 provides a premium dark catalog for *The Good Doctor*, episode browsing, watch-progress storage, and an embedded Vidking player.

## Web player

The SEVEN web app plays titles through cloud-hosted embed players — VidLink, Vidking, VidSrc, and 2Embed — selectable from the player's provider menu in the top bar. Playback progress, next-episode, and watch-together features work the same across all of them.

## Player safety and platform limits

- The web/PWA uses direct cross-origin provider iframes. It does not proxy, rewrite, or inspect provider media requests. A website service worker cannot reliably filter requests made inside a foreign iframe.
- Progress messages are accepted only when they come from the active iframe, match the selected provider's exact origin, and contain finite, sensible time and duration values.
- The Android WebView blocks unsolicited new windows and cross-site top-level navigation. The iOS player view does the same and only forwards valid player events from its configured provider origin.
- Browser-level filtering of resources inside an embedded cross-origin player requires a separately installed browser extension; it is not a capability claimed by the web app.

### Chrome/Edge popup guard

For browser and PWA use, [CompanionExtension](CompanionExtension) is an optional, local Manifest V3 extension that blocks new windows and top-level navigations initiated by the configured player domains. Its exact install steps are in [CompanionExtension/README.md](CompanionExtension/README.md). It is deliberately limited to popup protection: it does not proxy, rewrite, inspect, or store media traffic.

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

## Run on an iPhone without a Mac

The [Web](Web) directory contains an installable Cineva web app. From this Windows PC, run `node Web/server.js`, then open `http://YOUR-PC-IP:4174` in Safari on an iPhone connected to the same Wi-Fi. Use Share → **Add to Home Screen** to create a Cineva home-screen app. A public HTTPS host is required for offline PWA caching; local Wi-Fi mode works for live use.

## Enable TMDB catalog, posters, descriptions, and search

1. Create a TMDB account and open its API settings.
2. Copy the **API Read Access Token** (Bearer token), not your password.
3. Copy [tmdb.config.example.json](Web/tmdb.config.example.json) to `Web/tmdb.local.json` and paste the token as `bearerToken`.
4. Refresh Cineva in Safari. The local server reads the token file on each request, so no restart is needed.

The local config file is ignored by Git and the server keeps the token off the iPhone; the web app only calls its local `/api/tmdb` proxy. TMDB supplies the metadata, posters, descriptions, search, popular/trending lists, newly released movies, and correct season/episode names. Vidking remains the configured playback embed.

## Accounts and Supabase sync

1. In Supabase, open **SQL Editor** and run [supabase.schema.sql](Web/supabase.schema.sql). It uses Supabase's managed `auth.users` accounts, creates Cineva's linked `public.profiles` table automatically for each new account, and adds an RLS-protected per-user playback-progress table.
2. Copy [supabase.config.example.json](Web/supabase.config.example.json) to `Web/supabase.local.json`.
3. In Supabase **Settings → API Keys**, copy the Project URL and the **publishable/anon** key into that local file. Never use the `service_role` key.
4. In **Authentication → Providers → Email**, enable Confirm email when you are ready to require email verification. If using a public HTTPS deployment, add its URL to the Supabase redirect allow-list and set `emailRedirectTo` in the local config.

The account system supports email/password sign-up and sign-in. When the user is signed in, Cineva writes watch position, duration, completion state, title, and timestamp to Supabase and reloads them on the next signed-in session. The private `supabase.local.json` config is ignored by Git.

## Project structure

```
GoodDoctor/   SwiftUI iOS app, WebKit player bridge, persistence, catalog UI
Android/      Kotlin/Compose Android app and WebView player bridge
```

## Important

You are responsible for maintaining the necessary content rights and complying with the embedded provider’s terms. Cineva does not scrape sites, extract stream URLs, bypass DRM, or circumvent access controls.
