/* Trainingslogboek service worker
   - navigatie + app.js: network-first, zodat updates aankomen
   - overige eigen bestanden: stale-while-revalidate
   - externe modules (esm.sh): cache-first, want die versies staan vast
   - fallback naar index.html ALLEEN voor navigatieverzoeken            */
const VERSION = "v5";
const SHELL = `shell-${VERSION}`;
const VENDOR = `vendor-${VERSION}`;
const CORE = ["./", "./index.html", "./app.js", "./manifest.webmanifest", "./icon.svg",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL)
    .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== VENDOR).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const fresh = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    // cache: "reload" slaat de HTTP-cache van de browser over,
    // anders krijgen we een oude app.js terug van GitHub Pages.
    const res = await fetch(req, { cache: "reload" });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
};

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Externe modules: cache-first. Versienummers staan in de URL, dus die verouderen niet.
  if (url.origin !== self.location.origin) {
    event.respondWith(caches.open(VENDOR).then(async cache => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone());
      return res;
    }).catch(() => caches.match(request)));
    return;
  }

  // Navigatie: netwerk eerst, anders de opgeslagen index.html.
  if (request.mode === "navigate") {
    event.respondWith(fresh(request, SHELL).catch(() => caches.match("./index.html")));
    return;
  }

  // Eigen app-code: netwerk eerst, zodat een nieuwe versie meteen aankomt.
  if (url.pathname.endsWith("/app.js") || url.pathname.endsWith("/manifest.webmanifest") || url.pathname.endsWith("/sw.js")) {
    event.respondWith(fresh(request, SHELL));
    return;
  }

  // Rest: uit de cache, en op de achtergrond verversen. Geen index.html-fallback.
  event.respondWith(caches.open(SHELL).then(async cache => {
    const hit = await cache.match(request);
    const net = fetch(request).then(res => { if (res && res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
