import { api } from "./api.js";
import {
  $, $$, esc, ESTADOS, estadoInfo, idxEstado, colorAseg, linkLlamar, linkWhatsApp, linkMapa,
  fFecha, fFechaHora, fEuros, hace, toLocalInput, blobABase64, comprimirImagen, panelFirma, toast,
  importeLinea, totalesLineas, buscarEnTarifa, codigoAdicional, chipDias, recortarImagen, linkCalendario, diasParte, zonaDe, girarImagen,
} from "./util.js";
// pdf.js se carga solo cuando hace falta (si falla, no impide arrancar la app)
const cargarPDF = () => import("./pdf.js");

const CFG = window.APP_CONFIG;
const DEST = {
  get nombre() { return CFG.DESTINO_INFORMES?.nombre || "tramitador"; },
  get telefono() { return CFG.DESTINO_INFORMES?.telefono || ""; },
};
// "Conexión": el seguro no encarga el trabajo; el cliente pide presupuesto particular
// (se le manda a él, con IVA, y lo paga él: no entra en la relación de MULTIBETT)
const esConexion = (p) => p?.tipo === "conexion";
const ivaDe = (p) => (esConexion(p) ? Number(CFG.IVA_FACTURA ?? 21) : Number(CFG.IVA || 0));
const destinoDe = (p) => esConexion(p)
  ? { nombre: "el cliente", tel: p.telefono || "" }
  : { nombre: DEST.telefono ? DEST.nombre : "el tramitador", tel: DEST.telefono || p.tramitador_telefono || "" };
const aQuien = (q) => (q.startsWith("el ") ? "al " + q.slice(3) : "a " + q);
let ajustesCargados = false;
async function cargarAjustes() {
  try {
    const a = await api.leerAjustes();
    if (a.EMPRESA) CFG.EMPRESA = { ...CFG.EMPRESA, ...a.EMPRESA };
    if (a.DESTINO_INFORMES) CFG.DESTINO_INFORMES = { ...CFG.DESTINO_INFORMES, ...a.DESTINO_INFORMES };
    if (Array.isArray(a.ASEGURADORAS) && a.ASEGURADORAS.length) CFG.ASEGURADORAS = a.ASEGURADORAS;
    if (a.MENSAJE_CLIENTE) CFG.MENSAJE_CLIENTE = a.MENSAJE_CLIENTE;
    if (a.IVA != null && a.IVA !== "") CFG.IVA = Number(a.IVA);
    if (a.WHATSAPP_APP) CFG.WHATSAPP_APP = a.WHATSAPP_APP;
    if (Array.isArray(a.ZONAS)) CFG.ZONAS = a.ZONAS;
    if (a.PRECIOS_IA && typeof a.PRECIOS_IA === "object") CFG.PRECIOS_IA = a.PRECIOS_IA;
    if (a.DIAS_COBRO) CFG.DIAS_COBRO = Number(a.DIAS_COBRO);
    if (a.IVA_FACTURA != null && a.IVA_FACTURA !== "") CFG.IVA_FACTURA = Number(a.IVA_FACTURA);
    if (a.ULTIMA_COPIA) CFG.ULTIMA_COPIA = a.ULTIMA_COPIA;
    ajustesCargados = true;
  } catch { /* se usan los valores de config.js */ }
}
const app = $("#app");
const S = {
  yo: null, miembros: [], partes: [],
  filtro: sessionGet("filtro") ?? "activos", busqueda: "", soloMios: sessionGet("soloMios") === "1",
  orden: sessionGet("orden") ?? "recientes", filtroAseg: sessionGet("filtroAseg") ?? "", filtroZona: sessionGet("filtroZona") ?? "", fx: (() => { try { return JSON.parse(sessionGet("fx") || "{}"); } catch { return {}; } })(),
  borrador: null, // parte nuevo pendiente de guardar {datos, archivo, mime}
};

// Usuarios sin permiso de precios: la app no les muestra importes (solo se oculta en pantalla).
const verPrecios = () => api.modo !== "supabase" ? sessionGet("demoSinPrecios") !== "1" : (S.yo?.es_admin || S.yo?.ver_precios !== false);
function sessionGet(k) { try { return localStorage.getItem("pa_" + k); } catch { return null; } }
function sessionSet(k, v) { try { localStorage.setItem("pa_" + k, v); } catch { /* nada */ } }

// ------------------------------------------------------------------ Iconos
const I = {
  home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
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
// Las ventanas (hojas) ocupan una entrada del historial: el botón "atrás" del móvil cierra la ventana
// en lugar de salir de la pantalla (y perder lo que hubiera detrás).
let sheetEnHistorial = false;
const quitarSheets = () => $$(".sheet-fondo").forEach((f) => f.remove());
function abrirSheet(html) {
  quitarSheets();
  const fondo = document.createElement("div");
  fondo.className = "sheet-fondo";
  fondo.innerHTML = `<div class="sheet" role="dialog"><div class="sheet-asa"></div>${html}</div>`;
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrarSheetUsuario(); });
  document.body.appendChild(fondo);
  requestAnimationFrame(() => fondo.classList.add("abierto"));
  $$("[data-cerrar]", fondo).forEach((b) => b.addEventListener("click", cerrarSheetUsuario));
  if (!sheetEnHistorial) {
    if (!history.state?.sheet) history.pushState({ sheet: 1 }, "");
    sheetEnHistorial = true;
  }
  return $(".sheet", fondo);
}
// Cierre desde el código (p. ej. antes de navegar): quita la ventana y, si no se navega a otro sitio, retira su entrada del historial
function cerrarSheet() {
  quitarSheets();
  if (!sheetEnHistorial) return;
  sheetEnHistorial = false;
  const hash = location.hash;
  setTimeout(() => { if (!sheetEnHistorial && history.state?.sheet && location.hash === hash) history.back(); }, 0);
}
// Cierre por el usuario (Cerrar, Cancelar, tocar fuera)
function cerrarSheetUsuario() {
  quitarSheets();
  if (sheetEnHistorial) { sheetEnHistorial = false; history.back(); }
}
window.addEventListener("popstate", () => {
  if (sheetEnHistorial) { sheetEnHistorial = false; quitarSheets(); return; }   // atrás con una ventana abierta: solo se cierra
  if (history.state?.sheet && !$(".sheet-fondo")) history.back();              // entrada sobrante de una ventana ya cerrada
});

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

// ------------------------------------------------------------------ Copyright y versión
const pieCopyright = () => `<footer class="copyright">© ${new Date().getFullYear()} ${esc(CFG.AUTOR || "Alfonso Carrascosa Martínez")} · Todos los derechos reservados<br>${CFG.IDEA ? "Idea original: " + esc(CFG.IDEA) + "<br>" : ""}${CFG.HECHA_CON ? esc(CFG.HECHA_CON) + "<br>" : ""}Partes · versión ${esc(CFG.VERSION || "")}${CFG.FECHA_VERSION ? " (" + esc(CFG.FECHA_VERSION) + ")" : ""}</footer>`;

// ------------------------------------------------------------------ Router
window.addEventListener("hashchange", router);
async function router() {
  cerrarSheet();
  S.antesDeSalir = null;
  const h = location.hash.slice(1) || "/";
  const ses = await api.sesion();
  if (!ses) return vistaLogin();
  if (!S.yo) {
    S.yo = await api.yo();
    try { S.miembros = await api.miembros(); } catch { S.miembros = []; }
  }
  if (!ajustesCargados) await cargarAjustes();
  if (api.modo === "supabase" && !S.yo?.nombre) return vistaSinAcceso();
  document.body.classList.toggle("sin-precios", !verPrecios());
  const [, ruta, id] = h.split("/");
  document.body.dataset.vista = ruta || "lista";
  window.scrollTo(0, 0);
  if (!ruta) return vistaLista();
  if (ruta === "nuevo") return vistaFormulario(null);
  if (ruta === "parte" && id) return vistaParte(id);
  if (ruta === "editar" && id) return vistaFormulario(id);
  if (ruta === "lineas" && id) return vistaLineas(id, h.split("/")[3] || "valoracion");
  if (ruta === "papelera") return vistaPapelera();
  if (ruta === "compartido") return vistaCompartido();
  if (ruta === "agenda") return vistaAgenda();
  if (ruta === "lote") return vistaLote();
  if (ruta === "facturacion") return (S.yo?.es_admin || api.modo !== "supabase") ? vistaFacturacion() : (location.hash = "/");
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
    ${pieCopyright()}
  </div>`;
  $("#fLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await conCarga("Entrando…", () => api.entrar(f.get("email"), f.get("password")));
    S.yo = null; router();
setTimeout(() => { try { sessionStorage.removeItem("pa_recarga"); } catch { /* nada */ } }, 8000);
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
      <button class="icono" id="btnResumen" aria-label="Pendientes de hoy">${I.bell}<b class="badge" id="nResumen"></b></button>
      <a class="icono" href="#/agenda" aria-label="Agenda">${I.cal}</a>
      <button class="icono" id="recargar" aria-label="Recargar">${I.refresh}</button>
      <button class="icono" id="menuUsuario" aria-label="Usuario">${I.user}</button>
    </div>
  </header>
  ${api.modo === "demo" ? '<div class="demo">MODO DEMO · los datos solo se guardan en este navegador</div>' : ""}
  <div class="buscador">
    ${I.search}<input id="busca" type="search" placeholder="Buscar nombre, expediente, calle, teléfono…" value="${esc(S.busqueda)}">
  </div>
  <div class="chips" id="chips"></div>
  <div class="chips zonas" id="chipsZona"></div>
  <div class="filtros">
    <label class="solo-mios"><input type="checkbox" id="soloMios" ${S.soloMios ? "checked" : ""}> Solo míos</label>
    <select id="fAseg"><option value="">Todas las aseguradoras</option>${[...new Set(S.partes.map((p) => p.aseguradora).concat(CFG.ASEGURADORAS))].filter((a) => a && a !== "Otra").map((a) => `<option ${a === S.filtroAseg ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>
    <select id="orden">
      ${[["recientes", "Últimos movidos"], ["antiguos", "Más días primero"], ["cita", "Próxima cita"], ["nuevos", "Últimos entrados"]].map(([v, t]) => `<option value="${v}" ${S.orden === v ? "selected" : ""}>${t}</option>`).join("")}
    </select>
    <button class="btn peq" id="btnFiltros">⚙️ Más filtros<b id="nFiltros"></b></button>
  </div>
  <div class="filtros-activos" id="fActivos"></div>
  <div id="avisoLote"></div>
  <main id="lista" class="lista"><div class="vacio">Cargando…</div></main>
  <button class="fab" id="nuevo" aria-label="Nuevo parte">${I.plus}</button>`;

  $("#busca").addEventListener("input", (e) => { S.busqueda = e.target.value; pintarLista(); });
  $("#soloMios").addEventListener("change", (e) => { S.soloMios = e.target.checked; sessionSet("soloMios", S.soloMios ? "1" : "0"); pintarLista(); });
  $("#fAseg").addEventListener("change", (e) => { S.filtroAseg = e.target.value; sessionSet("filtroAseg", S.filtroAseg); pintarLista(); });
  $("#orden").addEventListener("change", (e) => { S.orden = e.target.value; sessionSet("orden", S.orden); pintarLista(); });
  $("#btnFiltros").addEventListener("click", sheetFiltros);
  $("#btnResumen").addEventListener("click", () => sheetResumen(true));
  $("#nuevo").addEventListener("click", menuNuevo);
  $("#recargar").addEventListener("click", cargarPartes);
  $("#menuUsuario").addEventListener("click", menuUsuario);
  $("#btnInstalar")?.addEventListener("click", instalarApp);
  avisoLotePendiente();
  await cargarPartes();
  if (S.saltarResumen) S.saltarResumen = false; else sheetResumen(false);
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
  const baseSinZona = base;
  if (S.filtroZona) base = base.filter((p) => (zonaDe(p) || "-") === S.filtroZona);
  base = base.filter(pasaFiltrosExtra);
  pintarFiltrosActivos();
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
  const enFase = (p) => S.filtro === "todos" || (S.filtro === "activos" ? p.estado !== "realizado" : p.estado === S.filtro);
  const cz = (z) => baseSinZona.filter((p) => enFase(p) && (zonaDe(p) || "-") === z).length;
  const zonasChips = [{ id: "", nombre: "📍 Todas las zonas", n: baseSinZona.filter(enFase).length },
    ...(CFG.ZONAS || []).map((z) => ({ id: z.nombre, nombre: z.nombre, n: cz(z.nombre) })),
    { id: "-", nombre: "Sin zona", n: cz("-") }];
  $("#chipsZona").innerHTML = zonasChips.map((c) =>
    `<button class="chip ${S.filtroZona === c.id ? "activo" : ""}" data-z="${esc(c.id)}">${esc(c.nombre)}<b>${c.n}</b></button>`).join("");
  $$("#chipsZona .chip").forEach((b) => b.addEventListener("click", () => { S.filtroZona = b.dataset.z; sessionSet("filtroZona", S.filtroZona); pintarLista(); }));

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

// ------------------------------------------------------------------ Más filtros
const hoyISO = () => new Date().toISOString().slice(0, 10);
const inicioDia = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const FILTROS_EXTRA = {
  tipo: { t: "Tipo", op: () => [["siniestro", "Encargos del seguro"], ["conexion", "Conexión (presupuesto particular)"]],
    fn: (p, v) => (v === "conexion" ? esConexion(p) : !esConexion(p)) },
  tecnico: { t: "Técnico", op: () => [["-", "Sin asignar"], ...S.miembros.map((m) => [m.user_id, m.nombre])],
    fn: (p, v) => (v === "-" ? !p.asignado_a : p.asignado_a === v) },
  dias: { t: "Antigüedad", op: () => [["7", "Más de 7 días"], ["15", "Más de 15 días"], ["30", "Más de 30 días"], ["60", "Más de 60 días (atascados)"]],
    fn: (p, v) => diasParte(p) > Number(v) },
  entrada: { t: "Entrada", op: () => [["hoy", "Hoy"], ["7", "Últimos 7 días"], ["mes", "Este mes"], ["mesant", "Mes pasado"]],
    fn: (p, v) => {
      const c = new Date(p.created_at), hoy = inicioDia();
      if (v === "hoy") return c >= hoy;
      if (v === "7") return c >= new Date(hoy - 6 * 864e5);
      const m0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      if (v === "mes") return c >= m0;
      const m1 = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      return c >= m1 && c < m0;
    } },
  cita: { t: "Cita", op: () => [["hoy", "Hoy"], ["manana", "Mañana"], ["semana", "Próximos 7 días"], ["pasada", "Cita pasada sin visitar"], ["sin", "Contactado sin cita"]],
    fn: (p, v) => {
      const hoy = inicioDia(), f = p.fecha_cita ? new Date(p.fecha_cita) : null;
      if (v === "sin") return p.estado === "contactado" && !f;
      if (!f) return false;
      if (v === "hoy") return f >= hoy && f < new Date(+hoy + 864e5);
      if (v === "manana") return f >= new Date(+hoy + 864e5) && f < new Date(+hoy + 2 * 864e5);
      if (v === "semana") return f >= hoy && f < new Date(+hoy + 7 * 864e5);
      if (v === "pasada") return f < hoy && idxEstado(p.estado) < idxEstado("visitado");
      return true;
    } },
  falta: { t: "Le falta", op: () => [["telefono", "Teléfono"], ["direccion", "Dirección o población"], ["contactar", "Contactar (recibido hace más de 2 días)"],
      ["valorar", "Valoración (visitado sin valorar)"], ["autorizar", "Autorización (valorado hace más de 7 días)"], ["terminar", "Terminar (autorizado)"]],
    fn: (p, v) => {
      if (v === "telefono") return !/\d{9}/.test(String(p.telefono || "").replace(/\D/g, ""));
      if (v === "direccion") return !p.direccion || !p.poblacion;
      if (v === "contactar") return p.estado === "recibido" && diasParte(p) > 2;
      if (v === "valorar") return p.estado === "visitado" && !(p.lineas_valoracion || []).length && p.importe_valorado == null;
      if (v === "autorizar") return p.estado === "valorado" && (Date.now() - new Date(p.updated_at)) / 864e5 > 7;
      if (v === "terminar") return p.estado === "autorizado";
      return true;
    } },
  importe: { t: "Importe valorado", op: () => [["0-300", "Hasta 300 €"], ["300-1000", "300 € a 1.000 €"], ["1000-", "Más de 1.000 €"], ["sin", "Sin importe"]],
    fn: (p, v) => {
      const i = p.importe_valorado;
      if (v === "sin") return i == null;
      if (i == null) return false;
      const [a, b] = v.split("-").map((x) => (x === "" ? Infinity : Number(x)));
      return i >= a && i < b;
    } },
  otros: { t: "Otros", op: () => [["repetidos", "Solo repetidos"], ["norepetidos", "Sin repetidos"]],
    fn: (p, v) => {
      if (v === "repetidos") return !!p.repetido_de;
      if (v === "norepetidos") return !p.repetido_de;
      return true;
    } },
};
function filtrosDisponibles() {
  return Object.entries(FILTROS_EXTRA).filter(([k]) => k !== "importe" || verPrecios());
}
function pasaFiltrosExtra(p) {
  return Object.entries(S.fx || {}).every(([k, v]) => !v || !FILTROS_EXTRA[k] || (k === "importe" && !verPrecios()) || FILTROS_EXTRA[k].fn(p, v));
}
function guardarFx() { sessionSet("fx", JSON.stringify(S.fx)); }
function pintarFiltrosActivos() {
  const cont = $("#fActivos"); if (!cont) return;
  const act = Object.entries(S.fx || {}).filter(([k, v]) => v && FILTROS_EXTRA[k]);
  $("#nFiltros").textContent = act.length ? " " + act.length : "";
  cont.innerHTML = act.map(([k, v]) => {
    const f = FILTROS_EXTRA[k], t = (f.op().find(([x]) => x === v) || [v, v])[1];
    return `<button class="chip activo peq-chip" data-quitar="${k}">${esc(f.t)}: ${esc(t)} ✕</button>`;
  }).join("") + (act.length > 1 ? '<button class="chip peq-chip" data-quitar="*">Quitar todos</button>' : "");
  $$("[data-quitar]", cont).forEach((b) => b.onclick = () => {
    if (b.dataset.quitar === "*") S.fx = {}; else delete S.fx[b.dataset.quitar];
    guardarFx(); pintarLista();
  });
}
function sheetFiltros() {
  const s = abrirSheet(`
    <h2>Más filtros</h2>
    <div class="form-filtros">
      ${filtrosDisponibles().map(([k, f]) => `
        <label>${esc(f.t)}<select data-fx="${k}"><option value="">— Todos —</option>
          ${f.op().map(([v, t]) => `<option value="${esc(v)}" ${S.fx[k] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}
        </select></label>`).join("")}
    </div>
    <p class="suave" id="fxCuenta"></p>
    <div class="pie-form"><button class="btn" id="fxLimpiar">Quitar filtros</button><button class="btn primario" data-cerrar>Ver resultados</button></div>`);
  const cuenta = () => { pintarLista(); $("#fxCuenta", s).textContent = `${$$("#lista .parte").length} partes con estos filtros`; };
  $$("[data-fx]", s).forEach((sel) => sel.addEventListener("change", () => { S.fx[sel.dataset.fx] = sel.value; if (!sel.value) delete S.fx[sel.dataset.fx]; guardarFx(); cuenta(); }));
  $("#fxLimpiar", s).onclick = () => { S.fx = {}; guardarFx(); $$("[data-fx]", s).forEach((x) => (x.value = "")); cuenta(); };
  cuenta();
}

// ------------------------------------------------------------------ Resumen de pendientes
const DIAS_COPIA = 7;   // aviso de copia de seguridad cada semana
function datosResumen() {
  const ps = S.partes || [];
  const cuenta = (k, v) => ps.filter((p) => FILTROS_EXTRA[k].fn(p, v)).length;
  return [
    { k: "cita", v: "hoy", t: "📅 Citas de hoy", n: cuenta("cita", "hoy"), aviso: false },
    { k: "cita", v: "pasada", t: "⏰ Cita pasada y sin marcar visitado", n: cuenta("cita", "pasada"), aviso: true },
    { k: "falta", v: "contactar", t: "📞 Sin contactar (más de 2 días)", n: cuenta("falta", "contactar"), aviso: true },
    { k: "cita", v: "sin", t: "🗓️ Contactados sin cita", n: cuenta("cita", "sin"), aviso: true },
    { k: "falta", v: "valorar", t: "📋 Visitados sin valorar", n: cuenta("falta", "valorar"), aviso: true },
    { k: "falta", v: "autorizar", t: "⏳ Valorados sin respuesta (más de 7 días)", n: cuenta("falta", "autorizar"), aviso: true },
    { k: "falta", v: "terminar", t: "🔧 Autorizados pendientes de hacer", n: cuenta("falta", "terminar"), aviso: false },
    { k: "dias", v: "30", t: "🔴 Atascados (más de 30 días)", n: ps.filter((p) => p.estado !== "realizado" && diasParte(p) > 30).length, aviso: true },
    ...((S.yo?.es_admin || api.modo !== "supabase") && ps.length ? (() => {
      const ult = CFG.ULTIMA_COPIA || sessionGet("ultimaCopia");
      const dias = ult ? Math.floor((Date.now() - new Date(ult)) / 864e5) : null;
      const toca = dias == null || dias >= DIAS_COPIA;
      return [{ accion: copiaSeguridad, t: `💾 Copia de seguridad: ${ult ? (dias === 0 ? "hecha hoy" : `última hace ${dias} día${dias === 1 ? "" : "s"}`) : "nunca hecha"}${toca ? " · pulsa para descargarla" : ""}`, n: toca ? 1 : 0, aviso: toca }];
    })() : []),
    ...(verPrecios() && (S.yo?.es_admin || api.modo !== "supabase") ? (() => {
      const f = datosFacturacion();
      return [
        { ir: "/facturacion", t: "🧾 Terminados de meses anteriores sin facturar", n: f.sinFacturarAnteriores.length, aviso: true },
        { ir: "/facturacion", t: "💶 Facturas vencidas sin cobrar", n: f.facturas.filter((x) => !x.cobrado && x.dias != null && x.dias < 0).length, aviso: true },
      ];
    })() : []),
  ];
}
function sheetResumen(forzar, soloContador) {
  const d = datosResumen();
  const avisos = d.filter((x) => x.aviso).reduce((a, x) => a + x.n, 0);
  const b = $("#nResumen"); if (b) b.textContent = avisos ? String(avisos) : "";
  if (soloContador) return;
  const hoy = new Date().toISOString().slice(0, 10);
  if (!forzar && (sessionGet("resumen") === hoy || !d.some((x) => x.n))) return;
  sessionSet("resumen", hoy);
  const s = abrirSheet(`
    <h2>Pendientes de hoy</h2>
    <div class="resumen">${d.filter((x) => x.n || forzar).map((x, i) => `
      <button class="res-fila ${x.n ? "" : "cero"} ${x.aviso && x.n ? "aviso" : ""}" data-i="${d.indexOf(x)}"><span>${x.t}</span><b>${x.n}</b></button>`).join("")}
    </div>
    <p class="suave">Pulsa una fila para ver esos partes. Este resumen sale una vez al día; puedes abrirlo con la campana 🔔.</p>
    <button class="btn texto ancho" data-cerrar>Cerrar</button>`);
  $$(".res-fila", s).forEach((el) => el.addEventListener("click", () => {
    const x = d[el.dataset.i];
    if (x.ir) { cerrarSheet(); location.hash = x.ir; return; }
    if (x.accion) { cerrarSheet(); x.accion(); return; }
    if (x.k === "dias") { S.fx = { dias: "30" }; S.filtro = "activos"; }
    else { S.fx = { [x.k]: x.v }; S.filtro = "todos"; }
    S.filtroZona = ""; sessionSet("filtroZona", ""); sessionSet("filtro", S.filtro); guardarFx();
    cerrarSheet();
    if (location.hash.replace("#", "") !== "/" && location.hash !== "") location.hash = "/"; else pintarLista();
  }));
}

// ------------------------------------------------------------------ Agenda de citas
async function vistaAgenda() {
  if (!S.partes?.length) { try { S.partes = await api.listarPartes(); } catch { S.partes = []; } }
  let zona = sessionGet("agendaZona") ?? "";
  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>Agenda de citas</h1><span></span>
  </header>
  <div class="chips zonas" id="agZonas"></div>
  <main id="agenda" class="agenda"></main>`;
  $("#volver").onclick = () => (location.hash = "/");
  const dirDe = (p) => [p.direccion, p.codigo_postal, p.poblacion].filter(Boolean).join(", ");
  const pinta = () => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const conCita = S.partes.filter((p) => p.fecha_cita && p.estado !== "realizado" && (!zona || (zonaDe(p) || "-") === zona));
    const pasadas = conCita.filter((p) => new Date(p.fecha_cita) < hoy && idxEstado(p.estado) < idxEstado("visitado"));
    const prox = conCita.filter((p) => new Date(p.fecha_cita) >= hoy).sort((a, b) => a.fecha_cita.localeCompare(b.fecha_cita));
    const sinCita = S.partes.filter((p) => p.estado === "contactado" && !p.fecha_cita && (!zona || (zonaDe(p) || "-") === zona));
    const zs = [{ id: "", n: "📍 Todas" }, ...(CFG.ZONAS || []).map((z) => ({ id: z.nombre, n: z.nombre })), { id: "-", n: "Sin zona" }];
    $("#agZonas").innerHTML = zs.map((z) => `<button class="chip ${zona === z.id ? "activo" : ""}" data-z="${esc(z.id)}">${esc(z.n)}</button>`).join("");
    $$("#agZonas .chip").forEach((b) => b.onclick = () => { zona = b.dataset.z; sessionSet("agendaZona", zona); pinta(); });
    const dias = new Map();
    const diaLocal = (iso) => new Date(iso).toLocaleDateString("sv-SE");
    for (const p of prox) { const k = diaLocal(p.fecha_cita); if (!dias.has(k)) dias.set(k, []); dias.get(k).push(p); }
    const item = (p) => `
      <div class="ag-item" data-id="${p.id}">
        <div class="ag-hora">${p.fecha_cita ? new Date(p.fecha_cita).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
        <div class="ag-info"><b>${esc(p.nombre || "Sin nombre")}</b><small>${esc(dirDe(p) || "Sin dirección")}${zonaDe(p) ? ` · ${esc(zonaDe(p))}` : ""}</small>
          <small>${esc(p.aseguradora || "")} ${esc(p.expediente || "")} · ${estadoInfo(p.estado).nombre}</small></div>
        <div class="ag-acc">
          ${p.telefono ? `<a class="mini tel" href="${linkLlamar(p.telefono)}" aria-label="Llamar">${I.phone}</a>` : ""}
          ${dirDe(p) ? `<a class="mini" href="${linkMapa(p)}" target="_blank" rel="noopener" aria-label="Cómo llegar">${I.map}</a>` : ""}
        </div>
      </div>`;
    const nombreDia = (k) => {
      const d = new Date(k + "T12:00:00"), dd = Math.floor((d - hoy) / 864e5);
      const base = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
      return (dd === 0 ? "Hoy · " : dd === 1 ? "Mañana · " : "") + base.charAt(0).toUpperCase() + base.slice(1);
    };
    const ruta = (ps) => {
      const dirs = ps.map(dirDe).filter(Boolean);
      if (!dirs.length) return "";
      const dest = dirs.at(-1), way = dirs.slice(0, -1).slice(0, 9);
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${way.length ? "&waypoints=" + encodeURIComponent(way.join("|")) : ""}`;
    };
    let html = "";
    if (pasadas.length) html += `<section class="ag-dia pasadas"><h3>⏰ Citas pasadas sin marcar visitado (${pasadas.length})</h3>${pasadas.map(item).join("")}</section>`;
    for (const [k, ps] of dias) {
      const r = ruta(ps);
      html += `<section class="ag-dia"><div class="h3-fila"><h3>${nombreDia(k)} <small>(${ps.length})</small></h3>${r && ps.length > 1 ? `<a class="btn peq" href="${r}" target="_blank" rel="noopener">🗺️ Ruta del día</a>` : ""}</div>${ps.map(item).join("")}</section>`;
    }
    if (sinCita.length) html += `<section class="ag-dia"><h3>🗓️ Contactados sin cita (${sinCita.length})</h3>${sinCita.map((p) => item({ ...p, fecha_cita: null })).join("")}</section>`;
    $("#agenda").innerHTML = html || '<div class="vacio">No hay citas próximas.<br>Las citas se ponen al marcar un parte como <b>Contactado</b>.</div>';
    $$(".ag-item", $("#agenda")).forEach((el) => el.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = "/parte/" + el.dataset.id; }));
  };
  pinta();
}

// ------------------------------------------------------------------ Copia de seguridad (Excel)
async function copiaSeguridad() {
  try {
    await conCarga("Preparando copia…", async () => {
      await cargarXLSX();
      const { partes, eventos } = await api.exportarTodo();
      const precios = verPrecios();
      const exp = new Map(partes.map((p) => [p.id, p]));
      const nombre = (uid) => S.miembros.find((m) => m.user_id === uid)?.nombre ?? "";
      const hojaPartes = partes.map((p) => ({
        Aseguradora: p.aseguradora, Expediente: p.expediente, "Nº encargo": p.num_encargo, "Nº siniestro": p.num_siniestro, Póliza: p.poliza,
        Estado: estadoInfo(p.estado).nombre, "En papelera": p.borrado_at ? "Sí" : "", Repetido: p.repetido_de ? "Sí" : "",
        Nombre: p.nombre, Teléfono: p.telefono, "Teléfono 2": p.telefono2, Perjudicado: p.perjudicado_nombre || "", "Tel. perjudicado": p.perjudicado_telefono || "", Dirección: p.direccion, CP: p.codigo_postal, Población: p.poblacion,
        Provincia: p.provincia, Zona: zonaDe(p), Tipo: esConexion(p) ? "Conexión" : "Seguro", Avería: p.averia, Tramitador: p.tramitador_nombre, "Tel. tramitador": p.tramitador_telefono,
        "Fecha encargo": p.fecha_encargo, Cita: p.fecha_cita ? fFechaHora(p.fecha_cita) : "", Asignado: nombre(p.asignado_a),
        ...(precios ? { "Valorado (€)": p.importe_valorado, "Autorizado (€)": p.importe_autorizado } : {}),
        Entrada: fFechaHora(p.created_at), "Último cambio": fFechaHora(p.updated_at), Días: diasParte(p),
      }));
      const hojaLineas = [];
      for (const p of partes) for (const [tipo, ls] of [["Valoración", p.lineas_valoracion], ["Autorizado", p.lineas_autorizadas], ["Realizado", p.lineas_realizadas]])
        for (const l of ls || []) hojaLineas.push({ Expediente: p.expediente, Cliente: p.nombre, Tipo: tipo, Código: l.codigo, Descripción: l.descripcion, Cantidad: Number(l.cantidad),
          ...(precios ? { "Precio (€)": Number(l.precio), "Dto %": Number(l.dto) || 0, "Importe (€)": importeLinea(l) } : {}) });
      const hojaHist = eventos.map((e) => ({ Expediente: exp.get(e.parte_id)?.expediente ?? "", Cliente: exp.get(e.parte_id)?.nombre ?? "",
        Fecha: fFechaHora(e.created_at), Fase: e.estado ? estadoInfo(e.estado).nombre : "Nota", Nota: e.nota ?? "", Usuario: nombre(e.creado_por) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaPartes), "Partes");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaLineas.length ? hojaLineas : [{ Info: "Sin líneas" }]), "Líneas");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaHist.length ? hojaHist : [{ Info: "Sin historial" }]), "Historial");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      descargar(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `copia_partes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      const ahora = new Date().toISOString();
      sessionSet("ultimaCopia", ahora);
      CFG.ULTIMA_COPIA = ahora;
      // Se apunta en los ajustes compartidos para que el aviso valga para todos los móviles
      if (S.yo?.es_admin || api.modo !== "supabase") {
        try { const a = await api.leerAjustes(); await api.guardarAjustes({ ...a, ULTIMA_COPIA: ahora }); } catch { /* no pasa nada */ }
      }
    });
    sheetResumen(false, true);
    toast("Copia descargada", "ok");
  } catch { /* conCarga avisa */ }
}

// ------------------------------------------------------------------ Gasto de la IA
async function pintarUsoIA() {
  const cont = $("#usoIA"); if (!cont) return;
  const hoy = new Date(), m0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1), m1 = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  let filas;
  try { filas = await api.usoIA(m1.toISOString()); }
  catch { cont.innerHTML = '<p class="suave">Aún no hay datos de gasto (se empiezan a contar desde esta versión).</p>'; return; }
  const usd = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
  const resumen = (xs) => {
    const cl = xs.filter((x) => x.proveedor !== "gemini"), ge = xs.length - cl.length;
    const total = xs.reduce((a, x) => a + Number(x.coste_usd || 0), 0);
    const conPrecio = cl.filter((x) => x.coste_usd != null).length;
    return { n: xs.length, cl: cl.length, ge, total, media: conPrecio ? total / conPrecio : 0 };
  };
  const sinPrecio = filas.filter((x) => x.coste_usd == null && x.proveedor !== "gemini");
  const este = resumen(filas.filter((x) => new Date(x.created_at) >= m0));
  const ant = resumen(filas.filter((x) => new Date(x.created_at) < m0));
  const mes = (d) => d.toLocaleDateString("es-ES", { month: "long" });
  cont.innerHTML = `
    <div class="kpis">
      <div class="kpi"><b>${este.n}</b><span>lecturas en ${mes(hoy)}</span></div>
      <div class="kpi"><b>${usd(este.total)}</b><span>gastado en ${mes(hoy)}</span></div>
      <div class="kpi"><b>${este.media ? este.media.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " $" : "—"}</b><span>media por lectura (Claude)</span></div>
    </div>
    ${sinPrecio.length ? `<p class="aviso-rojo">⚠️ ${sinPrecio.length} lectura${sinPrecio.length > 1 ? "s" : ""} con un modelo sin precio (<b>${esc([...new Set(sinPrecio.map((x) => x.modelo))].join(", "))}</b>): no se están sumando al gasto. Añade su tarifa en "Tarifas de la IA".</p>` : ""}
    <p class="suave">${este.cl} con Claude${este.ge ? ` · ${este.ge} con Gemini (gratis)` : ""}. ${mes(m1).charAt(0).toUpperCase() + mes(m1).slice(1)}: ${ant.n} lecturas · ${usd(ant.total)}.</p>`;
}

// ------------------------------------------------------------------ Espacio usado
async function pintarEspacio() {
  const cont = $("#espacio"); if (!cont) return;
  let u;
  try { u = await api.usoAlmacenamiento(); } catch { cont.innerHTML = '<p class="suave">No se pudo consultar el espacio.</p>'; return; }
  if (!u) { cont.innerHTML = '<p class="suave">Sin datos.</p>'; return; }
  const mb = (b) => (b / 1048576).toLocaleString("es-ES", { maximumFractionDigits: b > 1e8 ? 0 : 1 }) + " MB";
  const barra = (usado, total, txt) => {
    const pct = Math.min(100, Math.round(usado / total * 100));
    const col = pct >= 90 ? "#dc2626" : pct >= 75 ? "#f59e0b" : "#16a34a";
    return `<div class="espacio-fila"><div class="h3-fila"><span>${txt}</span><b>${mb(usado)} de ${mb(total)} · ${pct}%</b></div>
      <div class="barra-prog"><i style="width:${pct}%;background:${col}"></i></div></div>`;
  };
  const LIM_ARCH = 1024 * 1048576, LIM_BD = 500 * 1048576;
  const pctA = u.archivos_bytes / LIM_ARCH;
  const medio = u.archivos_n ? u.archivos_bytes / u.archivos_n : 0;
  const quedan = medio ? Math.max(0, Math.floor((LIM_ARCH - u.archivos_bytes) / medio)) : null;
  cont.innerHTML = barra(u.archivos_bytes, LIM_ARCH, `Fotos y documentos (${u.archivos_n.toLocaleString("es-ES")} archivos)`)
    + barra(u.bd_bytes, LIM_BD, "Datos de los partes")
    + `<p class="suave">Límites del plan gratuito de Supabase.${quedan != null ? ` Al ritmo actual caben unos <b>${quedan.toLocaleString("es-ES")}</b> archivos más.` : ""}</p>`
    + (pctA >= 0.75 ? `<p class="aviso-rojo">⚠️ El espacio para fotos se está llenando. Descarga una copia de seguridad y avísame para ampliar o limpiar fotos antiguas.</p>` : "");
}

async function cargarXLSX() {
  if (window.XLSX) return;
  await new Promise((ok, ko) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    sc.onload = ok; sc.onerror = () => ko(new Error("No se pudo cargar el generador de Excel (¿sin conexión?)"));
    document.head.appendChild(sc);
  });
}

// ------------------------------------------------------------------ Facturación mensual
const DIAS_COBRO = () => Number(CFG.DIAS_COBRO ?? 60);
const IVA_FACT = () => Number(CFG.IVA_FACTURA ?? 21);
const conIVA = (base) => { const iva = Math.round(base * IVA_FACT()) / 100; return { base, iva, total: Math.round((base + iva) * 100) / 100 }; };
// Lo que se factura: los códigos autorizados; si no hay, el importe autorizado; si no, lo realizado; si no, lo valorado
function importeParte(p) {
  if ((p.lineas_autorizadas || []).length) return totalesLineas(p.lineas_autorizadas, 0).base;
  if (p.importe_autorizado != null) return Number(p.importe_autorizado);
  if ((p.lineas_realizadas || []).length) return totalesLineas(p.lineas_realizadas, 0).base;
  if ((p.lineas_valoracion || []).length) return totalesLineas(p.lineas_valoracion, 0).base;
  if (p.importe_valorado != null) return Number(p.importe_valorado);
  return null;
}
const diaAISO = (d) => (d ? new Date(`${d}T12:00:00`).toISOString() : null);
const mesDe = (iso) => iso ? new Date(iso).toLocaleDateString("sv-SE").slice(0, 7) : "";
const nombreMes = (k) => { const [a, m] = k.split("-"); const t = new Date(+a, +m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const sumarDias = (fecha, d) => { const x = new Date(fecha + "T12:00:00"); x.setDate(x.getDate() + d); return x; };

function datosFacturacion() {
  const term = (S.partes || []).filter((p) => p.estado === "realizado" && !esConexion(p));
  const mesActual = mesDe(new Date().toISOString());
  const sinFacturarAnteriores = term.filter((p) => !p.factura_ref && p.realizado_at && mesDe(p.realizado_at) < mesActual);
  const facturas = new Map();
  for (const p of term.filter((x) => x.factura_ref)) {
    const k = p.factura_ref + "|" + (p.facturado_at || "");
    if (!facturas.has(k)) facturas.set(k, { ref: p.factura_ref, fecha: p.facturado_at, partes: [], cobrado: p.cobrado_at });
    facturas.get(k).partes.push(p);
  }
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const lista = [...facturas.values()].map((f) => ({ ...f, total: conIVA(f.partes.reduce((a, p) => a + (importeParte(p) || 0), 0)).total,
    vence: f.fecha ? sumarDias(f.fecha, DIAS_COBRO()) : null, cobrado: f.partes.every((p) => p.cobrado_at) ? f.partes[0].cobrado_at : null }))
    .map((f) => ({ ...f, dias: f.vence ? Math.floor((f.vence - hoy) / 864e5) : null }))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return { term, sinFacturarAnteriores, facturas: lista };
}

async function vistaFacturacion() {
  try { S.partes = await api.listarPartes(); } catch { /* se usa lo que haya */ }
  let mes = sessionGet("factMes") || mesDe(new Date().toISOString());
  const sel = new Set();
  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>Facturación mensual</h1><span></span>
  </header>
  <main class="fact" id="fact"></main>`;
  $("#volver").onclick = () => (location.hash = "/");
  const pinta = () => {
    const { term, sinFacturarAnteriores, facturas } = datosFacturacion();
    const meses = [...new Set([mesDe(new Date().toISOString()), ...term.map((p) => mesDe(p.realizado_at)).filter(Boolean)])].sort().reverse();
    if (!meses.includes(mes)) mes = meses[0];
    const delMes = term.filter((p) => mesDe(p.realizado_at) === mes).sort((a, b) => (a.realizado_at || "").localeCompare(b.realizado_at || ""));
    if (!sel.size) delMes.filter((p) => !p.factura_ref).forEach((p) => sel.add(p.id));
    const elegidos = delMes.filter((p) => sel.has(p.id));
    const total = elegidos.reduce((a, p) => a + (importeParte(p) || 0), 0);
    const sinImporte = elegidos.filter((p) => importeParte(p) == null).length;
    const pendientes = facturas.filter((f) => !f.cobrado);
    const pendTotal = pendientes.reduce((a, f) => a + f.total, 0);
    $("#fact").innerHTML = `
      ${sinFacturarAnteriores.length ? `<div class="aviso-rojo">🧾 Hay <b>${sinFacturarAnteriores.length}</b> parte(s) terminados en meses anteriores sin facturar (${[...new Set(sinFacturarAnteriores.map((p) => nombreMes(mesDe(p.realizado_at))))].join(", ")}).</div>` : ""}
      <section class="tarjeta">
        <div class="h3-fila"><h3>Terminados en</h3>
          <select id="fMes">${meses.map((m) => `<option value="${m}" ${m === mes ? "selected" : ""}>${nombreMes(m)}</option>`).join("")}</select></div>
        ${delMes.length ? `<div class="fact-lista">${delMes.map((p) => {
          const imp = importeParte(p);
          const est = p.cobrado_at ? `<em class="ok">Cobrado ${fFecha(p.cobrado_at)}</em>` : p.factura_ref ? `<em>Facturado · ${esc(p.factura_ref)}</em>` : "";
          return `<label class="fact-fila ${p.factura_ref ? "facturado" : ""}">
            <input type="checkbox" data-id="${p.id}" ${sel.has(p.id) ? "checked" : ""}>
            <span class="fact-info"><b>${esc(p.nombre || "Sin nombre")}</b><small>${fFecha(p.realizado_at)} · ${esc(p.aseguradora || "")} ${esc(p.expediente || "")}${p.poblacion ? " · " + esc(p.poblacion) : ""}</small>${est}</span>
            <b class="fact-imp ${imp == null ? "sin" : ""}">${imp == null ? "sin importe" : fEuros(imp)}</b></label>`;
        }).join("")}</div>
        <div class="fact-total"><span>${elegidos.length} seleccionados${sinImporte ? ` · <b class="rojo">${sinImporte} sin importe</b>` : ""}</span>
          <div class="fact-desglose"><span>Base imponible</span><b>${fEuros(total)}</b><span>IVA ${IVA_FACT()}%</span><b>${fEuros(conIVA(total).iva)}</b><span>Total factura</span><b class="grande">${fEuros(conIVA(total).total)}</b></div></div>
        <div class="lista-botones">
          <button class="btn primario grande" id="fEnviar" style="--c:#16a34a" ${elegidos.some((p) => !p.factura_ref) ? "" : "disabled"}>${I.wa}<span><b>Enviar relación y marcar facturado</b><small>Te pide el nº de factura, manda el PDF a ${esc(DEST.nombre)} y cuenta ${DIAS_COBRO()} días para el cobro</small></span></button>
          <button class="btn grande" id="fPDF" ${elegidos.length ? "" : "disabled"}>${I.pdf}<span><b>Solo el PDF</b><small>Ver o descargar sin marcar nada</small></span></button>
          <button class="btn grande" id="fXLS" ${elegidos.length ? "" : "disabled"}>📊<span><b>Relación en Excel</b></span></button>
          <button class="btn texto ancho" id="fMarcar" ${elegidos.some((p) => !p.factura_ref) ? "" : "disabled"}>Solo marcar como facturados (sin enviar)</button>
        </div>` : '<p class="suave">No hay partes terminados en este mes. Un parte cuenta aquí cuando lo marcas como <b>Realizado</b>.</p>'}
      </section>
      <section class="tarjeta">
        <div class="h3-fila"><h3>Pendiente de cobro</h3><b>${fEuros(pendTotal)} <small>IVA incl.</small></b></div>
        ${pendientes.length ? pendientes.map((f) => `
          <div class="factura ${f.dias != null && f.dias < 0 ? "vencida" : ""}">
            <div><b>Factura ${esc(f.ref)}</b><small>${f.fecha ? fFecha(f.fecha) : ""} · ${f.partes.length} partes · ${fEuros(f.total)} (IVA incl.)</small>
              <small>${f.vence ? (f.dias < 0 ? `⚠️ Vencida hace ${-f.dias} días (${fFecha(f.vence)})` : `Cobro previsto ${fFecha(f.vence)} · en ${f.dias} días`) : ""}</small></div>
            <button class="btn peq" data-cobrar="${esc(f.ref)}|${esc(f.fecha || "")}">Cobrada</button>
          </div>`).join("") : '<p class="suave">Nada pendiente de cobro.</p>'}
        ${facturas.filter((f) => f.cobrado).slice(0, 5).map((f) => `<div class="factura cobrada"><div><b>Factura ${esc(f.ref)}</b><small>${fEuros(f.total)} IVA incl. · cobrada ${fFecha(f.cobrado)}</small></div>
          <button class="btn peq texto" data-descobrar="${esc(f.ref)}|${esc(f.fecha || "")}">Deshacer</button></div>`).join("")}
      </section>`;
    $("#fMes").onchange = (e) => { mes = e.target.value; sessionSet("factMes", mes); sel.clear(); pinta(); };
    $$("#fact .fact-fila input").forEach((c) => c.onchange = () => { c.checked ? sel.add(c.dataset.id) : sel.delete(c.dataset.id); pinta(); });
    const lineasDe = (p) => [p.lineas_autorizadas, p.lineas_realizadas, p.lineas_valoracion].find((l) => (l || []).length) || [];
    const filasExp = () => elegidos.map((p) => ({ ...p, importe: importeParte(p) || 0, lineas: lineasDe(p), autorizado: !(p.lineas_autorizadas || []).length && p.importe_autorizado != null,
      trabajo: lineasDe(p).map((l) => `${l.codigo || ""} ${l.descripcion || ""}`.trim()).join("; ") || (p.averia || "").slice(0, 90) }));
    // Todos los archivos empiezan por el nombre de la empresa, para que MULTIBETT vea de quién vienen
    const nombreRelacion = async (ext, ref) => {
      const { empresaArchivo, slug } = await cargarPDF();
      return `${empresaArchivo()}_Relacion_${mes}${ref ? "_Fra-" + slug(ref) : ""}.${ext}`;
    };
    // Genera el PDF y lo comparte (o descarga). Devuelve true si se ha enviado/descargado.
    const enviarPDFRelacion = async (ref) => {
      const blob = await conCarga("Generando PDF…", async () => (await cargarPDF()).generarRelacion(filasExp(),
        `RELACIÓN DE TRABAJOS · ${nombreMes(mes).toUpperCase()}${ref ? " · FRA. " + ref : ""}`, DEST.nombre, IVA_FACT()));
      const nombre = await nombreRelacion("pdf", ref);
      const file = new File([blob], nombre, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nombre }); return true; }
        catch (e) { if (e.name === "AbortError") return false; }
      }
      descargar(blob, nombre); return true;
    };
    const pedirFactura = (aMarcar) => {
      const sinImp = aMarcar.filter((p) => importeParte(p) == null);
      if (sinImp.length && !confirm(`${sinImp.length} parte(s) no tienen importe (${sinImp.map((p) => p.nombre || p.expediente).join(", ")}). ¿Facturarlos igualmente a 0 €?`)) return null;
      const ref = prompt(`Nº de factura para ${aMarcar.length} parte(s) (${fEuros(conIVA(aMarcar.reduce((a, p) => a + (importeParte(p) || 0), 0)).total)} IVA incl.):`, `${mes}`);
      return ref && ref.trim() ? ref.trim() : null;
    };
    const marcarFacturados = async (aMarcar, ref) => {
      const fecha = new Date().toLocaleDateString("sv-SE");
      await conCarga("Guardando…", async () => { for (const p of aMarcar) { await api.actualizarParte(p.id, { factura_ref: ref, facturado_at: fecha, cobrado_at: null }); Object.assign(p, { factura_ref: ref, facturado_at: fecha, cobrado_at: null }); } });
      toast(`Factura ${ref} anotada. Cobro previsto: ${fFecha(sumarDias(fecha, DIAS_COBRO()))}`, "ok"); sel.clear(); pinta();
    };
    $("#fEnviar")?.addEventListener("click", async () => {
      const aMarcar = elegidos.filter((p) => !p.factura_ref);
      const ref = pedirFactura(aMarcar); if (!ref) return;
      try {
        const ok = await enviarPDFRelacion(ref);
        if (!ok && !confirm("No se ha enviado el PDF. ¿Marcar igualmente los partes como facturados?")) return;
        await marcarFacturados(aMarcar, ref);
      } catch { /* conCarga avisa */ }
    });
    $("#fPDF")?.addEventListener("click", async () => { try { await enviarPDFRelacion(null); } catch { /* conCarga avisa */ } });
    $("#fXLS")?.addEventListener("click", async () => {
      try {
        await conCarga("Generando Excel…", async () => {
          await cargarXLSX();
          const filas = filasExp().map((p) => ({ Terminado: fFecha(p.realizado_at), Aseguradora: p.aseguradora, Expediente: p.expediente, Encargo: p.num_encargo,
            Cliente: p.nombre, Dirección: p.direccion || "", Población: [p.codigo_postal, p.poblacion].filter(Boolean).join(" "),
            Códigos: (p.lineas || []).map((l) => l.codigo || "").filter(Boolean).join("\n"), Trabajo: (p.lineas || []).length ? p.lineas.map((l) => `${l.codigo ? l.codigo + " · " : ""}${Number(l.cantidad) && Number(l.cantidad) !== 1 ? l.cantidad + " × " : ""}${l.descripcion || ""}${l.precio != null ? " · " + fEuros(importeLinea(l)) : ""}`).join("\n") : p.trabajo, "Importe sin IVA (€)": p.importe, Factura: p.factura_ref || "" }));
          const t = conIVA(filas.reduce((a, f) => a + (f["Importe sin IVA (€)"] || 0), 0));
          filas.push({}, { Trabajo: "Base imponible", "Importe sin IVA (€)": t.base }, { Trabajo: `IVA ${IVA_FACT()}%`, "Importe sin IVA (€)": t.iva }, { Trabajo: "TOTAL", "Importe sin IVA (€)": t.total });
          const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), nombreMes(mes).slice(0, 30));
          descargar(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), await nombreRelacion("xlsx"));
        });
      } catch { /* conCarga avisa */ }
    });
    $("#fMarcar")?.addEventListener("click", async () => {
      const aMarcar = elegidos.filter((p) => !p.factura_ref);
      const ref = pedirFactura(aMarcar); if (!ref) return;
      try { await marcarFacturados(aMarcar, ref); } catch { /* conCarga avisa */ }
    });
    const cambiarCobro = async (clave, valor) => {
      const [ref, fecha] = clave.split("|");
      const ps = (S.partes || []).filter((p) => p.factura_ref === ref && (p.facturado_at || "") === fecha);
      try { await conCarga("Guardando…", async () => { for (const p of ps) { await api.actualizarParte(p.id, { cobrado_at: valor }); p.cobrado_at = valor; } }); pinta(); } catch { /* conCarga avisa */ }
    };
    $$("[data-cobrar]").forEach((b) => b.onclick = () => { if (confirm(`¿Marcar la factura ${b.dataset.cobrar.split("|")[0]} como cobrada hoy?`)) cambiarCobro(b.dataset.cobrar, new Date().toLocaleDateString("sv-SE")); });
    $$("[data-descobrar]").forEach((b) => b.onclick = () => cambiarCobro(b.dataset.descobrar, null));
  };
  pinta();
}

function tarjetaParte(p) {
  const e = estadoInfo(p.estado);
  const asignado = S.miembros.find((m) => m.user_id === p.asignado_a)?.nombre;
  return `
  <article class="parte" data-id="${p.id}" style="--ase:${colorAseg(p.aseguradora)}">
    <div class="parte-top">
      <span class="aseg">${esc(p.aseguradora)}</span>
      <span class="exp">${esc(p.expediente || "sin nº")}</span>
      ${p.repetido_de ? '<span class="rep-badge" title="Parte repetido con cambios">🔁 Repetido</span>' : ""}
      ${esConexion(p) ? '<span class="cx-badge" title="Presupuesto particular para el cliente">💬 Conexión</span>' : ""}
      ${chipDias(p)}
      <span class="estado" style="--c:${e.color}">${e.nombre}</span>
    </div>
    <div class="parte-nombre">${esc(p.nombre || "Sin nombre")}</div>
    <div class="parte-dir">${esc([p.direccion, p.poblacion].filter(Boolean).join(", "))}${zonaDe(p) ? ` <span class="zona">${esc(zonaDe(p))}</span>` : ""}</div>
    ${p.averia ? `<div class="parte-averia">${esc(p.averia)}</div>` : ""}
    ${p.importe_valorado != null && verPrecios() ? `<div class="parte-importe">Valoración: <b>${fEuros(p.importe_valorado)}</b>${p.importe_autorizado != null ? ` · Autorizado: <b>${fEuros(p.importe_autorizado)}</b>` : ""}</div>` : ""}
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
      ${S.yo?.es_admin || api.modo !== "supabase" ? '<button class="btn ancho" id="irFact">💶 Facturación mensual</button>' : ""}
      ${api.modo === "supabase" ? '<button class="btn ancho" id="cambiarPw">Cambiar contraseña</button>' : ""}
      ${yaInstalada() ? "" : '<button class="btn ancho" id="instalarMenu">Instalar como app</button>'}
      <button class="btn ancho" id="irPapelera">🗑 Papelera (partes borrados)</button>
      <button class="btn ancho" id="exportar">Exportar partes (CSV)</button>
      ${api.modo === "supabase" ? '<button class="btn ancho peligro" id="salir">Cerrar sesión</button>' : ""}
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>
    ${pieCopyright()}`);
  $("#salir", s)?.addEventListener("click", async () => { await api.salir(); S.yo = null; cerrarSheet(); router(); });
  $("#exportar", s).addEventListener("click", exportarCSV);
  $("#irPapelera", s).addEventListener("click", () => { cerrarSheet(); location.hash = "/papelera"; });
  $("#irAjustes", s)?.addEventListener("click", () => { cerrarSheet(); location.hash = "/ajustes"; });
  $("#irFact", s)?.addEventListener("click", () => { cerrarSheet(); location.hash = "/facturacion"; });
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
  if (!verPrecios()) cols.splice(0, cols.length, ...cols.filter((c) => !c.startsWith("importe")));
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
  S.fotosPendientes = null;
  const s = abrirSheet(`
    <h2>Nuevo parte</h2>
    <div class="lista-botones">
      <button class="btn grande" id="nCam">${I.cam}<span><b>Hacer foto al parte</b><small>Con la cámara del móvil</small></span></button>
      <button class="btn grande" id="nArch">${I.file}<span><b>Subir PDF o imagen</b><small>Desde archivos, correo o descargas</small></span></button>
      <button class="btn grande" id="nLote">${I.file}<span><b>Subir varios partes a la vez</b><small>Elige varios PDF o fotos: uno por parte</small></span></button>
      <button class="btn grande" id="nMano">${I.edit}<span><b>Crear a mano</b><small>Sin documento</small></span></button>
    </div>`);
  $("#nCam", s).onclick = () => { cerrarSheet(); $("#inCamara").click(); };
  $("#nArch", s).onclick = () => { cerrarSheet(); $("#inArchivo").click(); };
  $("#nLote", s).onclick = () => { cerrarSheet(); $("#inLote").click(); };
  $("#nMano", s).onclick = () => { S.borrador = { datos: {} }; cerrarSheet(); location.hash = "/nuevo"; };
}

// Lee con IA; si la foto está girada, la endereza y la vuelve a leer (las tablas giradas se leen mal).
// Devuelve { datos, lectura, giro } — giro = grados aplicados (para girar también la foto que se guarda).
// Llamada a la IA con reintentos si falla la conexión (cobertura, servidor actualizándose…)
async function extraerConReintento(b64, mime, aviso = () => {}) {
  for (let intento = 1; ; intento++) {
    try { return await api.extraer(b64, mime); }
    catch (e) {
      const red = /fetch|network|conexi|timeout|503|502|504/i.test(String(e?.message || e));
      if (!red || intento >= 3) throw e;
      aviso(`Sin conexión con el servidor, reintentando (${intento}/2)…`);
      await new Promise((r) => setTimeout(r, 3000 * intento));
    }
  }
}

async function leerConIA(lectura, mime, aviso = () => {}) {
  let datos = await extraerConReintento(await blobABase64(lectura), mime, aviso);
  if (mime === "application/pdf") return { datos, lectura, giro: 0 };
  let giro = 0;
  for (let i = 0; i < 2; i++) {
    const g = ((Number(datos?.orientacion) || 0) % 360 + 360) % 360;
    if (![90, 180, 270].includes(g)) break;
    aviso("La foto está girada: enderezando y leyendo otra vez…");
    lectura = await girarImagen(lectura, g);
    giro = (giro + g) % 360;
    datos = await extraerConReintento(await blobABase64(lectura), mime, aviso);
  }
  return { datos, lectura, giro };
}

// Avisos de datos que parecen mal colocados
function avisosLectura(d = {}) {
  const out = [], sin = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (d.nombre && d.tramitador_nombre && sin(d.nombre) === sin(d.tramitador_nombre)) out.push("El nombre del cliente es igual que el del tramitador/gestor");
  if (d.nombre && /^(vecino|asegurado|cliente)$/i.test(d.nombre.trim())) out.push("El nombre del cliente no es un nombre");
  const dir = d.direccion || "";
  if (dir && (dir.length > 60 || /\b(da[ñn]os?|humedad|aver[ií]a|valorar|reparar|sustituir|puerta|mueble|filtraci|fuga|rotura)\b/i.test(dir))) out.push("La dirección parece la descripción del daño");
  if (dir && !/\d/.test(dir) && !/s\/n/i.test(dir)) out.push("La dirección no tiene número");
  return out;
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
    const r = await leerConIA(lectura, mime, (t) => cargando(true, t));
    if (r.giro) blob = r.lectura === lectura ? blob : (blob === lectura ? r.lectura : await girarImagen(blob, r.giro));
    S.borrador = { datos: normalizar(r.datos), archivo: blob, mime };
    irANuevo();
  } catch (e) {
    console.error(e);
    toast("No se pudo leer: " + e.message + ". Puedes rellenarlo a mano.", "error");
    S.borrador = { datos: {}, archivo: blob, mime };
    irANuevo();
  } finally { cargando(false); }
}

// ------------------------------------------------------------------ Archivos compartidos desde WhatsApp u otras apps
async function leerCompartidos() {
  if (!("caches" in window)) return [];
  const c = await caches.open("partes-compartido");
  const files = [];
  S.diagCompartir = null;
  const d = await c.match("diagnostico");
  if (d) { try { S.diagCompartir = await d.json(); } catch { /* nada */ } await c.delete("diagnostico"); }
  for (const req of await c.keys()) {
    const r = await c.match(req);
    if (!r) continue;
    const blob = await r.blob();
    const nombre = decodeURIComponent(r.headers.get("x-nombre") || "archivo");
    files.push(new File([blob], nombre, { type: r.headers.get("content-type") || blob.type }));
    await c.delete(req);
  }
  return files;
}

async function vistaCompartido() {
  const nuevos = await leerCompartidos();
  if (nuevos.length || S.diagCompartir) S.compartidos = nuevos;   // un envío nuevo sustituye al anterior
  const files = S.compartidos || [];
  history.replaceState(null, "", location.pathname + "#/");
  S.saltarResumen = true;
  await vistaLista();
  if (!files.length) {
    const dg = S.diagCompartir || {};
    const s = abrirSheet(`
      <h2>No ha llegado el archivo</h2>
      <p>La app se abrió desde WhatsApp pero no recibió la foto. Puedes elegirla directamente:</p>
      <div class="lista-botones">
        <button class="btn primario grande" id="dgElegir">${I.file}<span><b>Elegir la foto o PDF</b><small>Desde la galería o descargas</small></span></button>
        <button class="btn texto ancho" data-cerrar>Cerrar</button>
      </div>
      <details class="suave"><summary>Detalle técnico (mándame captura de esto)</summary>
        <pre class="diag">${esc(JSON.stringify(dg, null, 1) || "sin datos: no pasó por el service worker")}</pre></details>`);
    $("#dgElegir", s).onclick = () => { cerrarSheet(); $("#inArchivo").click(); };
    return;
  }
  const esPDF = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  const imgs = files.filter((f) => !esPDF(f) && /^image\//.test(f.type || "image/"));
  const s = abrirSheet(`
    <h2>Archivos recibidos</h2>
    <p>Has compartido <b>${files.length}</b> ${files.length === 1 ? "archivo" : "archivos"}${imgs.length && imgs.length !== files.length ? ` (${imgs.length} fotos)` : ""}. ¿Qué quieres hacer?</p>
    <div class="lista-botones">
      <button class="btn grande" id="cNuevo">${I.file}<span><b>Nuevo parte</b><small>Leer ${files.length > 1 ? "el primero" : "el documento"} con IA${files.length > 1 && imgs.length > 1 ? " (las demás fotos se añaden al guardar)" : ""}</small></span></button>
      ${files.length > 1 ? `<button class="btn grande" id="cLote">${I.file}<span><b>Varios partes (uno por archivo)</b><small>Lee los ${files.length} con IA y los revisas antes de guardar</small></span></button>` : ""}
      ${imgs.length ? `<button class="btn grande" id="cFotos">${I.cam}<span><b>Añadir ${imgs.length === 1 ? "la foto" : "las " + imgs.length + " fotos"} a un parte</b><small>Fotos del daño o del trabajo terminado</small></span></button>` : ""}
    </div>`);
  $("#cNuevo", s).onclick = () => {
    cerrarSheet();
    const [primero, ...resto] = files;
    S.fotosPendientes = resto.filter((f) => imgs.includes(f));
    S.compartidos = null;
    procesarArchivo(primero);
  };
  $("#cFotos", s)?.addEventListener("click", () => elegirParteParaFotos(imgs));
  $("#cLote", s)?.addEventListener("click", () => { cerrarSheet(); S.compartidos = null; iniciarLote(files); });
}

function elegirParteParaFotos(imgs) {
  const sin = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const s = abrirSheet(`
    <h2>¿A qué parte?</h2>
    <input type="search" id="bParte" placeholder="Buscar por nombre, expediente, dirección…" autocomplete="off">
    <div id="lParte" class="lista-elegir"></div>`);
  const pinta = () => {
    const q = sin($("#bParte", s).value);
    const lista = (S.partes || []).filter((p) => !q || sin([p.nombre, p.expediente, p.direccion, p.poblacion, p.aseguradora].join(" ")).includes(q)).slice(0, 30);
    $("#lParte", s).innerHTML = lista.length ? lista.map((p) => `
      <button class="btn fila-elegir" data-id="${p.id}">
        <b>${esc(p.nombre || "Sin nombre")}</b>
        <small>${esc(p.aseguradora || "")}${p.expediente ? " · " + esc(p.expediente) : ""}${p.direccion ? " · " + esc(p.direccion) : ""}</small>
      </button>`).join("") : '<p class="vacio">No hay partes que coincidan.</p>';
  };
  $("#bParte", s).addEventListener("input", pinta);
  $("#lParte", s).addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-id]"); if (!b) return;
    const p = S.partes.find((x) => x.id === b.dataset.id); if (!p) return;
    const tipo = idxEstado(p.estado) >= idxEstado("autorizado") ? "despues" : "antes";
    cerrarSheet();
    try {
      await subirFotos(p, imgs, tipo);
      S.compartidos = null;
      toast(`${imgs.length === 1 ? "Foto añadida" : imgs.length + " fotos añadidas"} al parte`, "ok");
      location.hash = "/parte/" + p.id;
    } catch (e) { toast("No se pudieron subir: " + e.message, "error"); }
    finally { cargando(false); }
  });
  pinta();
  setTimeout(() => $("#bParte", s).focus(), 200);
}

// ------------------------------------------------------------------ Partes repetidos
const CAMPOS_TXT = {
  expediente: "expediente", num_encargo: "nº encargo", num_siniestro: "nº siniestro", poliza: "póliza", fecha_encargo: "fecha encargo",
  nombre: "nombre", direccion: "dirección", codigo_postal: "C.P.", poblacion: "población", provincia: "provincia",
  telefono: "teléfono", telefono2: "teléfono 2", perjudicado_nombre: "perjudicado", perjudicado_telefono: "teléfono del perjudicado", averia: "avería", tramitador_nombre: "tramitador",
  tramitador_telefono: "tel. tramitador", tramitador_email: "email tramitador",
};
const normRef = (x) => String(x ?? "").replace(/[\s.\-\/]/g, "").toUpperCase();

async function buscarRepetidos(d) {
  let lista = S.partes?.length ? S.partes : [];
  if (!lista.length) { try { lista = S.partes = await api.listarPartes(); } catch { lista = []; } }
  const res = new Map();
  const add = (x, motivo, fuerte) => { const r = res.get(x.id); if (!r || (fuerte && !r.fuerte)) res.set(x.id, { p: x, motivo, fuerte }); };
  const exp = normRef(d.expediente), enc = normRef(d.num_encargo), sin = normRef(d.num_siniestro);
  const tel = String(d.telefono || "").replace(/\D/g, "").slice(-9);
  for (const x of lista) {
    const mismaAseg = normRef(x.aseguradora) === normRef(d.aseguradora);
    if (exp && (exp.length >= 5 || mismaAseg) && [x.expediente, x.num_siniestro].some((v) => normRef(v) === exp)) add(x, "mismo expediente", true);
    else if (enc && enc.length >= 5 && normRef(x.num_encargo) === enc) add(x, "mismo nº de encargo", true);
    else if (sin && sin.length >= 5 && [x.expediente, x.num_siniestro].some((v) => normRef(v) === sin)) add(x, "mismo nº de siniestro", true);
    else if (tel.length === 9 && [x.telefono, x.telefono2].some((v) => String(v || "").replace(/\D/g, "").slice(-9) === tel)) add(x, "mismo teléfono", false);
  }
  if (d.aseguradora && d.expediente) {
    try {
      const dup = await api.buscarDuplicado(d.aseguradora, d.expediente);
      if (dup?.borrado_at) add({ ...dup, aseguradora: d.aseguradora, expediente: d.expediente }, "mismo expediente (en la papelera)", true);
    } catch { /* nada */ }
  }
  return [...res.values()].sort((a, b) => b.fuerte - a.fuerte).slice(0, 3);
}

// Compara un parte nuevo con uno existente. Solo cuenta como cambio lo que tiene valor en los dos.
const limpiaTxt = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
function mismaAveria(a, b) {
  const pal = (t) => new Set(limpiaTxt(t).split(" ").filter((w) => w.length >= 4));
  const A = pal(a), B = pal(b);
  if (!A.size || !B.size) return limpiaTxt(a) === limpiaTxt(b);
  let c = 0; for (const w of A) if (B.has(w)) c++;
  return c / Math.min(A.size, B.size) >= 0.6;
}
function compararPartes(n, v) {
  const diffs = [], faltan = [];
  const reglas = {
    expediente: [(a, b) => normRef(a) === normRef(b), false],
    num_encargo: [(a, b) => normRef(a) === normRef(b), true],
    num_siniestro: [(a, b) => normRef(a) === normRef(b), true],
    fecha_encargo: [(a, b) => String(a).slice(0, 10) === String(b).slice(0, 10), true],
    averia: [mismaAveria, true],
    telefono: [(a, b) => String(a).replace(/\D/g, "").slice(-9) === String(b).replace(/\D/g, "").slice(-9), false],
    direccion: [(a, b) => { const x = limpiaTxt(a), y = limpiaTxt(b); return x === y || x.includes(y) || y.includes(x); }, false],
    nombre: [(a, b) => { const x = limpiaTxt(a), y = limpiaTxt(b); return x === y || x.includes(y) || y.includes(x); }, false],
  };
  for (const [k, [igual, trabajo]] of Object.entries(reglas)) {
    const a = String(n[k] ?? "").trim(), b = String(v[k] ?? "").trim();
    if (!a) continue;
    if (!b) { faltan.push(k); continue; }
    if (!igual(a, b)) diffs.push({ k, trabajo, txt: k === "averia" ? "descripción distinta" : `${CAMPOS_TXT[k]} ${k === "fecha_encargo" ? fFecha(a) : a} (antes ${k === "fecha_encargo" ? fFecha(b) : b})` });
  }
  return { diffs, faltan, identico: !diffs.length };
}

// Busca el parte "original" más parecido (mismo expediente / encargo / siniestro) y lo compara.
async function analizarRepeticion(d) {
  const reps = (await buscarRepetidos(d)).filter((r) => r.fuerte);
  if (!reps.length) return null;
  const cands = reps.map((r) => ({ ...r, cmp: compararPartes(d, r.p) }))
    .sort((a, b) => (normRef(b.p.aseguradora) === normRef(d.aseguradora)) - (normRef(a.p.aseguradora) === normRef(d.aseguradora))
      || b.cmp.identico - a.cmp.identico || a.cmp.diffs.length - b.cmp.diffs.length);
  const c = cands[0];
  return { orig: c.p, motivo: c.motivo, ...c.cmp };
}

async function avisoRepetido(d) {
  const [rep, todos] = await Promise.all([analizarRepeticion(d), buscarRepetidos(d)]);
  const form = $("#fParte");
  if (!form) return;
  $(".aviso.repetido")?.remove();
  const debiles = todos.filter((r) => !r.fuerte);
  if (!rep && !debiles.length) return;
  const div = document.createElement("div");
  div.className = "aviso repetido";
  const filaP = (x, extra) => `
      <div class="rep-fila">
        <div><b>${esc(x.nombre || "Sin nombre")}</b><small>${esc(x.aseguradora || "")}${x.expediente ? " · " + esc(x.expediente) : ""}${x.num_encargo ? " · enc. " + esc(x.num_encargo) : ""} · ${esc(x.borrado_at ? "en la papelera" : estadoInfo(x.estado).nombre)}${extra ? " — " + esc(extra) : ""}</small></div>
        <div class="rep-botones"><button type="button" class="btn" data-abrir="${x.id}">Abrir</button></div>
      </div>`;
  let html = "";
  if (rep?.identico) {
    html = `<b>⛔ Este parte ya lo tienes (es igual)</b>${filaP(rep.orig, rep.motivo)}
      <small>No se guardará otro igual.${rep.faltan.length ? ` El nuevo trae datos que faltan en el que tienes (${rep.faltan.map((k) => CAMPOS_TXT[k]).join(", ")}).` : ""}</small>
      ${rep.faltan.length ? `<button type="button" class="btn primario" data-act="${rep.orig.id}">Completar el que ya tengo</button>` : ""}`;
  } else if (rep) {
    html = `<b>🔁 Parte repetido con cambios</b>${filaP(rep.orig, rep.motivo)}
      <ul class="rep-cambios">${rep.diffs.map((x) => `<li>${esc(x.txt)}</li>`).join("")}</ul>
      <small>Al guardar se creará como <b>parte nuevo marcado "Repetido"</b> y enlazado al anterior.</small>
      <button type="button" class="btn" data-act="${rep.orig.id}">No, actualizar el anterior en su lugar</button>`;
  }
  if (debiles.length && !(rep && debiles.every((r) => r.p.id === rep.orig.id))) {
    html += `<b style="margin-top:6px">ℹ️ Mismo teléfono que:</b>${debiles.filter((r) => r.p.id !== rep?.orig.id).map((r) => filaP(r.p, "")).join("")}`;
  }
  div.innerHTML = html;
  form.before(div);
  div.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-abrir]"), u = ev.target.closest("[data-act]");
    if (a) { S.borrador = null; S.fotosPendientes = null; location.hash = "/parte/" + a.dataset.abrir; }
    if (u) actualizarExistente(u.dataset.act, Object.fromEntries(new FormData(form)));
  });
}

async function actualizarExistente(pid, f) {
  try {
    await conCarga("Actualizando parte…", async () => {
      const ex = await api.obtenerParte(pid);
      const cambios = {}, rellenos = [], distintos = [];
      for (const k of Object.keys(CAMPOS_TXT)) {
        const nuevo = f[k] == null ? "" : String(f[k]).trim();
        const viejo = ex[k] == null ? "" : String(ex[k]).trim();
        if (!nuevo) continue;
        if (!viejo) { cambios[k] = nuevo; rellenos.push(CAMPOS_TXT[k]); }
        else if (normRef(nuevo) !== normRef(viejo) && k !== "averia") distintos.push(`${CAMPOS_TXT[k]}: ${nuevo} (antes ${viejo})`);
        else if (k === "averia" && !viejo.includes(nuevo.slice(0, 40))) distintos.push(`avería nueva: ${nuevo}`);
      }
      if (ex.borrado_at) await api.restaurarParte(pid);
      if (S.borrador?.archivo) {
        const pdf = S.borrador.mime === "application/pdf";
        if (!ex.documento_path || pdf) {
          cambios.documento_path = await api.subirArchivo(`${pid}/documento_${Date.now()}.${pdf ? "pdf" : "jpg"}`, S.borrador.archivo, S.borrador.mime);
        } else {
          const path = await api.subirArchivo(`${pid}/documento_${Date.now()}.jpg`, S.borrador.archivo, "image/jpeg");
          await api.anadirFoto(pid, path, "otra");
        }
      }
      if (Object.keys(cambios).length) await api.actualizarParte(pid, cambios);
      if (S.fotosPendientes?.length) { await subirFotos({ id: pid }, S.fotosPendientes, idxEstado(ex.estado) >= idxEstado("autorizado") ? "despues" : "antes"); }
      const nota = ["Parte recibido de nuevo.",
        rellenos.length ? "Se han rellenado: " + rellenos.join(", ") + "." : "",
        distintos.length ? "Diferencias en el nuevo (no se han cambiado): " + distintos.join(" · ") + "." : "",
        S.borrador?.archivo ? (S.borrador.mime === "application/pdf" || !ex.documento_path ? "Documento actualizado." : "El documento nuevo se ha guardado en Fotos.") : "",
        ex.borrado_at ? "Recuperado de la papelera." : ""].filter(Boolean).join(" ");
      await api.anadirEvento(pid, null, nota);
    });
    S.borrador = null; S.fotosPendientes = null;
    toast("Parte actualizado", "ok");
    location.replace("#/parte/" + pid);
  } catch { /* conCarga ya avisa */ }
}

// ------------------------------------------------------------------ Subida de varios partes (lote)
const CAMPOS_PARTE = ["aseguradora", "expediente", "num_encargo", "num_siniestro", "poliza", "fecha_encargo", "nombre", "direccion",
  "codigo_postal", "poblacion", "provincia", "telefono", "telefono2", "perjudicado_nombre", "perjudicado_telefono", "averia", "tramitador_nombre", "tramitador_telefono", "tramitador_email"];
const MAX_LOTE = 20;

// ---- La tanda en curso se guarda en el móvil (IndexedDB): si se sale sin querer o se cierra la app, se puede recuperar
const loteDB = () => new Promise((res, rej) => {
  const r = indexedDB.open("partes-lote", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("kv");
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function loteIDB(modo, valor) {
  try {
    const db = await loteDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction("kv", modo === "leer" ? "readonly" : "readwrite"), st = tx.objectStore("kv");
      const r = modo === "leer" ? st.get("lote") : modo === "borrar" ? st.delete("lote") : st.put(valor, "lote");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  } catch (e) { console.warn("lote IDB", e); return null; }
}
let tGuardarLote;
function persistirLote() {
  clearTimeout(tGuardarLote);
  tGuardarLote = setTimeout(() => {
    const lote = S.lote;
    if (!lote?.some((x) => ["ok", "pendiente", "leyendo", "error"].includes(x.estado))) { loteIDB("borrar"); return; }
    loteIDB("guardar", { fecha: Date.now(), items: lote.map(({ avisos, ...x }) => x) });
  }, 400);
}
const lotePendiente = (items) => (items || []).filter((x) => x.estado === "ok" && x.sel).length;
async function recuperarLote() {
  if (S.lote) return S.lote;
  const g = await loteIDB("leer");
  if (!g?.items?.length) return null;
  if (Date.now() - g.fecha > 7 * 864e5) { loteIDB("borrar"); return null; }   // más de una semana: se descarta
  S.lote = g.items.map((x) => (x.estado === "leyendo" ? { ...x, estado: "pendiente" } : x));
  revisarLote();
  return S.lote;
}
function descartarLote() { S.lote = null; S.antesDeSalir = null; loteIDB("borrar"); }
async function avisoLotePendiente() {
  const el = $("#avisoLote"); if (!el) return;
  const lote = await recuperarLote();
  const n = lotePendiente(lote), porLeer = (lote || []).filter((x) => x.estado === "pendiente").length;
  if (!n && !porLeer) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="aviso lote-pend">📥 Tienes una subida en masa sin terminar: <b>${n}</b> parte${n === 1 ? "" : "s"} leído${n === 1 ? "" : "s"} sin guardar${porLeer ? ` y ${porLeer} por leer` : ""}.
    <div class="dos"><button class="btn peq" id="loteSeguir">Continuar</button><button class="btn peq texto" id="loteTirar">Descartar</button></div></div>`;
  $("#loteSeguir").onclick = () => { location.hash = "/lote"; if (S.lote.some((x) => x.estado === "pendiente")) procesarLote(); };
  $("#loteTirar").onclick = () => { if (confirm("¿Descartar esos partes leídos? Habría que volver a escanearlos.")) { descartarLote(); el.innerHTML = ""; } };
}

function iniciarLote(files) {
  if (files.length > MAX_LOTE) { toast(`Máximo ${MAX_LOTE} archivos por tanda. Se cogen los ${MAX_LOTE} primeros.`, "error"); files = files.slice(0, MAX_LOTE); }
  if (lotePendiente(S.lote) && !confirm("Tienes otra subida en masa con partes leídos sin guardar. ¿Descartarla y empezar esta?")) return;
  S.lote = files.map((f, i) => ({ i, file: f, nombre: f.name, estado: "pendiente", sel: true }));
  if (location.hash === "#/lote") vistaLote(); else location.hash = "/lote";
  procesarLote();
}

async function procesarLote() {
  const lote = S.lote; if (!lote) return;
  const siguiente = () => lote.find((x) => x.estado === "pendiente");
  const trabajador = async () => {
    for (let it = siguiente(); it; it = siguiente()) {
      it.estado = "leyendo"; pintarLote();
      try {
        const esPDF = it.file.type === "application/pdf" || /\.pdf$/i.test(it.file.name);
        it.mime = esPDF ? "application/pdf" : "image/jpeg";
        it.blob = esPDF ? it.file : await comprimirImagen(it.file, 2000, 0.85);
        if (it.blob.size > 9.5 * 1024 * 1024) throw new Error("pesa más de 9 MB");
        const r = await leerConIA(it.blob, it.mime);
        it.blob = r.lectura; it.giro = r.giro;
        it.datos = normalizar(r.datos);
        it.rep = await analizarRepeticion(it.datos).catch(() => null);
        it.estado = "ok";
      } catch (e) { it.estado = "error"; it.error = e.message; it.sel = false; }
      if (S.lote !== lote) return;
      revisarLote(); pintarLote();
    }
  };
  await Promise.all([trabajador(), trabajador()]);
}

// Marca repetidos (con partes ya guardados y dentro de la propia tanda)
function revisarLote() {
  const vistos = new Map();
  for (const it of S.lote || []) {
    if (it.estado !== "ok") continue;
    it.avisos = [];
    const d = it.datos;
    const clave = normRef(d.aseguradora) + "|" + normRef(d.expediente) + "|" + normRef(d.num_encargo);
    if (d.expediente && vistos.has(clave)) { it.avisos.push({ t: `⛔ Igual que el nº ${vistos.get(clave) + 1} de esta tanda`, grave: true }); if (!it.tocado) it.sel = false; }
    else if (d.expediente) vistos.set(clave, it.i);
    if (it.rep?.identico) { it.avisos.push({ t: `⛔ Ya lo tienes (${it.rep.orig.nombre || "sin nombre"})`, grave: true }); if (!it.tocado) it.sel = false; }
    else if (it.rep) it.avisos.push({ t: `🔁 Repetido con cambios: ${it.rep.diffs.map((x) => x.txt).join(", ")}` });
    if (!d.aseguradora) it.avisos.push({ t: "⚠️ Sin aseguradora" });
    if (!d.expediente) it.avisos.push({ t: "⚠️ Sin expediente" });
    if (!/^(\+?34)?[6-9]\d{8}$/.test(d.telefono || "")) it.avisos.push({ t: "⚠️ Sin teléfono completo" });
    for (const t of avisosLectura(d)) it.avisos.push({ t: "⚠️ " + t, grave: true });
  }
}

async function vistaLote() {
  if (!S.lote?.length) await recuperarLote();
  if (!S.lote?.length) { location.hash = "/"; return; }
  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>Subir varios partes</h1><span></span>
  </header>
  <div class="aviso" id="loteAviso"></div>
  <main id="loteLista" class="lote"></main>
  <div class="pie-form lote-pie"><button class="btn" id="loteCancelar">Descartar</button><button class="btn primario" id="loteGuardar">Guardar</button></div>`;
  S.antesDeSalir = () => !S.lote?.some((x) => x.estado === "ok" && x.sel) || confirm("Hay partes leídos sin guardar. ¿Salir y descartarlos?");
  const salir = () => { if (!S.antesDeSalir()) return; descartarLote(); location.hash = "/"; };
  $("#volver").onclick = salir;
  $("#loteCancelar").onclick = salir;
  $("#loteGuardar").onclick = guardarLote;
  pintarLote();
}

function pintarLote() {
  persistirLote();
  const cont = $("#loteLista"); if (!cont || !S.lote) return;
  const n = S.lote.length, hechos = S.lote.filter((x) => ["ok", "error", "guardado"].includes(x.estado)).length;
  const sel = S.lote.filter((x) => x.estado === "ok" && x.sel).length;
  $("#loteAviso").innerHTML = hechos < n
    ? `Leyendo con IA… <b>${hechos} de ${n}</b>. No cierres la app mientras tanto.<div class="barra-prog"><i style="width:${Math.round(hechos / n * 100)}%"></i></div>`
    : `Revisa los datos: la IA puede equivocarse. Toca un parte para corregirlo. Se guardarán <b>${sel}</b>.`;
  $("#loteGuardar").textContent = `Guardar ${sel} parte${sel === 1 ? "" : "s"}`;
  $("#loteGuardar").disabled = hechos < n || !sel;
  cont.innerHTML = S.lote.map((it) => {
    const d = it.datos || {};
    const cab = it.estado === "ok" || it.estado === "guardado"
      ? `<b>${esc(d.aseguradora || "¿Aseguradora?")} · ${esc(d.expediente || "sin expediente")}</b><span>${esc(d.nombre || "Sin nombre")}</span>
         <small>${esc([d.direccion, d.poblacion].filter(Boolean).join(", ") || "Sin dirección")}${d.telefono ? " · " + esc(d.telefono) : ""}</small>`
      : `<b>${esc(it.nombre)}</b><small>${it.estado === "error" ? "❌ No se pudo leer: " + esc(it.error || "") : it.estado === "leyendo" ? "⏳ Leyendo…" : "En cola"}</small>`;
    return `<div class="lote-item ${it.estado} ${it.sel ? "" : "desmarcado"}" data-i="${it.i}">
      <label class="lote-check">${it.estado === "ok" ? `<input type="checkbox" ${it.sel ? "checked" : ""}>` : it.estado === "guardado" ? "✅" : ""}</label>
      <div class="lote-info">${cab}${(it.avisos || []).map((a) => `<em class="${a.grave ? "grave" : ""}">${esc(a.t)}</em>`).join("")}</div>
      ${it.estado === "ok" ? `<button class="btn peq" data-editar>Corregir</button>` : ""}
      ${it.estado === "error" && it.file ? `<button class="btn peq" data-reintentar>Reintentar</button>` : ""}
    </div>`;
  }).join("");
  $$(".lote-item", cont).forEach((el) => {
    const it = S.lote[el.dataset.i];
    el.querySelector("input[type=checkbox]")?.addEventListener("change", (e) => { it.sel = e.target.checked; it.tocado = true; pintarLote(); });
    el.querySelector("[data-editar]")?.addEventListener("click", () => editarItemLote(it));
    el.querySelector("[data-reintentar]")?.addEventListener("click", () => { it.estado = "pendiente"; it.error = null; it.sel = true; pintarLote(); procesarLote(); });
  });
}

function editarItemLote(it) {
  const d = it.datos;
  const opc = [...new Set([...CFG.ASEGURADORAS, d.aseguradora].filter(Boolean))];
  const c = (k, t, tipo = "text") => `<label>${t}<input name="${k}" type="${tipo}" value="${esc(d[k] ?? "")}"></label>`;
  const s = abrirSheet(`
    <h2>Corregir parte</h2>
    <form id="fLote" class="form">
      <label>Aseguradora<select name="aseguradora"><option value="">— Elegir —</option>${opc.map((a) => `<option ${a === d.aseguradora ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
      <div class="dos">${c("expediente", "Nº expediente")}${c("num_encargo", "Nº encargo")}</div>
      ${c("nombre", "Nombre")}
      <div class="dos">${c("telefono", "Teléfono", "tel")}${c("telefono2", "Teléfono 2", "tel")}</div>
      <div class="dos">${c("perjudicado_nombre", "Perjudicado")}${c("perjudicado_telefono", "Tel. perjudicado", "tel")}</div>
      ${c("direccion", "Dirección")}
      <div class="dos">${c("codigo_postal", "C.P.")}${c("poblacion", "Población")}</div>
      <label>Avería<textarea name="averia" rows="3">${esc(d.averia ?? "")}</textarea></label>
      <div class="pie-form"><button type="button" class="btn" data-cerrar>Cancelar</button><button type="submit" class="btn primario">Aplicar</button></div>
    </form>`);
  $("#fLote", s).addEventListener("submit", async (e) => {
    e.preventDefault();
    Object.assign(d, Object.fromEntries(new FormData(e.target)));
    for (const k in d) if (typeof d[k] === "string") d[k] = d[k].trim();
    it.rep = await analizarRepeticion(d).catch(() => null);
    it.sel = !it.rep?.identico; it.tocado = false;
    cerrarSheet(); revisarLote(); pintarLote();
  });
}

async function guardarLote() {
  const items = S.lote.filter((x) => x.estado === "ok" && x.sel);
  if (!items.length) return;
  const sinAseg = items.filter((x) => !x.datos.aseguradora);
  if (sinAseg.length) return toast(`Falta la aseguradora en ${sinAseg.length} parte(s). Pulsa "Corregir".`, "error");
  let ok = 0, fallos = 0;
  cargando(true, "Guardando…");
  for (const it of items) {
    cargando(true, `Guardando ${ok + fallos + 1} de ${items.length}…`);
    try {
      const f = {};
      for (const k of CAMPOS_PARTE) f[k] = it.datos[k] ? it.datos[k] : null;
      f.tipo = detectarTipo(it.datos);
      aMayus(f);
      if (f.fecha_encargo && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_encargo)) f.fecha_encargo = null;
      const rep = await analizarRepeticion(f).catch(() => null);
      if (rep?.identico) { it.estado = "error"; it.error = "ya existía igual; no se ha guardado"; fallos++; continue; }
      if (rep) { f.repetido_de = rep.orig.id; f.cambios_repetido = rep.diffs.map((x) => x.txt).join(" · "); }
      const n = await api.crearParte({ ...f, asignado_a: S.yo?.user_id ?? null, datos_ia: it.datos });
      const ext = it.mime === "application/pdf" ? "pdf" : "jpg";
      const path = await api.subirArchivo(`${n.id}/documento.${ext}`, it.blob, it.mime);
      await api.actualizarParte(n.id, { documento_path: path });
      if (f.repetido_de) api.anadirEvento(f.repetido_de, null, `Ha llegado otro parte repetido con cambios (${f.cambios_repetido}). Se ha guardado como parte nuevo.`).catch(() => {});
      S.partes = [n, ...(S.partes || [])];
      it.estado = "guardado"; it.sel = false; ok++;
    } catch (e) { it.estado = "error"; it.error = e.message; fallos++; }
  }
  cargando(false);
  if (!fallos) { descartarLote(); toast(`${ok} partes guardados`, "ok"); location.hash = "/"; }
  else { toast(`${ok} guardados, ${fallos} con problemas (revísalos)`, "error"); pintarLote(); }
}

function irANuevo() {
  if (location.hash === "#/nuevo") vistaFormulario(null); else location.hash = "/nuevo";
}

// Conexión: la IA lo marca si el parte lo dice; en Mapfre, además, el expediente empieza por A (los encargos, por V)
function detectarTipo(r) {
  if (/conexi/i.test(r.tipo || "")) return "conexion";
  if (r.aseguradora === "Mapfre" && /^A[\s-]?\d/i.test((r.expediente || "").trim())) return "conexion";
  return "siniestro";
}

// Campos que se guardan siempre en MAYÚSCULAS (la base de datos también lo fuerza)
const CAMPOS_MAYUS = ["expediente", "num_encargo", "num_siniestro", "poliza", "codigo_postal", "averia"];
const CAMPOS_TITULO = ["nombre", "direccion", "poblacion", "provincia", "tramitador_nombre", "perjudicado_nombre"];
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e"]);
// "MARIA DEL MAR VILCHEZ" → "Maria del Mar Vilchez"; "CL ADARVES BAJOS 37 3a" → "Cl Adarves Bajos 37 3A"
const tipoTitulo = (t) => String(t).trim().split(/\s+/).map((w, i) => {
  if (/\d/.test(w)) return w.toLocaleUpperCase("es-ES");
  const l = w.toLocaleLowerCase("es-ES");
  if (i > 0 && PARTICULAS.has(l)) return l;
  return l.replace(/(^|[^a-záéíóúüñç0-9])([a-záéíóúüñç])/g, (m, a, b) => a + b.toLocaleUpperCase("es-ES"));
}).join(" ");
const aMayus = (o) => {
  for (const k of CAMPOS_MAYUS) if (typeof o[k] === "string") o[k] = o[k].toLocaleUpperCase("es-ES");
  for (const k of CAMPOS_TITULO) if (typeof o[k] === "string" && o[k].trim()) o[k] = tipoTitulo(o[k]);
  return o;
};

function normalizar(d = {}) {
  const r = {};
  for (const [k, v] of Object.entries(d)) r[k] = v === null || v === "null" ? "" : String(v).trim();
  // Unifica el nombre de la aseguradora con la lista
  const a = (r.aseguradora || "").toLowerCase();
  const sin = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const match = a && CFG.ASEGURADORAS.find((x) => sin(a).includes(sin(x)) || sin(x).includes(sin(a)));
  if (match && match !== "Otra") r.aseguradora = match;
  if (r.fecha_encargo && !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_encargo)) r.fecha_encargo = "";
  // Números de referencia con puntos de miles (915.978.190 → 915978190)
  for (const k of ["expediente", "num_encargo", "num_siniestro", "poliza"]) {
    if (/^\d{1,3}(\.\d{3})+$/.test(r[k] || "")) r[k] = r[k].replace(/\./g, "");
  }
  for (const k of ["telefono", "telefono2", "perjudicado_telefono", "tramitador_telefono"]) {
    if (r[k] && /^[\d\s.\-+]+$/.test(r[k])) r[k] = r[k].replace(/[\s.\-]/g, "");
    if (/^(\+|00)34\d{9}$/.test(r[k] || "")) r[k] = r[k].replace(/^(\+|00)34/, "");
  }
  // Teléfono ilegible o tapado: busca teléfonos escritos en la descripción
  const telOK = (t) => /^(\+?34)?[6-9]\d{8}$/.test(t || "");
  const enTexto = [...new Set(((r.averia || "").match(/(?<!\d)[6-9](?:[\s.]?\d){8}(?!\d)/g) || [])
    .map((t) => t.replace(/[\s.]/g, "")))]
    .filter((t) => ![r.tramitador_telefono, r.perjudicado_telefono, CFG.DESTINO_INFORMES?.telefono, r.expediente, r.num_encargo, r.num_siniestro, r.poliza]
      .some((x) => x && String(x).replace(/\D/g, "") === t));
  if (!telOK(r.telefono)) {
    if (enTexto.length) r.telefono = enTexto.shift();
  } else {
    const i = enTexto.indexOf(r.telefono.replace(/^\+?34/, ""));
    if (i >= 0) enTexto.splice(i, 1);
  }
  if (!telOK(r.telefono2) && enTexto.length) r.telefono2 = enTexto.shift();
  r.tipo = detectarTipo(r);
  return aMayus(r);
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
  ${!id && S.fotosPendientes?.length ? `<div class="aviso">Al guardar se añadirán también ${S.fotosPendientes.length === 1 ? "1 foto compartida" : S.fotosPendientes.length + " fotos compartidas"}.</div>` : ""}
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
      ${id && p.realizado_at ? `<label>Fecha en que se hizo el trabajo<input name="realizado_dia" type="date" value="${new Date(p.realizado_at).toLocaleDateString("sv-SE")}" max="${new Date().toLocaleDateString("sv-SE")}"><small class="suave">Decide en qué mes entra en la facturación.</small></label>` : ""}
      <label>Tipo de parte
        <select name="tipo">
          <option value="siniestro" ${esConexion(p) ? "" : "selected"}>Encargo del seguro</option>
          <option value="conexion" ${esConexion(p) ? "selected" : ""}>Conexión · presupuesto particular (con IVA, lo paga el cliente)</option>
        </select>
      </label>
      ${!id && S.borrador?.archivo && esConexion(p) ? '<p class="aviso-campo">💬 Parece un parte de <b>Conexión</b> (presupuesto para el cliente). Cámbialo si no lo es.</p>' : ""}
    </div>
    <div class="tarjeta">
      ${campo("nombre", "Nombre del asegurado", "text", 'autocomplete="off"')}
      ${!id && S.borrador?.archivo
        ? (/^(\+?34)?[6-9]\d{8}$/.test(p.telefono || "")
          ? '<p class="aviso-campo">⚠️ Comprueba el teléfono cifra a cifra con el papel.</p>'
          : '<p class="aviso-campo">⚠️ No se ha podido leer un teléfono completo (9 cifras). Míralo en la descripción del trabajo o pídeselo al tramitador.</p>')
        : ""}
      ${!id && S.borrador?.archivo ? avisosLectura(p).map((t) => `<p class="aviso-campo">⚠️ ${esc(t)}: revísalo con el papel.</p>`).join("") : ""}
      <div class="dos">${campo("telefono", "Teléfono", "tel")}${campo("telefono2", "Teléfono 2", "tel")}</div>
      <div class="dos">${campo("perjudicado_nombre", "Perjudicado (tercero)")}${campo("perjudicado_telefono", "Tel. perjudicado", "tel")}</div>
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
      <div class="dos precio">${campo("importe_valorado", "Valorado (€ sin IVA)", "number", 'step="0.01" inputmode="decimal"')}${campo("importe_autorizado", "Autorizado (€)", "number", 'step="0.01" inputmode="decimal"')}</div>
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

  if (!id && S.borrador?.archivo) S.antesDeSalir = () => confirm("Se perderán los datos leídos de este parte. ¿Salir sin guardar?");
  $("#volver").onclick = $("#cancelar").onclick = () => { if (S.antesDeSalir && !S.antesDeSalir()) return; S.antesDeSalir = null; history.back(); };
  if (!id && (S.borrador?.archivo || S.fotosPendientes?.length)) avisoRepetido(p);
  // Mapfre con expediente que empieza por A → Conexión
  $$("#fParte [name=expediente], #fParte [name=aseguradora]").forEach((el) => el.addEventListener("change", () => {
    const f = Object.fromEntries(new FormData($("#fParte")));
    if (detectarTipo({ ...f, tipo: "" }) === "conexion" && f.tipo !== "conexion") { $("#fParte [name=tipo]").value = "conexion"; toast("Marcado como Conexión (Mapfre, expediente con A)"); }
  }));
  if (!id) {
    let tRep;
    $$("#fParte [name=expediente], #fParte [name=num_encargo], #fParte [name=num_siniestro], #fParte [name=aseguradora]").forEach((el) =>
      el.addEventListener("change", () => { clearTimeout(tRep); tRep = setTimeout(() => avisoRepetido(Object.fromEntries(new FormData($("#fParte")))), 300); }));
  }
  $("#fParte").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = aMayus(Object.fromEntries(new FormData(e.target)));
    for (const k in f) if (f[k] === "") f[k] = null;
    if (f.fecha_cita) f.fecha_cita = new Date(f.fecha_cita).toISOString();
    if ("realizado_dia" in f) { if (f.realizado_dia) f.realizado_at = diaAISO(f.realizado_dia); delete f.realizado_dia; }
    for (const k of ["importe_valorado", "importe_autorizado"]) if (f[k] != null) f[k] = Number(String(f[k]).replace(",", "."));
    if (!f.aseguradora) return toast("Elige la aseguradora", "error");
    try {
      if (id) {
        await conCarga("Guardando…", () => api.actualizarParte(id, f));
        toast("Guardado", "ok");
        location.replace("#/parte/" + id);
      } else {
        const rep = await analizarRepeticion(f);
        if (rep?.identico) {
          if (rep.orig.borrado_at) {
            if (confirm(`Este parte ya lo tienes (igual) y está en la papelera. ¿Recuperarlo?`)) {
              await conCarga("Recuperando…", () => api.restaurarParte(rep.orig.id));
              S.borrador = null; return (location.hash = "/parte/" + rep.orig.id);
            }
            return;
          }
          if (confirm(`Este parte ya lo tienes y es igual (${rep.orig.nombre ?? ""}, ${rep.motivo}). No se guarda otro.\n\n¿Abrir el que ya tienes?`)) {
            S.borrador = null; S.fotosPendientes = null; location.hash = "/parte/" + rep.orig.id;
          }
          return;
        }
        if (rep) {
          f.repetido_de = rep.orig.id;
          f.cambios_repetido = rep.diffs.map((x) => x.txt).join(" · ");
        }
        const nuevo = await conCarga("Guardando…", async () => {
          const n = await api.crearParte({ ...f, datos_ia: S.borrador?.archivo ? S.borrador.datos : null });
          if (S.borrador?.archivo) {
            const ext = S.borrador.mime === "application/pdf" ? "pdf" : "jpg";
            const path = await api.subirArchivo(`${n.id}/documento.${ext}`, S.borrador.archivo, S.borrador.mime);
            await api.actualizarParte(n.id, { documento_path: path });
          }
          if (S.fotosPendientes?.length) {
            try { await subirFotos(n, S.fotosPendientes, "antes"); } catch (e) { toast("El parte se guardó, pero no las fotos: " + e.message, "error"); }
            S.fotosPendientes = null;
          }
          return n;
        });
        if (f.repetido_de) api.anadirEvento(f.repetido_de, null, `Ha llegado otro parte repetido con cambios (${f.cambios_repetido}). Se ha guardado como parte nuevo.`).catch(() => {});
        S.borrador = null;
        toast(f.repetido_de ? "Parte creado (marcado como repetido)" : "Parte creado", "ok");
        location.replace("#/parte/" + nuevo.id);
      }
    } catch (err) {
      if (String(err.message).includes("partes_aseg_exp_uq")) toast("La base de datos todavía no admite partes repetidos con cambios (falta un paso de configuración)", "error");
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
  if (!S.partes?.length) { try { S.partes = await api.listarPartes(); } catch { /* nada */ } }
  const original = p.repetido_de ? (S.partes || []).find((x) => x.id === p.repetido_de) : null;
  const repetidos = (S.partes || []).filter((x) => x.repetido_de === p.id);

  app.innerHTML = `
  <header class="barra" style="--ase:${colorAseg(p.aseguradora)}">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1><span class="aseg">${esc(p.aseguradora)}</span> ${esc(p.expediente || "")}</h1>
    <button class="icono" id="menuParte" aria-label="Más opciones">${I.more}</button>
  </header>

  ${esConexion(p) ? `<div class="aviso cx-info">💬 <b>Conexión · presupuesto particular.</b> No es un encargo del seguro: el presupuesto se manda al cliente, con IVA (${ivaDe(p)} %), y lo paga él. No entra en la relación de ${esc(DEST.nombre)}.</div>` : ""}
  ${p.repetido_de ? `<div class="aviso repetido-info">🔁 <b>Parte repetido</b>${p.cambios_repetido ? ` · Cambios: ${esc(p.cambios_repetido)}` : ""}
    <br>${original ? `<a href="#/parte/${original.id}">Ver el parte anterior (${esc(original.estado ? estadoInfo(original.estado).nombre : "")}, ${fFecha(original.created_at)})</a>` : "El parte anterior ya no está en la lista (puede estar en la papelera)."}</div>` : ""}
  ${repetidos.length ? `<div class="aviso repetido-info">🔁 Este parte tiene ${repetidos.length === 1 ? "un repetido posterior" : repetidos.length + " repetidos posteriores"}: ${repetidos.map((x) => `<a href="#/parte/${x.id}">${fFecha(x.created_at)}${x.num_encargo ? " · enc. " + esc(x.num_encargo) : ""}</a>`).join(" · ")}</div>` : ""}
  <section class="cabecera">
    <div class="nombre">${esc(p.nombre || "Sin nombre")}</div>
    ${dirCompleta ? `<a class="dir" href="${linkMapa(p)}" target="_blank" rel="noopener">${esc(dirCompleta)}</a>` : ""}
    ${p.telefono ? `<div class="tel-txt">${esc(p.telefono)}${p.telefono2 ? " · " + esc(p.telefono2) : ""}</div>` : ""}
    <div class="acciones">
      <a class="accion ${p.telefono ? "" : "off"}" href="${p.telefono ? linkLlamar(p.telefono) : "#"}">${I.phone}<span>Llamar</span></a>
      <a class="accion wa ${p.telefono ? "" : "off"}" href="${p.telefono ? linkWhatsApp(p.telefono, msgCliente) : "#"}" target="_blank" rel="noopener">${I.wa}<span>WhatsApp</span></a>
      <a class="accion ${dirCompleta ? "" : "off"}" href="${dirCompleta ? linkMapa(p) : "#"}" target="_blank" rel="noopener">${I.map}<span>Cómo llegar</span></a>
      <button class="accion ${p.telefono ? "" : "off"}" id="aContacto">${I.user}<span>Contacto</span></button>
    </div>
    ${p.telefono2 ? `<div class="tel2">Tel. 2: <a href="${linkLlamar(p.telefono2)}">llamar</a> · <a href="${linkWhatsApp(p.telefono2, msgCliente)}" target="_blank" rel="noopener">WhatsApp</a></div>` : ""}
    ${p.perjudicado_nombre || p.perjudicado_telefono ? `<div class="tel2 perj">👤 Perjudicado: <b>${esc(p.perjudicado_nombre || "sin nombre")}</b>${p.perjudicado_telefono ? ` · ${esc(p.perjudicado_telefono)} · <a href="${linkLlamar(p.perjudicado_telefono)}">llamar</a> · <a href="${linkWhatsApp(p.perjudicado_telefono, "")}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>` : ""}
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
      ${idx >= idxEstado("visitado") ? `<button class="btn primario ancho" id="informe" style="--c:#16a34a">${I.wa} ${esConexion(p) ? `Enviar ${p.estado === "realizado" ? "trabajo terminado" : "presupuesto"} al cliente` : `Enviar ${p.estado === "realizado" ? "trabajo terminado" : "visita"} a ${esc(DEST.nombre)}`}</button>` : ""}
      <button class="btn ancho" id="nota">Añadir nota</button>
    </div>
  </section>

  <section class="tarjeta">
    <h3>${esConexion(p) ? "Trabajo solicitado" : "Avería / daño"}</h3>
    <p class="pre">${esc(p.averia || "—")}</p>
  </section>
  ${(p.lineas_autorizadas || []).length && !esConexion(p) ? seccionLineas(p, "autorizados")
    : idx >= idxEstado("visitado") || (p.lineas_valoracion || []).length ? seccionLineas(p, "valoracion") : ""}
  ${idx >= idxEstado("autorizado") || (p.lineas_realizadas || []).length ? seccionLineas(p, "realizados") : ""}

  <section class="tarjeta datos">
    <h3>Datos</h3>
    ${dato("Nº encargo", p.num_encargo)}
    ${dato("Nº siniestro", p.num_siniestro)}
    ${dato("Póliza", p.poliza)}
    ${dato("Fecha encargo", fFecha(p.fecha_encargo))}
    ${p.fecha_cita ? `<div class="dato"><span>Cita</span><b>${fFechaHora(p.fecha_cita)} · <a href="${linkCalendario(p)}" target="_blank" rel="noopener">📅 Añadir al calendario</a></b></div>` : ""}
    ${verPrecios() ? dato("Valorado (sin IVA)", fEuros(p.importe_valorado)) + dato("Autorizado", fEuros(p.importe_autorizado)) : ""}
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
    <div class="h3-fila"><h3>Fotos (${fotosDe(p).length})</h3><button class="btn peq" id="addFoto">${I.cam} Añadir</button></div>
    <div class="fotos" id="fotos">${fotosDe(p).length ? "" : '<p class="suave">Sin fotos</p>'}</div>
  </section>

  <section class="tarjeta">
    <div class="h3-fila"><h3>Bocetos (${bocetosDe(p).length})</h3><button class="btn peq" id="addBoceto">✏️ Dibujar</button></div>
    <div class="fotos" id="bocetos">${bocetosDe(p).length ? "" : '<p class="suave">Dibuja el mueble, medidas… Es solo para uso interno: no se envía en los informes.</p>'}</div>
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

  $("#volver").onclick = () => (location.hash = "/");
  $("#menuParte").onclick = () => menuParte(p);
  $("#aContacto").onclick = () => guardarContacto(p);
  // Autorizar = confirmar la valoración código a código (si hay códigos valorados)
  const irAFase = (dest) => {
    if (dest === "autorizado" && !esConexion(p) && (p.lineas_valoracion || []).length && idxEstado(p.estado) < idxEstado("autorizado")) { location.hash = `/lineas/${p.id}/autorizados`; return; }
    sheetFase(p, dest);
  };
  $("#avanzar")?.addEventListener("click", () => irAFase(sig.id));
  $("#informe")?.addEventListener("click", () => flujoInforme(p));
  $("#nota").onclick = () => sheetFase(p, null);
  $$(".paso").forEach((b) => b.addEventListener("click", () => {
    const dest = b.dataset.estado;
    if (dest === p.estado) return;
    irAFase(dest);
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
  $("#addBoceto").onclick = () => nuevoBoceto(p);
  $$(".editar-ev").forEach((b) => b.addEventListener("click", () => sheetEvento(p, p.eventos.find((e) => String(e.id) === b.dataset.id))));
  $("#aPapelera").onclick = () => enviarPapelera(p);
  pintarFotos(p);
}

const htmlTotales = (t, iva = CFG.IVA) => iva
  ? `<span>Base imponible</span><b>${fEuros(t.base)}</b><span>IVA ${iva}%</span><b>${fEuros(t.iva)}</b><span>Total</span><b class="grande">${fEuros(t.total)}</b>`
  : `<span>Total (sin IVA)</span><b class="grande">${fEuros(t.base)}</b>`;

const CAMPO_LINEAS = { valoracion: "lineas_valoracion", autorizados: "lineas_autorizadas", realizados: "lineas_realizadas" };
function seccionLineas(p, tipo) {
  const lineas = p[CAMPO_LINEAS[tipo]] || [];
  const t = totalesLineas(lineas, ivaDe(p));
  const titulo = tipo === "realizados" ? "Trabajos realizados" : tipo === "autorizados" ? "Valoración autorizada" : (esConexion(p) ? "Presupuesto" : "Valoración");
  const vacio = tipo === "realizados" ? "Sin trabajos anotados. Al editarlos se copian los autorizados (o los de la valoración) para que solo cambies lo que haya variado." : "Sin códigos. Busca por código o por descripción.";
  return `<section class="tarjeta">
    <div class="h3-fila"><h3>${titulo}</h3>
      <span>${tipo === "valoracion" && lineas.length && !esConexion(p) && idxEstado(p.estado) >= idxEstado("valorado") ? `<a class="btn peq primario" href="#/lineas/${p.id}/autorizados">Autorizar</a> ` : ""}<a class="btn peq" href="#/lineas/${p.id}/${tipo}">${lineas.length ? "Editar" : "+ Códigos"}</a></span></div>
    ${tipo === "autorizados" ? `<p class="suave" style="font-size:.85em;margin:.2em 0 .6em">Esto es lo que se factura<span class="precio">. Valorado: ${fEuros(totalesLineas(p.lineas_valoracion || []).base)}</span> · <a href="#/lineas/${p.id}/valoracion">ver valoración original</a></p>` : ""}
    ${lineas.length ? `<div class="lineas-mini">${lineas.map((l) => `
      <div><span><b>${esc(l.codigo || "—")}</b> ${esc(l.descripcion)}</span><span>${Number(l.cantidad)}×<span class="precio"> · ${fEuros(importeLinea(l))}${Number(l.dto) ? ` <small>(-${Number(l.dto)}%)</small>` : ""}</span></span></div>`).join("")}</div>
      <div class="totales precio">${htmlTotales(t, ivaDe(p))}</div>`
      : `<p class="suave">${vacio}</p>`}
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

// Bocetos: dibujos internos (se guardan como fotos de tipo "boceto" y nunca salen en informes)
const fotosDe = (p) => (p.fotos || []).filter((f) => f.tipo !== "boceto");
const bocetosDe = (p) => (p.fotos || []).filter((f) => f.tipo === "boceto");
const cargarBoceto = () => import("./boceto.js");

async function nuevoBoceto(p, fondo = null, reemplaza = null, esFoto = false) {
  let abrirBoceto;
  try { ({ abrirBoceto } = await cargarBoceto()); } catch { toast("No se pudo abrir el editor de dibujo", "error"); return; }
  const blob = await abrirBoceto({ fondo, foto: esFoto || fondo?.type === "image/jpeg", titulo: `${esFoto ? "Sobre foto" : "Boceto"} · ${p.nombre || p.expediente || ""}` });
  if (!blob) return;
  await conCarga("Guardando dibujo…", async () => {
    const jpg = blob.type === "image/jpeg";
    const path = await api.subirArchivo(`${p.id}/boceto_${Date.now()}.${jpg ? "jpg" : "png"}`, blob, jpg ? "image/jpeg" : "image/png");
    await api.anadirFoto(p.id, path, "boceto");
    if (reemplaza) await api.borrarFoto(reemplaza).catch(() => {});
  });
  toast("Dibujo guardado", "ok");
  vistaParte(p.id);
}

function pintarBocetos(p) {
  const cont = $("#bocetos"), lista = bocetosDe(p);
  if (!cont || !lista.length) return;
  cont.innerHTML = lista.map((f) => `<figure data-id="${f.id}" class="boceto-mini"><img alt="Boceto" loading="lazy"><figcaption>${fFecha(f.created_at)}</figcaption></figure>`).join("");
  for (const f of lista) {
    const fig = cont.querySelector(`figure[data-id="${f.id}"]`);
    api.urlArchivo(f.path).then((u) => { fig.querySelector("img").src = u; }).catch(() => {});
    fig.addEventListener("click", () => {
      const s = abrirSheet(`
        <h2>Boceto</h2>
        <div class="lista-botones">
          <button class="btn ancho" id="bVer">👁 Verlo en grande</button>
          <button class="btn ancho" id="bEditar">✏️ Seguir dibujando encima</button>
          <button class="btn ancho peligro" id="bBorrar">🗑 Borrar boceto</button>
          <button class="btn texto ancho" data-cerrar>Cerrar</button>
        </div>`);
      $("#bVer", s).onclick = async () => { cerrarSheet(); window.open(await api.urlArchivo(f.path), "_blank"); };
      $("#bEditar", s).onclick = async () => {
        cerrarSheet();
        let fondo;
        try { fondo = await conCarga("Abriendo…", () => api.descargarArchivo(f.path)); } catch { return; }
        nuevoBoceto(p, fondo, f);
      };
      $("#bBorrar", s).onclick = async () => {
        if (!confirm("¿Borrar este boceto?")) return;
        cerrarSheet();
        await conCarga("Borrando…", () => api.borrarFoto(f));
        vistaParte(p.id);
      };
    });
  }
}

async function pintarFotos(p) {
  pintarBocetos(p);
  const cont = $("#fotos");
  const fotos = fotosDe(p).sort((x, y) => (y.tipo === "firmado") - (x.tipo === "firmado"));   // el parte firmado, el primero
  if (!fotos.length) return;
  const etiquetas = { antes: "Antes", despues: "Después", firmado: "📄 Parte firmado", otra: "" };
  cont.innerHTML = fotos.map((f) => `
    <figure data-id="${f.id}"><img alt="" loading="lazy"><figcaption>${etiquetas[f.tipo] || ""}</figcaption>
      <button class="borrar-foto" aria-label="Borrar foto">${I.x}</button></figure>`).join("");
  for (const f of fotos) {
    const fig = cont.querySelector(`figure[data-id="${f.id}"]`);
    api.urlArchivo(f.path).then((u) => { fig.querySelector("img").src = u; }).catch(() => {});
    fig.querySelector("img").addEventListener("click", () => {
      const s = abrirSheet(`
        <h2>Foto</h2>
        <div class="lista-botones">
          <button class="btn ancho" id="fVer">👁 Verla en grande</button>
          <button class="btn ancho" id="fDibujar">✏️ Dibujar encima (medidas, daños…)</button>
          <button class="btn texto ancho" data-cerrar>Cerrar</button>
        </div>
        <p class="suave">El dibujo se guarda aparte, en Bocetos (interno). La foto original no se toca.</p>`);
      $("#fVer", s).onclick = async () => { cerrarSheet(); window.open(await api.urlArchivo(f.path), "_blank"); };
      $("#fDibujar", s).onclick = async () => {
        cerrarSheet();
        let fondo;
        try { fondo = await conCarga("Abriendo foto…", () => api.descargarArchivo(f.path)); } catch { return; }
        if (!fondo) return toast("No se pudo abrir la foto", "error");
        nuevoBoceto(p, fondo, null, true);
      };
    });
    fig.querySelector(".borrar-foto").addEventListener("click", async () => {
      if (!confirm("¿Borrar esta foto?")) return;
      await conCarga("Borrando…", () => api.borrarFoto(f));
      vistaParte(p.id);
    });
  }
}

async function subirFotos(p, files, tipo) {
  if (tipo === "firmado") {   // solo hay un parte firmado: el nuevo sustituye al anterior
    files = files.slice(0, 1);
    const previos = (p.fotos || []).filter((f) => f.tipo === "firmado");
    for (const f of previos) await api.borrarFoto(f).catch(() => {});
  }
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
      ${[["antes", "Antes"], ["despues", "Después"], ["firmado", "Parte firmado"], ["otra", "Otra"]].map(([v, n]) => `<button type="button" data-v="${v}" class="${v === tipoDef ? "on" : ""}">${n}</button>`).join("")}
    </div>
    <div class="lista-botones">
      <label class="btn grande">${I.cam}<span><b>Hacer foto</b></span><input type="file" accept="image/*" capture="environment" hidden id="fCam"></label>
      <label class="btn grande">${I.file}<span><b>Elegir de la galería</b></span><input type="file" accept="image/*" multiple hidden id="fGal"></label>
      <button class="btn texto ancho" data-cerrar>Cancelar</button>
    </div>`);
  let tipo = tipoDef;
  $$("#tipoFoto button", s).forEach((b) => b.onclick = () => {
    tipo = b.dataset.v; $$("#tipoFoto button", s).forEach((x) => x.classList.toggle("on", x === b));
    $("#fGal", s).multiple = tipo !== "firmado";
  });
  const alElegir = async (ev) => {
    const files = [...ev.target.files]; if (!files.length) return;
    cerrarSheet();
    try { await subirFotos(p, files, tipo); toast("Fotos guardadas", "ok"); }
    catch (e) { toast("Error subiendo fotos: " + e.message, "error"); }
    finally { cargando(false); vistaParte(p.id); }
  };
  $("#fCam", s).onchange = alElegir; $("#fGal", s).onchange = alElegir;
}

// Tarjeta de contacto (.vcf): nombre, teléfono, dirección, expediente y descripción. Nada más.
function vcardParte(p) {
  const e = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const nombre = (p.nombre || "Cliente").trim();
  const L = ["BEGIN:VCARD", "VERSION:3.0", `FN:${e(nombre)}`, `N:;${e(nombre)};;;`];
  for (const t of [p.telefono, p.telefono2].filter(Boolean)) L.push(`TEL;TYPE=CELL:${String(t).replace(/\s/g, "")}`);
  if (p.direccion || p.poblacion) L.push(`ADR;TYPE=HOME:;;${e(p.direccion)};${e(p.poblacion)};${e(p.provincia)};${e(p.codigo_postal)};`);
  const nota = [p.expediente ? `Exp. ${p.expediente}` : "", p.averia || ""].filter(Boolean).join("\n");
  if (nota) L.push(`NOTE:${e(nota)}`);
  L.push("END:VCARD");
  return L.join("\r\n") + "\r\n";
}

async function guardarContacto(p) {
  if (!p.telefono) return toast("Este parte no tiene teléfono", "error");
  const nombreArch = `${(p.nombre || "cliente").replace(/[^\wÀ-ÿ ]+/g, "").trim().replace(/\s+/g, "_") || "cliente"}.vcf`;
  const file = new File([vcardParte(p)], nombreArch, { type: "text/vcard" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: p.nombre || "Contacto" }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  descargar(file, nombreArch);
  toast("Contacto descargado: ábrelo para guardarlo en Contactos", "ok");
}

function menuParte(p) {
  const s = abrirSheet(`
    <h2>Parte ${esc(p.expediente || "")}</h2>
    <div class="lista-botones">
      <button class="btn ancho" id="mEditar">${I.edit} Editar datos, cita e importes</button>
      <button class="btn ancho" id="mDoc">${I.cam} Cambiar documento / volver a leer con IA</button>
      <button class="btn ancho" id="mInforme">${I.pdf} Enviar informe: PDF o mensaje (en cualquier fase)</button>
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
      const r = await conCarga("Leyendo con IA…", () => leerConIA(lectura, mime));
      if (r.giro) blob = blob === lectura ? r.lectura : await girarImagen(blob, r.giro);
      const datos = normalizar(r.datos);
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
        <label class="precio">Importe valorado (€, sin IVA)<input type="number" step="0.01" inputmode="decimal" name="importe_valorado" value="${(p.lineas_valoracion || []).length ? totalesLineas(p.lineas_valoracion).base : (p.importe_valorado ?? "")}"></label>` : ""}
      ${destino === "autorizado" ? `<label class="precio">Importe autorizado (€)<input type="number" step="0.01" inputmode="decimal" name="importe_autorizado" value="${(p.lineas_autorizadas || []).length ? totalesLineas(p.lineas_autorizadas).base : (p.importe_autorizado ?? p.importe_valorado ?? "")}"></label>` : ""}
      ${destino === "visitado" ? `<label class="btn ancho">${I.cam} Fotos de antes (opcional)<input type="file" accept="image/*" multiple hidden name="fotos" data-tipo="antes"></label><small class="suave" id="nFotos"></small>` : ""}
      ${destino === "realizado" ? `<label>Fecha en que se hizo el trabajo<input type="date" name="realizado_dia" value="${new Date().toLocaleDateString("sv-SE")}" max="${new Date().toLocaleDateString("sv-SE")}"></label>
        <small class="suave" style="margin-top:-.4em">Si lo hiciste el mes pasado, pon esa fecha: así entra en la facturación de ese mes.</small>
        <a class="btn ancho" href="#/lineas/${p.id}/realizados">📋 ${(p.lineas_realizadas || []).length ? "Revisar" : "Anotar"} trabajos realizados (códigos)</a>
        <label class="btn ancho primario">📄 Foto del parte firmado<input type="file" accept="image/*" capture="environment" hidden name="firmado"></label><small class="suave" id="nFirmado">${firmadoDe(p) ? "Ya hay un parte firmado; si haces otra foto se sustituye." : "Una sola foto. Irá la primera al enviar el trabajo terminado."}</small>
        <label class="btn ancho">${I.cam} Fotos del trabajo terminado<input type="file" accept="image/*" multiple hidden name="fotos" data-tipo="despues"></label><small class="suave" id="nFotos"></small>
        <div class="firma-caja"><div class="h3-fila"><b>Firma del cliente</b><button type="button" class="btn texto peq" id="limpiarFirma">Borrar</button></div>
          <canvas id="firma"></canvas><small class="suave">${p.firma_path ? "Ya hay una firma guardada; si firmas de nuevo se sustituye." : "Opcional. Pide al cliente que firme con el dedo."}</small></div>` : ""}
      <div class="pie-form">
        <button type="button" class="btn" data-cerrar>Cancelar</button>
        <button type="submit" class="btn primario" ${info ? `style="--c:${info.color}"` : ""}>Guardar</button>
      </div>
    </form>`);
  const inFotos = $("input[name=fotos]", s);
  const inFirmado = $("input[name=firmado]", s);
  inFirmado?.addEventListener("change", () => { if (inFirmado.files.length) $("#nFirmado", s).textContent = "✅ Parte firmado listo para guardar"; });
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
    if (destino === "realizado") {
      const dia = f.get("realizado_dia");
      cambios.realizado_at = dia && dia !== new Date().toLocaleDateString("sv-SE") ? diaAISO(dia) : new Date().toISOString();
    }
    else if (destino && p.estado === "realizado") cambios.realizado_at = null;
    if (f.has("fecha_cita")) cambios.fecha_cita = f.get("fecha_cita") ? new Date(f.get("fecha_cita")).toISOString() : null;
    if (f.has("importe_valorado")) cambios.importe_valorado = f.get("importe_valorado") === "" ? null : Number(f.get("importe_valorado"));
    if (f.has("importe_autorizado")) cambios.importe_autorizado = f.get("importe_autorizado") === "" ? null : Number(f.get("importe_autorizado"));
    const fotos = inFotos ? [...inFotos.files] : [];
    const firmadoFile = inFirmado?.files[0] || null;
    const firmaBlob = firma && !firma.vacio ? await firma.aBlob() : null;
    cerrarSheet();
    try {
      await conCarga("Guardando…", async () => {
        if (firmadoFile) await subirFotos(p, [firmadoFile], "firmado");
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

// ------------------------------------------------------------------ Informe y envío (PDF o mensaje + fotos)
function textoInforme(p, conPrecios) {
  const final = p.estado === "realizado";
  const lineas = final && (p.lineas_realizadas || []).length ? p.lineas_realizadas : p.lineas_valoracion || [];
  const ev = p.eventos || [];
  const fechaDe = (estado) => [...ev].reverse().find((e) => e.estado === estado)?.created_at;
  const notas = ev.filter((e) => e.nota && ["visitado", "valorado", "realizado", null].includes(e.estado ?? null) && !/^(Parte recibido de nuevo|Ha llegado otro parte|Preparado mensaje)/.test(e.nota))
    .slice(-3).map((e) => "- " + e.nota.trim());
  const L = [];
  const cx = esConexion(p);
  if (cx) {
    L.push(`*${final ? "TRABAJO TERMINADO" : "PRESUPUESTO"}*`);
    L.push(`Cliente: ${p.nombre || "—"}`);
  } else {
  L.push(`*${final ? "TRABAJO TERMINADO" : "VISITA REALIZADA"}*`);
  L.push(`${p.aseguradora || ""} · Exp. ${p.expediente || "—"}${p.num_encargo ? " · Encargo " + p.num_encargo : ""}${p.num_siniestro ? " · Siniestro " + p.num_siniestro : ""}`);
  L.push(`Cliente: ${p.nombre || "—"}${p.telefono ? " · Tel. " + p.telefono : ""}`);
  }
  const dir = [p.direccion, p.codigo_postal, p.poblacion].filter(Boolean).join(", ");
  if (dir) L.push(`Dirección: ${dir}`);
  if (p.averia) L.push(`${cx ? "Trabajo" : "Avería"}: ${p.averia}`);
  const fv = fechaDe("visitado"), fr = fechaDe("realizado");
  if (fv) L.push(`Visita: ${fFecha(fv)}`);
  if (final && fr) L.push(`Terminado: ${fFecha(fr)}`);
  if (notas.length && !cx) { L.push(""); L.push("*Observaciones:*"); L.push(...notas); }
  if (lineas.length) {
    L.push(""); L.push(`*${final && (p.lineas_realizadas || []).length ? "Trabajos realizados" : (cx ? "Presupuesto" : "Valoración")}:*`);
    for (const l of lineas) {
      const cant = Number(l.cantidad || 1).toLocaleString("es-ES");
      L.push(`- ${l.codigo ? l.codigo + " " : ""}${l.descripcion || ""} × ${cant}${conPrecios ? " = " + fEuros(importeLinea(l)) : ""}`);
    }
    if (conPrecios) {
      const iva = ivaDe(p), t = totalesLineas(lineas, iva);
      L.push(iva ? `*TOTAL: ${fEuros(t.total)}* (IVA ${iva}% incl.)` : `*TOTAL (sin IVA): ${fEuros(t.base)}*`);
    }
  } else if (conPrecios && p.importe_valorado != null) {
    L.push(""); L.push(cx && ivaDe(p) ? `*Presupuesto: ${fEuros(p.importe_valorado * (1 + ivaDe(p) / 100))}* (IVA ${ivaDe(p)}% incl.)` : `*Valoración: ${fEuros(p.importe_valorado)}*`);
  }
  L.push(""); L.push(CFG.EMPRESA?.nombre || "");
  return L.join("\n").trim();
}

const firmadoDe = (p) => (p.fotos || []).filter((f) => f.tipo === "firmado").at(-1) || null;
// Grupos de fotos que se pueden mandar con el trabajo terminado, en este orden: parte firmado, antes, después, otras
const GRUPOS_ENVIO = [["firmado", "Parte firmado"], ["antes", "Fotos del antes"], ["despues", "Fotos del después"], ["otra", "Otras fotos"]];
function fotosParaEnvio(p, sel) {
  const fotos = fotosDe(p).filter((f) => f.tipo !== "firmado");   // los bocetos son internos: nunca se envían
  if (p.estado === "realizado") {
    const firmado = firmadoDe(p);
    const de = { firmado: firmado ? [firmado] : [], antes: fotos.filter((f) => f.tipo === "antes"),
      despues: fotos.filter((f) => f.tipo === "despues"), otra: fotos.filter((f) => !["antes", "despues"].includes(f.tipo)) };
    if (!sel) return de;
    return GRUPOS_ENVIO.flatMap(([k]) => (sel[k] ? de[k] : []));
  }
  return fotos.filter((f) => f.tipo !== "despues");
}

async function flujoInforme(pIn) {
  cerrarSheet();
  let p;
  try { p = await conCarga("Preparando…", () => api.obtenerParte(pIn.id)); } catch { return; }
  const final = p.estado === "realizado";
  // En el trabajo terminado se elige qué fotos van (se recuerda la última elección)
  const grupos = final ? fotosParaEnvio(p) : null;
  let sel = { firmado: true, antes: true, despues: true, otra: false };
  try { Object.assign(sel, JSON.parse(sessionGet("fotosEnvio") || "{}")); } catch { /* por defecto */ }
  let fotos = final ? fotosParaEnvio(p, sel) : fotosParaEnvio(p);
  const textoMsg = () => `Texto escrito${fotos.length ? ` y ${fotos.length} foto${fotos.length > 1 ? "s" : ""} adjunta${fotos.length > 1 ? "s" : ""}` : " (sin fotos)"}`;
  const hayLineas = (p.lineas_valoracion || []).length || (p.lineas_realizadas || []).length || p.importe_valorado != null;
  let precios = verPrecios() && (esConexion(p) || sessionGet("precios") !== "0");
  const tipoInf = p.estado === "realizado" ? "trabajo terminado" : (esConexion(p) ? "presupuesto" : "visita");
  const s = abrirSheet(`
    <h2>Enviar ${tipoInf} ${esc(aQuien(destinoDe(p).nombre))}</h2>
    ${esConexion(p) && !p.telefono ? '<p class="aviso-campo">⚠️ Este parte no tiene teléfono del cliente.</p>' : ""}
    ${hayLineas && verPrecios() ? `<label class="check"><input type="checkbox" id="conPrecios" ${precios ? "checked" : ""}> Incluir precios en ${esConexion(p) ? "el presupuesto" : "la valoración"}</label>
    <p class="suave" id="txtPrecios">${precios ? "Códigos, cantidades, precios y total." : "Solo códigos, descripción y cantidades (sin precios ni total)."}</p>` : ""}
    ${final && GRUPOS_ENVIO.some(([k]) => grupos[k].length) ? `<div class="fotos-envio"><b>Fotos que van en el mensaje</b> <small class="suave">(en este orden)</small>
      ${GRUPOS_ENVIO.filter(([k]) => grupos[k].length).map(([k, n]) => `<label class="check"><input type="checkbox" data-grupo="${k}" ${sel[k] ? "checked" : ""}> ${n} (${grupos[k].length})</label>`).join("")}</div>` : ""}
    <div class="lista-botones">
      <button class="btn primario grande" id="envPDF" style="--c:#16a34a">${I.pdf}<span><b>PDF</b><small>Informe completo en un archivo PDF</small></span></button>
      <button class="btn grande" id="envMsg">${I.wa}<span><b>Mensaje + fotos</b><small id="txtMsgFotos">${textoMsg()}</small></span></button>
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>`);
  $("#conPrecios", s)?.addEventListener("change", (e) => {
    precios = e.target.checked; if (!esConexion(p)) sessionSet("precios", precios ? "1" : "0");
    $("#txtPrecios", s).textContent = precios ? "Códigos, cantidades, precios y total." : "Solo códigos, descripción y cantidades (sin precios ni total).";
  });
  $("#envPDF", s).onclick = () => enviarPDF(p, precios);
  $$(".fotos-envio input", s).forEach((c) => c.addEventListener("change", () => {
    sel[c.dataset.grupo] = c.checked; sessionSet("fotosEnvio", JSON.stringify(sel));
    fotos = fotosParaEnvio(p, sel); $("#txtMsgFotos", s).textContent = textoMsg();
  }));
  $("#envMsg", s).onclick = () => enviarMensaje(p, precios, fotos);
}

async function enviarMensaje(p, precios, fotosSel) {
  const texto = textoInforme(p, precios);
  let files = [];
  if (fotosSel.length) {
    try {
      files = await conCarga("Preparando fotos…", async () => {
        const out = [];
        let n = 0;
        for (const f of fotosSel) {
          const b = await api.descargarArchivo(f.path);
          if (b) out.push(new File([b], `${(p.expediente || "parte").replace(/[^\w-]/g, "")}_${++n}.jpg`, { type: b.type || "image/jpeg" }));
        }
        return out;
      });
    } catch { files = []; }
  }
  const { tel, nombre: quien } = destinoDe(p);
  const puedeFotos = files.length && navigator.canShare && navigator.canShare({ files });
  cerrarSheet();
  const s = abrirSheet(`
    <h2>Mensaje para ${esc(quien)}</h2>
    <textarea id="txtMsg" rows="10">${esc(texto)}</textarea>
    <div class="lista-botones">
      ${puedeFotos ? `<button class="btn primario grande" id="msgFotos" style="--c:#16a34a">${I.wa}<span><b>Enviar ${files.length} foto${files.length > 1 ? "s" : ""} + texto</b><small>Van juntas en un grupo. El texto se copia: pégalo una vez en «Añade un comentario»</small></span></button>` : ""}
      ${tel ? `<button class="btn grande" id="msgSolo">${I.wa}<span><b>${puedeFotos ? "Solo el texto" : "Enviar por WhatsApp"}</b><small>Abre el chat ${esc(quien.startsWith("el ") ? "del " + quien.slice(3) : "de " + quien)} con el mensaje escrito</small></span></button>` : ""}
      <button class="btn grande" id="msgCopiar">📋<span><b>Copiar texto</b><small>Para pegarlo donde quieras</small></span></button>
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>
    ${files.length && !puedeFotos ? '<p class="suave">Este navegador no deja adjuntar fotos directamente: envía el texto y adjunta las fotos desde la galería.</p>' : ""}`);
  const txt = () => $("#txtMsg", s).value;
  $("#msgFotos", s)?.addEventListener("click", async () => {
    // Sin "text": si se pasa, WhatsApp lo repite en cada foto. Las fotos van en grupo y el texto se pega una sola vez.
    try {
      let copiado = false;
      try { await navigator.clipboard.writeText(txt()); copiado = true; } catch { /* sin permiso */ }
      toast(copiado ? "Texto copiado: en WhatsApp mantén pulsado «Añade un comentario» y pega" : "No se pudo copiar el texto: usa luego «Solo el texto»", copiado ? "ok" : "error");
      await navigator.share({ files });
    }
    catch (e) { if (e.name !== "AbortError") toast("No se pudo compartir: " + e.message, "error"); }
  });
  $("#msgSolo", s)?.addEventListener("click", () => { location.href = linkWhatsApp(tel, txt()); });
  $("#msgCopiar", s).onclick = async () => {
    try { await navigator.clipboard.writeText(txt()); toast("Texto copiado", "ok"); } catch { toast("No se pudo copiar", "error"); }
  };
}

async function enviarPDF(pIn, precios) {
  cerrarSheet();
  let blob, nombre, p, enlace = null;
  try {
    ({ blob, nombre, p } = await conCarga("Generando PDF…", async () => {
      const p = await api.obtenerParte(pIn.id);
      const { generarInforme } = await cargarPDF();
      const r = await generarInforme(p, api, S.miembros, { precios, iva: ivaDe(p) });
      const path = await api.subirArchivo(`${p.id}/${r.nombre}`, r.blob, "application/pdf");
      await api.actualizarParte(p.id, { informe_path: path });
      if (api.modo === "supabase") { try { enlace = await api.urlArchivo(path, 60 * 60 * 24 * 30); } catch { /* sin enlace */ } }
      return { ...r, p };
    }));
  } catch { return; }

  const file = new File([blob], nombre, { type: "application/pdf" });
  const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const tipoInf = p.estado === "realizado" ? "Trabajo terminado" : "Visita realizada";
  const texto = esConexion(p)
    ? `Hola${p.nombre ? " " + p.nombre.split(/\s+/)[0] : ""}, le enviamos ${p.estado === "realizado" ? "el resumen del trabajo realizado" : "el presupuesto que nos pidió"}. Cualquier duda nos dice. ${CFG.EMPRESA?.nombre || ""}`
    : `${tipoInf} - ${p.aseguradora} exp. ${p.expediente || ""}${p.num_encargo ? " (encargo " + p.num_encargo + ")" : ""} - ${p.nombre || ""}.`;
  const { tel, nombre: quien } = destinoDe(p);
  const s = abrirSheet(`
    <h2>PDF listo</h2>
    <p class="suave">${esc(nombre)}${precios ? "" : " · sin precios"}</p>
    <div class="lista-botones">
      ${puedeCompartir ? `<button class="btn primario grande" id="compartir" style="--c:#16a34a">${I.wa}<span><b>Enviar PDF por WhatsApp</b><small>Elige WhatsApp y luego ${esc(aQuien(quien))}</small></span></button>` : ""}
      ${tel ? `<a class="btn grande" id="waEnlace" target="_blank" rel="noopener" href="${linkWhatsApp(tel, texto + (enlace ? "\n" + enlace : ""))}">${I.wa}<span><b>WhatsApp directo ${esc(aQuien(quien))}</b><small>${enlace ? "Mensaje con enlace al PDF (válido 30 días)" : "Abre el chat; adjunta el PDF descargado"}</small></span></a>` : ""}
      <button class="btn grande" id="descargar">${I.pdf}<span><b>Descargar / ver PDF</b></span></button>
      <button class="btn texto ancho" data-cerrar>Cerrar</button>
    </div>
    ${!tel ? `<p class="suave">Consejo: añade el teléfono ${esConexion(p) ? "del cliente" : "del tramitador"} en "Editar datos" para abrir su chat directamente.</p>` : ""}`);
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
  if (!CAMPO_LINEAS[tipo]) tipo = "valoracion";
  const campo = CAMPO_LINEAS[tipo];
  let lineas = JSON.parse(JSON.stringify(p[campo] || []));
  let copiado = "";
  const origen = tipo === "realizados" ? ((p.lineas_autorizadas || []).length ? ["lineas_autorizadas", "autorizados"] : ["lineas_valoracion", "de la valoración"])
    : tipo === "autorizados" ? ["lineas_valoracion", "de la valoración"] : null;
  if (origen && !lineas.length && (p[origen[0]] || []).length) { lineas = JSON.parse(JSON.stringify(p[origen[0]])); copiado = origen[1]; }
  let sucio = copiado;

  app.innerHTML = `
  <header class="barra">
    <button class="icono" id="volver" aria-label="Volver">${I.back}</button>
    <h1>${tipo === "realizados" ? "Trabajos realizados" : tipo === "autorizados" ? "Autorizar" : "Valoración"} <small class="sub">${esc(p.expediente || "")}</small></h1>
    <button class="btn peq guardar" id="guardarL">${tipo === "autorizados" && idxEstado(p.estado) < idxEstado("autorizado") ? "Autorizar" : "Guardar"}</button>
  </header>
  ${copiado ? `<div class="aviso">He copiado los códigos ${copiado}. ${tipo === "autorizados" ? "Quita o añade lo que no te hayan autorizado y pulsa arriba. Esto es lo que se factura." : "Cambia solo lo que haya variado y guarda."}</div>` : ""}
  <div class="buscador">${I.search}<input id="bT" type="search" placeholder="Código o descripción (p.ej. 5108, rodapié, galce)" autocomplete="off"></div>
  <div class="chips cats" id="catsT"></div>
  <div id="resT" class="resultados"></div>
  <section class="tarjeta">
    <div class="h3-fila"><h3>Líneas</h3>
      <span><button class="btn peq" id="libre">+ Línea libre</button> <button class="btn peq" id="dtoTodo">% Dto a todo</button></span></div>
    <div id="lineas"></div>
    <div id="totales" class="totales precio"></div>
  </section>
  <div style="height:60px"></div>`;

  const pintarTotales = () => {
    const t = totalesLineas(lineas, ivaDe(p));
    $("#totales").innerHTML = htmlTotales(t, ivaDe(p));
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
          <label class="precio">Precio €<input class="prec" type="number" inputmode="decimal" step="0.01" value="${l.precio}"></label>
          <label class="precio">Dto %<input class="dto" type="number" inputmode="decimal" step="0.5" min="0" max="100" value="${l.dto || 0}"></label>
          <div class="imp precio"><span>Importe</span><b>${fEuros(importeLinea(l))}</b></div>
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
      : r.map((c) => `<button class="res" data-c="${esc(c.codigo)}"><b>${esc(c.codigo)}</b><span>${esc(c.descripcion)}</span><em class="precio">${fEuros(c.precio)}</em></button>`).join("");
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
  S.antesDeSalir = () => !sucio || confirm("Hay cambios sin guardar. ¿Salir sin guardar?");
  $("#volver").onclick = () => { if (!S.antesDeSalir()) return; S.antesDeSalir = null; location.hash = "/parte/" + id; };
  $("#guardarL").onclick = async () => {
    const limpias = lineas.filter((l) => l.descripcion.trim() || l.codigo).map((l) => ({ ...l, cantidad: Number(l.cantidad) || 0, precio: Number(l.precio) || 0, dto: Number(l.dto) || 0 }));
    const cambios = { [campo]: limpias };
    if (tipo === "valoracion") cambios.importe_valorado = totalesLineas(limpias).base;
    const autorizaAhora = tipo === "autorizados" && limpias.length && idxEstado(p.estado) < idxEstado("autorizado");
    if (tipo === "autorizados") {
      cambios.importe_autorizado = limpias.length ? totalesLineas(limpias).base : null;
      if (autorizaAhora) cambios.estado = "autorizado";
    }
    await conCarga("Guardando…", async () => {
      await api.actualizarParte(id, cambios);
      if (autorizaAhora) await api.anadirEvento(id, "autorizado", `Valoración confirmada: ${limpias.length} código(s), ${fEuros(cambios.importe_autorizado)} sin IVA.`);
    });
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
      return `${cab}<button class="res ${c.activo === false ? "inactivo" : ""}" data-c="${esc(c.codigo)}"><b>${esc(c.codigo)}</b><span>${esc(c.descripcion)}</span><em class="precio">${fEuros(c.precio)}</em></button>`;
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
      <div class="dos"><label>Días que tarda en pagar<input name="dias_cobro" type="number" min="0" step="1" value="${CFG.DIAS_COBRO ?? 60}"></label>
        <label>IVA de la factura mensual (%)<input name="iva_factura" type="number" min="0" step="1" value="${CFG.IVA_FACTURA ?? 21}"></label></div>
    </section>
    <section class="tarjeta">
      <h3>Tarifa de precios</h3>
      <a class="btn ancho" href="#/tarifa">📋 Ver y editar la tarifa (códigos y precios)</a>
      <label>IVA que se suma a las valoraciones (%, 0 = sin IVA)<input name="iva" type="number" step="1" min="0" value="${CFG.IVA ?? 21}"></label>
    </section>
    <section class="tarjeta">
      <h3>Espacio usado</h3>
      <div id="espacio"><p class="suave">Cargando…</p></div>
    </section>
    <section class="tarjeta">
      <h3>Gasto de la IA</h3>
      <div id="usoIA"><p class="suave">Cargando…</p></div>
      <p class="suave">Coste calculado con las tarifas de abajo (Gemini gratuito = 0 $). El saldo que te queda se ve en console.anthropic.com → Settings → Billing. Compara una vez al mes esta cifra con la de console.anthropic.com → Usage: si no coinciden, han cambiado los precios.</p>
      <label>Tarifas de la IA ($ por millón de tokens) — una por línea: <i>modelo: entrada, salida</i>
        <textarea name="precios_ia" rows="3">${esc(Object.entries(CFG.PRECIOS_IA || {}).map(([m, [a, b]]) => `${m}: ${a}, ${b}`).join("\n"))}</textarea></label>
      <p class="suave">Los precios oficiales están en claude.com/pricing (apartado API). Un cambio aquí solo afecta a las lecturas nuevas.</p>
    </section>
    <section class="tarjeta">
      <h3>Copia de seguridad</h3>
      <button type="button" class="btn ancho" id="btnCopia">💾 Descargar copia en Excel</button>
      <p class="suave">Todos los partes (también los de la papelera), las líneas de valoración y el historial. ${CFG.ULTIMA_COPIA || sessionGet("ultimaCopia") ? "Última copia: " + fFecha(CFG.ULTIMA_COPIA || sessionGet("ultimaCopia")) + "." : "Aún no se ha descargado ninguna."} Hazla una vez a la semana: si pasan ${DIAS_COPIA} días, la campana 🔔 te lo recuerda.</p>
    </section>
    <section class="tarjeta">
      <h3>Zonas</h3>
      <label>Una zona por línea: <i>Nombre: pueblo, pueblo, pueblo…</i><textarea name="zonas" rows="8">${esc((CFG.ZONAS || []).map((z) => z.nombre + ": " + (z.pueblos || []).join(", ")).join("\n"))}</textarea></label>
      <p class="suave">Cada parte se asigna a la zona cuyo pueblo aparece en su población. Los que no encajan salen en "Sin zona".</p>
    </section>
    <section class="tarjeta">
      <h3>Aseguradoras del desplegable</h3>
      <label>Una por línea<textarea name="aseguradoras" rows="7">${esc(CFG.ASEGURADORAS.join("\n"))}</textarea></label>
    </section>
    <section class="tarjeta">
      <h3>Mensaje de WhatsApp al cliente</h3>
      <label>Abrir con (en Android)<select name="wa_app">
        <option value="business" ${CFG.WHATSAPP_APP === "business" ? "selected" : ""}>WhatsApp Business</option>
        <option value="normal" ${CFG.WHATSAPP_APP !== "business" ? "selected" : ""}>WhatsApp normal</option>
      </select></label>
      <label>Texto<textarea name="mensaje" rows="4">${esc(CFG.MENSAJE_CLIENTE)}</textarea></label>
      <p class="suave">Puedes usar: {nombre} {empresa} {aseguradora} {expediente} {averia_corta}</p>
    </section>
    <div class="pie-form"><span></span><button type="submit" class="btn primario">Guardar ajustes</button></div>
  </form>

  <section class="tarjeta">
    <div class="h3-fila"><h3>Usuarios</h3><button class="btn peq" id="nuevoUsuario">+ Añadir</button></div>
    <div id="usuarios"><p class="suave">Cargando…</p></div>
  </section>
  ${pieCopyright()}
  <div style="height:40px"></div>`;

  $("#volver").onclick = () => (location.hash = "/");
  $("#fAjustes").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    const datos = {
      EMPRESA: { nombre: f.e_nombre.trim(), cif: f.e_cif.trim(), telefono: f.e_telefono.trim(), email: f.e_email.trim(), direccion: f.e_direccion.trim() },
      DESTINO_INFORMES: { nombre: f.d_nombre.trim(), telefono: f.d_telefono.replace(/\s/g, "") },
      DIAS_COBRO: Number(f.dias_cobro) || 60,
      IVA_FACTURA: f.iva_factura === "" ? 21 : Number(f.iva_factura),
      ASEGURADORAS: f.aseguradoras.split("\n").map((x) => x.trim()).filter(Boolean),
      MENSAJE_CLIENTE: f.mensaje.trim(),
      IVA: Number(f.iva) || 0,
      WHATSAPP_APP: f.wa_app || "business",
      PRECIOS_IA: Object.fromEntries(f.precios_ia.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [m, r = ""] = l.split(":"); const [a, b] = r.split(",").map((x) => Number(String(x).trim().replace(",", ".")));
        return [m.trim(), [a || 0, b || 0]];
      }).filter(([m]) => m)),
      ZONAS: f.zonas.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const i = l.indexOf(":");
        return i < 0 ? { nombre: l, pueblos: [l] } : { nombre: l.slice(0, i).trim(), pueblos: l.slice(i + 1).split(",").map((x) => x.trim()).filter(Boolean) };
      }),
    };
    if (!datos.ASEGURADORAS.includes("Otra")) datos.ASEGURADORAS.push("Otra");
    if (CFG.ULTIMA_COPIA) datos.ULTIMA_COPIA = CFG.ULTIMA_COPIA;
    await conCarga("Guardando…", () => api.guardarAjustes(datos));
    ajustesCargados = false; await cargarAjustes();
    toast("Ajustes guardados", "ok");
  });
  $("#nuevoUsuario").onclick = sheetNuevoUsuario;
  $("#btnCopia").onclick = copiaSeguridad;
  pintarUsoIA();
  pintarEspacio();
  pintarUsuarios();
}

async function pintarUsuarios() {
  const cont = $("#usuarios");
  if (!cont) return;
  let lista;
  try {
    lista = (await api.adminUsuarios("listar")).usuarios;
    const ms = await api.miembros().catch(() => []);
    lista = lista.map((u) => ({ ...u, ver_precios: ms.find((m) => m.user_id === u.id)?.ver_precios ?? u.ver_precios }));
  }
  catch (e) { cont.innerHTML = `<p class="suave">No se pudieron cargar: ${esc(e.message)}</p>`; return; }
  cont.innerHTML = lista.map((u) => `
    <div class="usuario" data-id="${u.id}">
      <div><b>${esc(u.nombre || "(sin alta en el equipo)")}</b>${u.es_admin ? ' <span class="etq">admin</span>' : ""}${!u.es_admin && u.ver_precios === false ? ' <span class="etq">sin precios</span>' : ""}<br>
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
      ${soyYo || u.es_admin ? "" : `<button class="btn ancho" id="uPrecios">${u.ver_precios === false ? "💶 Dejarle ver los precios" : "🙈 Ocultarle los precios"}</button>`}
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
  $("#uPrecios", s)?.addEventListener("click", async () => {
    await conCarga("Guardando…", () => api.editarMiembro(u.id, { ver_precios: u.ver_precios === false }));
    fin(u.ver_precios === false ? "Ahora ve los precios" : "Precios ocultos para este usuario");
  });
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

// Los enlaces "intent://" (WhatsApp Business en Android) se abren en la misma ventana
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='intent:']");
  if (a) { e.preventDefault(); location.href = a.href; }
});

// Al volver a la app (otra pestaña, desbloquear el móvil…) se recargan los partes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && $("#lista") && S.yo) cargarPartes();
});

// ------------------------------------------------------------------ Botón "Inicio" en todas las pantallas
function irAInicio() {
  if (typeof S.antesDeSalir === "function" && !S.antesDeSalir()) return;
  cerrarSheet();
  S.antesDeSalir = null;
  if (!location.hash || location.hash === "#/" || location.hash === "#") { vistaLista(); window.scrollTo(0, 0); }
  else location.hash = "/";
}
new MutationObserver(() => {
  const barra = $("#app > header.barra");
  if (!barra || barra.querySelector(".btn-inicio") || !$("#volver", barra)) return;
  const b = document.createElement("button");
  b.className = "icono btn-inicio"; b.setAttribute("aria-label", "Ir al inicio"); b.title = "Inicio";
  b.innerHTML = I.home;
  b.onclick = irAInicio;
  const ultimo = barra.lastElementChild;
  if (ultimo && ultimo.tagName === "SPAN" && !ultimo.textContent.trim()) ultimo.replaceWith(b);
  else barra.insertBefore(b, ultimo);
}).observe($("#app"), { childList: true });

// ------------------------------------------------------------------ Arranque
$("#inCamara").addEventListener("change", (e) => { procesarArchivo(e.target.files[0]); e.target.value = ""; });
$("#inArchivo").addEventListener("change", (e) => { procesarArchivo(e.target.files[0]); e.target.value = ""; });
(() => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.id = "inLote"; inp.multiple = true; inp.hidden = true; inp.accept = "application/pdf,image/*";
  document.body.appendChild(inp);
  inp.addEventListener("change", (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) iniciarLote(f); });
})();
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
