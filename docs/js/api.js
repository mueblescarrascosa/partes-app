// Capa de datos: Supabase (real) o Demo (localStorage). La interfaz es la misma.
const CFG = window.APP_CONFIG;
const BUCKET = "archivos";

// ---------------------------------------------------------------- Supabase
function crearApiSupabase() {
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  let yo = null;
  // Usuario de solo lectura (y no admin): no puede leer partes ni eventos directamente, sino las vistas
  // sin importes partes_lector y eventos_lector. Lo decide Supabase; aquí solo se elige de dónde leer.
  let lector = false;
  const tablaPartes = () => (lector ? "partes_lector" : "partes");
  const tablaEventos = () => (lector ? "eventos_lector" : "eventos");

  // Supabase devuelve como mucho 1.000 filas por consulta: las listas se leen en bloques.
  // Los bloques van ordenados por la clave única (no cambia aunque alguien edite mientras se lee)
  // y después se reordena en el móvil; sort es estable, así que en los empates manda la clave.
  const TAM_BLOQUE = 1000;
  async function leerTodo(consulta, clave = "id") {
    const filas = [];
    for (let desde = 0; ; desde += TAM_BLOQUE) {
      const bloque = ok(await consulta().order(clave).range(desde, desde + TAM_BLOQUE - 1));
      filas.push(...bloque);
      if (bloque.length < TAM_BLOQUE) return filas;
    }
  }
  const porFecha = (campo, desc = false) => (a, b) => (new Date(a[campo]) - new Date(b[campo])) * (desc ? -1 : 1);

  return {
    modo: "supabase",
    async sesion() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    onAuth(cb) { sb.auth.onAuthStateChange((e, s) => setTimeout(() => cb(s, e), 0)); },
    async entrar(email, password) {
      ok(await sb.auth.signInWithPassword({ email, password }));
    },
    async salir() { yo = null; lector = false; await sb.auth.signOut(); },
    async recuperar(email) {
      ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async cambiarPassword(password) { ok(await sb.auth.updateUser({ password })); },
    async yo() {
      if (yo) return yo;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const m = ok(await sb.from("miembros").select("*").eq("user_id", user.id).maybeSingle());
      yo = m ? { ...m, email: user.email } : { user_id: user.id, email: user.email, nombre: null };
      lector = !!(m?.solo_lectura && !m?.es_admin);
      return yo;
    },
    async miembros() { return ok(await sb.from("miembros").select("user_id,nombre,telefono,es_admin,ver_precios,solo_lectura").order("nombre")); },

    async listarPartes() {
      const r = await leerTodo(() => sb.from(tablaPartes()).select("*").is("borrado_at", null));
      return r.sort(porFecha("updated_at", true));
    },
    async usoIA(desde) {
      const r = await leerTodo(() => sb.from("lecturas_ia").select("created_at,proveedor,modelo,tokens_in,tokens_out,coste_usd").gte("created_at", desde));
      return r.sort(porFecha("created_at", true));
    },
    async usoAlmacenamiento() { const { data, error } = await sb.rpc("uso_almacenamiento"); if (error) throw error; return data; },
    async exportarTodo() {
      const [partes, eventos] = await Promise.all([
        leerTodo(() => sb.from("partes").select("*")),
        leerTodo(() => sb.from("eventos").select("*")),
      ]);
      return { partes: partes.sort(porFecha("created_at")), eventos: eventos.sort(porFecha("created_at")) };
    },
    async listarPapelera() {
      const r = await leerTodo(() => sb.from("partes").select("id,aseguradora,expediente,nombre,poblacion,estado,borrado_at").not("borrado_at", "is", null));
      return r.sort(porFecha("borrado_at", true));
    },
    async aPapelera(id) { ok(await sb.from("partes").update({ borrado_at: new Date().toISOString() }).eq("id", id)); },
    async restaurarParte(id) { ok(await sb.from("partes").update({ borrado_at: null }).eq("id", id)); },
    async editarEvento(id, cambios) { ok(await sb.from("eventos").update(cambios).eq("id", id)); },
    async _sinUso() {
    },
    async obtenerParte(id) {
      const [p, ev, fo] = await Promise.all([
        sb.from(tablaPartes()).select("*").eq("id", id).single(),
        leerTodo(() => sb.from(tablaEventos()).select("*").eq("parte_id", id)),
        leerTodo(() => sb.from("fotos").select("*").eq("parte_id", id)),
      ]);
      return { ...ok(p), eventos: ev.sort(porFecha("created_at")), fotos: fo.sort(porFecha("created_at")) };
    },
    async buscarDuplicado(aseguradora, expediente) {
      if (!expediente) return null;
      const r = ok(await sb.from("partes").select("*").ilike("aseguradora", aseguradora).eq("expediente", expediente).order("created_at", { ascending: false }).limit(1));
      return r[0] ?? null;
    },
    async crearParte(p) { return ok(await sb.from("partes").insert(p).select().single()); },
    async actualizarParte(id, cambios) { return ok(await sb.from("partes").update(cambios).eq("id", id).select().single()); },
    // Los mismos cambios en varios partes con una sola actualización: o se aplica a todos o a ninguno
    async actualizarVarios(ids, cambios) {
      if (!ids.length) return;
      const r = ok(await sb.from("partes").update(cambios).in("id", ids).select("id"));
      if (r.length !== ids.length) throw new Error(`Solo se han actualizado ${r.length} de ${ids.length} partes. Recarga y revísalo.`);
    },
    async borrarParte(id) {
      // Primero se apuntan todos los archivos (en bloques) y después se borran: borrar mientras se lista descuadraría los bloques.
      // Si algún archivo no se puede listar o borrar, se para sin borrar el parte (se puede reintentar sin dejar archivos sueltos).
      const fallo = "No se han podido borrar todos los archivos del parte. El parte no se ha borrado: inténtalo de nuevo.";
      const rutas = [];
      for (let offset = 0; ; offset += TAM_BLOQUE) {
        const { data: files, error } = await sb.storage.from(BUCKET).list(id, { limit: TAM_BLOQUE, offset });
        if (error) throw new Error(fallo);
        if (files.some((f) => f.id == null)) throw new Error(fallo + " (hay subcarpetas)");
        rutas.push(...files.map((f) => `${id}/${f.name}`));
        if (files.length < TAM_BLOQUE) break;
      }
      for (let i = 0; i < rutas.length; i += TAM_BLOQUE) {
        const trozo = rutas.slice(i, i + TAM_BLOQUE);
        // remove() no da error si no hay permiso: devuelve solo los que ha borrado
        const { data, error } = await sb.storage.from(BUCKET).remove(trozo);
        if (error || (data || []).length !== trozo.length) throw new Error(fallo);
      }
      const r = ok(await sb.from("partes").delete().eq("id", id).select("id"));
      if (!r.length) throw new Error("No se ha podido borrar el parte (¿tienes permiso?)");
    },
    async anadirEvento(parte_id, estado, nota, created_at) {
      return ok(await sb.from("eventos").insert({ parte_id, estado, nota, ...(created_at ? { created_at } : {}) }).select().single());
    },
    async borrarEvento(id) { ok(await sb.from("eventos").delete().eq("id", id)); },

    async subirArchivo(path, blob, contentType) {
      // El lector no puede sobrescribir (tampoco lo necesita: sus fotos y bocetos tienen nombre único)
      ok(await sb.storage.from(BUCKET).upload(path, blob, { contentType, upsert: !lector }));
      return path;
    },
    async urlArchivo(path, segundos = 3600) {
      const d = ok(await sb.storage.from(BUCKET).createSignedUrl(path, segundos));
      return d.signedUrl;
    },
    async descargarArchivo(path) { return ok(await sb.storage.from(BUCKET).download(path)); },
    async anadirFoto(parte_id, path, tipo) { return ok(await sb.from("fotos").insert({ parte_id, path, tipo }).select().single()); },
    async borrarFoto(foto) {
      // Primero el registro y después el archivo: si falla el archivo queda un archivo sin usar, nunca una foto rota en la ficha
      const r = ok(await sb.from("fotos").delete().eq("id", foto.id).select("id"));
      if (!r.length) throw new Error("No se ha podido borrar la foto (¿tienes permiso?)");
      const { error } = await sb.storage.from(BUCKET).remove([foto.path]);
      if (error) console.warn("Archivo de la foto sin borrar", foto.path, error.message);
    },

    async listarTarifa() {
      // Se lee por código y se ordena por "orden" (los que no tienen, al final); en los empates queda el orden por código
      const r = await leerTodo(() => sb.from("tarifa").select("*"), "codigo");
      const orden = (x) => x.orden ?? Number.MAX_SAFE_INTEGER;
      return r.sort((a, b) => orden(a) - orden(b));
    },
    async guardarCodigo(c) { ok(await sb.from("tarifa").upsert({ ...c, updated_at: new Date().toISOString() })); },
    async borrarCodigo(codigo) { ok(await sb.from("tarifa").delete().eq("codigo", codigo)); },
    async leerAjustes() {
      const { data, error } = await sb.from("ajustes").select("datos").eq("id", 1).maybeSingle();
      if (error) return {};
      return data?.datos ?? {};
    },
    async guardarAjustes(datos) {
      ok(await sb.from("ajustes").upsert({ id: 1, datos, updated_at: new Date().toISOString() }));
    },
    async adminUsuarios(accion, datos = {}) {
      const { data, error } = await sb.functions.invoke("admin-usuarios", { body: { accion, ...datos } });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); msg = j.error || msg; } catch { /* nada */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    async editarMiembro(user_id, cambios) {
      ok(await sb.from("miembros").update(cambios).eq("user_id", user_id));
    },

    async extraer(base64, mime) {
      const { data, error } = await sb.functions.invoke("extraer-parte", { body: { data: base64, mime } });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); msg = j.error || msg; } catch { /* nada */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data.datos;
    },
  };
}

// ---------------------------------------------------------------- Demo
function crearApiDemo() {
  const KEY = "partes_demo_v1";
  const archivos = new Map(); // path -> dataURL (solo en memoria + intento localStorage)
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) } catch { db = null; }
  if (!db) db = { partes: [], eventos: [], fotos: [], seq: 1, archivos: {} };
  for (const [k, v] of Object.entries(db.archivos || {})) archivos.set(k, v);
  const guardar = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...db, archivos: Object.fromEntries(archivos) })); }
    catch { try { localStorage.setItem(KEY, JSON.stringify({ ...db, archivos: {} })); } catch { /* sin almacenamiento */ } }
  };
  const ahora = () => new Date().toISOString();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const YO = { user_id: "demo", nombre: "Usuario demo", email: "demo@demo", es_admin: true };
  const blobADataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

  return {
    modo: "demo",
    async sesion() { return { user: YO }; },
    onAuth() {},
    async entrar() {}, async salir() {}, async recuperar() {}, async cambiarPassword() {},
    async yo() { return YO; },
    async miembros() { return [YO, { user_id: "demo2", nombre: "Técnico 2" }]; },
    async listarPartes() { return db.partes.filter((p) => !p.borrado_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); },
    async listarPapelera() { return db.partes.filter((p) => p.borrado_at); },
    async exportarTodo() { return { partes: db.partes, eventos: db.eventos }; },
    async usoAlmacenamiento() { return { archivos_bytes: 312e6, archivos_n: 1040, bd_bytes: 24e6 }; },
    async usoIA() { return (db.usoIA ??= [
      { created_at: new Date().toISOString(), proveedor: "anthropic", modelo: "claude-sonnet-4-5", tokens_in: 4100, tokens_out: 380, coste_usd: 0.0180 },
      { created_at: new Date(Date.now() - 864e5).toISOString(), proveedor: "anthropic", modelo: "claude-sonnet-4-5", tokens_in: 6900, tokens_out: 420, coste_usd: 0.0270 },
      { created_at: new Date(Date.now() - 2 * 864e5).toISOString(), proveedor: "gemini", modelo: "gemini-flash-latest", tokens_in: 3000, tokens_out: 350, coste_usd: 0 },
      { created_at: new Date(Date.now() - 40 * 864e5).toISOString(), proveedor: "anthropic", modelo: "claude-sonnet-4-5", tokens_in: 4000, tokens_out: 400, coste_usd: 0.0180 },
      { created_at: new Date().toISOString(), proveedor: "anthropic", modelo: "claude-sonnet-5", tokens_in: 4000, tokens_out: 400, coste_usd: null }]); },
    async aPapelera(id) { const p = db.partes.find((x) => x.id === id); p.borrado_at = ahora(); guardar(); },
    async restaurarParte(id) { const p = db.partes.find((x) => x.id === id); p.borrado_at = null; guardar(); },
    async editarEvento(id, c) { const e = db.eventos.find((x) => x.id === id); Object.assign(e, c); guardar(); },
    async obtenerParte(id) {
      const p = db.partes.find((x) => x.id === id);
      if (!p) throw new Error("No encontrado");
      return { ...p, eventos: db.eventos.filter((e) => e.parte_id === id), fotos: db.fotos.filter((f) => f.parte_id === id) };
    },
    async buscarDuplicado(a, e) {
      return db.partes.find((p) => e && p.expediente === e && p.aseguradora.toLowerCase() === a.toLowerCase()) ?? null;
    },
    async crearParte(p) {
      const n = { id: uuid(), created_at: ahora(), updated_at: ahora(), estado: "recibido", creado_por: "demo", ...p };
      db.partes.push(n);
      db.eventos.push({ id: db.seq++, parte_id: n.id, estado: "recibido", nota: null, creado_por: "demo", created_at: ahora() });
      guardar(); return n;
    },
    async actualizarParte(id, c) {
      const p = db.partes.find((x) => x.id === id); Object.assign(p, c, { updated_at: ahora() }); guardar(); return p;
    },
    async actualizarVarios(ids, c) {
      const ps = db.partes.filter((x) => ids.includes(x.id));
      if (ps.length !== ids.length) throw new Error(`Solo se han encontrado ${ps.length} de ${ids.length} partes. Recarga y revísalo.`);
      ps.forEach((p) => Object.assign(p, c, { updated_at: ahora() })); guardar();
    },
    async borrarParte(id) {
      db.partes = db.partes.filter((p) => p.id !== id);
      db.eventos = db.eventos.filter((p) => p.parte_id !== id);
      db.fotos = db.fotos.filter((p) => p.parte_id !== id);
      guardar();
    },
    async anadirEvento(parte_id, estado, nota, created_at) {
      const e = { id: db.seq++, parte_id, estado, nota, creado_por: "demo", created_at: created_at || ahora() };
      db.eventos.push(e); guardar(); return e;
    },
    async borrarEvento(id) { db.eventos = db.eventos.filter((e) => e.id !== id); guardar(); },
    async subirArchivo(path, blob) { archivos.set(path, await blobADataURL(blob)); guardar(); return path; },
    async urlArchivo(path) { return archivos.get(path) ?? ""; },
    async descargarArchivo(path) { const u = archivos.get(path); return u ? (await fetch(u)).blob() : null; },
    async anadirFoto(parte_id, path, tipo) {
      const f = { id: db.seq++, parte_id, path, tipo, created_at: ahora() }; db.fotos.push(f); guardar(); return f;
    },
    async borrarFoto(foto) { db.fotos = db.fotos.filter((f) => f.id !== foto.id); archivos.delete(foto.path); guardar(); },
    async listarTarifa() { return db.tarifa ?? []; },
    async guardarCodigo(c) { db.tarifa ??= []; const i = db.tarifa.findIndex((x) => x.codigo === c.codigo); if (i >= 0) db.tarifa[i] = { ...db.tarifa[i], ...c }; else db.tarifa.push(c); guardar(); },
    async borrarCodigo(cod) { db.tarifa = (db.tarifa ?? []).filter((x) => x.codigo !== cod); guardar(); },
    async leerAjustes() { return db.ajustes ?? {}; },
    async guardarAjustes(d) { db.ajustes = d; guardar(); },
    async adminUsuarios(accion, d = {}) {
      db.usuarios ??= [{ id: "demo", email: "demo@demo", nombre: "Usuario demo", es_admin: true, miembro: true }];
      if (accion === "listar") return { usuarios: db.usuarios };
      if (accion === "crear") { db.usuarios.push({ id: uuid(), email: d.email, nombre: d.nombre, es_admin: !!d.es_admin, miembro: true }); guardar(); return { ok: true }; }
      if (accion === "borrar") { db.usuarios = db.usuarios.filter((u) => u.id !== d.id); guardar(); return { ok: true }; }
      return { ok: true };
    },
    async editarMiembro(id, c) { const u = (db.usuarios || []).find((x) => x.id === id); if (u) Object.assign(u, c); guardar(); },
    async extraer() {
      await new Promise((r) => setTimeout(r, 900));
      const ej = [
        { aseguradora: "Mapfre", nombre: "María López García", direccion: "C/ Mayor 12, 3º B", codigo_postal: "28013", poblacion: "Madrid", provincia: "Madrid", telefono: "612345678", averia: "Filtración de agua desde baño superior. Mancha en techo de cocina de 1 m². Reparar tubería y pintar techo.", tramitador_nombre: "Jorge Ruiz", tramitador_telefono: "699111222" },
        { aseguradora: "Santalucía", nombre: "Antonio Pérez Sanz", direccion: "Avda. de la Constitución 45, bajo", codigo_postal: "41001", poblacion: "Sevilla", provincia: "Sevilla", telefono: "655987654", averia: "Rotura de cristal de ventana del salón (120x90 cm) por golpe.", tramitador_nombre: "Lucía Martín", tramitador_telefono: "644333222" },
        { aseguradora: "Iris Global", nombre: "Carmen Díaz Ortega", direccion: "C/ Valencia 210, 1º 2ª", codigo_postal: "08011", poblacion: "Barcelona", provincia: "Barcelona", telefono: "633222111", averia: "Cortocircuito en cuadro eléctrico; sin luz en dormitorios.", tramitador_nombre: "Pablo Gil", tramitador_telefono: "688777666" },
      ][Math.floor(Math.random() * 3)];
      return { ...ej, expediente: String(Math.floor(10000000 + Math.random() * 89999999)), poliza: "POL-" + Math.floor(Math.random() * 999999), fecha_encargo: new Date().toISOString().slice(0, 10) };
    },
  };
}

export const api = CFG.SUPABASE_URL ? crearApiSupabase() : crearApiDemo();
