-- Facturación mensual a MULTIBETT y espacio usado
alter table public.partes add column if not exists realizado_at timestamptz;
alter table public.partes add column if not exists factura_ref text;
alter table public.partes add column if not exists facturado_at date;
alter table public.partes add column if not exists cobrado_at date;
create index if not exists partes_realizado_idx on public.partes (realizado_at);

-- Rellena la fecha de terminado de los partes que ya estaban realizados
update public.partes p set realizado_at = (
  select max(e.created_at) from public.eventos e where e.parte_id = p.id and e.estado = 'realizado')
where p.estado = 'realizado' and p.realizado_at is null;

-- Espacio usado (archivos y base de datos), solo para miembros del equipo
create or replace function public.uso_almacenamiento() returns json
language sql stable security definer set search_path = public, storage as $$
  select json_build_object(
    'archivos_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'archivos'), 0),
    'archivos_n', (select count(*) from storage.objects where bucket_id = 'archivos'),
    'bd_bytes', pg_database_size(current_database()))
  where public.es_miembro();
$$;
