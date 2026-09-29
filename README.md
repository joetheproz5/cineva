# Cineva

Cineva is a personal iPhone and Android streaming client for content the account holder is authorized to show. Version 1 provides a premium dark catalog for *The Good Doctor*, episode browsing, watch-progress storage, and embedded web players.

## Web player

The SEVEN web app plays titles through cloud-hosted embed players — VidLink, Vidking, VidSrc, and 2Embed — selectable from the player's provider menu in the top bar. Playback progress, next-episode, and watch-together features work the same across all of them.

## Player safety and platform limits

- The web/PWA uses direct cross-origin provider iframes. It does not proxy, rewrite, or inspect provider media requests. A website service worker cannot reliably filter requests made inside a foreign iframe.
- Progress messages are accepted only when they come from the active iframe, match the selected provider's exact origin, and contain finite, sensible time and duration values.
- The Android WebView blocks unsolicited new windows and cross-site top-level navigation. The iOS player view does the same and only forwards valid player events from its configured provider origin.
- The Android wrapper also filters matching ad/tracker host requests inside its own WebView using a cached, periodically refreshed [AdGuard DNS filter](https://github.com/AdguardTeam/AdGuardSDNSFilter), distributed under GPL-3.0. This is app-only host filtering, not a system-wide VPN or the full uBlock Origin extension; unsupported or context-specific rules are ignored to avoid guessing and overblocking.
- Browser-level filtering of resources inside an embedded cross-origin player requires a separately installed browser extension; it is not a capability claimed by the web app.
- The Windows shell bundles the official uBlock Origin Lite Edge extension, with its uBlock, EasyList, and EasyPrivacy rules, for content and network filtering inside the embedded browser. Right-click the otherwise minimal title bar to enable or disable it. The extension is shipped under GPL-3.0; see `Windows/Seven.Desktop/ThirdPartyNotices.txt`.

### Chrome/Edge popup guard

For browser and PWA use, [CompanionExtension](CompanionExtension) is an optional, local Manifest V3 extension that blocks new windows and top-level navigations initiated by the configured player domains. Its exact install steps are in [CompanionExtension/README.md](CompanionExtension/README.md). It is deliberately limited to popup protection: it does not proxy, rewrite, inspect, or store media traffic.

The desktop wrappers live in [Windows/Seven.Desktop](Windows/Seven.Desktop) and [Mac](Mac). The Windows app uses WPF and Microsoft's WebView2; the macOS app is a native SwiftUI/WebKit shell built for Intel and Apple Silicon. Both keep SEVEN in the app window and send outside links to the default browser. The combined [desktop build workflow](.github/workflows/desktop-build.yml) builds both installers and publishes them together, so their download links remain available from the same latest GitHub Release. Windows may display SmartScreen for the unsigned installer. The macOS build is unsigned and not notarized; Gatekeeper may require Control-click → Open for the first launch.

## Platforms

- **iPhone:** [GoodDoctor.xcodeproj](GoodDoctor.xcodeproj) — the Xcode target and on-device name are **Cineva**.
- **Android:** [Android](Android) — a native Kotlin/Jetpack Compose project with the same player URL configuration.
- **Mac:** [Mac](Mac) — a native SwiftUI/WebKit app that wraps the SEVEN web experience.
- **Windows:** [Windows/Seven.Desktop](Windows/Seven.Desktop) — a native WPF/WebView2 desktop wrapper.

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

## Run on Mac

1. Open `Mac` in Terminal on a Mac with Swift 5.9 or later.
2. Run `swift build --configuration release` to build the native wrapper.
3. For the distributable universal app, use the `Build SEVEN desktop apps` GitHub Actions workflow; it packages the Apple Silicon and Intel builds into a DMG.

## Run on an iPhone without a Mac

The [Web](Web) directory contains an installable Cineva web app. From this Windows PC, run `node Web/server.js`, then open `http://YOUR-PC-IP:4174` in Safari on an iPhone connected to the same Wi-Fi. Use Share → **Add to Home Screen** to create a Cineva home-screen app. A public HTTPS host is required for offline PWA caching; local Wi-Fi mode works for live use.

## Enable TMDB catalog, posters, descriptions, and search

1. Create a TMDB account and open its API settings.
2. Copy the **API Read Access Token** (Bearer token), not your password.
3. Copy [tmdb.config.example.json](Web/tmdb.config.example.json) to `Web/tmdb.local.json` and paste the token as `bearerToken`.
4. Refresh Cineva in Safari. The local server reads the token file on each request, so no restart is needed.

The local config file is ignored by Git and the server keeps the token off the iPhone; the web app only calls its local `/api/tmdb` proxy. TMDB supplies the metadata, posters, descriptions, search, popular/trending lists, newly released movies, and correct season/episode names. The web app offers VidSrc and 2Embed playback embeds, selectable in Settings.

## Accounts and Supabase sync

1. In Supabase, open **SQL Editor** and run [supabase.schema.sql](Web/supabase.schema.sql). It uses Supabase's managed `auth.users` accounts, creates Cineva's linked `public.profiles` table automatically for each new account, and adds an RLS-protected per-user playback-progress table.
2. Copy [supabase.config.example.json](Web/supabase.config.example.json) to `Web/supabase.local.json`.
3. In Supabase **Settings → API Keys**, copy the Project URL and the **publishable/anon** key into that local file. Never use the `service_role` key.
4. In **Authentication → Providers → Email**, enable Confirm email when you are ready to require email verification. If using a public HTTPS deployment, add its URL to the Supabase redirect allow-list and set `emailRedirectTo` in the local config.

The account system supports email/password sign-up and sign-in. When the user is signed in, Cineva writes watch position, duration, completion state, title, and timestamp to Supabase and reloads them on the next signed-in session. The private `supabase.local.json` config is ignored by Git.

## SEVEN Studio dashboard

The private operations dashboard is available at /dashboard. It shows daily active users split into guests and signed-in accounts, all-time visitor-days, account totals and signup trends, install-button clicks by platform, and watch time split by guest/account. All-time visitor-days sum each day's unique counts (repeat users count again on a later day); visits recorded before the split remain unclassified. Historical account watch time is estimated from a one-time aggregate of saved playback positions; guest history cannot be reconstructed because it only existed locally, so guest and account live watch time starts after deployment. No member emails, account IDs, titles, or per-account viewing activity are stored in analytics. Daily visitor HMACs expire after 31 days. Do Not Track and Global Privacy Control are respected.

Setup and updates:

1. In Supabase SQL Editor, run [supabase-dashboard.sql](Web/supabase-dashboard.sql). It is safe to run again when dashboard metrics are updated.
2. In the Cloudflare Pages project, add **SUPABASE_SECRET_KEY** as an encrypted secret. Keep it server-side; never put it in **Web/** or client code. The legacy **SUPABASE_SERVICE_ROLE_KEY** name is also accepted if that is what your project already has.
3. Add **SEVEN_ADMIN_PASSWORD** as an encrypted secret. Use a unique passphrase of at least 16 characters. The login name defaults to **admin**; optionally set **SEVEN_ADMIN_USERNAME** as a regular Pages variable to change it.
4. Add **SEVEN_DASHBOARD_SECRET** as an encrypted secret containing a unique random value of at least 32 characters. It signs the short-lived admin session and daily visitor hashes.
5. Set **SUPABASE_URL** and **SUPABASE_PUBLISHABLE_KEY** as Pages variables, then redeploy so the Functions receive the new values. The publishable key is not a secret; the secret API key remains encrypted and server-only.

The dashboard intentionally does not ship a default password. Cloudflare Pages Functions read these values from server-side environment bindings; Supabase's secret key can bypass row-level security, so it must stay out of the browser and source control. See [Cloudflare Pages bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/) and [Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys).

## Project structure

```
GoodDoctor/   SwiftUI iOS app, WebKit player bridge, persistence, catalog UI
Android/      Kotlin/Compose Android app and WebView player bridge
```

## Important

You are responsible for maintaining the necessary content rights and complying with the embedded provider’s terms. Cineva does not scrape sites, extract stream URLs, bypass DRM, or circumvent access controls.
