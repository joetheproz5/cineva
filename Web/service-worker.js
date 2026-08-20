const VERSION = "seven-v89";
const SHELL = ["/", "/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js", "/manifest.webmanifest", "/icon.svg", "/assets/seven-logo-red.png", "/assets/avatars/red-panda.png", "/assets/avatars/black-cat.png", "/assets/avatars/astronaut.png", "/assets/avatars/dino.png", "/assets/avatars/duck.png", "/assets/avatars/robot.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL).then(() => self.skipWaiting()))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  const appShell = event.request.mode === "navigate" || ["/index.html", "/styles.css", "/auth.css", "/ui.css", "/app.js"].includes(url.pathname);
  if (appShell) event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request, { ignoreSearch:true })));
  else event.respondWith(caches.match(event.request, { ignoreSearch:true }).then(cached => cached || fetch(event.request)));
});
