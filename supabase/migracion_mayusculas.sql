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
