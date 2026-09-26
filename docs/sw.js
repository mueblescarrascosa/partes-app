// Service worker: permite instalar la app y abrirla sin conexión (la última versión cargada).
const CACHE = "partes-v12";
const COMPARTIDO = "partes-compartido";
const BASE = ["./", "index.html", "styles.css", "js/app.js", "js/api.js", "js/util.js", "js/pdf.js", "js/config.js",
"manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== COMPARTIDO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre la versión más nueva); si no hay conexión, caché.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Archivos compartidos desde otras apps (WhatsApp, Galería, Gmail...) con "Compartir > Partes"
  if (e.request.method === "POST" && url.pathname.endsWith("/compartir")) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const files = fd.getAll("archivos").filter((f) => f && typeof f !== "string" && f.size);
        const c = await caches.open(COMPARTIDO);
        for (const k of await c.keys()) await c.delete(k);
        await Promise.all(files.map((f, i) => c.put(`compartido/${Date.now()}_${i}`, new Response(f, {
          headers: { "content-type": f.type || "application/octet-stream", "x-nombre": encodeURIComponent(f.name || `archivo_${i}`) },
        }))));
      } catch (err) { console.error(err); }
      return Response.redirect(new URL("./#/compartido", self.registration.scope).href, 303);
    })());
    return;
  }
  const cdn = url.hostname === "cdn.jsdelivr.net";
  if (e.request.method !== "GET" || (url.origin !== location.origin && !cdn)) return;
  e.respondWith(
    fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
