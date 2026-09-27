-- Usuarios que no ven precios (solo se ocultan en pantalla)
alter table public.miembros add column if not exists ver_precios boolean not null default true;
