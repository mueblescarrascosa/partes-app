// Supabase Edge Function: admin-usuarios
// Gestión de usuarios del equipo. Solo la pueden usar los administradores (miembros.es_admin).
// Acciones: listar | crear | password | editar | quitar | borrar
//
// El proyecto de Supabase es compartido con otra app (Olivas) y las cuentas son comunes: borrar una cuenta
// borra en cascada sus datos de la otra app. Por eso:
//  - solo se listan y se tocan los usuarios del equipo de Partes (tabla miembros);
//  - "quitar" solo la saca del equipo de Partes (la cuenta y sus datos de otras apps quedan intactos);
//  - "borrar" (la cuenta entera) solo si no es admin ni tiene datos en otras apps (datos_en_otras_apps).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ error: "Método no permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return resp({ error: "No autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
    if (!service) return resp({ error: "Falta la clave de servicio en la función" }, 500);

    const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: esAdmin, error: e1 } = await comoUsuario.rpc("es_admin");
    if (e1 || !esAdmin) return resp({ error: "Solo un administrador puede gestionar usuarios" }, 403);
    const { data: { user: yo } } = await comoUsuario.auth.getUser(auth.slice(7));

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const b = await req.json();

    // El usuario sobre el que se actúa tiene que ser del equipo de Partes
    const miembro = async (id: unknown) => {
      if (typeof id !== "string" || !id) return null;
      const { data, error } = await admin.from("miembros").select("user_id,nombre,es_admin").eq("user_id", id).maybeSingle();
      if (error) throw error;
      return data;
    };
    const noEsDelEquipo = () => resp({ error: "Ese usuario no es del equipo de Partes (puede ser de otra app del proyecto): no se puede tocar desde aquí" }, 403);
    const datosEnOtrasApps = async (id: string) => {
      const { data, error } = await admin.rpc("datos_en_otras_apps", { uid: id });
      if (error) throw error;
      return Number(data) || 0;
    };

    switch (b.accion) {
      case "listar": {
        const { data: ms, error: em } = await admin.from("miembros").select("*");
        if (em) throw em;
        const todos = [];
        for (let page = 1; ; page++) {
          const { data: us, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) throw error;
          todos.push(...us.users);
          if (us.users.length < 1000) break;
        }
        const usuarios = [];
        for (const u of todos) {
          const m = ms?.find((x) => x.user_id === u.id);
          if (!m) continue;   // cuentas de otras apps: no se listan
          usuarios.push({
            id: u.id, email: u.email, creado: u.created_at, ultimo_acceso: u.last_sign_in_at,
            nombre: m.nombre ?? null, es_admin: !!m.es_admin, miembro: true, datos_otras_apps: await datosEnOtrasApps(u.id),
          });
        }
        usuarios.sort((a, b) => (a.nombre ?? "~").localeCompare(b.nombre ?? "~"));
        return resp({ usuarios });
      }

      case "crear": {
        const email = String(b.email ?? "").trim().toLowerCase();
        const nombre = String(b.nombre ?? "").trim();
        const password = String(b.password ?? "");
        if (!email || !nombre) return resp({ error: "Faltan el nombre o el email" }, 400);
        if (password.length < 8) return resp({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) {
          if (/already|registered|exists/i.test(error.message)) return resp({ error: "Ya existe una cuenta con ese email (puede ser de la app de Olivas, que comparte las cuentas)" }, 409);
          throw error;
        }
        const { error: e2 } = await admin.from("miembros").upsert({ user_id: data.user.id, nombre, es_admin: !!b.es_admin });
        if (e2) throw e2;
        return resp({ ok: true, id: data.user.id });
      }

      case "password": {
        if (!(await miembro(b.id))) return noEsDelEquipo();
        const password = String(b.password ?? "");
        if (password.length < 8) return resp({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        const { error } = await admin.auth.admin.updateUserById(b.id, { password });
        if (error) throw error;
        return resp({ ok: true });
      }

      case "editar": {
        if (!(await miembro(b.id))) return noEsDelEquipo();   // ya no añade al equipo cuentas ajenas
        const cambios: Record<string, unknown> = {};
        if (typeof b.nombre === "string" && b.nombre.trim()) cambios.nombre = b.nombre.trim();
        if (typeof b.es_admin === "boolean") {
          if (b.id === yo?.id && !b.es_admin) return resp({ error: "No puedes quitarte a ti mismo el permiso de administrador" }, 400);
          cambios.es_admin = b.es_admin;
        }
        const { error } = await admin.from("miembros").update(cambios).eq("user_id", b.id);
        if (error) throw error;
        return resp({ ok: true });
      }

      case "quitar": {   // sacar del equipo de Partes; la cuenta y sus datos de otras apps quedan intactos
        const m = await miembro(b.id);
        if (!m) return noEsDelEquipo();
        if (b.id === yo?.id) return resp({ error: "No puedes quitarte a ti mismo del equipo" }, 400);
        if (m.es_admin) return resp({ error: "Es administrador: quítale antes el permiso de administrador" }, 400);
        const { error } = await admin.from("miembros").delete().eq("user_id", b.id);
        if (error) throw error;
        return resp({ ok: true });
      }

      case "borrar": {   // borrar la cuenta entera: solo si no es admin ni tiene datos en otras apps
        const m = await miembro(b.id);
        if (!m) return noEsDelEquipo();
        if (b.id === yo?.id) return resp({ error: "No puedes borrarte a ti mismo" }, 400);
        const n = await datosEnOtrasApps(b.id);
        if (n > 0) return resp({ error: `Esta cuenta tiene ${n} datos en otra app del proyecto (Olivas) y se borrarían con ella: solo se puede quitar del equipo de Partes` }, 409);
        if (m.es_admin) return resp({ error: "Es administrador: quítale antes el permiso de administrador" }, 400);
        const { error } = await admin.auth.admin.deleteUser(b.id);
        if (error) throw error;
        return resp({ ok: true });
      }

      default:
        return resp({ error: "Acción no válida" }, 400);
    }
  } catch (e) {
    console.error(e);
    return resp({ error: String((e as Error).message ?? e) }, 500);
  }
});
