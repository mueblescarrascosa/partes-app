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

  // IVA que se suma a la valoración (0 = precios y totales sin IVA)
  IVA: 0,

  // A quién se envían los PDF de visita y de trabajo terminado
  DESTINO_INFORMES: { nombre: "MULTIBETT", telefono: "680412264" },

  // Aseguradoras que salen en el selector (puedes añadir más)
  ASEGURADORAS: ["Mapfre", "Santalucía", "Iris Global", "Caser", "Allianz", "AXA", "Generali", "Reale", "Mutua Madrileña", "Otra"],

  // App de WhatsApp en Android: "business" (WhatsApp Business) o "normal"
  WHATSAPP_APP: "business",

  // Zonas para filtrar la lista (se asignan por la población del parte). Editables en Ajustes.
  ZONAS: [
    { nombre: "Jaén y alrededores", pueblos: ["Jaén", "Mancha Real", "Torredelcampo", "Torredonjimeno", "Martos", "Jamilena", "Los Villares", "La Guardia de Jaén", "Pegalajar", "Mengíbar", "Villatorres", "Torrequebradilla", "Villargordo", "Vados de Torralba", "Fuerte del Rey", "Cambil", "Torres", "Jimena", "Bedmar", "Cárcheles", "Campillo de Arenas", "Valdepeñas de Jaén", "Puente de la Sierra", "Las Infantas", "Fuensanta de Martos"] },
    { nombre: "Cazorla y alrededores", pueblos: ["Cazorla", "La Iruela", "Burunchel", "Arroyo Frío", "Peal de Becerro", "Quesada", "Pozo Alcón", "Hinojares", "Huesa", "Santo Tomé", "Chilluévar", "Belerda", "Tíscar", "Larva"] },
    { nombre: "Segura", pueblos: ["Segura de la Sierra", "Orcera", "La Puerta de Segura", "Puente de Génave", "Siles", "Beas de Segura", "Hornos", "Santiago-Pontones", "Pontones", "Santiago de la Espada", "Coto Ríos", "Benatae", "Torres de Albanchez", "Génave", "Villarrodrigo", "Arroyo del Ojanco", "Cortijos Nuevos"] },
    { nombre: "Las Villas", pueblos: ["Villanueva del Arzobispo", "Villacarrillo", "Iznatoraf", "Sorihuela del Guadalimar", "Mogón"] },
  ],

  // Mensaje inicial al abrir WhatsApp con el cliente
  MENSAJE_CLIENTE: "Hola {nombre}, le escribo de {empresa} por el parte de {aseguradora} (exp. {expediente}) por {averia_corta}. ¿Cuándo le vendría bien que pasemos a verlo?",
};
