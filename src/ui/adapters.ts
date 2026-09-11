/**
 * Fase 2.6 — Adapters extraídos de KoruProvider.tsx.
 *
 * Funciones de mapeo entre tipos del dominio (KoruState) y tipos de UI
 * (Memory, MemoryStatus, MemoryCategory, Stage). También helpers de
 * chat storage y patching de UiBlocks con resultados web.
 */
import type {
  AssistantAction,
  UiBlock,
  KoruStage,
  MemoryFact,
} from "../domain/types";
import type { webResultToPayload } from "../domain/web";
import type { KoruTurnItem, KoruChatTurn } from "../domain/turn";
import { createId } from "../domain/store";
import type { Stage } from "./KoruProvider";

const CHAT_STORAGE_KEY = "michi.infinite.conversation.v1";
const STAGE_ORDER: Stage[] = ["semilla", "brote", "raices", "nacimiento", "jardin"];

// Re-export para que KoruProvider pueda usarlo
export { CHAT_STORAGE_KEY };

export function stageForEnergy(energy: number, stageMeta: Record<Stage, { minEnergy: number }>): Stage {
  let current: Stage = "semilla";
  for (const s of STAGE_ORDER) {
    if (energy >= stageMeta[s].minEnergy) current = s;
  }
  return current;
}

export function domainStageToNew(stage: KoruStage): Stage {
  const map: Record<string, Stage> = {
    seed: "semilla",
    sprout: "brote",
    roots: "raices",
    born: "nacimiento",
    garden: "jardin",
  };
  return map[stage] ?? "semilla";
}

export function domainStatusToMemoryStatus(memory: MemoryFact): "reciente" | "confirmada" | "dudosa" | "importante" | "sensible" {
  // 🔴 FIX: el orden importa. Antes una CANDIDATA con confianza >= 0.8 se
  // mostraba como "importante" — lo que (a) miente (no está confirmada) y
  // (b) ocultaba el botón de confirmar en el jardín. Ahora "importante" es
  // exclusivo de memorias CONFIRMADAS de alta confianza, y las candidatas
  // siempre aparecen como lo que son: algo que pide atención del usuario.
  if (memory.sensitivity === "sensitive") return "sensible";
  if (memory.status === "confirmed") {
    return memory.confidence >= 0.8 ? "importante" : "confirmada";
  }
  if (memory.status === "candidate") {
    return memory.confidence >= 0.6 ? "dudosa" : "reciente";
  }
  return "reciente";
}

export function domainKindToCategory(kind: string): "rutina" | "trabajo" | "relacion" | "preferencia" | "objetivo" | "salud" {
  const map: Record<string, "rutina" | "trabajo" | "relacion" | "preferencia" | "objetivo" | "salud"> = {
    routine: "rutina",
    retail: "trabajo",
    relationship: "relacion",
    preference: "preferencia",
    goal: "objetivo",
    wellbeing: "salud",
    profile: "rutina",
    boundary: "preferencia",
    task: "trabajo",
  };
  return map[kind] ?? "rutina";
}

export function greetingTurn(userName?: string): KoruChatTurn {
  return {
    id: createId("turn"),
    role: "koru",
    text: `Hola${userName ? `, ${userName}` : ""}. Cuéntame cómo estás.`,
    createdAt: new Date().toISOString(),
    status: "done",
    mascotState: "idle",
  };
}

/**
 * 🔴 FIX "CAMILA" (bug en vivo 2026-09-10): el morning brief llegaba con un
 * nombre INVENTADO por el LLM ("¡Buen día, Camila!") para un usuario con otro
 * nombre. Red de seguridad del cliente: si hay userName real y el greeting
 * contiene un nombre que NO es el suyo (palabra capitalizada standalone),
 * reemplazarlo por el real. Si no hay userName, quitar cualquier nombre
 * inventado (quedar solo el saludo).
 */
export function sanitizeBriefGreeting(greeting: string, userName?: string): string {
  const g = (greeting ?? "").trim();
  if (!g) return "";
  const real = (userName ?? "").trim();
  if (real && g.toLowerCase().includes(real.toLowerCase())) return g;
  // Buscar "nombre propio sospechoso": palabra capitalizada (no al inicio de
  // oración tras signo) de 3-16 letras, sin ser palabra común de saludo.
  const COMMON = /^(?:Buen|Buenos|Buena|Hola|Hey|Día|Dias|Días|Tardes|Noches|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|Empecemos|Arranquemos|Vamos|Que|Qué|Hoy|Un|Una|El|La|Este|Esta|Listo|Vamos)$/i;
  const words = g.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^\p{L}\p{M}'-]/gu, "");
    // Si la palabra PREVIA termina en puntuación de oración, esta palabra abre
    // oración (capitalizada por gramática, no por ser nombre propio).
    const opensSentence = /[.:!¡¿?]$/.test(words[i - 1] ?? "");
    if (!opensSentence && w.length >= 3 && w.length <= 16 && /^\p{Lu}/u.test(w) && !COMMON.test(w)) {
      // Candidato a nombre inventado — reemplazar por el real o eliminar.
      // Conservar la puntuación que rodea la palabra ("Camila!" → "Facundo!").
      const trailing = (words[i].match(/[^\p{L}\p{M}'-]+$/u) ?? [""])[0];
      if (real) {
        words[i] = real + trailing;
        return words.join(" ").replace(/\s{2,}/g, " ").replace(/,(\S)/g, ", $1").replace(/(\S),/g, "$1,");
      }
      // Sin nombre real: sacar el nombre y la coma previa.
      const cleaned = words.slice(0, i).join(" ").replace(/[,\s]+$/, "") + (i < words.length - 1 ? " " + words.slice(i + 1).join(" ") : "");
      return cleaned.replace(/\s{2,}/g, " ").trim();
    }
  }
  return g;
}

export function readChatTurns(userName?: string): KoruChatTurn[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [greetingTurn(userName)];
    const parsed = JSON.parse(raw) as KoruChatTurn[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [greetingTurn(userName)];
    // 🐱 v7.6 — infinite scroll: el historial persistido se muestra
    // COMPLETO en el feed. Un turno que quedó "working" al cerrar la app
    // (stream interrumpido) renderizaría su card esqueleto "Buscando…"
    // POR SIEMPRE — lo normalizamos a done al cargar.
    return parsed.map((turn) =>
      turn && turn.status === "working" ? { ...turn, status: "done" as const, items: [] } : turn,
    );
  } catch {
    return [greetingTurn(userName)];
  }
}

export function saveChatTurns(turns: KoruChatTurn[], persist = true) {
  try {
    if (!persist) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(turns.slice(-120)));
  } catch {
    // Browser conversation persistence is best-effort.
  }
}

export function patchUiBlockWithWebResult(
  action: AssistantAction,
  result: ReturnType<typeof webResultToPayload>,
): UiBlock | undefined {
  const block = action.payload.uiBlock;
  if (!block) return undefined;
  if (block.type === "weather") {
    const summaryItems = result.summaryItems ?? [];
    return {
      ...block,
      now: summaryItems[0]?.value ?? block.now,
      range: summaryItems[1]?.value ?? block.range,
      rain: summaryItems[2]?.value ?? block.rain,
      advice: result.recommendation ?? block.advice,
      sourceStatus: result.externalStatus ?? block.sourceStatus,
      sources: result.sources ?? block.sources,
    };
  }
  if (block.type === "proactive_signal") {
    return {
      ...block,
      body: result.recommendation ?? block.body,
      sourceStatus: result.externalStatus ?? block.sourceStatus,
      timestampLabel: result.verifiedAt
        ? new Date(result.verifiedAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : block.timestampLabel,
      sources: result.sources ?? block.sources,
      summaryItems: result.summaryItems ?? block.summaryItems,
    };
  }
  if (block.type === "research_sources") {
    if (action.payload.webMode === "shopping" && result.comparisonItems?.length) {
      const items = result.comparisonItems.map((offer) => {
        const sourceTitle = result.sources?.find((source) => source.url === offer.url)?.title;
        return {
          ...offer,
          evidence: [sourceTitle && sourceTitle !== offer.title ? sourceTitle : undefined, offer.evidence].filter(Boolean).join(" - ") || offer.evidence,
        };
      });
      return {
        type: "comparison",
        title: action.payload.title ?? block.title ?? "Comparativa",
        items,
        recommendation: result.recommendation,
        sources: result.sources ?? block.sources,
      };
    }
    return {
      ...block,
      summary: result.recommendation ?? block.summary,
      sources: result.sources ?? block.sources,
      sourceStatus: result.externalStatus ?? block.sourceStatus,
    };
  }
  if (block.type === "comparison" && result.comparisonItems?.length) {
    return {
      ...block,
      items: result.comparisonItems,
      recommendation: result.recommendation ?? block.recommendation,
      sources: result.sources ?? block.sources,
    };
  }
  return block;
}

export function actionConfirmationText(item: KoruTurnItem): string {
  if (item.status === "executed" && item.actionKind === "day_plan") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "structured_note") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "money_summary") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "morning_brief") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "meeting_brief") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "decision_support") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "file_bundle") return item.result ?? "";
  if (item.status === "executed" && item.actionKind === "web_research") return item.result ?? "";
  if (item.status === "executed" && item.result) return item.result;
  return "";
}
