-- Registro de cada lectura con IA (para ver el gasto en Ajustes)
create table if not exists public.lecturas_ia (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  proveedor  text,
  modelo     text,
  tokens_in  integer,
  tokens_out integer,
  coste_usd  numeric(10,6)
);
create index if not exists lecturas_ia_fecha_idx on public.lecturas_ia (created_at desc);
alter table public.lecturas_ia enable row level security;
drop policy if exists lecturas_ia_ins on public.lecturas_ia;
create policy lecturas_ia_ins on public.lecturas_ia for insert to authenticated with check (public.es_miembro());
drop policy if exists lecturas_ia_sel on public.lecturas_ia;
create policy lecturas_ia_sel on public.lecturas_ia for select to authenticated using (public.es_miembro());
