-- =====================================================================
--  Ajustes sin pisarse (22/10/2026)
--  fusionar_ajustes(cambios): añade o cambia solo las claves que recibe y deja el resto como está,
--  en una sola operación. La usan la copia de seguridad (sus fechas) y el formulario de Ajustes
--  (sus claves), para que ninguno borre lo que acaba de guardar el otro.
--  Se ejecuta con los permisos de quien la llama (security invoker): solo un administrador puede
--  cambiar ajustes (reglas ajustes_admin_ins y ajustes_admin_upd).
--  No quita claves: para "quitar" una, guárdala vacía (null o ""); la app ignora los valores vacíos.
--  Vuelta atrás: rollback_ajustes.sql
-- =====================================================================
begin;

create or replace function public.fusionar_ajustes(cambios jsonb) returns jsonb
language sql security invoker set search_path = public as $$
  insert into public.ajustes as a (id, datos, updated_at) values (1, cambios, now())
  on conflict (id) do update set datos = coalesce(a.datos, '{}'::jsonb) || excluded.datos, updated_at = now()
  returning datos;
$$;
revoke execute on function public.fusionar_ajustes(jsonb) from public, anon;
grant execute on function public.fusionar_ajustes(jsonb) to authenticated, service_role;

commit;
