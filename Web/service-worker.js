const VERSION = "seven-v352";const DATA_CACHE = "seven-data-v1";
const IMAGE_CACHE = "seven-images-v1";
const SHELL = ["./", "index.html", "styles.css?v=235", "auth.css?v=273", "ui.css?v=299", "player-security.js?v=245", "profile-stats.js?v=1", "app.js?v=352", "manifest.webmanifest", "icon.svg", "assets/seven-logo-red.png", "assets/seven-logo-red-download.webp", "assets/seven-wordmark-v2.png", "assets/profile-person.svg", "assets/avatars/red-panda.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
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
    tag:`seven-release-${Date.now()}`,
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
    event.respondWith(caches.open(IMAGE_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok || response.type === "opaque") { await cache.put(event.request, response.clone()); const keys = await cache.keys(); await Promise.all(keys.slice(0, Math.max(0, keys.length - 120)).map(key => cache.delete(key))); }
      return response;
    }));
    return;
  }
  if (url.origin === location.origin && url.pathname.startsWith("/api/tmdb/")) {
    event.respondWith(caches.open(DATA_CACHE).then(async cache => {
      try { const response = await fetch(event.request); if (response.ok) cache.put(event.request, response.clone()); return response; }
      catch { const cached = await cache.match(event.request); if (cached) return cached; throw new Error("No cached SEVEN data is available."); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  const appPath = url.pathname.slice(scopePath.length) || "/";
  const appShell = event.request.mode === "navigate" || ["/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js"].includes(appPath);
  if (appShell) event.respondWith(fetch(event.request, { cache:"reload" }).then(response => { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request, { ignoreSearch:true })));
  else event.respondWith(caches.match(event.request, { ignoreSearch:true }).then(cached => cached || fetch(event.request)));
});
