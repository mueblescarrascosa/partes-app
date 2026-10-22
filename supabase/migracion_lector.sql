-- =====================================================================
--  Fase 2 · Usuarios de solo lectura y sin precios (22/10/2026)
--  · miembros.solo_lectura: el usuario ve los partes, pero solo puede añadir fotos (antes, después,
--    otra y bocetos) y notas sin cambio de fase; puede borrar sus propias fotos. Nada más.
--  · El lector no lee partes ni eventos directamente, sino las vistas partes_lector y
--    eventos_lector, sin importes, sin datos de facturación y con los importes del texto tapados.
--  · Archivos: el lector solo abre fotos, bocetos, firma, documento original y lo que él ha subido;
--    nunca los PDF de informe.
--  · tarifa: no la lee el lector. lecturas_ia (gasto de IA): solo administradores.
--  Un administrador nunca es lector, aunque tenga marcada la casilla.
--  Vuelta atrás: rollback_fase2.sql
-- =====================================================================
begin;

-- ---------- Marca de solo lectura ----------
alter table public.miembros add column if not exists solo_lectura boolean not null default false;

create or replace function public.es_lector() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros
                 where user_id = auth.uid() and solo_lectura and not es_admin);
$$;

create or replace function public.puede_escribir() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros
                 where user_id = auth.uid() and (es_admin or not solo_lectura));
$$;

-- ---------- Tapar importes ----------
-- "500€", "196,87 €", "135.00 €", "€ 40", "300 euros", "50 EUR" → "[importe]"
create or replace function public.tapar_importes(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(t, '(€\s*\d[\d.,]*|\d[\d.,]*\s*(€|euros?\M|eur\M))', '[importe]', 'gi');
$$;

-- Líneas de trabajo solo con código, descripción (importes tapados) y cantidad. Lista blanca:
-- cualquier otro campo (precio, dto, o un importe/total que añadiera la IA) no pasa.
create or replace function public.lineas_sin_precio(j jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', e->'codigo',
           'descripcion', to_jsonb(public.tapar_importes(e->>'descripcion')),
           'cantidad', e->'cantidad') order by n), '[]'::jsonb)
  from jsonb_array_elements(coalesce(j, '[]'::jsonb)) with ordinality as x(e, n)
  where jsonb_typeof(e) = 'object';
$$;

-- ¿Puede el lector abrir este archivo? Fotos/bocetos de la tabla fotos, documento original y firma
-- de partes que no están en la papelera. Nunca los PDF de informe (informe_path).
create or replace function public.lector_ve_archivo(ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.fotos f join public.partes p on p.id = f.parte_id
                 where f.path = ruta and p.borrado_at is null)
      or exists (select 1 from public.partes p
                 where p.borrado_at is null and (p.documento_path = ruta or p.firma_path = ruta));
$$;

-- ¿Puede el lector subir este archivo? Solo fotos y bocetos con los nombres que usa la app
-- ({parte}/foto_<hora>_<n>.jpg y {parte}/boceto_<hora>.jpg|png), en partes que no están en la papelera.
create or replace function public.lector_puede_subir(ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_lector()
     and ruta ~ '^[0-9a-f-]{36}/(foto_[0-9]+_[0-9]+\.jpg|boceto_[0-9]+\.(jpg|png))$'
     and exists (select 1 from public.partes p
                 where p.id::text = split_part(ruta, '/', 1) and p.borrado_at is null);
$$;

revoke execute on function public.es_lector()              from public, anon;
revoke execute on function public.puede_escribir()         from public, anon;
revoke execute on function public.tapar_importes(text)     from public, anon;
revoke execute on function public.lineas_sin_precio(jsonb) from public, anon;
revoke execute on function public.lector_ve_archivo(text)  from public, anon;
revoke execute on function public.lector_puede_subir(text) from public, anon;
grant execute on function public.es_lector()              to authenticated, service_role;
grant execute on function public.puede_escribir()         to authenticated, service_role;
grant execute on function public.tapar_importes(text)     to authenticated, service_role;
grant execute on function public.lineas_sin_precio(jsonb) to authenticated, service_role;
grant execute on function public.lector_ve_archivo(text)  to authenticated, service_role;
grant execute on function public.lector_puede_subir(text) to authenticated, service_role;

-- ---------- Vistas para el lector ----------
-- Se ejecutan con los permisos de su dueño (security_invoker = false) para poder leer la tabla
-- sin dar acceso a las columnas con importes; cada vista comprueba por sí misma que quien lee es del equipo.
-- Solo lectura: se quitan insert/update/delete para que no se pueda escribir a través de ellas.
create or replace view public.partes_lector with (security_invoker = false) as
select id, created_at, updated_at, creado_por, asignado_a, aseguradora, expediente, poliza,
       fecha_encargo, nombre, direccion, codigo_postal, poblacion, provincia, telefono, telefono2,
       public.tapar_importes(averia) as averia,
       tramitador_nombre, tramitador_telefono, tramitador_email, estado, fecha_cita,
       documento_path, firma_path, num_encargo, num_siniestro,
       public.lineas_sin_precio(lineas_valoracion)  as lineas_valoracion,
       public.lineas_sin_precio(lineas_realizadas)  as lineas_realizadas,
       public.lineas_sin_precio(lineas_autorizadas) as lineas_autorizadas,
       borrado_at, repetido_de,
       public.tapar_importes(cambios_repetido) as cambios_repetido,
       realizado_at, tipo, perjudicado_nombre, perjudicado_telefono, modalidad,
       public.tapar_importes(aviso_cobertura) as aviso_cobertura
from public.partes
where borrado_at is null and public.es_miembro();

create or replace view public.eventos_lector with (security_invoker = false) as
select e.id, e.parte_id, e.estado, public.tapar_importes(e.nota) as nota, e.creado_por, e.created_at
from public.eventos e
where public.es_miembro();

revoke all on public.partes_lector  from public, anon, authenticated;
revoke all on public.eventos_lector from public, anon, authenticated;
grant select on public.partes_lector  to authenticated;
grant select on public.eventos_lector to authenticated;

-- ---------- Partes ----------
drop policy if exists partes_leer      on public.partes;
drop policy if exists partes_crear     on public.partes;
drop policy if exists partes_modificar on public.partes;
create policy partes_leer on public.partes for select to authenticated
  using (public.es_miembro() and not public.es_lector());
create policy partes_crear on public.partes for insert to authenticated
  with check (public.puede_escribir() and creado_por = (select auth.uid()));
create policy partes_modificar on public.partes for update to authenticated
  using (public.puede_escribir()) with check (public.puede_escribir());
-- partes_borrar (solo admin): sin cambios

-- ---------- Historial (eventos) ----------
drop policy if exists eventos_leer  on public.eventos;
drop policy if exists eventos_crear on public.eventos;
-- El lector lee de eventos_lector; en la tabla solo ve sus propias notas (las escribió él).
create policy eventos_leer on public.eventos for select to authenticated
  using (public.es_miembro() and (not public.es_lector() or creado_por = (select auth.uid())));
-- El lector solo añade notas, sin cambio de fase (estado vacío).
create policy eventos_crear on public.eventos for insert to authenticated
  with check (creado_por = (select auth.uid())
              and (public.puede_escribir() or (public.es_lector() and estado is null)));
-- eventos_modificar y eventos_borrar (solo admin): sin cambios

-- ---------- Fotos ----------
-- fotos_leer (miembros): sin cambios; no tiene importes
drop policy if exists fotos_crear     on public.fotos;
drop policy if exists fotos_modificar on public.fotos;
drop policy if exists fotos_borrar    on public.fotos;
-- El lector solo añade fotos antes/después/otra y bocetos (no el parte firmado, que sustituye al anterior).
create policy fotos_crear on public.fotos for insert to authenticated
  with check (creado_por = (select auth.uid())
              and (public.puede_escribir()
                   or (tipo in ('antes', 'despues', 'otra', 'boceto') and public.lector_puede_subir(path))));
create policy fotos_modificar on public.fotos for update to authenticated
  using (public.puede_escribir() and (creado_por = (select auth.uid()) or public.es_admin()))
  with check (public.puede_escribir() and (creado_por = (select auth.uid()) or public.es_admin()));
-- Borrar: el autor (también el lector, sus propias fotos) o un admin.
create policy fotos_borrar on public.fotos for delete to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));

-- ---------- Tarifa y gasto de IA ----------
drop policy if exists tarifa_leer on public.tarifa;
create policy tarifa_leer on public.tarifa for select to authenticated
  using (public.es_miembro() and not public.es_lector());
drop policy if exists lecturas_ia_sel on public.lecturas_ia;
create policy lecturas_ia_sel on public.lecturas_ia for select to authenticated
  using (public.es_admin());
drop policy if exists lecturas_ia_ins on public.lecturas_ia;
create policy lecturas_ia_ins on public.lecturas_ia for insert to authenticated
  with check (public.puede_escribir());

-- ---------- Archivos (bucket "archivos") ----------
drop policy if exists archivos_equipo_sel on storage.objects;
create policy archivos_equipo_sel on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (not public.es_lector() or owner_id = (select auth.uid())::text or public.lector_ve_archivo(name)));
drop policy if exists archivos_equipo_ins on storage.objects;
create policy archivos_equipo_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and owner_id = (select auth.uid())::text
              and (public.puede_escribir() or public.lector_puede_subir(name)));
drop policy if exists archivos_equipo_upd on storage.objects;
create policy archivos_equipo_upd on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and public.puede_escribir())
  with check (bucket_id = 'archivos' and public.puede_escribir());
drop policy if exists archivos_equipo_del on storage.objects;
-- Borrar: quien lo subió (también el lector, sus propias fotos) o un admin.
create policy archivos_equipo_del on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (owner_id = (select auth.uid())::text or public.es_admin()));

commit;
