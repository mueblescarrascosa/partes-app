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
