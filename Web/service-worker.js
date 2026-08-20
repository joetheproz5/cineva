const VERSION = "seven-v73";
const SHELL = ["/", "/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js", "/manifest.webmanifest", "/icon.svg", "/assets/seven-logo-red.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL).then(() => self.skipWaiting()))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => { if (new URL(event.request.url).origin === location.origin) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
