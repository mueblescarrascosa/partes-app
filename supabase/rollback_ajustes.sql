-- =====================================================================
--  VUELTA ATRÁS de migracion_ajustes.sql: quita la función fusionar_ajustes.
--  No toca datos. La app 2.15.0 la necesita para guardar Ajustes y las fechas de copia:
--  si se quita, hay que volver antes a la 2.14.0.
-- =====================================================================
drop function if exists public.fusionar_ajustes(jsonb);
