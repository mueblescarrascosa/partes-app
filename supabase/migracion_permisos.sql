-- =====================================================================
--  Fase 1 · Permisos (21/10/2026)
--  · Leer: cualquier miembro. Crear: cualquier miembro, y el autor tiene que ser quien guarda.
--  · Partes: modificar cualquier miembro (la papelera es una modificación); borrar para siempre, solo admin.
--  · Historial (eventos): modificar y borrar, solo admin.
--  · Fotos y archivos: borrar (y modificar fotos), el autor o un admin.
--    Sobrescribir archivos sigue abierto a los miembros (firma.png y los PDF tienen nombre fijo).
--  · Funciones: sin acceso para quien no ha iniciado sesión; search_path fijo.
--  Vuelta atrás: rollback_fase1.sql
-- =====================================================================
begin;

-- ---------- Partes ----------
drop policy if exists partes_equipo     on public.partes;
drop policy if exists partes_leer       on public.partes;
drop policy if exists partes_crear      on public.partes;
drop policy if exists partes_modificar  on public.partes;
drop policy if exists partes_borrar     on public.partes;
create policy partes_leer on public.partes for select to authenticated
  using (public.es_miembro());
create policy partes_crear on public.partes for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy partes_modificar on public.partes for update to authenticated
  using (public.es_miembro()) with check (public.es_miembro());
create policy partes_borrar on public.partes for delete to authenticated
  using (public.es_admin());

-- ---------- Historial (eventos) ----------
drop policy if exists eventos_equipo     on public.eventos;
drop policy if exists eventos_leer       on public.eventos;
drop policy if exists eventos_crear      on public.eventos;
drop policy if exists eventos_modificar  on public.eventos;
drop policy if exists eventos_borrar     on public.eventos;
create policy eventos_leer on public.eventos for select to authenticated
  using (public.es_miembro());
create policy eventos_crear on public.eventos for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy eventos_modificar on public.eventos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy eventos_borrar on public.eventos for delete to authenticated
  using (public.es_admin());

-- ---------- Fotos ----------
drop policy if exists fotos_equipo     on public.fotos;
drop policy if exists fotos_leer       on public.fotos;
drop policy if exists fotos_crear      on public.fotos;
drop policy if exists fotos_modificar  on public.fotos;
drop policy if exists fotos_borrar     on public.fotos;
create policy fotos_leer on public.fotos for select to authenticated
  using (public.es_miembro());
create policy fotos_crear on public.fotos for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy fotos_modificar on public.fotos for update to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()))
  with check (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));
create policy fotos_borrar on public.fotos for delete to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));

-- ---------- Archivos (bucket "archivos") ----------
-- Leer y sobrescribir: sin cambios. Subir: el dueño tiene que ser quien sube. Borrar: el dueño o un admin.
drop policy if exists archivos_equipo_ins on storage.objects;
create policy archivos_equipo_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.es_miembro() and owner_id = (select auth.uid())::text);
drop policy if exists archivos_equipo_del on storage.objects;
create policy archivos_equipo_del on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (owner_id = (select auth.uid())::text or public.es_admin()));

-- ---------- Funciones: nadie sin sesión ----------
revoke execute on function public.es_miembro()           from public, anon;
revoke execute on function public.es_admin()             from public, anon;
revoke execute on function public.uso_almacenamiento()   from public, anon;
revoke execute on function public.tg_parte_recibido()    from public, anon;
revoke execute on function public.tg_updated_at()        from public, anon;
revoke execute on function public.tg_partes_mayusculas() from public, anon;
revoke execute on function public.tipo_titulo(text)      from public, anon;
grant execute on function public.es_miembro()           to authenticated, service_role;
grant execute on function public.es_admin()             to authenticated, service_role;
grant execute on function public.uso_almacenamiento()   to authenticated, service_role;
grant execute on function public.tg_parte_recibido()    to authenticated, service_role;
grant execute on function public.tg_updated_at()        to authenticated, service_role;
grant execute on function public.tg_partes_mayusculas() to authenticated, service_role;
grant execute on function public.tipo_titulo(text)      to authenticated, service_role;

-- ---------- Funciones: search_path fijo ----------
alter function public.tg_updated_at()        set search_path = public;
alter function public.tg_partes_mayusculas() set search_path = public;
alter function public.tipo_titulo(text)      set search_path = public;

commit;
