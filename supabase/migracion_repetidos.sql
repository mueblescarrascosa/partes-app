-- Permite guardar partes repetidos con cambios (mismo expediente, distinto encargo/descripción)
drop index if exists public.partes_aseg_exp_uq;
create index if not exists partes_aseg_exp_idx on public.partes (lower(aseguradora), expediente);
alter table public.partes add column if not exists repetido_de uuid references public.partes(id) on delete set null;
alter table public.partes add column if not exists cambios_repetido text;
