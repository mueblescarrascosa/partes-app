// ============================================================
//  CONFIGURACIÓN — rellena con los datos de tu proyecto Supabase
//  (Supabase > Project Settings > API)
//  Si SUPABASE_URL se deja vacío, la app arranca en MODO DEMO
//  (datos solo en este navegador, lectura de partes simulada).
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://kseyndjbmkaflpoqitsj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_CbwajQX7DgAoK3fV6GVU5g_18CWeqMG", // clave pública (la protege RLS)

  EMPRESA: {
    nombre: "Muebles Carrascosa SL",
    cif: "B23237522",
    telefono: "653 451 270",
    email: "carrascosamuebles@gmail.com",
    direccion: "C/ Fuenclara, 72 · 23330 Villanueva del Arzobispo",
  },

  // Aseguradoras que salen en el selector (puedes añadir más)
  ASEGURADORAS: ["Mapfre", "Santalucía", "Iris Global", "Caser", "Allianz", "AXA", "Generali", "Reale", "Mutua Madrileña", "Otra"],

  // Mensaje inicial al abrir WhatsApp con el cliente
  MENSAJE_CLIENTE: "Hola {nombre}, le escribo de {empresa} por el parte de {aseguradora} (exp. {expediente}) por {averia_corta}. ¿Cuándo le vendría bien que pasemos a verlo?",
};
