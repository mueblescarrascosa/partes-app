-- =====================================================================
--  PARTES APP · Esquema de base de datos para Supabase
--  Ejecutar entero en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Miembros del equipo ----------
-- Solo los usuarios que estén en esta tabla pueden ver y tocar datos.
create table if not exists public.miembros (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  telefono   text,
  es_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros where user_id = auth.uid());
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros where user_id = auth.uid() and es_admin);
$$;

-- ---------- Estados ----------
do $$ begin
  create type public.estado_parte as enum
    ('recibido','contactado','visitado','valorado','autorizado','realizado');
exception when duplicate_object then null; end $$;

-- ---------- Partes ----------
create table if not exists public.partes (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  creado_por          uuid default auth.uid() references auth.users(id) on delete set null,
  asignado_a          uuid references public.miembros(user_id) on delete set null,

  aseguradora         text not null,
  expediente          text,
  num_encargo         text,
  num_siniestro       text,
  poliza              text,
  fecha_encargo       date,

  nombre              text,
  direccion           text,
  codigo_postal       text,
  poblacion           text,
  provincia           text,
  telefono            text,
  telefono2           text,

  averia              text,

  tramitador_nombre   text,
  tramitador_telefono text,
  tramitador_email    text,

  estado              public.estado_parte not null default 'recibido',
  fecha_cita          timestamptz,
  importe_valorado    numeric(10,2),
  importe_autorizado  numeric(10,2),

  documento_path      text,   -- PDF/foto original del parte
  firma_path          text,   -- firma del cliente (PNG)
  informe_path        text,   -- último PDF generado
  datos_ia            jsonb   -- respuesta bruta de la IA (por si hay que revisar)
);

create unique index if not exists partes_aseg_exp_uq
  on public.partes (lower(aseguradora), expediente) where expediente is not null and expediente <> '';
create index if not exists partes_estado_idx on public.partes (estado);
create index if not exists partes_updated_idx on public.partes (updated_at desc);

create or replace function public.tg_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists partes_updated_at on public.partes;
create trigger partes_updated_at before update on public.partes
  for each row execute function public.tg_updated_at();

-- ---------- Historial (cambios de fase y notas) ----------
create table if not exists public.eventos (
  id         bigint generated always as identity primary key,
  parte_id   uuid not null references public.partes(id) on delete cascade,
  estado     public.estado_parte,          -- null = nota sin cambio de fase
  nota       text,
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists eventos_parte_idx on public.eventos (parte_id, created_at);

-- Al crear un parte se registra automáticamente la fase "recibido"
create or replace function public.tg_parte_recibido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.eventos (parte_id, estado, nota, creado_por)
  values (new.id, 'recibido', null, new.creado_por);
  return new;
end $$;

drop trigger if exists partes_recibido on public.partes;
create trigger partes_recibido after insert on public.partes
  for each row execute function public.tg_parte_recibido();

-- ---------- Fotos ----------
create table if not exists public.fotos (
  id         bigint generated always as identity primary key,
  parte_id   uuid not null references public.partes(id) on delete cascade,
  path       text not null,
  tipo       text not null default 'otra' check (tipo in ('antes','despues','otra')),
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fotos_parte_idx on public.fotos (parte_id);

alter table public.partes add column if not exists num_encargo text;
alter table public.partes add column if not exists num_siniestro text;

-- ---------- Seguridad (RLS) ----------
alter table public.miembros enable row level security;
alter table public.partes   enable row level security;
alter table public.eventos  enable row level security;
alter table public.fotos    enable row level security;

drop policy if exists miembros_leer on public.miembros;
create policy miembros_leer on public.miembros for select to authenticated using (public.es_miembro());
drop policy if exists miembros_admin on public.miembros;
create policy miembros_admin on public.miembros for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists partes_equipo on public.partes;
create policy partes_equipo on public.partes for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists eventos_equipo on public.eventos;
create policy eventos_equipo on public.eventos for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists fotos_equipo on public.fotos;
create policy fotos_equipo on public.fotos for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

-- ---------- Almacenamiento de archivos (privado) ----------
insert into storage.buckets (id, name, public)
values ('archivos', 'archivos', false)
on conflict (id) do nothing;

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

-- =====================================================================
--  DESPUÉS DE EJECUTAR ESTO:
--  1) Authentication > Users > "Add user" (o "Invite") para ti y cada técnico.
--  2) Da de alta cada usuario en el equipo (cambia email y nombre):
--
--  insert into public.miembros (user_id, nombre, es_admin)
--  select id, 'Alfonso', true from auth.users where email = 'tu@email.com';
--
--  insert into public.miembros (user_id, nombre)
--  select id, 'Nombre técnico' from auth.users where email = 'tecnico@email.com';
-- =====================================================================

-- ---------- Ajustes de la app (una sola fila, editable por administradores) ----------
create table if not exists public.ajustes (
  id         int primary key default 1 check (id = 1),
  datos      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.ajustes (id) values (1) on conflict (id) do nothing;
alter table public.ajustes enable row level security;
drop policy if exists ajustes_leer on public.ajustes;
create policy ajustes_leer on public.ajustes for select to authenticated using (public.es_miembro());
drop policy if exists ajustes_admin_ins on public.ajustes;
create policy ajustes_admin_ins on public.ajustes for insert to authenticated with check (public.es_admin());
drop policy if exists ajustes_admin_upd on public.ajustes;
create policy ajustes_admin_upd on public.ajustes for update to authenticated using (public.es_admin()) with check (public.es_admin());
