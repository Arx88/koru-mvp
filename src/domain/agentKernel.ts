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

export type AgentActivity = {
  kind: AgentActivityKind;
  label: string;
};

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
    return { kind: "searching", label: "Claro. Lo miro." };
  }
  if (/\b(comparar|compara|precio|comprar|producto|entrega|devoluciones)\b/i.test(lower)) {
    return { kind: "comparing", label: "Dale. Comparo lo importante." };
  }
  if (/\b(recordame|recuerdame|acordame|anota|guarda|captura|idea|gaste|pague|tengo .*en casa)\b/i.test(lower)) {
    return { kind: "saving", label: "Lo guardo bien." };
  }
  if (/\b(no se que hacer|que hago|por donde empiezo|plan|organiza|ordena|pendiente|pendientes)\b/i.test(lower)) {
    return { kind: "planning", label: "Voy a buscar el primer paso real." };
  }
  if (/\b(mail|correo|mensaje|borrador|documento|informe|resumen|presentacion|propuesta)\b/i.test(lower)) {
    return { kind: "writing", label: "Lo preparo con calma." };
  }
  return { kind: "thinking", label: "Pensando el siguiente paso." };
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
