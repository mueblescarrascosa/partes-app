-- =====================================================================
--  VUELTA ATRÁS de la Fase 1 (permisos). Deja las reglas de seguridad y los
--  permisos de las funciones exactamente como estaban el 21/10/2026 antes del cambio.
--  Solo toca reglas y permisos: no modifica ni borra datos.
-- =====================================================================
begin;

-- ---------- Reglas nuevas de la Fase 1 (se quitan) ----------
drop policy if exists partes_leer       on public.partes;
drop policy if exists partes_crear      on public.partes;
drop policy if exists partes_modificar  on public.partes;
drop policy if exists partes_borrar     on public.partes;
drop policy if exists eventos_leer      on public.eventos;
drop policy if exists eventos_crear     on public.eventos;
drop policy if exists eventos_modificar on public.eventos;
drop policy if exists eventos_borrar    on public.eventos;
drop policy if exists fotos_leer        on public.fotos;
drop policy if exists fotos_crear       on public.fotos;
drop policy if exists fotos_modificar   on public.fotos;
drop policy if exists fotos_borrar      on public.fotos;

-- ---------- Reglas anteriores (se restauran) ----------
drop policy if exists partes_equipo on public.partes;
create policy partes_equipo on public.partes for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists eventos_equipo on public.eventos;
create policy eventos_equipo on public.eventos for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists fotos_equipo on public.fotos;
create policy fotos_equipo on public.fotos for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists archivos_equipo_sel on storage.objects;
create policy archivos_equipo_sel on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and public.es_miembro());
drop policy if exists archivos_equipo_ins on storage.objects;
create policy archivos_equipo_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.es_miembro());
drop policy if exists archivos_equipo_upd on storage.objects;
create policy archivos_equipo_upd on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and public.es_miembro());
drop policy if exists archivos_equipo_del on storage.objects;
create policy archivos_equipo_del on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_miembro());

-- ---------- Permisos de funciones anteriores (todos podían ejecutarlas) ----------
grant execute on function public.es_miembro()          to public, anon, authenticated, service_role;
grant execute on function public.es_admin()            to public, anon, authenticated, service_role;
grant execute on function public.uso_almacenamiento()  to public, anon, authenticated, service_role;
grant execute on function public.tg_parte_recibido()   to public, anon, authenticated, service_role;
grant execute on function public.tg_updated_at()       to public, anon, authenticated, service_role;
grant execute on function public.tg_partes_mayusculas() to public, anon, authenticated, service_role;
grant execute on function public.tipo_titulo(text)     to public, anon, authenticated, service_role;

-- ---------- search_path anterior (sin fijar) ----------
alter function public.tg_updated_at()        reset search_path;
alter function public.tg_partes_mayusculas() reset search_path;
alter function public.tipo_titulo(text)      reset search_path;

commit;
