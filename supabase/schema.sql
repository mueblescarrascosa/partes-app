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

-- 2.7: códigos autorizados (lo que se factura)
alter table public.partes add column if not exists lineas_autorizadas jsonb not null default '[]';

-- 2.8: foto del parte firmado y datos del perjudicado
alter table public.fotos drop constraint if exists fotos_tipo_check;
alter table public.fotos add constraint fotos_tipo_check check (tipo in ('antes','despues','otra','boceto','firmado'));

alter table public.partes add column if not exists perjudicado_nombre text;
alter table public.partes add column if not exists perjudicado_telefono text;

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
  new.perjudicado_nombre := public.tipo_titulo(new.perjudicado_nombre);
  return new;
end $$;

-- 2.10: modalidad, avisos de cobertura y límite de importe
alter table public.partes add column if not exists modalidad text;
alter table public.partes add column if not exists aviso_cobertura text;
alter table public.partes add column if not exists limite_importe numeric(10,2);

-- Tarifa de códigos y líneas de valoración / trabajos realizados
-- (ya existían en la base de datos; se añaden aquí para que este archivo la reproduzca entera)
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

-- =====================================================================
--  Fase 1 · Permisos (21/10/2026)
--  · Leer: cualquier miembro. Crear: cualquier miembro, y el autor tiene que ser quien guarda.
--  · Partes: modificar cualquier miembro (la papelera es una modificación); borrar para siempre, solo admin.
--  · Historial (eventos): modificar y borrar, solo admin.
--  · Fotos y archivos: borrar (y modificar fotos), el autor o un admin.
--    Sobrescribir archivos sigue abierto a los miembros (firma.png y los PDF tienen nombre fijo).
--  · Funciones: sin acceso para quien no ha iniciado sesión; search_path fijo.
--  Vuelta atrás: rollback_fase1.sql
-- =====================================================================

-- ---------- Partes ----------
drop policy if exists partes_equipo     on public.partes;
drop policy if exists partes_leer       on public.partes;
drop policy if exists partes_crear      on public.partes;
drop policy if exists partes_modificar  on public.partes;
drop policy if exists partes_borrar     on public.partes;
create policy partes_leer on public.partes for select to authenticated
  using (public.es_miembro());
create policy partes_crear on public.partes for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy partes_modificar on public.partes for update to authenticated
  using (public.es_miembro()) with check (public.es_miembro());
create policy partes_borrar on public.partes for delete to authenticated
  using (public.es_admin());

-- ---------- Historial (eventos) ----------
drop policy if exists eventos_equipo     on public.eventos;
drop policy if exists eventos_leer       on public.eventos;
drop policy if exists eventos_crear      on public.eventos;
drop policy if exists eventos_modificar  on public.eventos;
drop policy if exists eventos_borrar     on public.eventos;
create policy eventos_leer on public.eventos for select to authenticated
  using (public.es_miembro());
create policy eventos_crear on public.eventos for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy eventos_modificar on public.eventos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy eventos_borrar on public.eventos for delete to authenticated
  using (public.es_admin());

-- ---------- Fotos ----------
drop policy if exists fotos_equipo     on public.fotos;
drop policy if exists fotos_leer       on public.fotos;
drop policy if exists fotos_crear      on public.fotos;
drop policy if exists fotos_modificar  on public.fotos;
drop policy if exists fotos_borrar     on public.fotos;
create policy fotos_leer on public.fotos for select to authenticated
  using (public.es_miembro());
create policy fotos_crear on public.fotos for insert to authenticated
  with check (public.es_miembro() and creado_por = (select auth.uid()));
create policy fotos_modificar on public.fotos for update to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()))
  with check (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));
create policy fotos_borrar on public.fotos for delete to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));

-- ---------- Archivos (bucket "archivos") ----------
-- Leer y sobrescribir: sin cambios. Subir: el dueño tiene que ser quien sube. Borrar: el dueño o un admin.
drop policy if exists archivos_equipo_ins on storage.objects;
create policy archivos_equipo_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.es_miembro() and owner_id = (select auth.uid())::text);
drop policy if exists archivos_equipo_del on storage.objects;
create policy archivos_equipo_del on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (owner_id = (select auth.uid())::text or public.es_admin()));

-- ---------- Funciones: nadie sin sesión ----------
revoke execute on function public.es_miembro()           from public, anon;
revoke execute on function public.es_admin()             from public, anon;
revoke execute on function public.uso_almacenamiento()   from public, anon;
revoke execute on function public.tg_parte_recibido()    from public, anon;
revoke execute on function public.tg_updated_at()        from public, anon;
revoke execute on function public.tg_partes_mayusculas() from public, anon;
revoke execute on function public.tipo_titulo(text)      from public, anon;
grant execute on function public.es_miembro()           to authenticated, service_role;
grant execute on function public.es_admin()             to authenticated, service_role;
grant execute on function public.uso_almacenamiento()   to authenticated, service_role;
grant execute on function public.tg_parte_recibido()    to authenticated, service_role;
grant execute on function public.tg_updated_at()        to authenticated, service_role;
grant execute on function public.tg_partes_mayusculas() to authenticated, service_role;
grant execute on function public.tipo_titulo(text)      to authenticated, service_role;

-- ---------- Funciones: search_path fijo ----------
alter function public.tg_updated_at()        set search_path = public;
alter function public.tg_partes_mayusculas() set search_path = public;
alter function public.tipo_titulo(text)      set search_path = public;


-- =====================================================================
--  Fase 2 · Usuarios de solo lectura y sin precios (22/10/2026)
--  · miembros.solo_lectura: el usuario ve los partes, pero solo puede añadir fotos (antes, después,
--    otra y bocetos) y notas sin cambio de fase; puede borrar sus propias fotos. Nada más.
--  · El lector no lee partes ni eventos directamente, sino las vistas partes_lector y
--    eventos_lector, sin importes, sin datos de facturación y con los importes del texto tapados.
--  · Archivos: el lector solo abre fotos, bocetos, firma, documento original y lo que él ha subido;
--    nunca los PDF de informe.
--  · tarifa: no la lee el lector. lecturas_ia (gasto de IA): solo administradores.
--  Un administrador nunca es lector, aunque tenga marcada la casilla.
--  Vuelta atrás: rollback_fase2.sql
-- =====================================================================

-- ---------- Marca de solo lectura ----------
alter table public.miembros add column if not exists solo_lectura boolean not null default false;

create or replace function public.es_lector() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros
                 where user_id = auth.uid() and solo_lectura and not es_admin);
$$;

create or replace function public.puede_escribir() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros
                 where user_id = auth.uid() and (es_admin or not solo_lectura));
$$;

-- ---------- Tapar importes ----------
-- "500€", "196,87 €", "135.00 €", "€ 40", "300 euros", "50 EUR" → "[importe]"
create or replace function public.tapar_importes(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(t, '(€\s*\d[\d.,]*|\d[\d.,]*\s*(€|euros?\M|eur\M))', '[importe]', 'gi');
$$;

-- Líneas de trabajo solo con código, descripción (importes tapados) y cantidad. Lista blanca:
-- cualquier otro campo (precio, dto, o un importe/total que añadiera la IA) no pasa.
create or replace function public.lineas_sin_precio(j jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', e->'codigo',
           'descripcion', to_jsonb(public.tapar_importes(e->>'descripcion')),
           'cantidad', e->'cantidad') order by n), '[]'::jsonb)
  from jsonb_array_elements(coalesce(j, '[]'::jsonb)) with ordinality as x(e, n)
  where jsonb_typeof(e) = 'object';
$$;

-- ¿Puede el lector abrir este archivo? Fotos/bocetos de la tabla fotos, documento original y firma
-- de partes que no están en la papelera. Nunca los PDF de informe (informe_path).
create or replace function public.lector_ve_archivo(ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.fotos f join public.partes p on p.id = f.parte_id
                 where f.path = ruta and p.borrado_at is null)
      or exists (select 1 from public.partes p
                 where p.borrado_at is null and (p.documento_path = ruta or p.firma_path = ruta));
$$;

-- ¿Puede el lector subir este archivo? Solo fotos y bocetos con los nombres que usa la app
-- ({parte}/foto_<hora>_<n>.jpg y {parte}/boceto_<hora>.jpg|png), en partes que no están en la papelera.
create or replace function public.lector_puede_subir(ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_lector()
     and ruta ~ '^[0-9a-f-]{36}/(foto_[0-9]+_[0-9]+\.jpg|boceto_[0-9]+\.(jpg|png))$'
     and exists (select 1 from public.partes p
                 where p.id::text = split_part(ruta, '/', 1) and p.borrado_at is null);
$$;

revoke execute on function public.es_lector()              from public, anon;
revoke execute on function public.puede_escribir()         from public, anon;
revoke execute on function public.tapar_importes(text)     from public, anon;
revoke execute on function public.lineas_sin_precio(jsonb) from public, anon;
revoke execute on function public.lector_ve_archivo(text)  from public, anon;
revoke execute on function public.lector_puede_subir(text) from public, anon;
grant execute on function public.es_lector()              to authenticated, service_role;
grant execute on function public.puede_escribir()         to authenticated, service_role;
grant execute on function public.tapar_importes(text)     to authenticated, service_role;
grant execute on function public.lineas_sin_precio(jsonb) to authenticated, service_role;
grant execute on function public.lector_ve_archivo(text)  to authenticated, service_role;
grant execute on function public.lector_puede_subir(text) to authenticated, service_role;

-- ---------- Vistas para el lector ----------
-- Se ejecutan con los permisos de su dueño (security_invoker = false) para poder leer la tabla
-- sin dar acceso a las columnas con importes; cada vista comprueba por sí misma que quien lee es del equipo.
-- Solo lectura: se quitan insert/update/delete para que no se pueda escribir a través de ellas.
create or replace view public.partes_lector with (security_invoker = false) as
select id, created_at, updated_at, creado_por, asignado_a, aseguradora, expediente, poliza,
       fecha_encargo, nombre, direccion, codigo_postal, poblacion, provincia, telefono, telefono2,
       public.tapar_importes(averia) as averia,
       tramitador_nombre, tramitador_telefono, tramitador_email, estado, fecha_cita,
       documento_path, firma_path, num_encargo, num_siniestro,
       public.lineas_sin_precio(lineas_valoracion)  as lineas_valoracion,
       public.lineas_sin_precio(lineas_realizadas)  as lineas_realizadas,
       public.lineas_sin_precio(lineas_autorizadas) as lineas_autorizadas,
       borrado_at, repetido_de,
       public.tapar_importes(cambios_repetido) as cambios_repetido,
       realizado_at, tipo, perjudicado_nombre, perjudicado_telefono, modalidad,
       public.tapar_importes(aviso_cobertura) as aviso_cobertura
from public.partes
where borrado_at is null and public.es_miembro();

create or replace view public.eventos_lector with (security_invoker = false) as
select e.id, e.parte_id, e.estado, public.tapar_importes(e.nota) as nota, e.creado_por, e.created_at
from public.eventos e
where public.es_miembro();

revoke all on public.partes_lector  from public, anon, authenticated;
revoke all on public.eventos_lector from public, anon, authenticated;
grant select on public.partes_lector  to authenticated;
grant select on public.eventos_lector to authenticated;

-- ---------- Partes ----------
drop policy if exists partes_leer      on public.partes;
drop policy if exists partes_crear     on public.partes;
drop policy if exists partes_modificar on public.partes;
create policy partes_leer on public.partes for select to authenticated
  using (public.es_miembro() and not public.es_lector());
create policy partes_crear on public.partes for insert to authenticated
  with check (public.puede_escribir() and creado_por = (select auth.uid()));
create policy partes_modificar on public.partes for update to authenticated
  using (public.puede_escribir()) with check (public.puede_escribir());
-- partes_borrar (solo admin): sin cambios

-- ---------- Historial (eventos) ----------
drop policy if exists eventos_leer  on public.eventos;
drop policy if exists eventos_crear on public.eventos;
-- El lector lee de eventos_lector; en la tabla solo ve sus propias notas (las escribió él).
create policy eventos_leer on public.eventos for select to authenticated
  using (public.es_miembro() and (not public.es_lector() or creado_por = (select auth.uid())));
-- El lector solo añade notas, sin cambio de fase (estado vacío).
create policy eventos_crear on public.eventos for insert to authenticated
  with check (creado_por = (select auth.uid())
              and (public.puede_escribir() or (public.es_lector() and estado is null)));
-- eventos_modificar y eventos_borrar (solo admin): sin cambios

-- ---------- Fotos ----------
-- fotos_leer (miembros): sin cambios; no tiene importes
drop policy if exists fotos_crear     on public.fotos;
drop policy if exists fotos_modificar on public.fotos;
drop policy if exists fotos_borrar    on public.fotos;
-- El lector solo añade fotos antes/después/otra y bocetos (no el parte firmado, que sustituye al anterior).
create policy fotos_crear on public.fotos for insert to authenticated
  with check (creado_por = (select auth.uid())
              and (public.puede_escribir()
                   or (tipo in ('antes', 'despues', 'otra', 'boceto') and public.lector_puede_subir(path))));
create policy fotos_modificar on public.fotos for update to authenticated
  using (public.puede_escribir() and (creado_por = (select auth.uid()) or public.es_admin()))
  with check (public.puede_escribir() and (creado_por = (select auth.uid()) or public.es_admin()));
-- Borrar: el autor (también el lector, sus propias fotos) o un admin.
create policy fotos_borrar on public.fotos for delete to authenticated
  using (public.es_miembro() and (creado_por = (select auth.uid()) or public.es_admin()));

-- ---------- Tarifa y gasto de IA ----------
drop policy if exists tarifa_leer on public.tarifa;
create policy tarifa_leer on public.tarifa for select to authenticated
  using (public.es_miembro() and not public.es_lector());
drop policy if exists lecturas_ia_sel on public.lecturas_ia;
create policy lecturas_ia_sel on public.lecturas_ia for select to authenticated
  using (public.es_admin());
drop policy if exists lecturas_ia_ins on public.lecturas_ia;
create policy lecturas_ia_ins on public.lecturas_ia for insert to authenticated
  with check (public.puede_escribir());

-- ---------- Archivos (bucket "archivos") ----------
drop policy if exists archivos_equipo_sel on storage.objects;
create policy archivos_equipo_sel on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (not public.es_lector() or owner_id = (select auth.uid())::text or public.lector_ve_archivo(name)));
drop policy if exists archivos_equipo_ins on storage.objects;
create policy archivos_equipo_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and owner_id = (select auth.uid())::text
              and (public.puede_escribir() or public.lector_puede_subir(name)));
drop policy if exists archivos_equipo_upd on storage.objects;
create policy archivos_equipo_upd on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and public.puede_escribir())
  with check (bucket_id = 'archivos' and public.puede_escribir());
drop policy if exists archivos_equipo_del on storage.objects;
-- Borrar: quien lo subió (también el lector, sus propias fotos) o un admin.
create policy archivos_equipo_del on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_miembro()
         and (owner_id = (select auth.uid())::text or public.es_admin()));


-- =====================================================================
--  Ajustes sin pisarse (22/10/2026)
--  fusionar_ajustes(cambios): añade o cambia solo las claves que recibe y deja el resto como está,
--  en una sola operación. La usan la copia de seguridad (sus fechas) y el formulario de Ajustes
--  (sus claves), para que ninguno borre lo que acaba de guardar el otro.
--  Se ejecuta con los permisos de quien la llama (security invoker): solo un administrador puede
--  cambiar ajustes (reglas ajustes_admin_ins y ajustes_admin_upd).
--  No quita claves: para "quitar" una, guárdala vacía (null o ""); la app ignora los valores vacíos.
--  Vuelta atrás: rollback_ajustes.sql
-- =====================================================================

create or replace function public.fusionar_ajustes(cambios jsonb) returns jsonb
language sql security invoker set search_path = public as $$
  insert into public.ajustes as a (id, datos, updated_at) values (1, cambios, now())
  on conflict (id) do update set datos = coalesce(a.datos, '{}'::jsonb) || excluded.datos, updated_at = now()
  returning datos;
$$;
revoke execute on function public.fusionar_ajustes(jsonb) from public, anon;
grant execute on function public.fusionar_ajustes(jsonb) to authenticated, service_role;


-- =====================================================================
--  Proteger las cuentas que usan otras apps del proyecto (Olivas) (22/10/2026)
--  datos_en_otras_apps(uid): cuántas filas se borrarían en cascada FUERA de esta app si se borrara
--  esa cuenta (tablas de public con clave ajena a auth.users ON DELETE CASCADE, salvo miembros).
--  Encuentra sola las tablas (las olv_* de hoy y las que se creen). Solo cuenta: no cambia nada.
--  Solo la puede ejecutar service_role (la Edge Function admin-usuarios), nunca un usuario.
--  Vuelta atrás: rollback_usuarios.sql
-- =====================================================================

create or replace function public.datos_en_otras_apps(uid uuid) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare t text; c text; n bigint; total bigint := 0;
begin
  for t, c in
    select k.conrelid::regclass::text, a.attname
    from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
    where k.contype = 'f' and k.confrelid = 'auth.users'::regclass and k.confdeltype = 'c'
      and k.connamespace = 'public'::regnamespace and k.conrelid <> 'public.miembros'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', t, c) into n using uid;
    total := total + n;
  end loop;
  return total;
end $$;
revoke execute on function public.datos_en_otras_apps(uuid) from public, anon, authenticated;
grant execute on function public.datos_en_otras_apps(uuid) to service_role;


-- =====================================================================
--  Saber si la relación de una factura se envió (22/10/2026, versión 2.17.0)
--  partes.factura_enviada: true = se envió con "Enviar relación y marcar facturado" (fecha: facturado_at);
--  false = solo se marcó como facturado; null = no consta (facturas anteriores) o sin facturar.
--  La app avisa al cambiar algo de un parte facturado, más fuerte si la relación ya se envió.
--  No va en la vista partes_lector (el lector no ve la facturación).
--  Vuelta atrás: rollback_factura_enviada.sql
-- =====================================================================
alter table public.partes add column if not exists factura_enviada boolean;
comment on column public.partes.factura_enviada is
  'true = la relación se envió (fecha: facturado_at); false = solo se marcó como facturado; null = no consta (facturas anteriores a la 2.17.0) o sin facturar';
