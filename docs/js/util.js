// Utilidades: imágenes, teléfonos, formato, firma
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const ESTADOS = [
  { id: "recibido",   nombre: "Recibido",   color: "#64748b" },
  { id: "contactado", nombre: "Contactado", color: "#0284c7" },
  { id: "visitado",   nombre: "Visitado",   color: "#7c3aed" },
  { id: "valorado",   nombre: "Valorado",   color: "#d97706" },
  { id: "autorizado", nombre: "Autorizado", color: "#0d9488" },
  { id: "realizado",  nombre: "Realizado",  color: "#16a34a" },
];
export const estadoInfo = (id) => ESTADOS.find((e) => e.id === id) ?? ESTADOS[0];
export const idxEstado = (id) => ESTADOS.findIndex((e) => e.id === id);

const COLORES_ASEG = {
  mapfre: "#d81e05", "santalucía": "#0055a4", santalucia: "#0055a4", "iris global": "#e4007d",
  caser: "#00843d", allianz: "#003781", axa: "#00008f", generali: "#c21b17", reale: "#004a99",
};
export const colorAseg = (a) => COLORES_ASEG[(a || "").toLowerCase()] ?? "#475569";

// ---- Teléfonos (España por defecto)
export function telLimpio(t) {
  if (!t) return "";
  let d = String(t).replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  return d;
}
export function telWhatsApp(t) {
  let d = telLimpio(t).replace("+", "");
  if (d.length === 9) d = "34" + d;
  return d;
}
export const linkLlamar = (t) => `tel:${telLimpio(t)}`;
export function linkWhatsApp(t, texto = "") {
  const num = telWhatsApp(t);
  const web = `https://wa.me/${num}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
  // En Android se puede forzar WhatsApp Business; si no está instalado, abre el enlace normal
  if (window.APP_CONFIG?.WHATSAPP_APP === "business" && /Android/i.test(navigator.userAgent)) {
    return `intent://send/?phone=${num}${texto ? "&text=" + encodeURIComponent(texto) : ""}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(web)};end`;
  }
  return web;
}
export const linkMapa = (p) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.direccion, p.codigo_postal, p.poblacion, p.provincia].filter(Boolean).join(", "))}`;

// ---- Formato
export const fFecha = (d) => d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
export const fFechaHora = (d) => d ? new Date(d).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
export const fEuros = (n) => n == null || n === "" ? "" : Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
export function hace(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const dias = Math.floor(s / 86400);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}
export const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

// ---- Archivos e imágenes
export const blobABase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = rej; r.readAsDataURL(blob);
});
export const blobADataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
});

/** Reduce una imagen a maxLado px y la devuelve como JPEG Blob */
export async function comprimirImagen(file, maxLado = 1600, calidad = 0.82) {
  const bmp = await cargarImagen(file);
  const k = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, "image/jpeg", calidad));
}
async function cargarImagen(file) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fallback */ }
  }
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => res(img); img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
/** Dimensiones de una imagen dataURL */
export const medirImagen = (src) => new Promise((res) => {
  const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 4, h: 3 }); i.src = src;
});

// ---- Firma en pantalla
export function panelFirma(canvas) {
  const ctx = canvas.getContext("2d");
  let dibujando = false, vacio = true, ultimo = null;
  const ajustar = () => {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    vacio = true;
  };
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener("pointerdown", (e) => { dibujando = true; ultimo = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dibujando) return;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo = p; vacio = false; e.preventDefault();
  });
  const fin = () => { dibujando = false; };
  canvas.addEventListener("pointerup", fin); canvas.addEventListener("pointercancel", fin);
  requestAnimationFrame(ajustar);
  return {
    limpiar: ajustar,
    get vacio() { return vacio; },
    aBlob: () => new Promise((res) => canvas.toBlob(res, "image/png")),
  };
}

// ---- Avisos
let toastT;
export function toast(msg, tipo = "") {
  let t = $("#toast");
  t.textContent = msg; t.className = "toast show " + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast"), 3200);
}

// ---- Líneas de valoración / trabajos (códigos de tarifa)
export const norm = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const importeLinea = (l) => Math.round((Number(l.cantidad) || 0) * (Number(l.precio) || 0) * (1 - (Number(l.dto) || 0) / 100) * 100) / 100;
export function totalesLineas(lineas = [], ivaPct = 0) {
  const base = Math.round(lineas.reduce((a, l) => a + importeLinea(l), 0) * 100) / 100;
  const iva = Math.round(base * (Number(ivaPct) || 0)) / 100;
  return { base, iva, total: Math.round((base + iva) * 100) / 100 };
}
export function buscarEnTarifa(tarifa, q, max = 40) {
  const t = norm(q).trim();
  if (!t) return [];
  const pals = t.split(/\s+/);
  return tarifa.filter((c) => c.activo !== false).map((c) => {
    const cod = norm(c.codigo), d = norm(c.descripcion + " " + (c.categoria || ""));
    let score = 0;
    if (cod === t) score = 100;
    else if (cod.startsWith(t)) score = 50;
    else if (pals.every((w) => d.includes(w) || cod.startsWith(w))) score = 10;
    return { c, score };
  }).filter((x) => x.score).sort((a, b) => b.score - a.score || (a.c.orden ?? 0) - (b.c.orden ?? 0)).slice(0, max).map((x) => x.c);
}

/** Para códigos "1ª Ud." devuelve el código de "Ud. adicional" que le sigue en la tarifa (o null) */
export function codigoAdicional(tarifa, codigo) {
  const c = tarifa.find((x) => x.codigo === codigo);
  if (!c || !/\b1\s*(ª|a)?\s*(ud|unidad)/i.test(c.descripcion)) return null;
  const sig = tarifa.filter((x) => (x.orden ?? 0) > (c.orden ?? 0)).sort((a, b) => a.orden - b.orden)[0];
  return sig && /adicional/i.test(sig.descripcion) ? sig : null;
}

// ---- Contador de días desde que entró el parte (verde → rojo en 60 días)
export const DIAS_TOPE = 60;
export function diasParte(p) {
  const fin = p.estado === "realizado" ? new Date(p.updated_at) : new Date();
  return Math.max(0, Math.floor((fin - new Date(p.created_at)) / 86400000));
}
export function colorDias(d) {
  const t = Math.min(d, DIAS_TOPE) / DIAS_TOPE;       // 0 → 1
  return `hsl(${Math.round(120 * (1 - t))}, 75%, ${t > 0.5 ? 42 : 38}%)`;
}
export function chipDias(p, largo = false) {
  const d = diasParte(p);
  if (p.estado === "realizado") return `<span class="dias fin" title="Días hasta terminarlo">✓ ${d} d</span>`;
  const n = d >= DIAS_TOPE ? `${DIAS_TOPE}+` : `${d}`;
  const txt = largo ? `⏱ ${n} ${d === 1 ? "día" : "días"}` : `${n} d`;
  return `<span class="dias" style="--cd:${colorDias(d)}" title="Días desde que entró">${txt}</span>`;
}

// ---- Recortar una imagen antes de leerla (devuelve Blob JPEG o null si se cancela)
export function recortarImagen(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const cap = document.createElement("div");
    cap.className = "recorte";
    cap.innerHTML = `
      <div class="recorte-cab">Ajusta el recuadro a la zona con los datos del parte</div>
      <div class="recorte-zona"><div class="recorte-lienzo"><img alt="">
        <div class="recorte-caja"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
      <div class="recorte-pie">
        <button class="btn" data-a="cancelar">Cancelar</button>
        <button class="btn" data-a="todo">Foto entera</button>
        <button class="btn primario" data-a="ok">Recortar y leer</button>
      </div>`;
    document.body.appendChild(cap);
    const img = cap.querySelector("img"), caja = cap.querySelector(".recorte-caja"), lienzo = cap.querySelector(".recorte-lienzo");
    const r = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };
    const pintar = () => Object.assign(caja.style, { left: r.x * 100 + "%", top: r.y * 100 + "%", width: r.w * 100 + "%", height: r.h * 100 + "%" });
    img.onload = pintar;
    img.src = url;
    let arrastre = null;
    const MIN = 0.08;
    caja.addEventListener("pointerdown", (e) => {
      const b = lienzo.getBoundingClientRect();
      arrastre = { h: e.target.dataset.h || "mover", x0: e.clientX, y0: e.clientY, r0: { ...r }, W: b.width, H: b.height };
      caja.setPointerCapture(e.pointerId); e.preventDefault();
    });
    caja.addEventListener("pointermove", (e) => {
      if (!arrastre) return;
      const dx = (e.clientX - arrastre.x0) / arrastre.W, dy = (e.clientY - arrastre.y0) / arrastre.H, o = arrastre.r0;
      const lim = (v, a, b) => Math.min(b, Math.max(a, v));
      if (arrastre.h === "mover") { r.x = lim(o.x + dx, 0, 1 - o.w); r.y = lim(o.y + dy, 0, 1 - o.h); }
      else {
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (arrastre.h.includes("w")) x1 = lim(o.x + dx, 0, x2 - MIN);
        if (arrastre.h.includes("e")) x2 = lim(x2 + dx, x1 + MIN, 1);
        if (arrastre.h.includes("n")) y1 = lim(o.y + dy, 0, y2 - MIN);
        if (arrastre.h.includes("s")) y2 = lim(y2 + dy, y1 + MIN, 1);
        Object.assign(r, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      }
      pintar();
    });
    const soltar = () => { arrastre = null; };
    caja.addEventListener("pointerup", soltar); caja.addEventListener("pointercancel", soltar);
    const cerrar = (v) => { cap.remove(); URL.revokeObjectURL(url); resolve(v); };
    cap.querySelector("[data-a=cancelar]").onclick = () => cerrar(null);
    cap.querySelector("[data-a=todo]").onclick = () => cerrar(blob);
    cap.querySelector("[data-a=ok]").onclick = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = Math.round(r.w * W); c.height = Math.round(r.h * H);
      c.getContext("2d").drawImage(img, r.x * W, r.y * H, c.width, c.height, 0, 0, c.width, c.height);
      c.toBlob((b) => cerrar(b), "image/jpeg", 0.92);
    };
  });
}

/** Enlace para añadir la cita a Google Calendar */
export function linkCalendario(p) {
  if (!p.fecha_cita) return "";
  const ini = new Date(p.fecha_cita), fin = new Date(ini.getTime() + 3600000);
  const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Visita ${p.aseguradora || ""} ${p.expediente || ""} - ${p.nombre || ""}`,
    dates: `${f(ini)}/${f(fin)}`,
    details: [p.averia, p.telefono && "Tel: " + p.telefono].filter(Boolean).join("\n"),
    location: [p.direccion, p.codigo_postal, p.poblacion].filter(Boolean).join(", "),
  });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

// ---------- Zonas
export const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const limpiaZ = (t) => " " + sinAcentos(t).replace(/[^a-z0-9ñ]+/g, " ").trim() + " ";
// Devuelve el nombre de la zona del parte según su población (o, si no, su dirección). "" si no encaja en ninguna.
export function zonaDe(p, zonas = window.APP_CONFIG?.ZONAS || []) {
  const pares = zonas.flatMap((z) => (z.pueblos || []).map((pu) => [limpiaZ(pu), z.nombre])).filter(([n]) => n.trim())
    .sort((a, b) => b[0].length - a[0].length);
  for (const txt of [limpiaZ(p.poblacion), limpiaZ([p.direccion, p.poblacion, p.provincia].join(" "))]) {
    if (!txt.trim()) continue;
    const hit = pares.find(([n]) => txt.includes(n));
    if (hit) return hit[1];
  }
  return "";
}
