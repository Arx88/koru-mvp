import { foldAccents } from "./commitments";
import type { KoruState } from "./types";

export type AgentActivityKind =
  | "thinking"
  | "saving"
  | "planning"
  | "searching"
  | "comparing"
  | "writing"
  | "asking";

// "deep" = tarea real de investigacion/sintesis (informe, plan del dia): se
// gana el panel largo "Trabajando...". "quick" = dato en vivo o accion
// instantanea (clima, alarma, nota): responde al toque, sin panel largo. Ver
// flujo aprobado en flujo-informe-aoe2.html (pasos 3 vs 7).
export type ActivityDepth = "quick" | "deep";

export type AgentActivity = {
  kind: AgentActivityKind;
  label: string;
  depth: ActivityDepth;
};

const DEEP_INTENT_RE =
  /\b(informe|informes|investiga a fondo|investigacion a fondo|deep research|resumen completo|documento completo|propuesta completa|analisis completo|reporte completo|dossier)\b/i;

// 🔴 Voz mágica de Koru: cada kind tiene un set de mensajes cortos, cálidos,
// variados. Rotamos aleatoriamente para que no se sienta repetitivo. La idea
// es que Koru suene como un compañero curioso que se sumerge en la tarea, no
// como un bot que "procesa" fríamente.
const MAGIC_LABELS: Record<AgentActivityKind, string[]> = {
  thinking: [
    "Mmm, déjame ver…",
    "Dame un segundo…",
    "Me fijo en lo que me pediste.",
    "Pensando esto…",
    "Procesando tu pedido.",
  ],
  saving: [
    "Lo guardo donde corresponde ✨",
    "Anotado, no se pierde.",
    "Lo pongo a salvo en tu jardín.",
    "Lo dejo guardadito para vos.",
    "Toma, lo dejo anclado acá.",
  ],
  planning: [
    "Busco el primer paso real.",
    "Tejo un plan que puedas seguir.",
    "Ordeno el desorden, dame un respiro.",
    "Busco por dónde empezar.",
    "Lo acomodo en pasos chiquitos.",
  ],
  searching: [
    "Buscando información…",
    "Revisando fuentes…",
    "Consultando datos…",
    "A ver qué encuentro…",
    "Recopilando información…",
  ],
  comparing: [
    "Pongo todo en la mesa y comparo.",
    "Cruzo opciones, vemos cuál pega.",
    "Los pongo lado a lado 🤝",
    "Pesamos pros y contras.",
    "Separo el ruido de lo importante.",
  ],
  writing: [
    "Lo escribo con calma ✍️",
    "Redacto algo que valga la pena.",
    "Lo armo palabra por palabra.",
    "Le doy forma, dame un momento.",
    "Te lo dejo prolijo.",
  ],
  asking: [
    "Necesito una pista tuya…",
    "Una pregunta antes de seguir.",
    "Aclarame algo y sigo.",
    "Casi. Confirmame un detalle.",
    "Para no equivocarme: ¿…?",
  ],
};

function pickMagic(kind: AgentActivityKind): string {
  const pool = MAGIC_LABELS[kind] ?? MAGIC_LABELS.thinking;
  return pool[Math.floor(Math.random() * pool.length)];
}

function withDepth(lower: string, kind: AgentActivityKind, fallbackLabel: string): AgentActivity {
  const deep = DEEP_INTENT_RE.test(lower) || kind === "planning";
  const label = deep && kind === "searching"
    ? "Es un tema para meterse a fondo. Dame unos segundos."
    : pickMagic(kind) || fallbackLabel;
  return {
    kind,
    depth: deep ? "deep" : "quick",
    label,
  };
}

const ACTION_INTENT_RE =
  /\b(recordame|recuerdame|acordame|anota|guarda|comprar|gaste|pague|preparar|mandar|enviar|llamar|buscar|busca|buscame|investiga|compara|comparar|clima|temperatura|trafico|noticias|deep research|reunion|plan|que hago|que hacer|pendiente|permitirme)\b/i;

const NON_SLOT_RE =
  /\b(no se|no tengo|que hago|que hacer|pendiente|pendientes|plan|organiza|recordame|recuerdame|acordame|comprar|buscar|busca|buscame|investiga|clima|temperatura|noticias|reunion|gaste|anota|guarda|quiero|necesito|tengo que)\b/i;

function looksLikeLocation(text: string): boolean {
  const clean = foldAccents(text)
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return false;
  const words = clean.split(/\s+/);
  return words.length <= 4 && !NON_SLOT_RE.test(clean);
}

export function inferActivity(input: string): AgentActivity {
  const lower = foldAccents(input);
  if (/\b(clima|temperatura|lluvia|trafico|noticias|buscar|busca|buscame|investiga|internet|web|deep research)\b/i.test(lower)) {
    return withDepth(lower, "searching", "Voy a ver qué encuentro.");
  }
  if (/\b(comparar|compara|precio|comprar|producto|entrega|devoluciones)\b/i.test(lower)) {
    return withDepth(lower, "comparing", "Comparo lo importante.");
  }
  if (/\b(recordame|recuerdame|acordame|anota|guarda|captura|idea|gaste|pague|tengo .*en casa)\b/i.test(lower)) {
    return withDepth(lower, "saving", "Lo guardo bien.");
  }
  if (/\b(no se que hacer|que hago|por donde empiezo|plan|organiza|ordena|pendiente|pendientes)\b/i.test(lower)) {
    return withDepth(lower, "planning", "Busco el primer paso real.");
  }
  if (/\b(mail|correo|mensaje|borrador|documento|informe|resumen|presentacion|propuesta)\b/i.test(lower)) {
    return withDepth(lower, "writing", "Lo escribo con calma.");
  }
  return withDepth(lower, "thinking", "Mmm, déjame ver…");
}

export function rewritePendingFollowUp(text: string, pendingQuestionText: string): string {
  const clean = text.trim();
  if (!clean || ACTION_INTENT_RE.test(foldAccents(clean))) return clean;

  const pending = foldAccents(pendingQuestionText);
  if (/\b(clima|ciudad|ubicacion|weather)\b/i.test(pending) && looksLikeLocation(clean)) {
    return `Consultar clima real en ${clean}`;
  }
  if (/\b(origen|destino|ruta|trafico)\b/i.test(pending) && clean.length <= 80) {
    return `Consultar ruta y trafico para ${clean}`;
  }
  if (/\b(rubro|trabajo|tema|noticias)\b/i.test(pending) && clean.length <= 120) {
    return `Buscar noticias relevantes sobre ${clean}`;
  }
  if (/\b(pendientes actuales|urgencia|energia)\b/i.test(pending) && clean.length <= 140) {
    return `Para ordenar mi dia: ${clean}`;
  }
  return clean;
}

export function rememberedLocation(state: Pick<KoruState, "memories">): string | undefined {
  const text = state.memories
    .filter((memory) => memory.status === "confirmed" && memory.useForSuggestions !== false)
    .map((memory) => memory.text)
    .join("\n");
  const match =
    /\b(?:vivo|estoy|suelo estar)\s+(?:en|por)\s+([A-ZÁÉÍÓÚÑ][\p{L}\s-]{2,40})/u.exec(text) ??
    /\b(?:mi ciudad es|mi zona es)\s+([A-ZÁÉÍÓÚÑ][\p{L}\s-]{2,40})/u.exec(text) ??
    /\btrabajo\s+en\s+([A-ZÁÉÍÓÚÑ][\p{L}\s-]{2,40})/u.exec(text) ??
    /\b(?:vivo|estoy|suelo estar)\s+(?:en|por)\s+([a-záéíóúñ][\p{L}\s-]{2,40})/iu.exec(text) ??
    /\b(?:mi ciudad es|mi zona es)\s+([a-záéíóúñ][\p{L}\s-]{2,40})/iu.exec(text) ??
    /\btrabajo\s+en\s+([a-záéíóúñ][\p{L}\s-]{2,40})/iu.exec(text);
  if (!match?.[1]) return undefined;
  const location = match[1].replace(/\s+/g, " ").trim().replace(/[.!,;:]$/, "");
  if (/\b(clientes|manana|mañana|reunion|reuniones|cosas|abiertas|carga|mental)\b/i.test(foldAccents(location))) return undefined;
  return location;
}
