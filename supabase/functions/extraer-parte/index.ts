// Supabase Edge Function: extraer-parte
// Recibe un PDF o una foto de un parte (base64) y devuelve los datos en JSON.
// Proveedor de IA configurable con secretos:
//   IA_PROVEEDOR = "anthropic" (por defecto) | "gemini"
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
  "aseguradora": "nombre de la compañía (p.ej. Mapfre, Santalucía, Iris Global, Caser). Si el parte viene de una gestora/plataforma de asistencia, pon esa.",
  "expediente": "número de expediente / siniestro / encargo / servicio",
  "poliza": "número de póliza",
  "fecha_encargo": "fecha del encargo en formato AAAA-MM-DD",
  "nombre": "nombre y apellidos del asegurado o persona de contacto",
  "direccion": "calle, número, piso y puerta del riesgo",
  "codigo_postal": "",
  "poblacion": "",
  "provincia": "",
  "telefono": "teléfono principal de contacto del asegurado (solo dígitos, con prefijo +34 si aparece)",
  "telefono2": "otro teléfono del asegurado si hay",
  "averia": "descripción clara del daño o avería y del trabajo encargado (causa, estancia afectada, gremio)",
  "tramitador_nombre": "nombre del tramitador/gestor de la compañía",
  "tramitador_telefono": "teléfono del tramitador",
  "tramitador_email": "email del tramitador"
}

Reglas: usa null en lo que no aparezca; no inventes datos; no confundas el teléfono de la compañía con el del asegurado.`;

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
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5";
  const bloque = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mime, data } }
    : { type: "image", source: { type: "base64", media_type: mime, data } };
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
      messages: [{ role: "user", content: [bloque, { type: "text", text: PROMPT }] }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${j?.error?.message ?? JSON.stringify(j)}`);
  const texto = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  return limpiarJSON(texto);
}

async function conGemini({ data, mime }: Entrada) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("Falta el secreto GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
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
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${j?.error?.message ?? JSON.stringify(j)}`);
  const texto = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return limpiarJSON(texto);
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

    const { data, mime } = await req.json() as Entrada;
    if (!data || !mime) return resp({ error: "Faltan datos del archivo" }, 400);
    const permitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!permitidos.includes(mime)) return resp({ error: `Tipo no admitido: ${mime}` }, 400);
    if (data.length > 14_000_000) return resp({ error: "Archivo demasiado grande (máx. ~10 MB)" }, 413);

    const proveedor = (Deno.env.get("IA_PROVEEDOR") ?? "anthropic").toLowerCase();
    const datos = proveedor === "gemini" ? await conGemini({ data, mime }) : await conAnthropic({ data, mime });
    return resp({ datos, proveedor });
  } catch (e) {
    console.error(e);
    return resp({ error: String((e as Error).message ?? e) }, 500);
  }
});
