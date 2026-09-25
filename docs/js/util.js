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
export const linkWhatsApp = (t, texto = "") =>
  `https://wa.me/${telWhatsApp(t)}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
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
