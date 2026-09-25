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
    async salir() { yo = null; await sb.auth.signOut(); },
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
      return yo;
    },
    async miembros() { return ok(await sb.from("miembros").select("user_id,nombre,telefono").order("nombre")); },

    async listarPartes() {
      return ok(await sb.from("partes").select("*").is("borrado_at", null).order("updated_at", { ascending: false }).limit(3000));
    },
    async listarPapelera() {
      return ok(await sb.from("partes").select("id,aseguradora,expediente,nombre,poblacion,estado,borrado_at").not("borrado_at", "is", null).order("borrado_at", { ascending: false }));
    },
    async aPapelera(id) { ok(await sb.from("partes").update({ borrado_at: new Date().toISOString() }).eq("id", id)); },
    async restaurarParte(id) { ok(await sb.from("partes").update({ borrado_at: null }).eq("id", id)); },
    async editarEvento(id, cambios) { ok(await sb.from("eventos").update(cambios).eq("id", id)); },
    async _sinUso() {
    },
    async obtenerParte(id) {
      const [p, ev, fo] = await Promise.all([
        sb.from("partes").select("*").eq("id", id).single(),
        sb.from("eventos").select("*").eq("parte_id", id).order("created_at"),
        sb.from("fotos").select("*").eq("parte_id", id).order("created_at"),
      ]);
      return { ...ok(p), eventos: ok(ev), fotos: ok(fo) };
    },
    async buscarDuplicado(aseguradora, expediente) {
      if (!expediente) return null;
      const r = ok(await sb.from("partes").select("id,nombre,estado,borrado_at").ilike("aseguradora", aseguradora).eq("expediente", expediente).limit(1));
      return r[0] ?? null;
    },
    async crearParte(p) { return ok(await sb.from("partes").insert(p).select().single()); },
    async actualizarParte(id, cambios) { return ok(await sb.from("partes").update(cambios).eq("id", id).select().single()); },
    async borrarParte(id) {
      const { data: files } = await sb.storage.from(BUCKET).list(id, { limit: 1000 });
      if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`));
      ok(await sb.from("partes").delete().eq("id", id));
    },
    async anadirEvento(parte_id, estado, nota) {
      return ok(await sb.from("eventos").insert({ parte_id, estado, nota }).select().single());
    },
    async borrarEvento(id) { ok(await sb.from("eventos").delete().eq("id", id)); },

    async subirArchivo(path, blob, contentType) {
      ok(await sb.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true }));
      return path;
    },
    async urlArchivo(path, segundos = 3600) {
      const d = ok(await sb.storage.from(BUCKET).createSignedUrl(path, segundos));
      return d.signedUrl;
    },
    async descargarArchivo(path) { return ok(await sb.storage.from(BUCKET).download(path)); },
    async anadirFoto(parte_id, path, tipo) { return ok(await sb.from("fotos").insert({ parte_id, path, tipo }).select().single()); },
    async borrarFoto(foto) {
      await sb.storage.from(BUCKET).remove([foto.path]);
      ok(await sb.from("fotos").delete().eq("id", foto.id));
    },

    async listarTarifa() {
      return ok(await sb.from("tarifa").select("*").order("orden", { ascending: true, nullsFirst: false }).order("codigo"));
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
    async borrarParte(id) {
      db.partes = db.partes.filter((p) => p.id !== id);
      db.eventos = db.eventos.filter((p) => p.parte_id !== id);
      db.fotos = db.fotos.filter((p) => p.parte_id !== id);
      guardar();
    },
    async anadirEvento(parte_id, estado, nota) {
      const e = { id: db.seq++, parte_id, estado, nota, creado_por: "demo", created_at: ahora() };
      db.eventos.push(e); guardar(); return e;
    },
    async borrarEvento(id) { db.eventos = db.eventos.filter((e) => e.id !== id); guardar(); },
    async subirArchivo(path, blob) { archivos.set(path, await blobADataURL(blob)); guardar(); return path; },
    async urlArchivo(path) { return archivos.get(path) ?? ""; },
    async descargarArchivo(path) { const u = archivos.get(path); return u ? (await fetch(u)).blob() : null; },
    async anadirFoto(parte_id, path, tipo) {
      const f = { id: db.seq++, parte_id, path, tipo, created_at: ahora() }; db.fotos.push(f); guardar(); return f;
    },
    async borrarFoto(foto) { archivos.delete(foto.path); db.fotos = db.fotos.filter((f) => f.id !== foto.id); guardar(); },
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
