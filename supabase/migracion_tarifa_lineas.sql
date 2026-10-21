-- Tarifa de códigos y líneas de valoración / trabajos realizados
-- (la base de datos de producción ya lo tiene; este archivo solo documenta el cambio)
alter table public.partes add column if not exists lineas_valoracion jsonb not null default '[]';
alter table public.partes add column if not exists lineas_realizadas jsonb not null default '[]';

create table if not exists public.tarifa (
  codigo      text primary key,
  descripcion text not null,
  precio      numeric(10,2) not null default 0,
  categoria   text,
  orden       integer,
  activo      boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.tarifa enable row level security;
drop policy if exists tarifa_leer on public.tarifa;
create policy tarifa_leer on public.tarifa for select to authenticated using (public.es_miembro());
drop policy if exists tarifa_admin on public.tarifa;
create policy tarifa_admin on public.tarifa for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
