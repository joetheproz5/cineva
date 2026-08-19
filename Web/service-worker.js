const SHELL = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.webmanifest", "/icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open("cineva-v1").then(cache => cache.addAll(SHELL))));
self.addEventListener("fetch", event => { if (new URL(event.request.url).origin === location.origin) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
