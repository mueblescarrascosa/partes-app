// Service worker: permite instalar la app y abrirla sin conexión (la última versión cargada).
const CACHE = "partes-v8";
const BASE = ["./", "index.html", "styles.css", "js/app.js", "js/api.js", "js/util.js", "js/pdf.js", "js/config.js",
"manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre la versión más nueva); si no hay conexión, caché.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const cdn = url.hostname === "cdn.jsdelivr.net";
  if (e.request.method !== "GET" || (url.origin !== location.origin && !cdn)) return;
  e.respondWith(
    fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
