-- =====================================================================
--  Proteger las cuentas que usan otras apps del proyecto (Olivas) (22/10/2026)
--  datos_en_otras_apps(uid): cuántas filas se borrarían en cascada FUERA de esta app si se borrara
--  esa cuenta (tablas de public con clave ajena a auth.users ON DELETE CASCADE, salvo miembros).
--  Encuentra sola las tablas (las olv_* de hoy y las que se creen). Solo cuenta: no cambia nada.
--  Solo la puede ejecutar service_role (la Edge Function admin-usuarios), nunca un usuario.
--  Vuelta atrás: rollback_usuarios.sql
-- =====================================================================
begin;

create or replace function public.datos_en_otras_apps(uid uuid) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare t text; c text; n bigint; total bigint := 0;
begin
  for t, c in
    select k.conrelid::regclass::text, a.attname
    from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
    where k.contype = 'f' and k.confrelid = 'auth.users'::regclass and k.confdeltype = 'c'
      and k.connamespace = 'public'::regnamespace and k.conrelid <> 'public.miembros'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', t, c) into n using uid;
    total := total + n;
  end loop;
  return total;
end $$;
revoke execute on function public.datos_en_otras_apps(uuid) from public, anon, authenticated;
grant execute on function public.datos_en_otras_apps(uuid) to service_role;

commit;
