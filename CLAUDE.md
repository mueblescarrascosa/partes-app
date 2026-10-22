# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

PWA en español para gestionar partes de siniestros de aseguradoras (Mapfre, Santalucía, Iris Global…) desde el móvil. Frontend estático en `docs/` (servido tal cual por GitHub Pages desde `main` / `docs`) y backend en Supabase (Postgres + RLS, Storage, Auth y dos Edge Functions). Todo el código, nombres, comentarios y textos de la interfaz están en español: mantenlo así.

## Desarrollo

- **No hay build, ni bundler, ni `package.json`, ni tests, ni linter.** Es JavaScript plano con módulos ES nativos; las librerías (supabase-js, jsPDF, xlsx) se cargan desde jsDelivr con versión fija (`docs/index.html`, `cargarXLSX()` en `app.js`).
- Para probar en local basta un servidor estático sobre `docs/`, p. ej. `php -S localhost:8080 -t docs` (en esta máquina hay PHP; no hay Node). Los módulos ES no funcionan abriendo el HTML con `file://`. Ojo: con `config.js` tal cual, la prueba local usa la base de datos de producción.
- **Modo demo**: si `SUPABASE_URL` está vacío en `docs/js/config.js`, `api.js` usa `crearApiDemo()` (datos en `localStorage`, lectura con IA simulada). Útil para probar la interfaz sin tocar la base de datos real; `config.js` apunta ahora al proyecto de producción.
- Las Edge Functions (Deno/TypeScript) se despliegan pegándolas en el editor del panel de Supabase (o con `supabase functions deploy <nombre>`). Secretos: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `IA_PROVEEDOR`, `ANTHROPIC_MODEL`, `GEMINI_MODEL` (ver README).

## Al publicar un cambio

- **Sube `CACHE` en `docs/sw.js`** (`"partes-vNN"`) cada vez que cambien archivos de `docs/`; si no, los móviles siguen con la versión vieja en caché. Si añades un archivo JS nuevo, añádelo también a `BASE` en `sw.js`.
- Sube `VERSION` y `FECHA_VERSION` en `docs/js/config.js` (se muestran en el pie de la app).
- `index.html` tiene un manejador que limpia la caché y recarga una vez si se mezclan módulos viejos y nuevos; no lo quites.

## Arquitectura

- `docs/js/config.js` → define `window.APP_CONFIG` (script clásico, no módulo). Muchos valores (empresa, aseguradoras, zonas, IVA, precios de IA, destino de informes…) se **sobrescriben en tiempo de ejecución** desde la tabla `ajustes` mediante `cargarAjustes()` en `app.js`; config.js es solo el valor por defecto. Si añades un ajuste editable, tócalo en ambos sitios.
- `docs/js/api.js` → capa de datos con **dos implementaciones de la misma interfaz**: `crearApiSupabase()` y `crearApiDemo()`. Cualquier método nuevo de `api` debe añadirse a las dos. Exporta `api` según haya o no `SUPABASE_URL`.
- Supabase corta cada consulta en 1.000 filas sin avisar. Toda consulta que devuelva una lista debe usar `leerTodo()` de `api.js` (lee en bloques de `TAM_BLOQUE` ordenando por la clave única y reordena después en JS); no uses `.limit()` grandes. `TAM_BLOQUE` debe ser 1000 en lo que se publique.
- `docs/js/app.js` (~3100 líneas) → toda la interfaz. Router por hash (`router()`: `#/`, `#/parte/<id>`, `#/editar/<id>`, `#/lineas/<id>/<tipo>`, `#/agenda`, `#/revision`, `#/lote`, `#/facturacion`, `#/tarifa`, `#/ajustes`, `#/papelera`, `#/compartido`). Cada vista es una función `vistaXxx()` que rellena `#app` con `innerHTML` (escapar siempre con `esc()`); los paneles inferiores son `sheetXxx()` vía `abrirSheet()`. Estado global en el objeto `S`; preferencias del usuario en `localStorage` con prefijo `pa_` (`sessionGet`/`sessionSet`).
- `docs/js/util.js` → utilidades compartidas, incluida la lista `ESTADOS` (fases: recibido → contactado → visitado → valorado → autorizado → realizado).
- `docs/js/pdf.js` y `docs/js/boceto.js` se importan de forma dinámica solo cuando se necesitan.
- `docs/sw.js` → caché "red primero" y además recibe archivos compartidos desde otras apps (POST a `/compartir`, Web Share Target del manifest) y los deja en la caché `partes-compartido` para la vista `#/compartido`.

### Conceptos de dominio que cruzan varios archivos

- `partes.tipo`: `'siniestro'` (encargo del seguro; se informa/factura a `DESTINO_INFORMES`, MULTIBETT, sin IVA) o `'conexion'` (presupuesto particular al cliente, con `IVA_FACTURA`). Ver `esConexion`, `ivaDe`, `destinoDe` en `app.js`.
- Líneas de trabajo en tres columnas jsonb: `lineas_valoracion`, `lineas_autorizadas`, `lineas_realizadas` (`CAMPO_LINEAS`).
- `fotos.tipo`: `antes`, `despues`, `otra`, `boceto`, `firmado`. Solo hay un `firmado` por parte: al sustituirlo, el anterior se borra **después** de guardar el nuevo (nunca antes); si quedan dos, vale el más reciente (`firmadoDe`).
- Usuarios con `miembros.ver_precios = false`: los importes solo se ocultan en pantalla (clase `sin-precios` en `body`), no por RLS.
- Usuarios de solo lectura (`miembros.solo_lectura`, nunca un admin; `esLector()` en `app.js`): esto sí lo bloquea Supabase. No pueden leer `partes`, `eventos` ni `tarifa`; `api.js` lee de las vistas `partes_lector` y `eventos_lector` (sin importes ni facturación, líneas solo con código/descripción/cantidad e importes del texto tapados con `tapar_importes`). Solo pueden añadir notas sin fase, fotos antes/después/otra y bocetos, y borrar los suyos; no abren los PDF de informe ni usan la IA. Si añades una columna a `partes` que deba ver el lector, añádela también a la vista; si tiene importes, no. En la app, todo lo que escribe se oculta con `esLector()` y las rutas de `RUTAS_ESCRITURA` vuelven a la lista. En el modo demo se simula desde el menú de usuario.
- Las notas automáticas del historial no llevan importes (las leen también usuarios sin precios).
- Borrado lógico con `partes.borrado_at` (papelera).
- La normalización de texto (Tipo Título / MAYÚSCULAS) está duplicada: en el cliente (`normalizar()`, `CAMPOS_MAYUS`, `CAMPOS_TITULO` en `app.js`) y en el trigger `tg_partes_mayusculas` de la BD. Mantén ambas coherentes.

### Supabase

- `supabase/schema.sql` es el **esquema completo y acumulativo** (idempotente: `if not exists`, `create or replace`) e incluye ya todas las migraciones; se cotejó con la base de datos real el 21/10/2026 (antes le faltaban `tarifa`, `lineas_valoracion` y `lineas_realizadas`). Los archivos `migracion_*.sql` son los mismos cambios sueltos para aplicar sobre una BD existente. Un cambio de esquema nuevo va **en los dos**: nuevo `migracion_<tema>.sql` y añadido al final de `schema.sql`. Si un cambio se hace a mano en el panel de Supabase, pásalo también a estos archivos.
- **El proyecto de Supabase es compartido con otra app (Olivas)**: tablas `olv_*`, bucket `olv-facturas` y Edge Functions `leer-factura`, `tecnico-olivar`, `olivas-datos`, `olivas-push`. Comparten los usuarios de Auth (la función `admin-usuarios` los ve y puede borrar todos). No toques nada de Olivas desde este repositorio.
- Seguridad por RLS con las funciones `es_miembro()`, `es_admin()`, `es_lector()` y `puede_escribir()`; todo el equipo ve todos los partes. Bucket privado `archivos`. Permisos (`migracion_permisos.sql`, `migracion_lector.sql`): borrar partes para siempre, y editar o borrar el historial, solo admin; borrar fotos y archivos, su autor o un admin; al crear, el autor tiene que ser quien guarda. La app muestra los botones según esas mismas reglas (`esAdmin()`, `puedeBorrarFoto()`). `lecturas_ia` (gasto de IA) solo la leen los admins.
- `functions/extraer-parte`: recibe `{data: base64, mime}`, llama a Claude (y a Gemini como respaldo, según `IA_PROVEEDOR`) con un prompt largo que describe los formatos de cada aseguradora, y devuelve JSON con los campos del parte; registra el consumo en `lecturas_ia`. Si añades un campo extraído, actualiza el prompt, la columna en BD, `CAMPOS_PARTE`/`normalizar()` en `app.js` y el formulario.
- `functions/admin-usuarios`: alta/baja/edición de usuarios con la clave de servicio, solo para administradores.
