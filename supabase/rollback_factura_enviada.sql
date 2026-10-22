-- VUELTA ATRÁS de migracion_factura_enviada.sql. Antes, vuelve a una versión de la app anterior a la 2.17.0.
alter table public.partes drop column if exists factura_enviada;
