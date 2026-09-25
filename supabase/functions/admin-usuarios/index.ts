// Supabase Edge Function: admin-usuarios
// Gestión de usuarios del equipo. Solo la pueden usar los administradores (miembros.es_admin).
// Acciones: listar | crear | password | editar | borrar

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

    switch (b.accion) {
      case "listar": {
        const { data: us, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
        if (error) throw error;
        const { data: ms } = await admin.from("miembros").select("*");
        const usuarios = us.users.map((u) => {
          const m = ms?.find((x) => x.user_id === u.id);
          return {
            id: u.id, email: u.email, creado: u.created_at, ultimo_acceso: u.last_sign_in_at,
            nombre: m?.nombre ?? null, es_admin: !!m?.es_admin, miembro: !!m,
          };
        }).sort((a, b) => (a.nombre ?? "~").localeCompare(b.nombre ?? "~"));
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
          if (/already|registered|exists/i.test(error.message)) return resp({ error: "Ya existe un usuario con ese email" }, 409);
          throw error;
        }
        const { error: e2 } = await admin.from("miembros").upsert({ user_id: data.user.id, nombre, es_admin: !!b.es_admin });
        if (e2) throw e2;
        return resp({ ok: true, id: data.user.id });
      }

      case "password": {
        const password = String(b.password ?? "");
        if (password.length < 8) return resp({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
        const { error } = await admin.auth.admin.updateUserById(b.id, { password });
        if (error) throw error;
        return resp({ ok: true });
      }

      case "editar": {
        const cambios: Record<string, unknown> = {};
        if (typeof b.nombre === "string" && b.nombre.trim()) cambios.nombre = b.nombre.trim();
        if (typeof b.es_admin === "boolean") {
          if (b.id === yo?.id && !b.es_admin) return resp({ error: "No puedes quitarte a ti mismo el permiso de administrador" }, 400);
          cambios.es_admin = b.es_admin;
        }
        const { data: existe } = await admin.from("miembros").select("user_id").eq("user_id", b.id).maybeSingle();
        const { error } = existe
          ? await admin.from("miembros").update(cambios).eq("user_id", b.id)
          : await admin.from("miembros").insert({ user_id: b.id, nombre: cambios.nombre ?? "Sin nombre", es_admin: !!cambios.es_admin });
        if (error) throw error;
        return resp({ ok: true });
      }

      case "borrar": {
        if (b.id === yo?.id) return resp({ error: "No puedes borrarte a ti mismo" }, 400);
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
