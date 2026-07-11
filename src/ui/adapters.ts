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

const CHAT_STORAGE_KEY = "koru.infinite.conversation.v1";
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
  if (memory.sensitivity === "sensitive") return "sensible";
  if (memory.status === "confirmed") return "confirmada";
  if (memory.confidence >= 0.8) return "importante";
  if (memory.confidence >= 0.6) return "dudosa";
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

export function readChatTurns(userName?: string): KoruChatTurn[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [greetingTurn(userName)];
    const parsed = JSON.parse(raw) as KoruChatTurn[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [greetingTurn(userName)];
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
