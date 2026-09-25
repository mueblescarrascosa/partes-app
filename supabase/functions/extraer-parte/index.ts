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
  "tramitador_email": "email del tramitador"
}

Formatos conocidos:
- IRIS GLOBAL: cabecera con logo "IRIS GLOBAL". expediente = "Nº EXPEDIENTE IRIS" (tipo IM26138511); num_encargo = "Nº" de "ENCARGO DE TRABAJO"; gestor = campo "GESTOR".
- SANTALUCÍA: empieza con "Según instrucciones de nuestro Asegurado, le efectuamos el encargo..." y tiene los campos "Nº SINIESTRO (NES)", "RAMO", "MODALIDAD", "CENTRO TRAMITADOR" y "REF.EMPRESA ASIST.". Aunque no aparezca el nombre, es Santalucía. expediente = "REF.EMPRESA ASIST." (p.ej. 916236817); num_siniestro = "Nº SINIESTRO (NES)"; num_encargo = "Nº" de "ENCARGO DE TRABAJO"; poliza = "PÓLIZA"; el "GESTOR" suele ser un código numérico: ponlo en tramitador_nombre.
- MAPFRE: cabecera "MAPFRE ESPAÑA, S.A. / Parte de Trabajo <GREMIO>". expediente = "Nº de Expediente" (tipo V73739261, también aparece al final de "Referencia"); poliza = "Nº Póliza"; fecha_encargo = "Fecha" de la cabecera; tramitador_nombre = "Tramitador del Expediente"; telefono = "Teléfonos de contacto". En averia empieza por el gremio del título (p.ej. "CERRADURAS: ...") y usa la "Descripción del expediente" si aparece; el texto "CLIENTE PLATINO / atención prioritaria..." resúmelo como "Cliente platino: contactar en menos de 12 h".

Reglas:
- Usa null en lo que no aparezca. No inventes datos.
- Los datos del "Profesional" o "Reparador" (código profesional, domicilio y CIF del taller) son de la empresa que recibe el encargo, NO del asegurado: ignóralos.
- El "Gestor" o "Tramitador" es la persona de la compañía que lleva el expediente.
- No confundas el teléfono de la compañía con el del asegurado.
- TELÉFONOS: son críticos. Léelos cifra a cifra, fijándote bien en dígitos parecidos (4/6/9, 1/7, 3/8, 5/6). Un móvil español tiene 9 cifras y empieza por 6 o 7; un fijo, por 8 o 9. Devuelve solo las 9 cifras, sin espacios ni prefijo.
- NÚMEROS DE REFERENCIA (expediente, siniestro, encargo, póliza): cópialos cifra a cifra, sin saltarte ni repetir ninguna. Cuenta las cifras antes de responder.
- Fechas en formato AAAA-MM-DD; en España las fechas del documento van como DD/MM/AAAA.`;

type Entrada = { data: string; mime: string };

function limpiarJSON(txt: string) {
  const ini = txt.indexOf("{");
  const fin = txt.lastIndexOf("}");
  if (ini < 0 || fin < 0) throw new Error("La IA no devolvió JSON");
  return JSON.parse(txt.slice(ini, fin + 1));
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
      if ([400, 403, 404].includes(r.status) && /model/i.test(ultimoError)) continue;
      throw new Error(ultimoError);
    }
    const texto = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    return limpiarJSON(texto);
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
      if (r.status === 404 || r.status === 400) continue;
      throw new Error(ultimoError);
    }
    const texto = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    return limpiarJSON(texto);
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
    for (const proveedor of disponibles) {
      try {
        const datos = proveedor === "gemini" ? await conGemini({ data, mime }) : await conAnthropic({ data, mime });
        return resp({ datos, proveedor });
      } catch (e) {
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
