# Partes · gestión de siniestros desde el móvil

App web (PWA, se instala en el móvil como una app) para organizar partes de Mapfre, Santalucía, Iris Global, Caser, etc.

- Escanea el parte (foto o PDF) y la IA rellena aseguradora, expediente, nombre, dirección, teléfono, avería y tramitador.
- 6 fases: **Recibido → Contactado → Visitado → Valorado → Autorizado → Realizado**, con notas en cada una (en *Contactado*: lo que dijo el cliente y la fecha de la cita).
- Botones de **Llamar**, **WhatsApp** (con mensaje preparado) y **Cómo llegar**.
- Fotos antes/después, firma del cliente en pantalla e importes.
- Al marcar *Realizado* genera un **PDF** con todo y lo envía por WhatsApp al tramitador.
- Varios usuarios: cada parte se asigna a un técnico; todo el equipo ve todos los partes.

Si `docs/js/config.js` no tiene datos de Supabase, la app funciona en **modo demo** (datos solo en ese navegador).

## Estructura

```
docs/                         ← la web (GitHub Pages sirve esta carpeta)
  index.html, styles.css, sw.js, manifest.webmanifest
  js/config.js                ← AQUÍ van la URL y la clave de Supabase y los datos de tu empresa
  js/app.js, api.js, pdf.js, util.js
supabase/schema.sql           ← tablas, seguridad y almacenamiento
supabase/functions/extraer-parte/index.ts  ← lectura del parte con IA
```

## Instalación

### 1. Supabase
1. Crea un proyecto nuevo (región *West EU*).
2. **SQL Editor** → pega todo `supabase/schema.sql` → *Run*.
3. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up* (solo entra quien tú crees).
4. **Authentication → Users → Add user** para ti y cada técnico (email + contraseña, marca *Auto confirm*).
5. En **SQL Editor**, da de alta a cada uno en el equipo:
   ```sql
   insert into miembros (user_id, nombre, es_admin)
   select id, 'Alfonso', true from auth.users where email = 'tu@email.com';
   ```
6. **Authentication → URL Configuration**: pon como *Site URL* la dirección de GitHub Pages.

### 2. Función de IA
1. **Edge Functions → Deploy a new function → Via Editor**, nombre `extraer-parte`, pega `supabase/functions/extraer-parte/index.ts` → *Deploy*.
2. **Edge Functions → Secrets**, añade:
   - `ANTHROPIC_API_KEY` = tu clave de https://console.anthropic.com (recarga unos 5–10 € de saldo).
   - Opcional con Gemini: `IA_PROVEEDOR` = `gemini` y `GEMINI_API_KEY` = clave de https://aistudio.google.com.
   - Opcional: `ANTHROPIC_MODEL` / `GEMINI_MODEL` para cambiar el modelo.

Coste orientativo: unos céntimos por parte.

### 3. Web en GitHub Pages
1. Rellena `docs/js/config.js` con *Project URL* y la clave *anon/publishable* (Supabase → Project Settings → API) y los datos de tu empresa.
2. Sube el proyecto a un repositorio de GitHub.
3. **Settings → Pages** → *Deploy from a branch* → rama `main`, carpeta `/docs`.
4. Abre la URL en el móvil → menú del navegador → **Añadir a pantalla de inicio**.

La clave *anon* puede ser pública: los datos están protegidos por las reglas RLS y solo los miembros del equipo pueden leerlos. **No pongas nunca la clave `service_role` ni la de Anthropic en `config.js`.**

## Envío del PDF por WhatsApp
- **Enviar PDF por WhatsApp**: abre el menú de compartir del móvil con el PDF adjunto → WhatsApp → tramitador.
- **WhatsApp directo al tramitador**: abre su chat con un mensaje y un enlace al PDF válido 30 días.

## Protección de datos
Guardas datos personales de asegurados. Ten en cuenta el RGPD: usa contraseñas fuertes, da de baja a quien deje el equipo (borrándolo de *Users*) y borra partes antiguos cuando ya no los necesites.
