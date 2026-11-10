-- VUELTA ATRÁS de migracion_mes_factura.sql. Antes, vuelve a versiones de partes (anterior a la 2.20.0) y de facturas que no pidan esta columna.
alter table public.partes drop column if exists mes_factura;
