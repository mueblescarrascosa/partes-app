alter table public.partes add column if not exists lineas_autorizadas jsonb not null default '[]';
