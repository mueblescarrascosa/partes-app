-- =====================================================================
--  VUELTA ATRÁS de la Fase 2 (solo lectura). Deja reglas, vistas y funciones como estaban
--  el 22/10/2026 antes del cambio (después de la Fase 1). Quita la columna miembros.solo_lectura:
--  se pierde qué usuarios eran de solo lectura, pero ningún otro dato.
-- =====================================================================
begin;

-- ---------- Reglas anteriores ----------
drop policy if exists partes_leer      on public.partes;
drop policy if exists partes_crear     on public.partes;
drop policy if exists partes_modificar on public.partes;
create policy partes_leer on public.partes for select to authenticated
  using (public.es_miembro());
create policy partes_crear on public.partes for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy partes_modificar on public.partes for update to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists eventos_leer  on public.eventos;
drop policy if exists eventos_crear on public.eventos;
create policy eventos_leer on public.eventos for select to authenticated
  using (public.es_miembro());
create policy eventos_crear on public.eventos for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));

drop policy if exists fotos_crear     on public.fotos;
drop policy if exists fotos_modificar on public.fotos;
drop policy if exists fotos_borrar    on public.fotos;
create policy fotos_crear on public.fotos for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy fotos_modificar on public.fotos for update to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()))
  with check (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));
create policy fotos_borrar on public.fotos for delete to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));

drop policy if exists tarifa_leer on public.tarifa;
create policy tarifa_leer on public.tarifa for select to authenticated using (public.es_miembro());
drop policy if exists lecturas_ia_sel on public.lecturas_ia;
create policy lecturas_ia_sel on public.lecturas_ia for select to authenticated using (public.es_miembro());
drop policy if exists lecturas_ia_ins on public.lecturas_ia;
create policy lecturas_ia_ins on public.lecturas_ia for insert to authenticated with check (public.es_miembro());

drop policy if exists archivos_equipo_sel on storage.objects;
create policy archivos_equipo_sel on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and public.es_miembro());
drop policy if exists archivos_equipo_ins on storage.objects;
create policy archivos_equipo_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.es_miembro() and owner_id = (select auth.uid())::text);
drop policy if exists archivos_equipo_upd on storage.objects;
create policy archivos_equipo_upd on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and public.es_miembro());
drop policy if exists archivos_equipo_del on storage.objects;
create policy archivos_equipo_del on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (owner_id = (select auth.uid())::text or public.es_admin()));

-- ---------- Vistas y funciones nuevas ----------
drop view if exists public.partes_lector;
drop view if exists public.eventos_lector;
drop function if exists public.lector_ve_archivo(text);
drop function if exists public.lector_puede_subir(text);
drop function if exists public.lineas_sin_precio(jsonb);
drop function if exists public.tapar_importes(text);
drop function if exists public.puede_escribir();
drop function if exists public.es_lector();

alter table public.miembros drop column if exists solo_lectura;

commit;
-- Si ya se había desplegado la función extraer-parte nueva, volver a desplegar la anterior
-- (copia en C:\proyectos\copias-partes\2026-10-22-fase2\extraer-parte_v20.ts), que solo exige es_miembro.
