import { api } from "./api.js";
import {
  $, $$, esc, ESTADOS, estadoInfo, idxEstado, colorAseg, linkLlamar, linkWhatsApp, linkMapa,
  fFecha, fFechaHora, fEuros, hace, toLocalInput, blobABase64, comprimirImagen, panelFirma, toast,
  importeLinea, totalesLineas, buscarEnTarifa, codigoAdicional, chipDias, recortarImagen, linkCalendario, diasParte,
} from "./util.js";
import { generarInforme } from "./pdf.js";

const CFG = window.APP_CONFIG;
const DEST = {
  get nombre() { return CFG.DESTINO_INFORMES?.nombre || "tramitador"; },
  get telefono() { return CFG.DESTINO_INFORMES?.telefono || ""; },
};
let ajustesCargados = false;
async function cargarAjustes() {
  try {
    const a = await api.leerAjustes();
    if (a.EMPRESA) CFG.EMPRESA = { ...CFG.EMPRESA, ...a.EMPRESA };
    if (a.DESTINO_INFORMES) CFG.DESTINO_INFORMES = { ...CFG.DESTINO_INFORMES, ...a.DESTINO_INFORMES };
    if (Array.isArray(a.ASEGURADORAS) && a.ASEGURADORAS.length) CFG.ASEGURADORAS = a.ASEGURADORAS;
    if (a.MENSAJE_CLIENTE) CFG.MENSAJE_CLIENTE = a.MENSAJE_CLIENTE;
    if (a.IVA != null && a.IVA !== "") CFG.IVA = Number(a.IVA);
    ajustesCargados = true;
  } catch { /* se usan los valores de config.js */ }
}
const app = $("#app");
const S = {
  yo: null, miembros: [], partes: [],
  filtro: sessionGet("filtro") ?? "activos", busqueda: "", soloMios: sessionGet("soloMios") === "1",
  orden: sessionGet("orden") ?? "recientes", filtroAseg: sessionGet("filtroAseg") ?? "",
  borrador: null, // parte nuevo pendiente de guardar {datos, archivo, mime}
};

function sessionGet(k) { try { return localStorage.getItem("pa_" + k); } catch { return null; } }
function sessionSet(k, v) { try { localStorage.setItem("pa_" + k, v); } catch { /* nada */ } }

// ------------------------------------------------------------------ Iconos
const I = {
  phone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
  map: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  cam: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h2"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};

// ------------------------------------------------------------------ Sheet (panel inferior)
function abrirSheet(html) {
  cerrarSheet();
  const fondo = document.createElement("div");
  fondo.className = "sheet-fondo";
  fondo.innerHTML = `<div class="sheet" role="dialog"><div class="sheet-asa"></div>${html}</div>`;
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrarSheet(); });
  document.body.appendChild(fondo);
  requestAnimationFrame(() => fondo.classList.add("abierto"));
  $$("[data-cerrar]", fondo).forEach((b) => b.addEventListener("click", cerrarSheet));
  return $(".sheet", fondo);
}
function cerrarSheet() { $$(".sheet-fondo").forEach((f) => f.remove()); }

function cargando(on, texto = "Cargando…") {
  let c = $("#cargando");
  if (on) { c.querySelector("span").textContent = texto; c.classList.add("on"); } else c.classList.remove("on");
}

async function conCarga(texto, fn) {
  cargando(true, texto);
  try { return await fn(); }
  catch (e) { console.error(e); toast(e.message || "Error", "error"); throw e; }
  finally { cargando(false); }
}

// ------------------------------------------------------------------ Router
window.addEventListener("hashchange", router);
async function router() {
  cerrarSheet();
  const h = location.hash.slice(1) || "/";
  const ses = await api.sesion();
  if (!ses) return vistaLogin();
  if (!S.yo) {
    S.yo = await api.yo();
    try { S.miembros = await api.miembros(); } catch { S.miembros = []; }
  }
  if (!ajustesCargados) await cargarAjustes();
  if (api.modo === "supabase" && !S.yo?.nombre) return vistaSinAcceso();
  const [, ruta, id] = h.split("/");
  window.scrollTo(0, 0);
  if (!ruta) return vistaLista();
  if (ruta === "nuevo") return vistaFormulario(null);
  if (ruta === "parte" && id) return vistaParte(id);
  if (ruta === "editar" && id) return vistaFormulario(id);
  if (ruta === "lineas" && id) return vistaLineas(id, h.split("/")[3] || "valoracion");
  if (ruta === "papelera") return vistaPapelera();
  if (ruta === "tarifa") return S.yo?.es_admin ? vistaTarifa() : (location.hash = "/");
  if (ruta === "ajustes") return S.yo?.es_admin ? vistaAjustes() : (location.hash = "/");
  location.hash = "/";
}

// ------------------------------------------------------------------ Login
function vistaLogin() {
  app.innerHTML = `
  <div class="login">
    <div class="login-logo">${I.file}</div>
    <h1>Partes</h1>
    <p class="suave">Gestión de siniestros</p>
    <form id="fLogin" class="tarjeta">
      <label>Email<input type="email" name="email" autocomplete="username" required></label>
      <label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn primario ancho" type="submit">Entrar</button>
      <button class="btn texto ancho" type="button" id="olvido">He olvidado la contraseña</button>
    </form>
  </div>`;
  $("#fLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await conCarga("Entrando…", () => api.entrar(f.get("email"), f.get("password")));
    S.yo = null; router();
  });
  $("#olvido").addEventListener("click", async () => {
    const email = $("#fLogin [name=email]").value;
    if (!email) return toast("Escribe tu email primero");
    await conCarga("Enviando…", () => api.recuperar(email));
    toast("Te hemos enviado un email para cambiar la contraseña", "ok");
  });
}

function vistaSinAcceso() {
  app.innerHTML = `
  <div class="login"><h1>Sin acceso</h1>
    <p class="suave">Tu usuario (${esc(S.yo?.email)}) aún no está dado de alta en el equipo.<br>Pide al administrador que te añada en la tabla <b>miembros</b>.</p>
    <button class="btn" id="salir">Salir</button></div>`;
  $("#salir").onclick = async () => { await api.salir(); S.yo = null; router(); };
}

// ------------------------------------------------------------------ Lista
async function vistaLista() {
  app.innerHTML = `
  <header class="barra">
    <h1>Partes</h1>
    <div class="barra-acc">
      ${yaInstalada() ? "" : `<button class="btn peq instalar ${avisoInstalar ? "" : "oculto"}" id="btnInstalar">Instalar app</button>`}
      <button class="icono" id="recargar" aria-label="Recargar">${I.refresh}</button>
      <button class="icono" id="menuUsuario" aria-label="Usuario">${I.user}</button>
    </div>
  </header>
  ${api.modo === "demo" ? '<div class="demo">MODO DEMO · los datos solo se guardan en este navegador</div>' : ""}
  <div class="buscador">
    ${I.search}<input id="busca" type="search" placeholder="Buscar nombre, expediente, calle, teléfono…" value="${esc(S.busqueda)}">
  </div>
  <div class="chips" id="chips"></div>
  <div class="filtros">
    <label class="solo-mios"><input type="checkbox" id="soloMios" ${S.soloMios ? "checked" : ""}> Solo míos</label>
    <select id="fAseg"><option value="">Todas las aseguradoras</option>${[...new Set(S.partes.map((p) => p.aseguradora).concat(CFG.ASEGURADORAS))].filter((a) => a && a !== "Otra").map((a) => `<option ${a === S.filtroAseg ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>
    <select id="orden">
      ${[["recientes", "Últimos movidos"], ["antiguos", "Más días primero"], ["cita", "Próxima cita"], ["nuevos", "Últimos entrados"]].map(([v, t]) => `<option value="${v}" ${S.orden === v ? "selected" : ""}>${t}</option>`).join("")}
    </select>
  </div>
  <main id="lista" class="lista"><div class="vacio">Cargando…</div></main>
  <button class="fab" id="nuevo" aria-label="Nuevo parte">${I.plus}</button>`;

  $("#busca").addEventListener("input", (e) => { S.busqueda = e.target.value; pintarLista(); });
  $("#soloMios").addEventListener("change", (e) => { S.soloMios = e.target.checked; sessionSet("soloMios", S.soloMios ? "1" : "0"); pintarLista(); });
  $("#fAseg").addEventListener("change", (e) => { S.filtroAseg = e.target.value; sessionSet("filtroAseg", S.filtroAseg); pintarLista(); });
  $("#orden").addEventListener("change", (e) => { S.orden = e.target.value; sessionSet("orden", S.orden); pintarLista(); });
  $("#nuevo").addEventListener("click", menuNuevo);
  $("#recargar").addEventListener("click", cargarPartes);
  $("#menuUsuario").addEventListener("click", menuUsuario);
  $("#btnInstalar")?.addEventListener("click", instalarApp);
  await cargarPartes();
}

async function cargarPartes() {
  try { S.partes = await api.listarPartes(); }
  catch (e) { toast("No se pudieron cargar los partes: " + e.message, "error"); S.partes = []; }
  pintarLista();
}

function pintarLista() {
  const q = S.busqueda.trim().toLowerCase();
  let base = S.partes;
  if (S.soloMios) base = base.filter((p) => p.asignado_a === S.yo.user_id);
  if (S.filtroAseg) base = base.filter((p) => p.aseguradora === S.filtroAseg);
  if (q) base = base.filter((p) =>
    [p.nombre, p.expediente, p.num_encargo, p.num_siniestro, p.direccion, p.poblacion, p.telefono, p.aseguradora, p.averia, p.poliza]
      .some((v) => String(v ?? "").toLowerCase().includes(q)));

  const cuenta = (id) => base.filter((p) => p.estado === id).length;
  const chips = [
    { id: "activos", nombre: "Pendientes", n: base.filter((p) => p.estado !== "realizado").length },
    ...ESTADOS.map((e) => ({ ...e, n: cuenta(e.id) })),
    { id: "todos", nombre: "Todos", n: base.length },
  ];
  $("#chips").innerHTML = chips.map((c) =>
    `<button class="chip ${S.filtro === c.id ? "activo" : ""}" data-f="${c.id}" ${c.color ? `style="--c:${c.color}"` : ""}>${c.nombre}<b>${c.n}</b></button>`).join("");
  $$("#chips .chip").forEach((b) => b.addEventListener("click", () => { S.filtro = b.dataset.f; sessionSet("filtro", S.filtro); pintarLista(); }));

  let lista = base;
  if (S.filtro === "activos") lista = base.filter((p) => p.estado !== "realizado");
  else if (S.filtro !== "todos") lista = base.filter((p) => p.estado === S.filtro);

  const ordenes = {
    recientes: (a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""),
    nuevos: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
    antiguos: (a, b) => diasParte(b) - diasParte(a),
    cita: (a, b) => (a.fecha_cita ? 0 : 1) - (b.fecha_cita ? 0 : 1) || (a.fecha_cita || "").localeCompare(b.fecha_cita || ""),
  };
  lista = [...lista].sort(ordenes[S.orden] || ordenes.recientes);

  const cont = $("#lista");
  if (!lista.length) {
    cont.innerHTML = `<div class="vacio">${S.partes.length ? "No hay partes con este filtro." : "Aún no hay partes.<br>Pulsa <b>+</b> para escanear el primero."}</div>`;
    return;
  }
  cont.innerHTML = lista.map(tarjetaParte).join("");
  $$(".parte", cont).forEach((el) => el.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    location.hash = "/parte/" + el.dataset.id;
  }));
}

function tarjetaParte(p) {
  const e = estadoInfo(p.estado);
  const asignado = S.miembros.find((m) => m.user_id === p.asignado_a)?.nombre;
  return `
  <article class="parte" data-id="${p.id}" style="--ase:${colorAseg(p.aseguradora)}">
    <div class="parte-top">
      <span class="aseg">${esc(p.aseguradora)}</span>
      <span class="exp">${esc(p.expediente || "sin nº")}</span>
      ${chipDias(p)}
      <span class="estado" style="--c:${e.color}">${e.nombre}</span>
    </div>
    <div class="parte-nombre">${esc(p.nombre || "Sin nombre")}</div>
    <div class="parte-dir">${esc([p.direccion, p.poblacion].filter(Boolean).join(", "))}</div>
    ${p.averia ? `<div class="parte-averia">${esc(p.averia)}</div>` : ""}
    ${p.importe_valorado != null ? `<div class="parte-importe">Valoración: <b>${fEuros(p.importe_valorado)}</b>${p.importe_autorizado != null ? ` · Autorizado: <b>${fEuros(p.importe_autorizado)}</b>` : ""}</div>` : ""}
    <div class="parte-pie">
      <span>${p.fecha_cita && ["contactado"].includes(p.estado) ? `📅 Cita ${fFechaHora(p.fecha_cita)}` : hace(p.updated_at)}${asignado ? " · " + esc(asignado) : ""}</span>
      <span class="parte-acc">
        ${p.telefono ? `<a class="mini wa" href="${linkWhatsApp(p.telefono)}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.wa}</a>
        <a class="mini tel" href="${linkLlamar(p.telefono)}" aria-label="Llamar">${I.phone}</a>` : ""}
      </span>
    </div>
  </article>`;
}

function menuUsuario() {
  const s = abrirSheet(`
    <h2>${esc(S.yo?.nombre || "Usuario")}</h2>
    <p class="suave">${esc(S.yo?.email || "")}</p>
    <div class="lista-botones">
      ${S.yo?.es_admin ? '<button class="btn primario ancho" id="irAjustes">⚙️ Ajustes y usuarios</button>' : ""}
      ${api.modo === "supabase" ? '<button class="btn ancho" id="cambiarPw">Cambiar contraseña</button>' : ""}
      ${yaInstalada() ? "" : '<button class="btn ancho" id="instalarMenu">Instalar como app</button>'}
      <button class="btn ancho" id="irPapelera">🗑 Papelera (partes borrados)</button>
      <button class="btn ancho" id="exportar">Exportar partes (CSV)</button>
      ${api.modo === "supabase" ? '<button class="btn ancho peligro" id="salir">Cerrar sesión</button>' : ""}
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>`);
  $("#salir", s)?.addEventListener("click", async () => { await api.salir(); S.yo = null; cerrarSheet(); router(); });
  $("#exportar", s).addEventListener("click", exportarCSV);
  $("#irPapelera", s).addEventListener("click", () => { cerrarSheet(); location.hash = "/papelera"; });
  $("#irAjustes", s)?.addEventListener("click", () => { cerrarSheet(); location.hash = "/ajustes"; });
  $("#instalarMenu", s)?.addEventListener("click", instalarApp);
  $("#cambiarPw", s)?.addEventListener("click", async () => {
    const pw = prompt("Nueva contraseña (mínimo 8 caracteres)");
    if (!pw) return;
    if (pw.length < 8) return toast("Mínimo 8 caracteres", "error");
    await conCarga("Guardando…", () => api.cambiarPassword(pw));
    toast("Contraseña cambiada", "ok"); cerrarSheet();
  });
}

function exportarCSV() {
  const cols = ["aseguradora", "expediente", "num_encargo", "num_siniestro", "poliza", "estado", "nombre", "telefono", "direccion", "codigo_postal", "poblacion", "averia", "importe_valorado", "importe_autorizado", "fecha_cita", "created_at", "updated_at"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [cols.join(";"), ...S.partes.map((p) => cols.map((c) => q(p[c])).join(";"))].join("\n");
  descargar(new Blob([csv], { type: "text/csv" }), `partes_${new Date().toISOString().slice(0, 10)}.csv`);
}

function descargar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ------------------------------------------------------------------ Nuevo parte: escanear
function menuNuevo() {
  const s = abrirSheet(`
    <h2>Nuevo parte</h2>
    <div class="lista-botones">
      <button class="btn grande" id="nCam">${I.cam}<span><b>Hacer foto al parte</b><small>Con la cámara del móvil</small></span></button>
      <button class="btn grande" id="nArch">${I.file}<span><b>Subir PDF o imagen</b><small>Desde archivos, correo o descargas</small></span></button>
      <button class="btn grande" id="nMano">${I.edit}<span><b>Crear a mano</b><small>Sin documento</small></span></button>
    </div>`);
  $("#nCam", s).onclick = () => { cerrarSheet(); $("#inCamara").click(); };
  $("#nArch", s).onclick = () => { cerrarSheet(); $("#inArchivo").click(); };
  $("#nMano", s).onclick = () => { S.borrador = { datos: {} }; cerrarSheet(); location.hash = "/nuevo"; };
}

async function procesarArchivo(file) {
  if (!file) return;
  const esPDF = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let blob = file, lectura = file, mime = esPDF ? "application/pdf" : "image/jpeg";
  try {
    if (!esPDF) {
      cargando(true, "Preparando foto…");
      const grande = await comprimirImagen(file, 3000, 0.92);
      cargando(false);
      const recorte = await recortarImagen(grande);
      if (!recorte) return;                                   // cancelado
      cargando(true, "Preparando foto…");
      blob = await comprimirImagen(grande, 2000, 0.85);       // se guarda la foto entera
      lectura = recorte === grande ? blob : await comprimirImagen(recorte, 2000, 0.88);
    }
    if (lectura.size > 9.5 * 1024 * 1024) throw new Error("El archivo pesa demasiado (máx. 9 MB)");
    cargando(true, "Leyendo el parte con IA…");
    const datos = await api.extraer(await blobABase64(lectura), mime);
    S.borrador = { datos: normalizar(datos), archivo: blob, mime };
    irANuevo();
  } catch (e) {
    console.error(e);
    toast("No se pudo leer: " + e.message + ". Puedes rellenarlo a mano.", "error");
    S.borrador = { datos: {}, archivo: blob, mime };
    irANuevo();
  } finally { cargando(false); }
}

function irANuevo() {
  if (location.hash === "#/nuevo") vistaFormulario(null); else location.hash = "/nuevo";
}

function normalizar(d = {}) {
  const r = {};
  for (const [k, v] of Object.entries(d)) r[k] = v === null || v === "null" ? "" : String(v).trim();
  // Unifica el nombre de la aseguradora con la lista
  const a = (r.aseguradora || "").toLowerCase();
  const sin = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const match = a && CFG.ASEGURADORAS.find((x) => sin(a).includes(sin(x)) || sin(x).includes(sin(a)));
  if (match && match !== "Otra") r.aseguradora = match;
  if (r.fecha_encargo && !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_encargo)) r.fecha_encargo = "";
  return r;
}

// ------------------------------------------------------------------ Formulario (nuevo / editar)
async function vistaFormulario(id) {
  let p;
  if (id) p = await conCarga("Cargando…", () => api.obtenerParte(id));
  else {
    if (!S.borrador) S.borrador = { datos: {} };
    p = { ...S.borrador.datos, asignado_a: S.yo.user_id };
  }
  const opcAseg = [...new Set([...CFG.ASEGURADORAS, p.aseguradora].filter(Boolean))];
  const campo = (n, label, tipo = "text", extra = "") =>
    `<label>${label}<input name="${n}" type="${tipo}" value="${esc(p[n] ?? "")}" ${extra}></label>`;

  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>${id ? "Editar parte" : "Nuevo parte"}</h1><span></span>
  </header>
  ${!id && S.borrador?.archivo ? `<div class="aviso">Revisa los datos leídos antes de guardar. La IA puede equivocarse.</div>` : ""}
  <form id="fParte" class="form">
    <div class="tarjeta">
      <label>Aseguradora
        <select name="aseguradora" required>
          <option value="">— Elegir —</option>
          ${opcAseg.map((a) => `<option ${a === p.aseguradora ? "selected" : ""}>${esc(a)}</option>`).join("")}
        </select>
      </label>
      <div class="dos">${campo("expediente", "Nº expediente")}${campo("num_encargo", "Nº encargo")}</div>
      <div class="dos">${campo("num_siniestro", "Nº siniestro")}${campo("poliza", "Póliza")}</div>
      ${campo("fecha_encargo", "Fecha de encargo", "date")}
    </div>
    <div class="tarjeta">
      ${campo("nombre", "Nombre del asegurado", "text", 'autocomplete="off"')}
      ${!id && S.borrador?.archivo ? '<p class="aviso-campo">⚠️ Comprueba el teléfono cifra a cifra con el papel.</p>' : ""}
      <div class="dos">${campo("telefono", "Teléfono", "tel")}${campo("telefono2", "Teléfono 2", "tel")}</div>
      ${campo("direccion", "Dirección")}
      <div class="tres">${campo("codigo_postal", "C.P.", "text", 'inputmode="numeric"')}${campo("poblacion", "Población")}${campo("provincia", "Provincia")}</div>
    </div>
    <div class="tarjeta">
      <label>Avería / daño<textarea name="averia" rows="4">${esc(p.averia ?? "")}</textarea></label>
    </div>
    <div class="tarjeta">
      ${campo("tramitador_nombre", "Tramitador")}
      <div class="dos">${campo("tramitador_telefono", "Tel. tramitador", "tel")}${campo("tramitador_email", "Email tramitador", "email")}</div>
    </div>
    ${id ? `<div class="tarjeta">
      <label>Fecha y hora de la cita<input type="datetime-local" name="fecha_cita" value="${toLocalInput(p.fecha_cita)}"></label>
      <div class="dos">${campo("importe_valorado", "Valorado (€ sin IVA)", "number", 'step="0.01" inputmode="decimal"')}${campo("importe_autorizado", "Autorizado (€)", "number", 'step="0.01" inputmode="decimal"')}</div>
    </div>` : ""}
    <div class="tarjeta">
      <label>Asignado a
        <select name="asignado_a"><option value="">— Sin asignar —</option>
          ${S.miembros.map((m) => `<option value="${m.user_id}" ${m.user_id === p.asignado_a ? "selected" : ""}>${esc(m.nombre)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="pie-form">
      <button type="button" class="btn" id="cancelar">Cancelar</button>
      <button type="submit" class="btn primario">Guardar</button>
    </div>
  </form>`;

  $("#volver").onclick = $("#cancelar").onclick = () => history.back();
  $("#fParte").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    for (const k in f) if (f[k] === "") f[k] = null;
    if (f.fecha_cita) f.fecha_cita = new Date(f.fecha_cita).toISOString();
    for (const k of ["importe_valorado", "importe_autorizado"]) if (f[k] != null) f[k] = Number(String(f[k]).replace(",", "."));
    if (!f.aseguradora) return toast("Elige la aseguradora", "error");
    try {
      if (id) {
        await conCarga("Guardando…", () => api.actualizarParte(id, f));
        toast("Guardado", "ok");
        location.replace("#/parte/" + id);
      } else {
        const dup = await api.buscarDuplicado(f.aseguradora, f.expediente);
        if (dup?.borrado_at) {
          if (confirm(`Ese parte (${f.aseguradora} ${f.expediente}) está en la papelera. ¿Recuperarlo?`)) {
            await conCarga("Recuperando…", () => api.restaurarParte(dup.id));
            return (location.hash = "/parte/" + dup.id);
          }
          return;
        }
        if (dup && !confirm(`Ya existe un parte de ${f.aseguradora} con el expediente ${f.expediente} (${dup.nombre ?? ""}). ¿Crear otro igualmente?`)) {
          return (location.hash = "/parte/" + dup.id);
        }
        const nuevo = await conCarga("Guardando…", async () => {
          const n = await api.crearParte({ ...f, datos_ia: S.borrador?.archivo ? S.borrador.datos : null });
          if (S.borrador?.archivo) {
            const ext = S.borrador.mime === "application/pdf" ? "pdf" : "jpg";
            const path = await api.subirArchivo(`${n.id}/documento.${ext}`, S.borrador.archivo, S.borrador.mime);
            await api.actualizarParte(n.id, { documento_path: path });
          }
          return n;
        });
        S.borrador = null;
        toast("Parte creado", "ok");
        location.replace("#/parte/" + nuevo.id);
      }
    } catch (err) {
      if (String(err.message).includes("partes_aseg_exp_uq")) toast("Ya existe un parte con esa aseguradora y expediente", "error");
    }
  });
}

// ------------------------------------------------------------------ Detalle
async function vistaParte(id) {
  let p;
  try { p = await conCarga("Cargando…", () => api.obtenerParte(id)); }
  catch { location.hash = "/"; return; }
  const e = estadoInfo(p.estado), idx = idxEstado(p.estado);
  const sig = ESTADOS[idx + 1];
  const asignado = S.miembros.find((m) => m.user_id === p.asignado_a)?.nombre;
  const nombreDe = (uid) => S.miembros.find((m) => m.user_id === uid)?.nombre ?? "";
  const dirCompleta = [p.direccion, [p.codigo_postal, p.poblacion].filter(Boolean).join(" "), p.provincia].filter(Boolean).join(", ");
  const msgCliente = plantilla(CFG.MENSAJE_CLIENTE, p);

  app.innerHTML = `
  <header class="barra" style="--ase:${colorAseg(p.aseguradora)}">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1><span class="aseg">${esc(p.aseguradora)}</span> ${esc(p.expediente || "")}</h1>
    <button class="icono" id="menuParte" aria-label="Más opciones">${I.more}</button>
  </header>

  <section class="cabecera">
    <div class="nombre">${esc(p.nombre || "Sin nombre")}</div>
    ${dirCompleta ? `<a class="dir" href="${linkMapa(p)}" target="_blank" rel="noopener">${esc(dirCompleta)}</a>` : ""}
    ${p.telefono ? `<div class="tel-txt">${esc(p.telefono)}${p.telefono2 ? " · " + esc(p.telefono2) : ""}</div>` : ""}
    <div class="acciones">
      <a class="accion ${p.telefono ? "" : "off"}" href="${p.telefono ? linkLlamar(p.telefono) : "#"}">${I.phone}<span>Llamar</span></a>
      <a class="accion wa ${p.telefono ? "" : "off"}" href="${p.telefono ? linkWhatsApp(p.telefono, msgCliente) : "#"}" target="_blank" rel="noopener">${I.wa}<span>WhatsApp</span></a>
      <a class="accion ${dirCompleta ? "" : "off"}" href="${dirCompleta ? linkMapa(p) : "#"}" target="_blank" rel="noopener">${I.map}<span>Cómo llegar</span></a>
    </div>
    ${p.telefono2 ? `<div class="tel2">Tel. 2: <a href="${linkLlamar(p.telefono2)}">llamar</a> · <a href="${linkWhatsApp(p.telefono2, msgCliente)}" target="_blank" rel="noopener">WhatsApp</a></div>` : ""}
  </section>

  <section class="tarjeta">
    <div class="pasos">
      ${ESTADOS.map((s, i) => `
        <button class="paso ${i < idx ? "hecho" : ""} ${i === idx ? "actual" : ""}" data-estado="${s.id}" style="--c:${s.color}">
          <i>${i < idx ? "✓" : i + 1}</i><span>${s.nombre}</span>
        </button>`).join("")}
    </div>
    <div class="estado-actual" style="--c:${e.color}">${chipDias(p, true)} · Estado: <b>${e.nombre}</b>${p.fecha_cita && idx < 2 ? ` · Cita ${fFechaHora(p.fecha_cita)}` : ""}</div>
    <div class="lista-botones">
      ${sig ? `<button class="btn primario ancho" id="avanzar" style="--c:${sig.color}">Marcar como ${sig.nombre.toLowerCase()} →</button>` : ""}
      ${idx >= idxEstado("visitado") ? `<button class="btn primario ancho" id="informe" style="--c:#16a34a">${I.pdf} PDF de ${p.estado === "realizado" ? "trabajo terminado" : "visita"} → ${esc(DEST.nombre)}</button>` : ""}
      <button class="btn ancho" id="nota">Añadir nota</button>
    </div>
  </section>

  <section class="tarjeta">
    <h3>Avería / daño</h3>
    <p class="pre">${esc(p.averia || "—")}</p>
  </section>
  ${idx >= idxEstado("visitado") || (p.lineas_valoracion || []).length ? seccionLineas(p, "valoracion") : ""}
  ${idx >= idxEstado("autorizado") || (p.lineas_realizadas || []).length ? seccionLineas(p, "realizados") : ""}

  <section class="tarjeta datos">
    <h3>Datos</h3>
    ${dato("Nº encargo", p.num_encargo)}
    ${dato("Nº siniestro", p.num_siniestro)}
    ${dato("Póliza", p.poliza)}
    ${dato("Fecha encargo", fFecha(p.fecha_encargo))}
    ${p.fecha_cita ? `<div class="dato"><span>Cita</span><b>${fFechaHora(p.fecha_cita)} · <a href="${linkCalendario(p)}" target="_blank" rel="noopener">📅 Añadir al calendario</a></b></div>` : ""}
    ${dato("Valorado (sin IVA)", fEuros(p.importe_valorado))}
    ${dato("Autorizado", fEuros(p.importe_autorizado))}
    <div class="dato"><span>Asignado</span><b>
      <select id="asignar"><option value="">— Sin asignar —</option>
        ${S.miembros.map((m) => `<option value="${m.user_id}" ${m.user_id === p.asignado_a ? "selected" : ""}>${esc(m.nombre)}</option>`).join("")}
      </select></b></div>
    ${p.tramitador_nombre || p.tramitador_telefono || p.tramitador_email ? `
      <div class="dato"><span>Tramitador</span><b>${esc(p.tramitador_nombre || "")}
        ${p.tramitador_telefono ? `<br><a href="${linkLlamar(p.tramitador_telefono)}">${esc(p.tramitador_telefono)}</a> · <a href="${linkWhatsApp(p.tramitador_telefono)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${p.tramitador_email ? `<br><a href="mailto:${esc(p.tramitador_email)}">${esc(p.tramitador_email)}</a>` : ""}</b></div>` : ""}
    ${p.documento_path ? `<button class="btn ancho" id="verDoc">${I.file} Ver parte original</button>` : ""}
  </section>

  <section class="tarjeta">
    <div class="h3-fila"><h3>Fotos (${p.fotos.length})</h3><button class="btn peq" id="addFoto">${I.cam} Añadir</button></div>
    <div class="fotos" id="fotos">${p.fotos.length ? "" : '<p class="suave">Sin fotos</p>'}</div>
  </section>

  <section class="tarjeta">
    <h3>Historial</h3>
    <ol class="historial">
      ${[...p.eventos].reverse().map((ev) => {
        const s = ev.estado ? estadoInfo(ev.estado) : null;
        return `<li style="--c:${s ? s.color : "#94a3b8"}">
          <div class="h-cab"><b>${s ? s.nombre : "Nota"}</b><span>${fFechaHora(ev.created_at)}${nombreDe(ev.creado_por) ? " · " + esc(nombreDe(ev.creado_por)) : ""}</span></div>
          ${ev.nota ? `<p class="pre">${esc(ev.nota)}</p>` : ""}
          <button class="editar-ev" data-id="${ev.id}" aria-label="Editar">${I.edit}</button>
        </li>`;
      }).join("")}
    </ol>
  </section>
  <div class="zona-borrar"><button class="btn ancho peligro" id="aPapelera">🗑 Borrar este parte</button>
    <p class="suave">Va a la papelera (icono de la persona → Papelera) y se puede recuperar.</p></div>
  <div style="height:40px"></div>`;

  $("#volver").onclick = () => (history.length > 1 ? history.back() : (location.hash = "/"));
  $("#menuParte").onclick = () => menuParte(p);
  $("#avanzar")?.addEventListener("click", () => sheetFase(p, sig.id));
  $("#informe")?.addEventListener("click", () => flujoInforme(p));
  $("#nota").onclick = () => sheetFase(p, null);
  $$(".paso").forEach((b) => b.addEventListener("click", () => {
    const dest = b.dataset.estado;
    if (dest === p.estado) return;
    sheetFase(p, dest);
  }));
  $("#asignar").addEventListener("change", async (ev) => {
    await conCarga("Guardando…", () => api.actualizarParte(p.id, { asignado_a: ev.target.value || null }));
    toast("Asignado", "ok");
  });
  $("#verDoc")?.addEventListener("click", async () => {
    const w = window.open("", "_blank");
    const url = await api.urlArchivo(p.documento_path);
    if (w) w.location = url; else location.href = url;
  });
  $("#addFoto").onclick = () => sheetFotos(p);
  $$(".editar-ev").forEach((b) => b.addEventListener("click", () => sheetEvento(p, p.eventos.find((e) => String(e.id) === b.dataset.id))));
  $("#aPapelera").onclick = () => enviarPapelera(p);
  pintarFotos(p);
}

const htmlTotales = (t) => CFG.IVA
  ? `<span>Base imponible</span><b>${fEuros(t.base)}</b><span>IVA ${CFG.IVA}%</span><b>${fEuros(t.iva)}</b><span>Total</span><b class="grande">${fEuros(t.total)}</b>`
  : `<span>Total (sin IVA)</span><b class="grande">${fEuros(t.base)}</b>`;

function seccionLineas(p, tipo) {
  const lineas = (tipo === "realizados" ? p.lineas_realizadas : p.lineas_valoracion) || [];
  const t = totalesLineas(lineas, CFG.IVA);
  return `<section class="tarjeta">
    <div class="h3-fila"><h3>${tipo === "realizados" ? "Trabajos realizados" : "Valoración"}</h3>
      <a class="btn peq" href="#/lineas/${p.id}/${tipo}">${lineas.length ? "Editar" : "+ Códigos"}</a></div>
    ${lineas.length ? `<div class="lineas-mini">${lineas.map((l) => `
      <div><span><b>${esc(l.codigo || "—")}</b> ${esc(l.descripcion)}</span><span>${Number(l.cantidad)}× · ${fEuros(importeLinea(l))}${Number(l.dto) ? ` <small>(-${Number(l.dto)}%)</small>` : ""}</span></div>`).join("")}</div>
      <div class="totales">${htmlTotales(t)}</div>`
      : `<p class="suave">${tipo === "realizados" ? "Sin trabajos anotados. Al editarlos se copian los de la valoración para que solo cambies lo que haya variado." : "Sin códigos. Busca por código o por descripción."}</p>`}
  </section>`;
}

const dato = (k, v) => (v ? `<div class="dato"><span>${k}</span><b>${esc(v)}</b></div>` : "");

function plantilla(t, p) {
  const averia = (p.averia || "").split(/[.\n]/)[0].slice(0, 80).toLowerCase();
  return t.replace(/\{(\w+)\}/g, (_, k) => ({
    nombre: (p.nombre || "").split(" ")[0] || "", empresa: CFG.EMPRESA.nombre, aseguradora: p.aseguradora || "",
    expediente: p.expediente || "", averia_corta: averia || "la incidencia",
  }[k] ?? ""));
}

async function pintarFotos(p) {
  const cont = $("#fotos");
  if (!p.fotos.length) return;
  const etiquetas = { antes: "Antes", despues: "Después", otra: "" };
  cont.innerHTML = p.fotos.map((f) => `
    <figure data-id="${f.id}"><img alt="" loading="lazy"><figcaption>${etiquetas[f.tipo] || ""}</figcaption>
      <button class="borrar-foto" aria-label="Borrar foto">${I.x}</button></figure>`).join("");
  for (const f of p.fotos) {
    const fig = cont.querySelector(`figure[data-id="${f.id}"]`);
    api.urlArchivo(f.path).then((u) => { fig.querySelector("img").src = u; }).catch(() => {});
    fig.querySelector("img").addEventListener("click", async () => window.open(await api.urlArchivo(f.path), "_blank"));
    fig.querySelector(".borrar-foto").addEventListener("click", async () => {
      if (!confirm("¿Borrar esta foto?")) return;
      await conCarga("Borrando…", () => api.borrarFoto(f));
      vistaParte(p.id);
    });
  }
}

async function subirFotos(p, files, tipo) {
  let n = 0;
  for (const file of files) {
    cargando(true, `Subiendo foto ${++n} de ${files.length}…`);
    const blob = await comprimirImagen(file, 1600, 0.8);
    const path = await api.subirArchivo(`${p.id}/foto_${Date.now()}_${n}.jpg`, blob, "image/jpeg");
    await api.anadirFoto(p.id, path, tipo);
  }
}

function sheetFotos(p) {
  const tipoDef = idxEstado(p.estado) >= idxEstado("autorizado") ? "despues" : "antes";
  const s = abrirSheet(`
    <h2>Añadir fotos</h2>
    <div class="seg" id="tipoFoto">
      ${[["antes", "Antes"], ["despues", "Después"], ["otra", "Otra"]].map(([v, n]) => `<button type="button" data-v="${v}" class="${v === tipoDef ? "on" : ""}">${n}</button>`).join("")}
    </div>
    <div class="lista-botones">
      <label class="btn grande">${I.cam}<span><b>Hacer foto</b></span><input type="file" accept="image/*" capture="environment" hidden id="fCam"></label>
      <label class="btn grande">${I.file}<span><b>Elegir de la galería</b></span><input type="file" accept="image/*" multiple hidden id="fGal"></label>
      <button class="btn texto ancho" data-cerrar>Cancelar</button>
    </div>`);
  let tipo = tipoDef;
  $$("#tipoFoto button", s).forEach((b) => b.onclick = () => { tipo = b.dataset.v; $$("#tipoFoto button", s).forEach((x) => x.classList.toggle("on", x === b)); });
  const alElegir = async (ev) => {
    const files = [...ev.target.files]; if (!files.length) return;
    cerrarSheet();
    try { await subirFotos(p, files, tipo); toast("Fotos guardadas", "ok"); }
    catch (e) { toast("Error subiendo fotos: " + e.message, "error"); }
    finally { cargando(false); vistaParte(p.id); }
  };
  $("#fCam", s).onchange = alElegir; $("#fGal", s).onchange = alElegir;
}

function menuParte(p) {
  const s = abrirSheet(`
    <h2>Parte ${esc(p.expediente || "")}</h2>
    <div class="lista-botones">
      <button class="btn ancho" id="mEditar">${I.edit} Editar datos, cita e importes</button>
      <button class="btn ancho" id="mDoc">${I.cam} Cambiar documento / volver a leer con IA</button>
      <button class="btn ancho" id="mInforme">${I.pdf} Generar PDF (en cualquier fase)</button>
      <button class="btn ancho peligro" id="mBorrar">🗑 Borrar parte (a la papelera)</button>
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>
    <p class="suave">Para cambiar de fase (también hacia atrás) toca el círculo de la fase en la ficha.</p>`);
  $("#mEditar", s).onclick = () => { location.hash = "/editar/" + p.id; };
  $("#mInforme", s).onclick = () => flujoInforme(p);
  $("#mBorrar", s).onclick = () => enviarPapelera(p);
  $("#mDoc", s).onclick = () => { cerrarSheet(); releerDocumento(p); };
}

async function enviarPapelera(p) {
  if (!confirm(`¿Borrar el parte ${p.aseguradora} ${p.expediente || ""} (${p.nombre || "sin nombre"})?\nIrá a la papelera y podrás recuperarlo.`)) return;
  await conCarga("Borrando…", () => api.aPapelera(p.id));
  cerrarSheet(); toast("Parte enviado a la papelera"); location.hash = "/";
}

function releerDocumento(p) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/pdf,image/*";
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    const esPDF = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    let blob = file, lectura = file;
    const mime = esPDF ? "application/pdf" : "image/jpeg";
    try {
      if (!esPDF) {
        const grande = await comprimirImagen(file, 3000, 0.92);
        const recorte = await recortarImagen(grande); if (!recorte) return;
        blob = await comprimirImagen(grande, 2000, 0.85);
        lectura = recorte === grande ? blob : await comprimirImagen(recorte, 2000, 0.88);
      }
      const b64 = await blobABase64(lectura);
      const datos = normalizar(await conCarga("Leyendo con IA…", () => api.extraer(b64, mime)));
      const vacios = Object.keys(datos).filter((k) => datos[k] && (p[k] == null || p[k] === "") && k in p);
      const distintos = Object.keys(datos).filter((k) => datos[k] && p[k] && String(p[k]) !== datos[k] && k in p);
      const s = abrirSheet(`
        <h2>Datos leídos</h2>
        ${vacios.length ? `<p>Se rellenarán <b>${vacios.length}</b> campos vacíos: ${vacios.map(esc).join(", ")}.</p>` : "<p>No hay campos vacíos que rellenar.</p>"}
        ${distintos.length ? `<label class="check"><input type="checkbox" id="sobrescribir"> Sustituir también ${distintos.length} campos que ya tenían otro valor (${distintos.map(esc).join(", ")})</label>` : ""}
        <label class="check"><input type="checkbox" id="guardarDoc" checked> Guardar este documento como parte original</label>
        <div class="pie-form"><button class="btn" data-cerrar>Cancelar</button><button class="btn primario" id="aplicar">Aplicar</button></div>`);
      $("#aplicar", s).onclick = async () => {
        const cambios = {};
        vacios.forEach((k) => (cambios[k] = datos[k]));
        if ($("#sobrescribir", s)?.checked) distintos.forEach((k) => (cambios[k] = datos[k]));
        await conCarga("Guardando…", async () => {
          if ($("#guardarDoc", s).checked) cambios.documento_path = await api.subirArchivo(`${p.id}/documento_${Date.now()}.${esPDF ? "pdf" : "jpg"}`, blob, mime);
          if (Object.keys(cambios).length) await api.actualizarParte(p.id, cambios);
        });
        cerrarSheet(); toast("Parte actualizado", "ok"); vistaParte(p.id);
      };
    } catch (e) { cargando(false); toast("No se pudo leer: " + e.message, "error"); }
  };
  inp.click();
}

function sheetEvento(p, ev) {
  if (!ev) return;
  const s = abrirSheet(`
    <h2>${ev.estado ? "Fase " + esc(estadoInfo(ev.estado).nombre) : "Nota"}</h2>
    <form id="fEv" class="form">
      <label>Fecha y hora<input type="datetime-local" name="fecha" value="${toLocalInput(ev.created_at)}"></label>
      <label>Texto<textarea name="nota" rows="4">${esc(ev.nota || "")}</textarea></label>
      <div class="pie-form"><button type="button" class="btn peligro" id="borrarEv">Borrar</button><button class="btn primario">Guardar</button></div>
    </form>
    ${ev.estado ? '<p class="suave">Borrar esta línea no cambia la fase actual del parte. Para cambiar de fase toca el círculo de la fase.</p>' : ""}`);
  $("#fEv", s).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await conCarga("Guardando…", () => api.editarEvento(ev.id, { nota: f.nota.trim() || null, ...(f.fecha ? { created_at: new Date(f.fecha).toISOString() } : {}) }));
    cerrarSheet(); toast("Guardado", "ok"); vistaParte(p.id);
  });
  $("#borrarEv", s).onclick = async () => {
    if (!confirm("¿Borrar esta línea del historial?")) return;
    await conCarga("Borrando…", () => api.borrarEvento(ev.id));
    cerrarSheet(); vistaParte(p.id);
  };
}

async function vistaPapelera() {
  let lista = [];
  try { lista = await conCarga("Cargando…", () => api.listarPapelera()); } catch { /* nada */ }
  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>Papelera <small class="sub">${lista.length}</small></h1><span></span>
  </header>
  <main class="lista">${lista.length ? lista.map((p) => `
    <article class="parte papel" style="--ase:${colorAseg(p.aseguradora)}">
      <div class="parte-top"><span class="aseg">${esc(p.aseguradora)}</span><span class="exp">${esc(p.expediente || "")}</span><small class="suave">borrado ${hace(p.borrado_at)}</small></div>
      <div class="parte-nombre">${esc(p.nombre || "Sin nombre")}</div>
      <div class="lista-botones dos">
        <button class="btn" data-r="${p.id}">↩ Recuperar</button>
        ${S.yo?.es_admin ? `<button class="btn peligro" data-b="${p.id}">Borrar para siempre</button>` : ""}
      </div>
    </article>`).join("") : '<div class="vacio">La papelera está vacía.</div>'}</main>`;
  $("#volver").onclick = () => (location.hash = "/");
  $$("[data-r]").forEach((b) => b.onclick = async () => {
    await conCarga("Recuperando…", () => api.restaurarParte(b.dataset.r));
    toast("Parte recuperado", "ok"); vistaPapelera();
  });
  $$("[data-b]").forEach((b) => b.onclick = async () => {
    if (!confirm("Se borrará para siempre, con sus fotos y notas. ¿Seguro?")) return;
    await conCarga("Borrando…", () => api.borrarParte(b.dataset.b));
    toast("Borrado definitivamente"); vistaPapelera();
  });
}

// ------------------------------------------------------------------ Cambio de fase
const PREGUNTA = {
  null: "Nota",
  recibido: "Comentario (opcional)",
  contactado: "¿Qué te ha dicho el cliente?",
  visitado: "Observaciones de la visita",
  valorado: "Detalle de la valoración",
  autorizado: "Comentario de la autorización",
  realizado: "Trabajo realizado",
};

function sheetFase(p, destino) {
  const info = destino ? estadoInfo(destino) : null;
  const atras = destino && idxEstado(destino) < idxEstado(p.estado);
  const s = abrirSheet(`
    <h2>${info ? `${atras ? "Volver a" : "Marcar como"} <span style="color:${info.color}">${info.nombre}</span>` : "Añadir nota"}</h2>
    <form id="fFase" class="form">
      <label>${PREGUNTA[destino]}<textarea name="nota" rows="4" placeholder="${destino === "contactado" ? "Ej.: le viene bien el martes por la tarde, hay que llamar antes de ir…" : ""}"></textarea></label>
      ${destino === "contactado" ? `<label>Fecha y hora de la visita<input type="datetime-local" name="fecha_cita" value="${toLocalInput(p.fecha_cita)}"></label>` : ""}
      ${destino === "valorado" ? `<a class="btn ancho" href="#/lineas/${p.id}/valoracion">📋 ${(p.lineas_valoracion || []).length ? "Revisar" : "Meter"} códigos de la tarifa</a>
        <label>Importe valorado (€, sin IVA)<input type="number" step="0.01" inputmode="decimal" name="importe_valorado" value="${(p.lineas_valoracion || []).length ? totalesLineas(p.lineas_valoracion).base : (p.importe_valorado ?? "")}"></label>` : ""}
      ${destino === "autorizado" ? `<label>Importe autorizado (€)<input type="number" step="0.01" inputmode="decimal" name="importe_autorizado" value="${p.importe_autorizado ?? p.importe_valorado ?? ""}"></label>` : ""}
      ${destino === "visitado" ? `<label class="btn ancho">${I.cam} Fotos de antes (opcional)<input type="file" accept="image/*" multiple hidden name="fotos" data-tipo="antes"></label><small class="suave" id="nFotos"></small>` : ""}
      ${destino === "realizado" ? `<a class="btn ancho" href="#/lineas/${p.id}/realizados">📋 ${(p.lineas_realizadas || []).length ? "Revisar" : "Anotar"} trabajos realizados (códigos)</a>
        <label class="btn ancho">${I.cam} Fotos del trabajo terminado<input type="file" accept="image/*" multiple hidden name="fotos" data-tipo="despues"></label><small class="suave" id="nFotos"></small>
        <div class="firma-caja"><div class="h3-fila"><b>Firma del cliente</b><button type="button" class="btn texto peq" id="limpiarFirma">Borrar</button></div>
          <canvas id="firma"></canvas><small class="suave">${p.firma_path ? "Ya hay una firma guardada; si firmas de nuevo se sustituye." : "Opcional. Pide al cliente que firme con el dedo."}</small></div>` : ""}
      <div class="pie-form">
        <button type="button" class="btn" data-cerrar>Cancelar</button>
        <button type="submit" class="btn primario" ${info ? `style="--c:${info.color}"` : ""}>Guardar</button>
      </div>
    </form>`);
  const inFotos = $("input[name=fotos]", s);
  inFotos?.addEventListener("change", () => { $("#nFotos", s).textContent = `${inFotos.files.length} foto(s) seleccionada(s)`; });
  let firma = null;
  if (destino === "realizado") {
    firma = panelFirma($("#firma", s));
    $("#limpiarFirma", s).onclick = () => firma.limpiar();
  }
  $("#fFase", s).addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const nota = (f.get("nota") || "").trim() || null;
    if (!destino && !nota) return toast("Escribe la nota", "error");
    const cambios = {};
    if (destino) cambios.estado = destino;
    if (f.has("fecha_cita")) cambios.fecha_cita = f.get("fecha_cita") ? new Date(f.get("fecha_cita")).toISOString() : null;
    if (f.has("importe_valorado")) cambios.importe_valorado = f.get("importe_valorado") === "" ? null : Number(f.get("importe_valorado"));
    if (f.has("importe_autorizado")) cambios.importe_autorizado = f.get("importe_autorizado") === "" ? null : Number(f.get("importe_autorizado"));
    const fotos = inFotos ? [...inFotos.files] : [];
    const firmaBlob = firma && !firma.vacio ? await firma.aBlob() : null;
    cerrarSheet();
    try {
      await conCarga("Guardando…", async () => {
        if (fotos.length) await subirFotos(p, fotos, inFotos.dataset.tipo);
        if (firmaBlob) cambios.firma_path = await api.subirArchivo(`${p.id}/firma.png`, firmaBlob, "image/png");
        cargando(true, "Guardando…");
        if (Object.keys(cambios).length) await api.actualizarParte(p.id, cambios);
        await api.anadirEvento(p.id, destino, nota);
      });
      toast(destino ? `Marcado como ${info.nombre.toLowerCase()}` : "Nota añadida", "ok");
      await vistaParte(p.id);
      if (destino === "realizado" || destino === "visitado") {
        const nuevo = await api.obtenerParte(p.id);
        flujoInforme(nuevo);
      }
    } catch { vistaParte(p.id); }
  });
}

// ------------------------------------------------------------------ Informe PDF y envío
async function flujoInforme(pIn) {
  cerrarSheet();
  let blob, nombre, p, enlace = null;
  try {
    ({ blob, nombre, p } = await conCarga("Generando PDF…", async () => {
      const p = await api.obtenerParte(pIn.id);
      const r = await generarInforme(p, api, S.miembros);
      const path = await api.subirArchivo(`${p.id}/${r.nombre}`, r.blob, "application/pdf");
      await api.actualizarParte(p.id, { informe_path: path });
      if (api.modo === "supabase") { try { enlace = await api.urlArchivo(path, 60 * 60 * 24 * 30); } catch { /* sin enlace */ } }
      return { ...r, p };
    }));
  } catch { return; }

  const file = new File([blob], nombre, { type: "application/pdf" });
  const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const tipoInf = p.estado === "realizado" ? "Trabajo terminado" : "Visita realizada";
  const texto = `${tipoInf} - ${p.aseguradora} exp. ${p.expediente || ""}${p.num_encargo ? " (encargo " + p.num_encargo + ")" : ""} - ${p.nombre || ""}.`;
  const tel = DEST.telefono || p.tramitador_telefono;
  const quien = DEST.telefono ? DEST.nombre : "el tramitador";
  const s = abrirSheet(`
    <h2>PDF listo</h2>
    <p class="suave">${esc(nombre)}</p>
    <div class="lista-botones">
      ${puedeCompartir ? `<button class="btn primario grande" id="compartir" style="--c:#16a34a">${I.wa}<span><b>Enviar PDF por WhatsApp</b><small>Elige WhatsApp y luego a ${esc(quien)}</small></span></button>` : ""}
      ${tel ? `<a class="btn grande" id="waEnlace" target="_blank" rel="noopener" href="${linkWhatsApp(tel, texto + (enlace ? "\n" + enlace : ""))}">${I.wa}<span><b>WhatsApp directo a ${esc(quien)}</b><small>${enlace ? "Mensaje con enlace al PDF (válido 30 días)" : "Abre el chat; adjunta el PDF descargado"}</small></span></a>` : ""}
      <button class="btn grande" id="descargar">${I.pdf}<span><b>Descargar / ver PDF</b></span></button>
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>
    ${!tel ? '<p class="suave">Consejo: añade el teléfono del tramitador en "Editar datos" para abrir su chat directamente.</p>' : ""}`);
  $("#compartir", s)?.addEventListener("click", async () => {
    try { await navigator.share({ files: [file], title: nombre, text: texto }); }
    catch (e) { if (e.name !== "AbortError") toast("No se pudo compartir: " + e.message, "error"); }
  });
  $("#descargar", s).onclick = () => descargar(blob, nombre);
}



// ------------------------------------------------------------------ Tarifa y líneas
async function cargarTarifa(forzar = false) {
  if (S.tarifa && !forzar) return S.tarifa;
  try { S.tarifa = await api.listarTarifa(); } catch { S.tarifa = []; }
  return S.tarifa;
}

async function vistaLineas(id, tipo) {
  let p;
  try { p = await conCarga("Cargando…", () => api.obtenerParte(id)); } catch { location.hash = "/"; return; }
  await cargarTarifa();
  const campo = tipo === "realizados" ? "lineas_realizadas" : "lineas_valoracion";
  let lineas = JSON.parse(JSON.stringify(p[campo] || []));
  let copiado = false;
  if (tipo === "realizados" && !lineas.length && (p.lineas_valoracion || []).length) { lineas = JSON.parse(JSON.stringify(p.lineas_valoracion)); copiado = true; }
  let sucio = copiado;

  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>${tipo === "realizados" ? "Trabajos realizados" : "Valoración"} <small class="sub">${esc(p.expediente || "")}</small></h1>
    <button class="btn peq guardar" id="guardarL">Guardar</button>
  </header>
  ${copiado ? '<div class="aviso">He copiado los códigos de la valoración. Cambia solo lo que haya variado y guarda.</div>' : ""}
  <div class="buscador">${I.search}<input id="bT" type="search" placeholder="Código o descripción (p.ej. 5108, rodapié, galce)" autocomplete="off"></div>
  <div class="chips cats" id="catsT"></div>
  <div id="resT" class="resultados"></div>
  <section class="tarjeta">
    <div class="h3-fila"><h3>Líneas</h3>
      <span><button class="btn peq" id="libre">+ Línea libre</button> <button class="btn peq" id="dtoTodo">% Dto a todo</button></span></div>
    <div id="lineas"></div>
    <div id="totales" class="totales"></div>
  </section>
  <div style="height:60px"></div>`;

  const pintarTotales = () => {
    const t = totalesLineas(lineas, CFG.IVA);
    $("#totales").innerHTML = htmlTotales(t);
  };
  const pintarLineas = () => {
    const c = $("#lineas");
    if (!lineas.length) { c.innerHTML = '<p class="suave">Aún no hay líneas. Busca arriba por código o descripción y pulsa en el resultado para añadirlo.</p>'; pintarTotales(); return; }
    c.innerHTML = lineas.map((l, i) => `
      <div class="linea" data-i="${i}">
        <div class="linea-cab"><b>${esc(l.codigo || "Libre")}</b><button class="icono oscuro borrarL" aria-label="Quitar">${I.x}</button></div>
        <textarea class="desc" rows="2">${esc(l.descripcion)}</textarea>
        <div class="linea-num">
          <label>Cant.<input class="cant" type="number" inputmode="decimal" step="0.01" min="0" value="${l.cantidad}"></label>
          <label>Precio €<input class="prec" type="number" inputmode="decimal" step="0.01" value="${l.precio}"></label>
          <label>Dto %<input class="dto" type="number" inputmode="decimal" step="0.5" min="0" max="100" value="${l.dto || 0}"></label>
          <div class="imp"><span>Importe</span><b>${fEuros(importeLinea(l))}</b></div>
        </div>
      </div>`).join("");
    $$(".linea", c).forEach((el) => {
      const i = Number(el.dataset.i), l = lineas[i];
      const upd = () => { sucio = true; el.querySelector(".imp b").textContent = fEuros(importeLinea(l)); pintarTotales(); };
      el.querySelector(".cant").oninput = (e) => { l.cantidad = Number(e.target.value.replace(",", ".")) || 0; upd(); };
      el.querySelector(".cant").onchange = () => { if (repartirAdicionales(l)) pintarLineas(); };
      el.querySelector(".prec").oninput = (e) => { l.precio = Number(e.target.value.replace(",", ".")) || 0; upd(); };
      el.querySelector(".dto").oninput = (e) => { l.dto = Math.min(100, Number(e.target.value.replace(",", ".")) || 0); upd(); };
      el.querySelector(".desc").oninput = (e) => { l.descripcion = e.target.value; sucio = true; };
      el.querySelector(".borrarL").onclick = () => { lineas.splice(i, 1); sucio = true; pintarLineas(); };
    });
    pintarTotales();
  };
  // Si un código "1ª Ud." pasa de 1 unidad, el resto va a su "Ud. adicional"
  const sumarLinea = (c, n) => {
    const ex = lineas.find((l) => l.codigo === c.codigo);
    if (ex) ex.cantidad = Math.round(((Number(ex.cantidad) || 0) + n) * 100) / 100;
    else lineas.push({ codigo: c.codigo, descripcion: c.descripcion, cantidad: n, precio: Number(c.precio), dto: 0 });
  };
  const repartirAdicionales = (l) => {
    const ad = codigoAdicional(S.tarifa, l.codigo);
    const extra = (Number(l.cantidad) || 0) - 1;
    if (!ad || extra <= 0) return false;
    l.cantidad = 1;
    sumarLinea(ad, extra);
    const la = lineas.find((x) => x.codigo === ad.codigo); if (la && !la.dto && l.dto) la.dto = l.dto;
    toast(`${extra} ud. pasan al ${ad.codigo} (Ud. adicional)`, "ok");
    return true;
  };
  const anadir = (c) => {
    const ex = lineas.find((l) => l.codigo === c.codigo);
    const ad = codigoAdicional(S.tarifa, c.codigo);
    if (ex && ad) { sumarLinea(ad, 1); toast(`+1 ud. adicional (${ad.codigo})`, "ok"); }
    else { sumarLinea(c, 1); toast(`${c.codigo} añadido`, "ok"); }
    sucio = true; pintarLineas();
  };
  // Categorías de la tarifa para buscar rápido
  const cats = [...new Set(S.tarifa.filter((c) => c.activo !== false).map((c) => c.categoria || "Otros"))];
  let catSel = null;
  const pintarRes = (r, vacio) => {
    $("#resT").innerHTML = vacio ? '<p class="suave" style="padding:0 16px">Sin resultados. Puedes añadir una línea libre.</p>'
      : r.map((c) => `<button class="res" data-c="${esc(c.codigo)}"><b>${esc(c.codigo)}</b><span>${esc(c.descripcion)}</span><em>${fEuros(c.precio)}</em></button>`).join("");
    $$("#resT .res").forEach((b) => b.onclick = () => anadir(S.tarifa.find((c) => c.codigo === b.dataset.c)));
  };
  const pintarCats = () => {
    $("#catsT").innerHTML = cats.map((c) => `<button class="chip ${c === catSel ? "activo" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    $$("#catsT .chip").forEach((b) => b.onclick = () => {
      catSel = catSel === b.dataset.cat ? null : b.dataset.cat;
      $("#bT").value = ""; pintarCats();
      pintarRes(catSel ? S.tarifa.filter((c) => c.activo !== false && (c.categoria || "Otros") === catSel) : []);
    });
  };
  pintarCats();
  $("#bT").addEventListener("input", (e) => {
    const r = buscarEnTarifa(S.tarifa, e.target.value);
    if (e.target.value.trim()) { catSel = null; pintarCats(); }
    pintarRes(r, e.target.value.trim() && !r.length);
  });
  $("#libre").onclick = () => { lineas.push({ codigo: "", descripcion: "", cantidad: 1, precio: 0, dto: 0 }); sucio = true; pintarLineas(); $$("#lineas .desc").at(-1)?.focus(); };
  $("#dtoTodo").onclick = () => {
    const d = prompt("Descuento (%) para todas las líneas", "0"); if (d == null) return;
    const n = Math.min(100, Math.max(0, Number(String(d).replace(",", ".")) || 0));
    lineas.forEach((l) => (l.dto = n)); sucio = true; pintarLineas();
  };
  $("#volver").onclick = () => { if (sucio && !confirm("Hay cambios sin guardar. ¿Salir sin guardar?")) return; location.hash = "/parte/" + id; };
  $("#guardarL").onclick = async () => {
    const limpias = lineas.filter((l) => l.descripcion.trim() || l.codigo).map((l) => ({ ...l, cantidad: Number(l.cantidad) || 0, precio: Number(l.precio) || 0, dto: Number(l.dto) || 0 }));
    const cambios = { [campo]: limpias };
    if (tipo === "valoracion") cambios.importe_valorado = totalesLineas(limpias).base;
    await conCarga("Guardando…", () => api.actualizarParte(id, cambios));
    sucio = false; toast("Guardado", "ok"); location.hash = "/parte/" + id;
  };
  pintarLineas();
}

async function vistaTarifa() {
  await cargarTarifa(true);
  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>Tarifa <small class="sub">${S.tarifa.length} códigos</small></h1>
    <button class="btn peq guardar" id="nuevoCod">+ Nuevo</button>
  </header>
  <div class="buscador">${I.search}<input id="bT" type="search" placeholder="Buscar código o descripción" autocomplete="off"></div>
  <div id="listaT" class="resultados"></div>`;
  const pintar = () => {
    const q = $("#bT").value;
    const lista = q.trim() ? buscarEnTarifa(S.tarifa.map((c) => ({ ...c, activo: true })), q, 500) : S.tarifa;
    let cat = null;
    $("#listaT").innerHTML = lista.map((c) => {
      const cab = !q.trim() && c.categoria !== cat ? `<h4 class="cat">${esc((cat = c.categoria) || "Otros")}</h4>` : "";
      return `${cab}<button class="res ${c.activo === false ? "inactivo" : ""}" data-c="${esc(c.codigo)}"><b>${esc(c.codigo)}</b><span>${esc(c.descripcion)}</span><em>${fEuros(c.precio)}</em></button>`;
    }).join("") || '<p class="suave" style="padding:0 16px">Sin resultados.</p>';
    $$("#listaT .res").forEach((b) => b.onclick = () => editarCodigo(S.tarifa.find((c) => c.codigo === b.dataset.c)));
  };
  const editarCodigo = (c) => {
    const nuevo = !c; c = c || { codigo: "", descripcion: "", precio: 0, categoria: "", activo: true };
    const cats = [...new Set(S.tarifa.map((x) => x.categoria).filter(Boolean))];
    const s = abrirSheet(`
      <h2>${nuevo ? "Nuevo código" : "Código " + esc(c.codigo)}</h2>
      <form id="fCod" class="form">
        <label>Código<input name="codigo" value="${esc(c.codigo)}" ${nuevo ? "required" : "readonly"}></label>
        <label>Descripción<textarea name="descripcion" rows="3" required>${esc(c.descripcion)}</textarea></label>
        <div class="dos"><label>Precio (€)<input name="precio" type="number" step="0.01" inputmode="decimal" value="${c.precio}" required></label>
          <label>Categoría<input name="categoria" list="cats" value="${esc(c.categoria || "")}"></label></div>
        <datalist id="cats">${cats.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
        <label class="check"><input type="checkbox" name="activo" ${c.activo !== false ? "checked" : ""}> Activo (sale en las búsquedas)</label>
        <div class="pie-form">${nuevo ? '<button type="button" class="btn" data-cerrar>Cancelar</button>' : '<button type="button" class="btn peligro" id="borrarCod">Borrar</button>'}<button class="btn primario">Guardar</button></div>
      </form>`);
    $("#fCod", s).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      const cod = f.codigo.trim();
      if (nuevo && S.tarifa.some((x) => x.codigo === cod)) return toast("Ese código ya existe", "error");
      await conCarga("Guardando…", () => api.guardarCodigo({ codigo: cod, descripcion: f.descripcion.trim(), precio: Number(String(f.precio).replace(",", ".")) || 0, categoria: f.categoria.trim() || null, activo: !!f.activo, orden: c.orden ?? (Math.max(0, ...S.tarifa.map((x) => x.orden || 0)) + 1) }));
      await cargarTarifa(true); cerrarSheet(); pintar(); toast("Guardado", "ok");
    });
    $("#borrarCod", s)?.addEventListener("click", async () => {
      if (!confirm(`¿Borrar el código ${c.codigo}? Los partes que ya lo tengan no cambian.`)) return;
      await conCarga("Borrando…", () => api.borrarCodigo(c.codigo));
      await cargarTarifa(true); cerrarSheet(); pintar(); toast("Borrado");
    });
  };
  $("#volver").onclick = () => (location.hash = "/ajustes");
  $("#nuevoCod").onclick = () => editarCodigo(null);
  $("#bT").addEventListener("input", pintar);
  pintar();
}

// ------------------------------------------------------------------ Ajustes (solo administrador)
async function vistaAjustes() {
  const E = CFG.EMPRESA, D = CFG.DESTINO_INFORMES || {};
  let partes = S.partes;
  if (!partes.length) { try { partes = S.partes = await api.listarPartes(); } catch { partes = []; } }
  const ahora = new Date(), mes = ahora.toISOString().slice(0, 7);
  const cuenta = (f) => partes.filter(f).length;
  const porAseg = {};
  partes.forEach((p) => { porAseg[p.aseguradora] = (porAseg[p.aseguradora] || 0) + 1; });
  const tarjetaNum = (n, t, c = "") => `<div class="kpi" ${c ? `style="--c:${c}"` : ""}><b>${n}</b><span>${t}</span></div>`;

  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>Ajustes</h1><span></span>
  </header>

  <section class="tarjeta">
    <h3>Resumen</h3>
    <div class="kpis">
      ${tarjetaNum(cuenta((p) => p.estado !== "realizado"), "Pendientes")}
      ${tarjetaNum(cuenta((p) => (p.created_at || "").startsWith(mes)), "Entrados este mes")}
      ${tarjetaNum(cuenta((p) => p.estado === "realizado" && (p.updated_at || "").startsWith(mes)), "Terminados este mes", "#16a34a")}
    </div>
    <div class="kpis">${ESTADOS.map((e) => tarjetaNum(cuenta((p) => p.estado === e.id), e.nombre, e.color)).join("")}</div>
    <div class="dato-lista">${Object.entries(porAseg).sort((a, b) => b[1] - a[1]).map(([a, n]) => `<div class="dato"><span>${esc(a)}</span><b>${n}</b></div>`).join("") || '<p class="suave">Aún no hay partes.</p>'}</div>
  </section>

  <form id="fAjustes" class="form">
    <section class="tarjeta">
      <h3>Datos de la empresa (salen en el PDF)</h3>
      <label>Nombre<input name="e_nombre" value="${esc(E.nombre)}"></label>
      <div class="dos"><label>CIF<input name="e_cif" value="${esc(E.cif)}"></label><label>Teléfono<input name="e_telefono" type="tel" value="${esc(E.telefono)}"></label></div>
      <label>Email<input name="e_email" type="email" value="${esc(E.email)}"></label>
      <label>Dirección<input name="e_direccion" value="${esc(E.direccion)}"></label>
    </section>
    <section class="tarjeta">
      <h3>A quién se envían los PDF</h3>
      <div class="dos"><label>Nombre<input name="d_nombre" value="${esc(D.nombre)}"></label><label>WhatsApp<input name="d_telefono" type="tel" value="${esc(D.telefono)}"></label></div>
    </section>
    <section class="tarjeta">
      <h3>Tarifa de precios</h3>
      <a class="btn ancho" href="#/tarifa">📋 Ver y editar la tarifa (códigos y precios)</a>
      <label>IVA que se suma a las valoraciones (%, 0 = sin IVA)<input name="iva" type="number" step="1" min="0" value="${CFG.IVA ?? 21}"></label>
    </section>
    <section class="tarjeta">
      <h3>Aseguradoras del desplegable</h3>
      <label>Una por línea<textarea name="aseguradoras" rows="7">${esc(CFG.ASEGURADORAS.join("\n"))}</textarea></label>
    </section>
    <section class="tarjeta">
      <h3>Mensaje de WhatsApp al cliente</h3>
      <label>Texto<textarea name="mensaje" rows="4">${esc(CFG.MENSAJE_CLIENTE)}</textarea></label>
      <p class="suave">Puedes usar: {nombre} {empresa} {aseguradora} {expediente} {averia_corta}</p>
    </section>
    <div class="pie-form"><span></span><button type="submit" class="btn primario">Guardar ajustes</button></div>
  </form>

  <section class="tarjeta">
    <div class="h3-fila"><h3>Usuarios</h3><button class="btn peq" id="nuevoUsuario">+ Añadir</button></div>
    <div id="usuarios"><p class="suave">Cargando…</p></div>
  </section>
  <div style="height:40px"></div>`;

  $("#volver").onclick = () => (location.hash = "/");
  $("#fAjustes").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    const datos = {
      EMPRESA: { nombre: f.e_nombre.trim(), cif: f.e_cif.trim(), telefono: f.e_telefono.trim(), email: f.e_email.trim(), direccion: f.e_direccion.trim() },
      DESTINO_INFORMES: { nombre: f.d_nombre.trim(), telefono: f.d_telefono.replace(/\s/g, "") },
      ASEGURADORAS: f.aseguradoras.split("\n").map((x) => x.trim()).filter(Boolean),
      MENSAJE_CLIENTE: f.mensaje.trim(),
      IVA: Number(f.iva) || 0,
    };
    if (!datos.ASEGURADORAS.includes("Otra")) datos.ASEGURADORAS.push("Otra");
    await conCarga("Guardando…", () => api.guardarAjustes(datos));
    ajustesCargados = false; await cargarAjustes();
    toast("Ajustes guardados", "ok");
  });
  $("#nuevoUsuario").onclick = sheetNuevoUsuario;
  pintarUsuarios();
}

async function pintarUsuarios() {
  const cont = $("#usuarios");
  if (!cont) return;
  let lista;
  try { lista = (await api.adminUsuarios("listar")).usuarios; }
  catch (e) { cont.innerHTML = `<p class="suave">No se pudieron cargar: ${esc(e.message)}</p>`; return; }
  cont.innerHTML = lista.map((u) => `
    <div class="usuario" data-id="${u.id}">
      <div><b>${esc(u.nombre || "(sin alta en el equipo)")}</b>${u.es_admin ? ' <span class="etq">admin</span>' : ""}<br>
        <small class="suave">${esc(u.email)}${u.ultimo_acceso ? " · último acceso " + fFecha(u.ultimo_acceso) : ""}</small></div>
      <button class="icono oscuro" data-acc="menu" aria-label="Opciones">${I.more}</button>
    </div>`).join("");
  $$(".usuario [data-acc=menu]", cont).forEach((b) => b.addEventListener("click", () => {
    const u = lista.find((x) => x.id === b.closest(".usuario").dataset.id);
    menuUsuarioAdmin(u);
  }));
}

function sheetNuevoUsuario() {
  const s = abrirSheet(`
    <h2>Nuevo usuario</h2>
    <form id="fUsuario" class="form">
      <label>Nombre<input name="nombre" required></label>
      <label>Email<input name="email" type="email" required autocomplete="off"></label>
      <label>Contraseña (mínimo 8)<input name="password" type="text" minlength="8" required autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" name="es_admin"> Administrador (puede ver Ajustes)</label>
      <p class="suave">Apunta la contraseña y dásela a esa persona. Podrá cambiarla desde su menú.</p>
      <div class="pie-form"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Crear</button></div>
    </form>`);
  $("#fUsuario", s).addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    await conCarga("Creando…", () => api.adminUsuarios("crear", { nombre: f.nombre.trim(), email: f.email.trim(), password: f.password, es_admin: !!f.es_admin }));
    cerrarSheet(); toast("Usuario creado", "ok");
    S.miembros = await api.miembros().catch(() => S.miembros);
    pintarUsuarios();
  });
}

function menuUsuarioAdmin(u) {
  const soyYo = u.id === S.yo.user_id;
  const s = abrirSheet(`
    <h2>${esc(u.nombre || u.email)}</h2>
    <p class="suave">${esc(u.email)}</p>
    <div class="lista-botones">
      <button class="btn ancho" id="uNombre">Cambiar nombre</button>
      <button class="btn ancho" id="uPw">Poner contraseña nueva</button>
      ${soyYo ? "" : `<button class="btn ancho" id="uAdmin">${u.es_admin ? "Quitar administrador" : "Hacer administrador"}</button>`}
      ${soyYo ? "" : '<button class="btn ancho peligro" id="uBorrar">Borrar usuario</button>'}
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>`);
  const fin = async (msg) => { cerrarSheet(); toast(msg, "ok"); S.miembros = await api.miembros().catch(() => S.miembros); pintarUsuarios(); };
  $("#uNombre", s).onclick = async () => {
    const n = prompt("Nombre", u.nombre || ""); if (!n) return;
    await conCarga("Guardando…", () => api.adminUsuarios("editar", { id: u.id, nombre: n.trim() }));
    fin("Nombre cambiado");
  };
  $("#uPw", s).onclick = async () => {
    const pw = prompt("Contraseña nueva (mínimo 8 caracteres)"); if (!pw) return;
    if (pw.length < 8) return toast("Mínimo 8 caracteres", "error");
    await conCarga("Guardando…", () => api.adminUsuarios("password", { id: u.id, password: pw }));
    fin("Contraseña cambiada");
  };
  $("#uAdmin", s)?.addEventListener("click", async () => {
    await conCarga("Guardando…", () => api.adminUsuarios("editar", { id: u.id, es_admin: !u.es_admin }));
    fin("Permisos cambiados");
  });
  $("#uBorrar", s)?.addEventListener("click", async () => {
    if (!confirm(`¿Borrar a ${u.nombre || u.email}? Ya no podrá entrar. Sus partes se conservan.`)) return;
    await conCarga("Borrando…", () => api.adminUsuarios("borrar", { id: u.id }));
    fin("Usuario borrado");
  });
}

// ------------------------------------------------------------------ Instalar como app
let avisoInstalar = null;
const yaInstalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); avisoInstalar = e;
  $("#btnInstalar")?.classList.remove("oculto");
});
window.addEventListener("appinstalled", () => { avisoInstalar = null; toast("App instalada", "ok"); $("#btnInstalar")?.classList.add("oculto"); });
async function instalarApp() {
  if (avisoInstalar) { avisoInstalar.prompt(); await avisoInstalar.userChoice; avisoInstalar = null; $("#btnInstalar")?.classList.add("oculto"); return; }
  abrirSheet(`<h2>Instalar la app</h2>
    <p><b>Android (Chrome):</b> menú ⋮ → <b>Añadir a pantalla de inicio</b> → Instalar.</p>
    <p><b>Windows (Chrome):</b> icono de instalar (📥) a la derecha de la barra de direcciones, o menú ⋮ → <b>Enviar, guardar y compartir → Instalar página como app</b>.</p>
    <p><b>iPhone (Safari):</b> botón Compartir → <b>Añadir a pantalla de inicio</b>.</p>
    <button class="btn texto ancho" data-cerrar>Cerrar</button>`);
}

// Al volver a la app (otra pestaña, desbloquear el móvil…) se recargan los partes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && $("#lista") && S.yo) cargarPartes();
});

// ------------------------------------------------------------------ Arranque
$("#inCamara").addEventListener("change", (e) => { procesarArchivo(e.target.files[0]); e.target.value = ""; });
$("#inArchivo").addEventListener("change", (e) => { procesarArchivo(e.target.files[0]); e.target.value = ""; });
api.onAuth(async (ses, evento) => {
  if (evento === "PASSWORD_RECOVERY") {
    const pw = prompt("Escribe tu nueva contraseña (mínimo 8 caracteres)");
    if (pw && pw.length >= 8) { await conCarga("Guardando…", () => api.cambiarPassword(pw)); toast("Contraseña cambiada", "ok"); }
    return;
  }
  if (!ses && S.yo) { S.yo = null; router(); }
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
router();
