const VERSION = "seven-v106";
const DATA_CACHE = "seven-data-v1";
const IMAGE_CACHE = "seven-images-v1";
const SHELL = ["/", "/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js", "/manifest.webmanifest", "/icon.svg", "/assets/seven-logo-red.png", "/assets/seven-wordmark.png", "/assets/avatars/red-panda.png", "/assets/avatars/black-cat.png", "/assets/avatars/astronaut.png", "/assets/avatars/dino.png", "/assets/avatars/duck.png", "/assets/avatars/robot.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL).then(() => self.skipWaiting()))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => ![VERSION, DATA_CACHE, IMAGE_CACHE].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
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
  const appShell = event.request.mode === "navigate" || ["/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js"].includes(url.pathname);
  if (appShell) event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request, { ignoreSearch:true })));
  else event.respondWith(caches.match(event.request, { ignoreSearch:true }).then(cached => cached || fetch(event.request)));
});
