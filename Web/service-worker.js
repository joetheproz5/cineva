const VERSION = "seven-v429";const DATA_CACHE = "seven-data-v1";
const IMAGE_CACHE = "seven-images-v2";
const SECURITY_SHELL=["password-policy.js?v=1","auth-security.js?v=3","auth-security.css?v=2"];
const PRIVACY_SHELL=["privacy.html","privacy.js?v=1","privacy.css?v=1","metrics.js?v=2"];
const SHELL = ["./", "index.html", "SplashSpec.js?v=5", "splash-animation.js?v=7", "splash-boot.js?v=1", "startup-styles.js?v=2", "styles.css?v=235", "auth.css?v=293", "ui.css?v=315", "player-security.js?v=246", "profile-stats.js?v=1", "catalog-browser.js?v=1", "search-engine.js?v=1", "recommendations.js?v=1", "series-tracker.js?v=1", "progress-tools.js?v=1", "series-tracker-ui.js?v=5", "progress-ui.js?v=2", "devices.js?v=2", "title-discovery.js?v=1", "title-discovery-ui.js?v=2", "title-discovery.css?v=3", "hero-spotlight.js?v=1", "hero-spotlight.css?v=1", "age-ratings.js?v=1", "age-ratings.css?v=1", "settings-sync.js?v=1", "settings-sync-ui.js?v=4", "settings-sync.css?v=1", "undo-actions.js?v=1", "undo-actions.css?v=1", "settings-ui.js?v=4", "settings-ui.css?v=3", "app.js?v=429", "manifest.webmanifest", "icon.svg", "assets/seven-logo-red.png", "assets/seven-logo-red-download.webp", "assets/seven-wordmark-v2.png", "assets/seven-wordmark.svg", "assets/icons/google-g.svg", "assets/discord-symbol.svg", "assets/avatars/red-panda.png", "assets/avatars/astronaut.webp", "assets/avatars/black-cat.webp", "assets/avatars/dino.webp", "assets/avatars/duck.webp", "assets/avatars/red-panda.webp", "assets/avatars/robot.webp", "assets/poster-placeholder.svg", "assets/still-placeholder.svg", "assets/profile-placeholder.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll([...SHELL,...SECURITY_SHELL,...PRIVACY_SHELL])).then(() => self.skipWaiting())));
self.addEventListener("message", event => { if (event.data?.type === "SEVEN_SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => ![VERSION, DATA_CACHE, IMAGE_CACHE].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body:event.data?.text() || "A title on your list has reached its release date." }; }
  const target = new URL(payload.url || "./", self.registration.scope);
  if (target.origin !== self.location.origin) target.href = self.registration.scope;
  event.waitUntil(self.registration.showNotification(payload.title || "SEVEN · Release day", {
    body:payload.body || "A title you follow has reached its listed release date.",
    icon:new URL("assets/icon-192.png", self.registration.scope).href,
    badge:new URL("assets/icon-192.png", self.registration.scope).href,
    tag:payload.tag || `seven-release-${Date.now()}`,
    data:{ url:target.href }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.registration.scope);
  if (target.origin !== self.location.origin) target.href = self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target.href);
      return existing.focus();
    }
    return self.clients.openWindow(target.href);
  }));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Player proxy and live API routes must always hit the network — never answer from a cache.
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;
  if (url.origin === "https://image.tmdb.org") {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
      } catch { /* Storage restrictions must not block artwork from the network. */ }
      const response = await fetch(event.request);
      if (cache && (response.ok || response.type === "opaque")) {
        // Return the image immediately, even if the cache is full or unavailable.
        const copy = response.clone();
        event.waitUntil((async () => {
          try {
            await cache.put(event.request, copy);
            const keys = await cache.keys();
            await Promise.all(keys.slice(0, Math.max(0, keys.length - 120)).map(key => cache.delete(key)));
          } catch { /* Caching is optional; loading artwork is not. */ }
        })());
      }
      return response;
    })());
    return;
  }
  if (url.origin === location.origin && url.pathname.startsWith("/api/tmdb/")) {
    // Never approve a restricted title using an indefinitely cached offline classification.
    if (/\/(release_dates|content_ratings)$/.test(url.pathname)) { event.respondWith(fetch(event.request)); return; }
    event.respondWith(caches.open(DATA_CACHE).then(async cache => {
      try { const response = await fetch(event.request); if (response.ok) cache.put(event.request, response.clone()); return response; }
      catch { const cached = await cache.match(event.request); if (cached) return cached; throw new Error("No cached SEVEN data is available."); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  const appPath = url.pathname.slice(scopePath.length) || "/";
  // Verification pages must not be saved as navigations or replaced by stale app shells.
  if (["/verify-email", "/verify-email.html", "/oauth-callback.html"].includes(appPath)) { event.respondWith(fetch(event.request, { cache:"no-store" })); return; }
  const appShell = event.request.mode === "navigate" || ["/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js"].includes(appPath);
  if (appShell) event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreSearch:true });
    const refresh = fetch(event.request, { cache:"reload" }).then(async response => {
      if (response.ok) {
        const shellCache = await caches.open(VERSION);
        await shellCache.put(event.request, response.clone());
      }
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(refresh.then(() => {}));
      return cached;
    }
    const response = await refresh;
    return response || await caches.match(event.request, { ignoreSearch:true }) || new Response("SEVEN is not available offline yet.", { status:503, headers:{ "Content-Type":"text/plain; charset=utf-8" } });
  })());
  else event.respondWith(caches.match(event.request, { ignoreSearch:true }).then(cached => cached || fetch(event.request)));
});
