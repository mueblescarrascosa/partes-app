-- =====================================================================
--  VUELTA ATRÁS de migracion_usuarios.sql: quita la función datos_en_otras_apps. No toca datos.
--  La Edge Function admin-usuarios de la 2.16.0 la necesita para borrar cuentas: antes de quitarla,
--  vuelve a desplegar la anterior (copia en C:\proyectos\copias-partes\2026-10-22-usuarios\admin-usuarios_v1.ts,
--  igual que la del repositorio en la 2.15.0).
-- =====================================================================
drop function if exists public.datos_en_otras_apps(uuid);
