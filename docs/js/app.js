import { api } from "./api.js";
import {
  $, $$, esc, ESTADOS, estadoInfo, idxEstado, colorAseg, linkLlamar, linkWhatsApp, linkMapa,
  fFecha, fFechaHora, fEuros, hace, toLocalInput, blobABase64, comprimirImagen, panelFirma, toast,
} from "./util.js";
import { generarInforme } from "./pdf.js";

const CFG = window.APP_CONFIG;
const app = $("#app");
const S = {
  yo: null, miembros: [], partes: [],
  filtro: sessionGet("filtro") ?? "activos", busqueda: "", soloMios: sessionGet("soloMios") === "1",
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
  if (api.modo === "supabase" && !S.yo?.nombre) return vistaSinAcceso();
  const [, ruta, id] = h.split("/");
  window.scrollTo(0, 0);
  if (!ruta) return vistaLista();
  if (ruta === "nuevo") return vistaFormulario(null);
  if (ruta === "parte" && id) return vistaParte(id);
  if (ruta === "editar" && id) return vistaFormulario(id);
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
      <button class="icono" id="recargar" aria-label="Recargar">${I.refresh}</button>
      <button class="icono" id="menuUsuario" aria-label="Usuario">${I.user}</button>
    </div>
  </header>
  ${api.modo === "demo" ? '<div class="demo">MODO DEMO · los datos solo se guardan en este navegador</div>' : ""}
  <div class="buscador">
    ${I.search}<input id="busca" type="search" placeholder="Buscar nombre, expediente, calle, teléfono…" value="${esc(S.busqueda)}">
  </div>
  <div class="chips" id="chips"></div>
  <label class="solo-mios"><input type="checkbox" id="soloMios" ${S.soloMios ? "checked" : ""}> Solo asignados a mí</label>
  <main id="lista" class="lista"><div class="vacio">Cargando…</div></main>
  <button class="fab" id="nuevo" aria-label="Nuevo parte">${I.plus}</button>`;

  $("#busca").addEventListener("input", (e) => { S.busqueda = e.target.value; pintarLista(); });
  $("#soloMios").addEventListener("change", (e) => { S.soloMios = e.target.checked; sessionSet("soloMios", S.soloMios ? "1" : "0"); pintarLista(); });
  $("#nuevo").addEventListener("click", menuNuevo);
  $("#recargar").addEventListener("click", cargarPartes);
  $("#menuUsuario").addEventListener("click", menuUsuario);
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
  if (q) base = base.filter((p) =>
    [p.nombre, p.expediente, p.num_encargo, p.direccion, p.poblacion, p.telefono, p.aseguradora, p.averia, p.poliza]
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
      <span class="estado" style="--c:${e.color}">${e.nombre}</span>
    </div>
    <div class="parte-nombre">${esc(p.nombre || "Sin nombre")}</div>
    <div class="parte-dir">${esc([p.direccion, p.poblacion].filter(Boolean).join(", "))}</div>
    ${p.averia ? `<div class="parte-averia">${esc(p.averia)}</div>` : ""}
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
      ${api.modo === "supabase" ? '<button class="btn ancho" id="cambiarPw">Cambiar contraseña</button>' : ""}
      <button class="btn ancho" id="exportar">Exportar partes (CSV)</button>
      ${api.modo === "supabase" ? '<button class="btn ancho peligro" id="salir">Cerrar sesión</button>' : ""}
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>`);
  $("#salir", s)?.addEventListener("click", async () => { await api.salir(); S.yo = null; cerrarSheet(); router(); });
  $("#exportar", s).addEventListener("click", exportarCSV);
  $("#cambiarPw", s)?.addEventListener("click", async () => {
    const pw = prompt("Nueva contraseña (mínimo 8 caracteres)");
    if (!pw) return;
    if (pw.length < 8) return toast("Mínimo 8 caracteres", "error");
    await conCarga("Guardando…", () => api.cambiarPassword(pw));
    toast("Contraseña cambiada", "ok"); cerrarSheet();
  });
}

function exportarCSV() {
  const cols = ["aseguradora", "expediente", "num_encargo", "poliza", "estado", "nombre", "telefono", "direccion", "codigo_postal", "poblacion", "averia", "importe_valorado", "importe_autorizado", "fecha_cita", "created_at", "updated_at"];
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
  let blob = file, mime = esPDF ? "application/pdf" : "image/jpeg";
  try {
    cargando(true, "Preparando documento…");
    if (!esPDF) blob = await comprimirImagen(file, 2000, 0.85);
    if (blob.size > 9.5 * 1024 * 1024) throw new Error("El archivo pesa demasiado (máx. 9 MB)");
    cargando(true, "Leyendo el parte con IA…");
    const datos = await api.extraer(await blobABase64(blob), mime);
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
      <div class="dos">${campo("poliza", "Póliza")}${campo("fecha_encargo", "Fecha de encargo", "date")}</div>
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
    if (!f.aseguradora) return toast("Elige la aseguradora", "error");
    try {
      if (id) {
        await conCarga("Guardando…", () => api.actualizarParte(id, f));
        toast("Guardado", "ok");
        location.replace("#/parte/" + id);
      } else {
        const dup = await api.buscarDuplicado(f.aseguradora, f.expediente);
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
    <div class="estado-actual" style="--c:${e.color}">Estado: <b>${e.nombre}</b>${p.fecha_cita && idx < 2 ? ` · Cita ${fFechaHora(p.fecha_cita)}` : ""}</div>
    <div class="lista-botones">
      ${sig ? `<button class="btn primario ancho" id="avanzar" style="--c:${sig.color}">Marcar como ${sig.nombre.toLowerCase()} →</button>` : ""}
      ${p.estado === "realizado" ? `<button class="btn primario ancho" id="informe" style="--c:#16a34a">${I.pdf} Generar PDF y enviar al tramitador</button>` : ""}
      <button class="btn ancho" id="nota">Añadir nota</button>
    </div>
  </section>

  <section class="tarjeta">
    <h3>Avería / daño</h3>
    <p class="pre">${esc(p.averia || "—")}</p>
  </section>

  <section class="tarjeta datos">
    <h3>Datos</h3>
    ${dato("Nº encargo", p.num_encargo)}
    ${dato("Póliza", p.poliza)}
    ${dato("Fecha encargo", fFecha(p.fecha_encargo))}
    ${dato("Cita", fFechaHora(p.fecha_cita))}
    ${dato("Valorado", fEuros(p.importe_valorado))}
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
          ${!ev.estado ? `<button class="borrar-nota" data-id="${ev.id}" aria-label="Borrar nota">${I.x}</button>` : ""}
        </li>`;
      }).join("")}
    </ol>
  </section>
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
  $$(".borrar-nota").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("¿Borrar esta nota?")) return;
    await conCarga("Borrando…", () => api.borrarEvento(Number(b.dataset.id)));
    vistaParte(p.id);
  }));
  pintarFotos(p);
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
      <button class="btn ancho" id="mEditar">${I.edit} Editar datos</button>
      <button class="btn ancho" id="mInforme">${I.pdf} Generar PDF (en cualquier fase)</button>
      <button class="btn ancho peligro" id="mBorrar">Borrar parte</button>
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>`);
  $("#mEditar", s).onclick = () => { location.hash = "/editar/" + p.id; };
  $("#mInforme", s).onclick = () => flujoInforme(p);
  $("#mBorrar", s).onclick = async () => {
    if (!confirm("¿Borrar este parte con todas sus fotos y notas? No se puede deshacer.")) return;
    await conCarga("Borrando…", () => api.borrarParte(p.id));
    toast("Parte borrado"); location.hash = "/";
  };
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
      ${destino === "valorado" ? `<label>Importe valorado (€)<input type="number" step="0.01" inputmode="decimal" name="importe_valorado" value="${p.importe_valorado ?? ""}"></label>` : ""}
      ${destino === "autorizado" ? `<label>Importe autorizado (€)<input type="number" step="0.01" inputmode="decimal" name="importe_autorizado" value="${p.importe_autorizado ?? p.importe_valorado ?? ""}"></label>` : ""}
      ${destino === "visitado" ? `<label class="btn ancho">${I.cam} Fotos de antes (opcional)<input type="file" accept="image/*" multiple hidden name="fotos" data-tipo="antes"></label><small class="suave" id="nFotos"></small>` : ""}
      ${destino === "realizado" ? `
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
      if (destino === "realizado") {
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
  const texto = `Informe del expediente ${p.expediente || ""} (${p.aseguradora}) - ${p.nombre || ""}. Trabajo realizado.`;
  const tel = p.tramitador_telefono;
  const s = abrirSheet(`
    <h2>PDF listo</h2>
    <p class="suave">${esc(nombre)}</p>
    <div class="lista-botones">
      ${puedeCompartir ? `<button class="btn primario grande" id="compartir" style="--c:#16a34a">${I.wa}<span><b>Enviar PDF por WhatsApp</b><small>Elige WhatsApp y luego al tramitador${p.tramitador_nombre ? " (" + esc(p.tramitador_nombre) + ")" : ""}</small></span></button>` : ""}
      ${tel ? `<a class="btn grande" id="waEnlace" target="_blank" rel="noopener" href="${linkWhatsApp(tel, texto + (enlace ? "\n" + enlace : ""))}">${I.wa}<span><b>WhatsApp directo al tramitador</b><small>${enlace ? "Mensaje con enlace al PDF (válido 30 días)" : "Abre el chat; adjunta el PDF descargado"}</small></span></a>` : ""}
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
