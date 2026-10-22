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
