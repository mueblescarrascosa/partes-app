// Service worker: permite instalar la app y abrirla sin conexión (la última versión cargada).
const CACHE = "partes-v14";
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
      const diag = { hora: new Date().toISOString(), tipo: e.request.headers.get("content-type") || "", campos: [], error: "" };
      const c = await caches.open(COMPARTIDO);
      try {
        for (const k of await c.keys()) await c.delete(k);
        const fd = await e.request.formData();
        let i = 0;
        // Se aceptan archivos llegados con cualquier nombre de campo (no solo "archivos")
        for (const [campo, v] of fd.entries()) {
          const esArchivo = v && typeof v !== "string";
          diag.campos.push(esArchivo ? `${campo}: ${v.name || "?"} (${v.type || "sin tipo"}, ${v.size} bytes)` : `${campo}: texto (${String(v).slice(0, 60)})`);
          if (!esArchivo || !v.size) continue;
          await c.put(`compartido/${Date.now()}_${i}`, new Response(v, {
            headers: { "content-type": v.type || "application/octet-stream", "x-nombre": encodeURIComponent(v.name || `archivo_${i}`) },
          }));
          i++;
        }
      } catch (err) { diag.error = String(err && err.message || err); }
      try { await c.put("diagnostico", new Response(JSON.stringify(diag), { headers: { "content-type": "application/json" } })); } catch (_) { /* nada */ }
      return Response.redirect(new URL("./#/compartido", self.registration.scope).href, 303);
    })());
    return;
  }
  const cdn = url.hostname === "cdn.jsdelivr.net";
  if (e.request.method !== "GET" || (url.origin !== location.origin && !cdn)) return;
  e.respondWith(
    fetch(cdn ? e.request : e.request.url, cdn ? undefined : { cache: "no-cache", credentials: "same-origin" }).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
