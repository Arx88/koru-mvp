/**
 * 🐱 Stickers de Michi — sistema de actitud visual.
 *
 * Michi puede mandar UN sticker junto con su reply (campo "sticker" en el
 * JSON final del LLM). El sticker se renderiza en el chat como una imagen
 * suelta (estilo Telegram), con animación pop-in, SIN burbuja.
 *
 * Catálogo: 15 stickers propios (gato con anteojos de sol) en
 * /assets/stickers/{id}.webp (512px, ~30KB c/u, precacheados por el SW).
 *
 * El catálogo vive acá (dominio compartido client+server) porque:
 *  - el systemPrompt lo lista para que el LLM elija,
 *  - normalizeFinalPayload valida el id contra el catálogo,
 *  - TalkOverlay resuelve el src de la imagen.
 */

export const STICKER_IDS = [
  "hi",
  "good-morning",
  "love",
  "nice",
  "okey",
  "so-happy",
  "hahaha",
  "wow",
  "omg",
  "tough-guy",
  "verguenza",
  "tasty",
  "cook",
  "working-on-it",
  "zzz",
] as const;

export type StickerId = (typeof STICKER_IDS)[number];

/** Cuándo conviene cada sticker — usado por el system prompt del LLM. */
export const STICKER_HINTS: Record<StickerId, string> = {
  "hi": "saludo casual, primera charla del día",
  "good-morning": "saludo de mañana / arranque del día",
  "love": "cariño, agradecimiento tierno, algo que te encanta",
  "nice": "aprobación tranquila, 'qué bueno', cumplimiento",
  "okey": "acuerdo simple, 'listo', confirmación relajada",
  "so-happy": "entusiasmo real, muy buenas noticias",
  "hahaha": "algo genuinamente gracioso",
  "wow": "asombro positivo",
  "omg": "shock, noticia fuerte (buena o mala)",
  "tough-guy": "actitud cool, 'no hay problema', firmeza con onda",
  "verguenza": "te equivocaste, algo quedó gracioso, pena ajena ligera",
  "tasty": "comida, recetas, antojos",
  "cook": "cocinando/armando algo, 'estoy en eso'",
  "working-on-it": "tarea en progreso, investigación, mientras buscás algo",
  "zzz": "aburrimiento o sueño, madrugada, 'más tarde'",
};

/** Valida que un id crudo (del LLM o de storage viejo) sea un sticker real. */
export function isValidStickerId(raw: unknown): raw is StickerId {
  return typeof raw === "string" && (STICKER_IDS as readonly string[]).includes(raw);
}

/** Normaliza variantes comunes que el LLM puede emitir (espacios, mayúsculas, guión bajo). */
export function normalizeStickerId(raw: unknown): StickerId | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return isValidStickerId(cleaned) ? cleaned : undefined;
}

/** Src público de la imagen del sticker. */
export function stickerSrc(id: StickerId): string {
  return `/assets/stickers/${id}.webp`;
}
