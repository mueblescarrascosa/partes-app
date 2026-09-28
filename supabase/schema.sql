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

-- (Antes era único; ahora se permiten partes repetidos con cambios, enlazados con repetido_de)
create index if not exists partes_aseg_exp_idx on public.partes (lower(aseguradora), expediente);
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

-- ---------- Papelera ----------
alter table public.partes add column if not exists borrado_at timestamptz;

-- ---------- Partes repetidos con cambios ----------
drop index if exists public.partes_aseg_exp_uq;
create index if not exists partes_aseg_exp_idx on public.partes (lower(aseguradora), expediente);
alter table public.partes add column if not exists repetido_de uuid references public.partes(id) on delete set null;
alter table public.partes add column if not exists cambios_repetido text;

-- ---------- Usuarios que no ven precios (solo se ocultan en pantalla) ----------
alter table public.miembros add column if not exists ver_precios boolean not null default true;

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

-- Partes de "Conexión": presupuesto particular para el cliente (no es encargo del seguro)
alter table public.partes add column if not exists tipo text not null default 'siniestro';
alter table public.partes drop constraint if exists partes_tipo_check;
alter table public.partes add constraint partes_tipo_check check (tipo in ('siniestro','conexion'));

-- Formato de los datos del parte:
--  · Nombre, dirección, población, provincia y tramitador: "Tipo Título" (Maria del Mar Vilchez, Calle de la Paz 3A)
--  · Expediente, encargo, siniestro, póliza, C.P. y descripción: MAYÚSCULAS
create or replace function public.tipo_titulo(t text) returns text language plpgsql immutable as $$
declare p text; res text := ''; i int := 0;
begin
  if t is null then return null; end if;
  foreach p in array regexp_split_to_array(btrim(regexp_replace(t, '\s+', ' ', 'g')), ' ') loop
    i := i + 1;
    if p ~ '[0-9]' then p := upper(p);
    elsif i > 1 and lower(p) in ('de','del','la','las','los','el','y','e') then p := lower(p);
    else p := initcap(p);
    end if;
    res := res || case when i > 1 then ' ' else '' end || p;
  end loop;
  return res;
end $$;

create or replace function public.tg_partes_mayusculas() returns trigger language plpgsql as $$
begin
  new.expediente        := upper(new.expediente);
  new.num_encargo       := upper(new.num_encargo);
  new.num_siniestro     := upper(new.num_siniestro);
  new.poliza            := upper(new.poliza);
  new.codigo_postal     := upper(new.codigo_postal);
  new.averia            := upper(new.averia);
  new.nombre            := public.tipo_titulo(new.nombre);
  new.direccion         := public.tipo_titulo(new.direccion);
  new.poblacion         := public.tipo_titulo(new.poblacion);
  new.provincia         := public.tipo_titulo(new.provincia);
  new.tramitador_nombre := public.tipo_titulo(new.tramitador_nombre);
  return new;
end $$;
drop trigger if exists partes_mayusculas on public.partes;
create trigger partes_mayusculas before insert or update on public.partes
  for each row execute function public.tg_partes_mayusculas();

-- Aplica el formato a los partes que ya existen (sin cambiar su fecha de "último movimiento")
alter table public.partes disable trigger partes_updated_at;
update public.partes set nombre = nombre;
alter table public.partes enable trigger partes_updated_at;

-- Bocetos (dibujos internos): nuevo tipo de foto 'boceto'
alter table public.fotos drop constraint if exists fotos_tipo_check;
alter table public.fotos add constraint fotos_tipo_check check (tipo in ('antes','despues','otra','boceto'));
