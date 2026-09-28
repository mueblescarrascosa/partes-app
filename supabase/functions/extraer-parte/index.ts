// Supabase Edge Function: extraer-parte
// Recibe un PDF o una foto de un parte (base64) y devuelve los datos en JSON.
// Proveedor de IA configurable con secretos:
//   IA_PROVEEDOR = orden de prueba, por defecto "anthropic,gemini" (Claude y, si falla, Gemini)
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL (opcional)
//   GEMINI_API_KEY,    GEMINI_MODEL    (opcional)

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Eres un asistente que lee partes de siniestro de aseguradoras españolas
(Mapfre, Santalucía, Iris Global, Caser, Allianz, AXA, Generali, Reale, Mutua Madrileña, Zurich, Liberty, Pelayo, Ocaso, Helvetia, Multiasistencia, etc.).
Extrae los datos del documento y responde ÚNICAMENTE con un objeto JSON, sin texto adicional, con estas claves:

{
  "aseguradora": "compañía que envía el encargo: Mapfre, Santalucía, Iris Global, Caser, etc. NUNCA el 'Profesional' o reparador. Si no se puede saber, null.",
  "expediente": "número de EXPEDIENTE o SINIESTRO de la compañía (en Iris Global es el campo 'Nº EXPEDIENTE IRIS', p.ej. IM26138511)",
  "num_encargo": "número de ENCARGO / servicio / orden de trabajo, si es distinto del expediente (el 'Nº' bajo 'ENCARGO DE TRABAJO')",
  "num_siniestro": "número de SINIESTRO si es distinto del expediente (p.ej. 'Nº SINIESTRO (NES)')",
  "poliza": "número de póliza (solo si aparece un número de póliza real; nombres de producto o convenio como 'INTEGRAL KBS' NO son póliza)",
  "fecha_encargo": "fecha del ENCARGO (campo 'F. ENCARGO'; NO la fecha de ocurrencia ni de comunicación) en formato AAAA-MM-DD",
  "nombre": "nombre y apellidos del asegurado o persona de contacto",
  "direccion": "calle, número, piso y puerta del riesgo",
  "codigo_postal": "",
  "poblacion": "",
  "provincia": "",
  "telefono": "teléfono principal de contacto del asegurado (9 cifras)",
  "telefono2": "otro teléfono del asegurado si hay",
  "averia": "descripción clara del daño o avería y del trabajo encargado (causa, estancia afectada, gremio)",
  "tramitador_nombre": "nombre del tramitador/gestor de la compañía",
  "tramitador_telefono": "teléfono del tramitador",
  "tramitador_email": "email del tramitador",
  "orientacion": "número: cuántos grados habría que girar la imagen EN SENTIDO HORARIO para que el texto quedara derecho (leyéndose de izquierda a derecha y de arriba abajo). 0 si ya está derecha. 90 si las líneas de texto suben de abajo hacia arriba (para leer hay que inclinar la cabeza a la IZQUIERDA). 270 si bajan de arriba hacia abajo (hay que inclinar la cabeza a la DERECHA). 180 si está boca abajo.",
  "tipo": "'conexion' si el parte es un servicio de CONEXIÓN (la compañía solo pone en contacto al cliente con el profesional para que le haga un PRESUPUESTO PARTICULAR que paga el cliente; suele indicarse como 'Conexión', 'Servicio de conexión', 'Tipo encargo: Conexión' o similar, sobre todo en Santalucía e Iris Global). En cualquier otro caso 'siniestro'. OJO: la palabra 'conexión' dentro de la descripción de una avería de fontanería o electricidad (p.ej. 'fuga en la conexión del latiguillo') NO lo convierte en conexión."
}

Formatos conocidos:
- IRIS GLOBAL: cabecera con logo "IRIS GLOBAL". expediente = "Nº EXPEDIENTE IRIS" (tipo IM26138511); num_encargo = "Nº" de "ENCARGO DE TRABAJO"; gestor = campo "GESTOR".
- SANTALUCÍA: empieza con "Según instrucciones de nuestro Asegurado, le efectuamos el encargo..." y tiene los campos "Nº SINIESTRO (NES)", "RAMO", "MODALIDAD", "CENTRO TRAMITADOR" y "REF.EMPRESA ASIST.". Aunque no aparezca el nombre, es Santalucía. expediente = "REF.EMPRESA ASIST." (p.ej. 916236817); num_siniestro = "Nº SINIESTRO (NES)"; num_encargo = "Nº" de "ENCARGO DE TRABAJO"; poliza = "PÓLIZA"; el "GESTOR" suele ser un código numérico: ponlo en tramitador_nombre.
- SANTALUCÍA (pantalla "Buzón Profesional"): suele ser una FOTO HECHA A LA PANTALLA de un ordenador (puede estar inclinada, con reflejos o con la barra del navegador arriba; ignora la barra de marcadores). Tiene pestañas (Encargos, Notas, Agenda...), un "Buscador", una tabla con columnas Compañía / T. Trabajo / NºExp / NºEnc / Act / Domicilio / Código Postal - Población / F.Entrada / Días, y abajo "Detalle de Encargos Profesional" con Ramo, Número de póliza, Tipo Encargo, Causa siniestro, Número de expediente, Fecha Ocurrencia, Fecha Inicio, Gestor, Nombre, N.I.F. y Teléfono. Es Santalucía (logo "santalucia" en la columna Compañía). Reglas:
  · IGNORA por completo el bloque "Buscador" (son filtros de búsqueda, no datos del parte).
  · Si la tabla tiene varias filas, usa la fila cuyo NºExp coincide con el "Número de expediente" del Detalle.
  · expediente = "Número de expediente" del Detalle (la tabla suele cortar la última cifra); num_encargo = "NºEnc"; poliza = "Número de póliza". Quita los puntos de miles: "915.978.190" → "915978190".
  · nombre = "Nombre"; telefono = "Teléfono" del Detalle. El "Gestor" (p.ej. 9.650.043) es un código, NO un teléfono: ponlo sin puntos en tramitador_nombre como "Gestor 9650043". El N.I.F. no se usa.
  · direccion = columna "Domicilio" (puede venir cortada; cópiala tal cual); poblacion = "Código Postal - Población" (si solo hay población, codigo_postal = null).
  · fecha_encargo = "F.Entrada" de la tabla (solo la fecha). NO uses "Fecha Ocurrencia" ni "Fecha Inicio".
  · averia = gremio de la columna "Act" + "Tipo Encargo" + "Causa siniestro", p.ej. "Carpintería de madera – Fenómenos atmosféricos (lluvia). Ramo: Combinado del Hogar. Fecha ocurrencia 17/02/2026". Añade el texto de la nota si hay alguno relevante sobre el daño.
- MAPFRE: cabecera "MAPFRE ESPAÑA, S.A. / Parte de Trabajo <GREMIO>". expediente = "Nº de Expediente" (tipo V73739261, también aparece al final de "Referencia"); poliza = "Nº Póliza"; fecha_encargo = "Fecha" de la cabecera; tramitador_nombre = "Tramitador del Expediente"; telefono = "Teléfonos de contacto". En averia empieza por el gremio del título (p.ej. "CERRADURAS: ...") y usa la "Descripción del expediente" si aparece; el texto "CLIENTE PLATINO / atención prioritaria..." resúmelo como "Cliente platino: contactar en menos de 12 h".

Reglas:
- Usa null en lo que no aparezca. No inventes datos. Los ejemplos de estas instrucciones son solo ejemplos: NUNCA los copies como datos. Si la imagen no se lee bien (borrosa, girada, cortada), devuelve null en lo que no leas con seguridad antes que rellenarlo con algo parecido.
- Los datos del "Profesional" o "Reparador" (código profesional, domicilio y CIF del taller) son de la empresa que recibe el encargo, NO del asegurado: ignóralos.
- El "Gestor" o "Tramitador" es la persona de la compañía que lleva el expediente.
- No confundas el teléfono de la compañía con el del asegurado.
- TELÉFONOS: son críticos. Léelos cifra a cifra, fijándote bien en dígitos parecidos (4/6/9, 1/7, 3/8, 5/6). Un móvil español tiene 9 cifras y empieza por 6 o 7; un fijo, por 8 o 9. Devuelve solo las 9 cifras, sin espacios ni prefijo.
- TELÉFONO TAPADO O ILEGIBLE: a veces el campo de teléfono está tachado, tapado con bolígrafo, cortado o borroso. Busca SIEMPRE teléfonos también en el texto libre ("DESCRIPCIÓN DE LOS TRABAJOS A REALIZAR", "Observaciones", notas: "Tlf 615954724 Teresa (esposa)"). Si el del campo no se lee entero, usa el del texto (comprueba que encaja con las cifras que sí se ven). Si el del campo se lee bien y en el texto hay otro distinto, ponlo en telefono2. NUNCA devuelvas un teléfono incompleto ni con cifras inventadas: si no tienes las 9 cifras seguras, null. En averia conserva la persona de contacto si aparece (p.ej. "Contacto: Teresa (esposa)").
- CÓDIGO POSTAL tapado en parte: complétalo solo si la provincia deja claras las cifras que faltan (Jaén empieza por 23, p.ej. "?3006" en Jaén = 23006); si no, null.
- NÚMEROS DE REFERENCIA (expediente, siniestro, encargo, póliza): cópialos cifra a cifra, sin saltarte ni repetir ninguna. Cuenta las cifras antes de responder.
- CAMPOS QUE NO SE PUEDEN CONFUNDIR (errores graves):
  · nombre = el ASEGURADO / CLIENTE: casillas "NOMBRE" + "APELLIDOS O RAZÓN SOCIAL" (júntalas en un solo nombre completo) o "Nombre:" en Mapfre. NUNCA el "GESTOR", el "Tramitador del Expediente" ni el "Profesional" (MULTIBETT).
  · direccion = la casilla "DOMICILIO DE ACTUACIÓN" o "Domicilio:" (calle y número). NUNCA el texto de "DESCRIPCIÓN DE LOS TRABAJOS A REALIZAR".
  · averia = el texto de "DESCRIPCIÓN DE LOS TRABAJOS A REALIZAR" / "DESCRIPCIÓN DEL TRABAJO A REALIZAR".
  · En las tablas de Iris Global y Santalucía cada dato está en la casilla JUSTO DEBAJO de su título (NOMBRE → debajo el nombre; GESTOR → debajo el gestor). Empareja cada título con SU casilla, no con la de al lado.
- FOTOS GIRADAS: la foto puede venir girada 90° o boca abajo (se hace con el papel sobre la mesa). Léela igual, con especial cuidado en números y teléfonos.
- NOTAS A MANO: los partes suelen tener anotaciones a bolígrafo hechas por el taller ("Albañil no ha comenzado", "Llamado 18/09 a las 9", "Vivimos 10", "Tf. albañil 607...", etc.). NO son datos del encargo: no las metas en averia y nunca uses esos teléfonos (de albañil, pintor u otros gremios) como teléfono del cliente. EXCEPCIÓN: si a mano se ha CORREGIDO o COMPLETADO un dato del cliente (un nombre escrito encima de "VECINO", el piso/puerta añadido a la dirección como "2ºA"), usa la corrección.
- OTRAS COMPAÑÍAS EN EL TEXTO: a veces la descripción cita la póliza o el expediente de OTRA compañía (p.ej. un parte de Iris Global que dice "POL 0762200017150 Mapfre exp V70261021 CCPP", datos de la comunidad de propietarios). Eso NO cambia la aseguradora ni el expediente: la compañía es la del logo/cabecera y el expediente, el de su campo. Déjalo en averia como información.
- EÑES PERDIDAS: algunos sistemas imprimen la Ñ como espacio o símbolo ("MU OZ", "ESPA/A", "CASTA O"). Escríbelo bien: MUÑOZ, ESPAÑA, CASTAÑO.
- MAPFRE escribe el nombre como "APELLIDOS,NOMBRE" ("ARAGON GOMEZ,ALBA MARIA"): devuélvelo como "ALBA MARIA ARAGON GOMEZ".
- Fechas en formato AAAA-MM-DD; en España las fechas del documento van como DD/MM/AAAA. Copia el día cifra a cifra tal como está escrito; no uses la fecha de hoy ni la calcules.`;

type Entrada = { data: string; mime: string };
type Uso = { modelo: string; tokens_in: number; tokens_out: number; coste_usd: number | null };

// Precio en $ por millón de tokens [entrada, salida]. Se pueden cambiar en la app (Ajustes → Tarifas de la IA).
// Gemini en plan gratuito = 0. Un modelo sin precio se guarda con coste null para que la app avise.
const PRECIOS_BASE: Record<string, [number, number]> = {
  "claude-sonnet-4-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
};
function coste(modelo: string, tin: number, tout: number, precios: Record<string, [number, number]>) {
  const tabla = { ...PRECIOS_BASE, ...precios };
  const clave = Object.keys(tabla).sort((a, b) => b.length - a.length).find((k) => modelo.startsWith(k));
  if (!clave) return modelo.startsWith("gemini") ? 0 : null;
  const p = tabla[clave];
  return Math.round(((tin * Number(p[0]) + tout * Number(p[1])) / 1e6) * 1e6) / 1e6;
}

function limpiarJSON(txt: string) {
  const ini = txt.indexOf("{");
  const fin = txt.lastIndexOf("}");
  if (ini < 0 || fin < 0) throw new Error("La IA no devolvió JSON");
  return JSON.parse(txt.slice(ini, fin + 1));
}

// Si la respuesta no es un JSON válido, el error lleva el consumo para registrarlo igualmente (se ha cobrado)
function parsearConUso(texto: string, uso: Uso) {
  try { return limpiarJSON(texto); }
  catch (e) { const err = new Error(`respuesta no válida: ${(e as Error).message}`) as Error & { uso?: Uso }; err.uso = uso; throw err; }
}

async function conAnthropic({ data, mime }: Entrada) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("Falta el secreto ANTHROPIC_API_KEY");
  const modelos = (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5,claude-haiku-4-5").split(",").map((m) => m.trim());
  const bloque = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mime, data } }
    : { type: "image", source: { type: "base64", media_type: mime, data } };
  let ultimoError = "";
  for (const model of modelos) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0,
        messages: [{ role: "user", content: [bloque, { type: "text", text: PROMPT }] }],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      ultimoError = `Anthropic ${model} ${r.status}: ${j?.error?.message ?? JSON.stringify(j)}`;
      // Si el modelo no existe o no está disponible, probamos el siguiente
      if (([400, 403, 404].includes(r.status) && /model/i.test(ultimoError)) || [429, 500, 529].includes(r.status)) continue;
      throw new Error(ultimoError);
    }
    const texto = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const tin = j.usage?.input_tokens ?? 0, tout = j.usage?.output_tokens ?? 0;
    const uso: Uso = { modelo: j.model ?? model, tokens_in: tin, tokens_out: tout, coste_usd: null };
    return { datos: parsearConUso(texto, uso), uso };
  }
  throw new Error(ultimoError || "Ningún modelo de Claude disponible");
}

async function conGemini({ data, mime }: Entrada) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("Falta el secreto GEMINI_API_KEY");
  const modelos = (Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest,gemini-3.8-flash,gemini-2.5-flash").split(",").map((m) => m.trim());
  let ultimoError = "";
  for (const model of modelos) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    const j = await r.json();
    if (!r.ok) {
      ultimoError = `Gemini ${model} ${r.status}: ${j?.error?.message ?? JSON.stringify(j)}`;
      if ([400, 404, 429, 500, 503].includes(r.status)) continue; // modelo no disponible o saturado: probamos el siguiente
      throw new Error(ultimoError);
    }
    const texto = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    const uso: Uso = { modelo: j.modelVersion ?? model, tokens_in: j.usageMetadata?.promptTokenCount ?? 0, tokens_out: j.usageMetadata?.candidatesTokenCount ?? 0, coste_usd: null };
    return { datos: parsearConUso(texto, uso), uso };
  }
  throw new Error(ultimoError || "Ningún modelo de Gemini disponible");
}

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ error: "Método no permitido" }, 405);

  try {
    // Solo miembros del equipo pueden usar la IA (evita gasto por terceros)
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return resp({ error: "No autorizado" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: miembro, error: e1 } = await sb.rpc("es_miembro");
    if (e1 || !miembro) return resp({ error: "No autorizado" }, 401);

    const { data, mime, proveedor: forzar } = await req.json() as Entrada & { proveedor?: string };
    if (!data || !mime) return resp({ error: "Faltan datos del archivo" }, 400);
    const permitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!permitidos.includes(mime)) return resp({ error: `Tipo no admitido: ${mime}` }, 400);
    if (data.length > 14_000_000) return resp({ error: "Archivo demasiado grande (máx. ~10 MB)" }, 413);

    // Orden de prueba: Claude primero y Gemini de respaldo (configurable con IA_PROVEEDOR="gemini,anthropic")
    const orden = (Deno.env.get("IA_PROVEEDOR") ?? "anthropic,gemini").toLowerCase().split(",").map((x) => x.trim());
    const disponibles = (forzar ? [forzar] : orden).filter((p) =>
      (p === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) || (p === "gemini" && Deno.env.get("GEMINI_API_KEY")));
    if (!disponibles.length) return resp({ error: "No hay ninguna clave de IA configurada (ANTHROPIC_API_KEY o GEMINI_API_KEY)" }, 500);
    const fallos: string[] = [];
    // Registro del gasto (si falla, no impide devolver los datos)
    const registrar = async (proveedor: string, uso: Uso) => {
      try {
        const { data: aj } = await sb.from("ajustes").select("datos").eq("id", 1).maybeSingle();
        uso.coste_usd = coste(uso.modelo, uso.tokens_in, uso.tokens_out, aj?.datos?.PRECIOS_IA ?? {});
        const { error } = await sb.from("lecturas_ia").insert({ proveedor, ...uso });
        if (error) console.error("registro uso", error.message);
      } catch (e) { console.error("registro uso", e); }
    };
    for (const proveedor of disponibles) {
      try {
        const { datos, uso } = proveedor === "gemini" ? await conGemini({ data, mime }) : await conAnthropic({ data, mime });
        await registrar(proveedor, uso);
        return resp({ datos, proveedor, uso });
      } catch (e) {
        const u = (e as { uso?: Uso }).uso;
        if (u) await registrar(proveedor, u);   // lectura cobrada aunque la respuesta no sirviera
        console.error(proveedor, e);
        fallos.push(`${proveedor}: ${(e as Error).message}`);
      }
    }
    return resp({ error: fallos.join(" | ") }, 502);
  } catch (e) {
    console.error(e);
    return resp({ error: String((e as Error).message ?? e) }, 500);
  }
});
