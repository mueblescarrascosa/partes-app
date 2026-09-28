-- Partes de "Conexión": presupuesto particular para el cliente (no es encargo del seguro)
alter table public.partes add column if not exists tipo text not null default 'siniestro';
alter table public.partes drop constraint if exists partes_tipo_check;
alter table public.partes add constraint partes_tipo_check check (tipo in ('siniestro','conexion'));
