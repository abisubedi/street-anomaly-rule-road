// Rule Road offline support. Bump VERSION whenever index.html changes so players get the new towns.
const VERSION = "rule-road-v45";
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/img/hero-sign.jpg", "/img/open-road.jpg", "/img/tape.jpg", "/js/compat.js?v=45", "/js/juice.js?v=45", "/js/mic.js?v=45", "/js/road.js?v=45", "/js/radio.js?v=45", "/js/reel.js?v=45", "/js/glovebox.js?v=45", "/js/play.js?v=45", "/js/sketch.js?v=45", "/js/share.js?v=45"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Pages: try the network first so new towns show up, fall back to the cached game offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put("/index.html", copy)); return res; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  // Narrator clips: the audio element asks for byte ranges, so cache and serve whole files by path.
  if (url.origin === location.origin && url.pathname.startsWith("/voice/")) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(url.pathname);
      if (hit) return hit;
      const res = await fetch(url.pathname);
      if (res.status === 200) c.put(url.pathname, res.clone());
      return res;
    }));
    return;
  }
  // Same-origin files and Google Fonts: serve from cache, refresh in the background.
  if (url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
