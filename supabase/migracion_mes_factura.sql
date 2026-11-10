-- =====================================================================
--  Mes de factura de un parte (10/11/2026, versión 2.20.0)
--  partes.mes_factura: 'AAAA-MM' = el mes en que se factura, elegido a mano o desde la nota mensual
--  de la app de facturas. Vacío = el mes en que se terminó (realizado_at), que no se toca nunca.
--  No va en la vista partes_lector (el lector no ve la facturación).
--  Vuelta atrás: rollback_mes_factura.sql
-- =====================================================================
alter table public.partes add column if not exists mes_factura text
  check (mes_factura is null or mes_factura ~ '^\d{4}-(0[1-9]|1[0-2])$');
comment on column public.partes.mes_factura is
  'AAAA-MM: mes en que se factura. Vacío: el mes de realizado_at.';
