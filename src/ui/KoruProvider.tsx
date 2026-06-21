import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AssistantAction,
  AssistantArtifact,
  AssistantPlanItem,
  AssistantSource,
  Commitment,
  UiBlock,
  DailyEntry,
  EnergyEvent,
  KoruState,
  KoruStage,
  LifeRecord,
  MascotState,
  MemoryFact,
  ModelCall,
} from "../domain/types";
import {
  applyHeartbeatNudges,
  addOnboardingMemories,
  approveAndExecuteAction,
  completeCommitment,
  confirmMemory as confirmMemoryInStore,
  createInitialState,
  dismissNudge,
  loadPersistedState,
  rejectAction,
  rejectMemory,
  resetState,
  saveState,
  setActionPreparationEnabled,
  setDurableMemoryEnabled,
  setHeartbeatEnabled,
  setWorldSignalsEnabled,
  toggleMemorySuggestions,
  toggleEphemeralMode,
  updateMemoryText,
  stageFor as domainStageFor,
} from "../domain/store";
import { runBackendAgentTurn, type KoruBackendTurnResponse, type KoruSuggestedAction } from "../domain/backendAgentClient";
import { buildHeartbeatNudges } from "../domain/heartbeat";
import { runWebNavigation, webResultToPayload } from "../domain/web";
import { dueLabel } from "../domain/time";
import { inferActivity, type AgentActivity } from "../domain/agentKernel";
import { actionKindForUiBlock, shouldAutoRunAction } from "../domain/toolRegistry";

export type Stage = "semilla" | "brote" | "raices" | "nacimiento" | "jardin";

export type MemoryStatus = "reciente" | "confirmada" | "dudosa" | "importante" | "sensible";

export type MemoryCategory =
  | "rutina" | "trabajo" | "relacion" | "preferencia" | "objetivo" | "salud";

export type Priority = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
  kind?: "commitment" | "action" | "nudge";
};

export type Memory = {
  id: string;
  text: string;
  status: MemoryStatus;
  category: MemoryCategory;
  origin: string;
  savedOn: string;
  useForSuggestions: boolean;
};

export type HistoryEntry = {
  id: string;
  time: string;
  kind: "check-in" | "memoria" | "cierre";
  title: string;
  detail: string;
  reason?: string;
  energy?: number;
};

export type Permission = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type KoruTurnItem = {
  id: string;
  kind: "action" | "memory" | "commitment";
  tag: string;
  text: string;
  status?: "proposed" | "working" | "executed" | "rejected" | "confirmed" | "open";
  result?: string;
  payloadPreview?: string;
  sourceId?: string;
  actionKind?: AssistantAction["kind"];
  uiBlock?: UiBlock;
  approvalLabel?: string;
  rejectLabel?: string;
  steps?: Array<{ text: string; status: "done" | "doing" | "waiting" }>;
  files?: AssistantArtifact[];
  sources?: AssistantSource[];
  planItems?: AssistantPlanItem[];
  contextReview?: NonNullable<AssistantAction["payload"]["contextReview"]>;
  questions?: string[];
  missingContext?: string[];
  searchQueries?: string[];
  researchCriteria?: string[];
  records?: Array<Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">>;
  summaryItems?: NonNullable<AssistantAction["payload"]["summaryItems"]>;
  totalAmount?: number;
  currency?: string;
  recommendation?: string;
  verifiedAt?: string;
  externalStatus?: AssistantAction["payload"]["externalStatus"];
  webMode?: AssistantAction["payload"]["webMode"];
  comparisonItems?: AssistantAction["payload"]["comparisonItems"];
  decisionVote?: AssistantAction["payload"]["decisionVote"];
  decisionAssumption?: AssistantAction["payload"]["decisionAssumption"];
};

export type KoruChatTurn = {
  id: string;
  role: "user" | "koru";
  text: string;
  createdAt: string;
  items?: KoruTurnItem[];
  liked?: boolean;
  status?: "done" | "working" | "error";
  mascotState?: MascotState;
};

export const STAGE_META: Record<Stage, { label: string; meaning: string; capability: string; minEnergy: number }> = {
  semilla: { label: "Semilla", meaning: "Koru acaba de llegar", capability: "Escucha, resume y ordena", minEnergy: 0 },
  brote: { label: "Brote", meaning: "Ya te entiendo lo suficiente", capability: "Reconoce tu rutina y objetivos", minEnergy: 31 },
  raices: { label: "RaÃ­ces", meaning: "Tengo contexto para ayudar mejor", capability: "Detecta patrones y hace follow-ups", minEnergy: 90 },
  nacimiento: { label: "Nacimiento", meaning: "NacÃ­ para acompaÃ±arte", capability: "Proactividad fina, con tu permiso", minEnergy: 160 },
  jardin: { label: "JardÃ­n vivo", meaning: "Tu jardÃ­n se cuida solo", capability: "Memoria editable, autonomÃ­a completa", minEnergy: 260 },
};

const STAGE_ORDER: Stage[] = ["semilla", "brote", "raices", "nacimiento", "jardin"];
const CHAT_STORAGE_KEY = "koru.infinite.conversation.v1";
const AUDIT_FLAG_KEY = "koru.audit.enabled";
const AUDIT_SESSION_KEY = "koru.audit.session";

function auditEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("koruAudit") === "1") {
      sessionStorage.setItem(AUDIT_FLAG_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(AUDIT_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function auditSessionId(): string {
  try {
    const existing = sessionStorage.getItem(AUDIT_SESSION_KEY);
    if (existing) return existing;
    const next = `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(AUDIT_SESSION_KEY, next);
    return next;
  } catch {
    return `audit_${Date.now().toString(36)}`;
  }
}

function writeAuditEvent(event: Record<string, unknown>) {
  if (!auditEnabled()) return;
  void fetch("/koru-audit/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: auditSessionId(),
      clientAt: new Date().toISOString(),
      ...event,
    }),
  }).catch(() => undefined);
}

function auditStateSnapshot(state: KoruState) {
  return {
    userName: state.userName,
    stage: state.stage,
    trustedEnergy: state.trustedEnergy,
    totalEnergy: state.totalEnergy,
    counts: {
      memories: state.memories.length,
      confirmedMemories: state.memories.filter((memory) => memory.status === "confirmed").length,
      commitments: state.commitments.length,
      openCommitments: state.commitments.filter((commitment) => commitment.status === "open").length,
      actions: state.actions.length,
      records: state.records.length,
      entries: state.entries.length,
      nudges: state.nudges.length,
      modelCalls: state.modelCalls.length,
    },
    latest: {
      memories: state.memories.slice(0, 8).map((memory) => ({
        id: memory.id,
        kind: memory.kind,
        status: memory.status,
        sensitivity: memory.sensitivity,
        confidence: memory.confidence,
        text: memory.text,
        rootQuote: memory.rootQuote,
      })),
      commitments: state.commitments.slice(0, 8).map((commitment) => ({
        id: commitment.id,
        title: commitment.title,
        dueHint: commitment.dueHint,
        dueAt: commitment.dueAt,
        status: commitment.status,
        recurrence: commitment.recurrence,
      })),
      actions: state.actions.slice(0, 8).map((action) => ({
        id: action.id,
        kind: action.kind,
        title: action.title,
        status: action.status,
        approvalRequired: action.approvalRequired,
        uiBlockType: action.payload.uiBlock?.type,
        webMode: action.payload.webMode,
        externalStatus: action.payload.externalStatus,
        result: action.result,
      })),
      records: state.records.slice(0, 8).map((record) => ({
        id: record.id,
        domain: record.domain,
        kind: record.kind,
        title: record.title,
        value: record.value,
        dueHint: record.dueHint,
        amount: record.amount,
        currency: record.currency,
        person: record.person,
        url: record.url,
      })),
      modelCalls: state.modelCalls.slice(0, 5).map((call) => ({
        provider: call.provider,
        model: call.model,
        success: call.success,
        latencyMs: call.latencyMs,
        summary: call.summary,
        error: call.error,
      })),
    },
    runtime: {
      freeLlmApiEnabled: state.runtime.freeLlmApiEnabled,
      openModelEnabled: state.runtime.openModelEnabled,
      embeddingsEnabled: state.runtime.embeddingsEnabled,
      freeLlmApiModel: state.runtime.freeLlmApiModel,
      openModelModel: state.runtime.openModelModel,
    },
  };
}

function auditTurnItems(items?: KoruTurnItem[]) {
  return (items ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    tag: item.tag,
    text: item.text,
    status: item.status,
    actionKind: item.actionKind,
    uiBlockType: item.uiBlock?.type,
    webMode: item.webMode,
    externalStatus: item.externalStatus,
    result: item.result,
    records: item.records,
    questions: item.questions,
    missingContext: item.missingContext,
    searchQueries: item.searchQueries,
    researchCriteria: item.researchCriteria,
    sources: item.sources,
    planItems: item.planItems,
  }));
}

function auditStateDelta(previous: KoruState, next: KoruState) {
  return {
    addedMemories: next.memories
      .filter((memory) => !previous.memories.some((existing) => existing.id === memory.id))
      .map((memory) => ({
        id: memory.id,
        kind: memory.kind,
        status: memory.status,
        sensitivity: memory.sensitivity,
        confidence: memory.confidence,
        text: memory.text,
        rootQuote: memory.rootQuote,
      })),
    addedCommitments: next.commitments
      .filter((commitment) => !previous.commitments.some((existing) => existing.id === commitment.id))
      .map((commitment) => ({
        id: commitment.id,
        title: commitment.title,
        dueHint: commitment.dueHint,
        dueAt: commitment.dueAt,
        status: commitment.status,
        recurrence: commitment.recurrence,
      })),
    addedActions: next.actions
      .filter((action) => !previous.actions.some((existing) => existing.id === action.id))
      .map((action) => ({
        id: action.id,
        kind: action.kind,
        title: action.title,
        status: action.status,
        approvalRequired: action.approvalRequired,
        uiBlockType: action.payload.uiBlock?.type,
        webMode: action.payload.webMode,
        externalStatus: action.payload.externalStatus,
        result: action.result,
      })),
    addedRecords: next.records
      .filter((record) => !previous.records.some((existing) => existing.id === record.id))
      .map((record) => ({
        id: record.id,
        domain: record.domain,
        kind: record.kind,
        title: record.title,
        value: record.value,
        dueHint: record.dueHint,
        amount: record.amount,
        currency: record.currency,
        person: record.person,
        url: record.url,
      })),
    addedEntries: next.entries
      .filter((entry) => !previous.entries.some((existing) => existing.id === entry.id))
      .map((entry) => ({
        id: entry.id,
        text: entry.text,
        summary: entry.summary,
        sentiment: entry.sentiment,
        energyAwarded: entry.energyAwarded,
        memoryIds: entry.memoryIds,
        commitmentIds: entry.commitmentIds,
        actionIds: entry.actionIds,
        recordIds: entry.recordIds,
        activeMemoryIds: entry.activeMemoryIds,
        brainProvider: entry.brainProvider,
        brainModel: entry.brainModel,
      })),
  };
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function greetingTurn(userName?: string): KoruChatTurn {
  return {
    id: createId("turn"),
    role: "koru",
    text: `Hola${userName ? `, ${userName}` : ""}. Cuéntame cómo estás.`,
    createdAt: new Date().toISOString(),
    status: "done",
    mascotState: "idle",
  };
}

function readChatTurns(userName?: string): KoruChatTurn[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [greetingTurn(userName)];
    const parsed = JSON.parse(raw) as KoruChatTurn[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [greetingTurn(userName)];
  } catch {
    return [greetingTurn(userName)];
  }
}

function saveChatTurns(turns: KoruChatTurn[], persist = true) {
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

export function stageForEnergy(energy: number): Stage {
  let current: Stage = "semilla";
  for (const s of STAGE_ORDER) {
    if (energy >= STAGE_META[s].minEnergy) current = s;
  }
  return current;
}

function domainStageToNew(stage: KoruStage): Stage {
  const map: Record<string, Stage> = {
    seed: "semilla",
    sprout: "brote",
    roots: "raices",
    born: "nacimiento",
    garden: "jardin",
  };
  return map[stage] ?? "semilla";
}

function domainStatusToMemoryStatus(memory: MemoryFact): MemoryStatus {
  if (memory.sensitivity === "sensitive") return "sensible";
  if (memory.status === "confirmed") return "confirmada";
  if (memory.confidence >= 0.8) return "importante";
  if (memory.confidence >= 0.6) return "dudosa";
  return "reciente";
}

function domainKindToCategory(kind: string): MemoryCategory {
  const map: Record<string, MemoryCategory> = {
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

function defaultActionSteps(kind: AssistantAction["kind"]): string[] {
  const map: Partial<Record<AssistantAction["kind"], string[]>> = {
    day_plan: ["LeÃ­ tu pedido", "RevisÃ© pendientes", "AgrupÃ© por prioridad", "PreparÃ© una propuesta"],
    structured_note: ["Guardado", "Clasificado", "Disponible para usar despuÃ©s"],
    money_summary: ["RevisÃ© gastos", "CalculÃ© el total", "PreparÃ© criterio de decisiÃ³n"],
    morning_brief: ["RevisÃ© agenda", "CrucÃ© pendientes", "SeparÃ© lo sabido de lo que falta"],
    meeting_brief: ["RevisÃ© contexto", "AgrupÃ© temas", "PreparÃ© agenda"],
    decision_support: ["LeÃ­ el costo", "ComparÃ© con contexto", "SeparÃ© recomendaciÃ³n de supuesto"],
    file_bundle: ["AnalicÃ© requerimientos", "OrdenÃ© entregables", "GenerÃ© archivos", "DejÃ© revisiÃ³n lista"],
    web_research: ["DefinÃ­ bÃºsqueda", "PreparÃ© fuentes", "OrdenÃ© opciones", "DejÃ© el siguiente paso"],
    clarifying_question: ["RevisÃ© contexto", "DetectÃ© datos faltantes", "PreparÃ© preguntas Ãºtiles"],
    draft_message: ["EntendÃ­ el contexto", "PreparÃ© borrador", "Lo dejÃ© para revisar"],
    calendar_event: ["LeÃ­ horario", "PreparÃ© evento", "Espero tu visto bueno"],
    alarm: ["LeÃ­ la hora", "PreparÃ© la alarma", "Espero tu visto bueno"],
    reminder: ["Detecte pendiente", "Lo deje visible", "Espero tu visto bueno"],
    restock_note: ["RevisÃ© pedido", "PreparÃ© nota", "Espero tu visto bueno"],
    daily_brief: ["OrdenÃ© lo importante", "Reduje el ruido", "PreparÃ© un cierre"],
  };
  return map[kind] ?? ["Entendi el pedido", "Prepare una respuesta concreta", "Deje el siguiente paso visible"];
}

function actionLabels(kind: AssistantAction["kind"]): { tag: string; approve: string; reject: string } {
  const map: Partial<Record<AssistantAction["kind"], { tag: string; approve: string; reject: string }>> = {
    day_plan: { tag: "Plan", approve: "Aplicar plan", reject: "Soltar" },
    structured_note: { tag: "Guardado", approve: "Entendido", reject: "Soltar" },
    money_summary: { tag: "Dinero", approve: "Usar resumen", reject: "Soltar" },
    morning_brief: { tag: "Brief", approve: "Usar brief", reject: "Soltar" },
    meeting_brief: { tag: "ReuniÃ³n", approve: "Usar brief", reject: "Soltar" },
    decision_support: { tag: "DecisiÃ³n", approve: "Usar criterio", reject: "Soltar" },
    file_bundle: { tag: "Archivos", approve: "Preparar archivos", reject: "Soltar" },
    web_research: { tag: "Fuentes", approve: "Preparar busqueda", reject: "Soltar" },
    clarifying_question: { tag: "Pregunta", approve: "Responder", reject: "Soltar" },
    draft_message: { tag: "Borrador", approve: "Dejar listo", reject: "Soltar" },
    calendar_event: { tag: "Calendario", approve: "Crear evento", reject: "Soltar" },
    alarm: { tag: "Alarma", approve: "Crear alarma", reject: "Soltar" },
    reminder: { tag: "Recordatorio", approve: "Dejar visible", reject: "Soltar" },
    restock_note: { tag: "Nota", approve: "Guardar nota", reject: "Soltar" },
    daily_brief: { tag: "Plan", approve: "Aplicar", reject: "Soltar" },
  };
  return map[kind] ?? { tag: "Accion", approve: "Usar", reject: "Soltar" };
}

function actionToTurnItem(action: AssistantAction): KoruTurnItem {
  const labels = actionLabels(action.kind);
  const approveLabel = action.kind === "world_signal"
    ? "Traer radar"
    : action.kind === "web_research" && action.payload.webMode === "weather"
      ? "Buscar clima"
      : action.kind === "web_research" && action.payload.webMode === "news"
        ? "Traer noticias"
        : labels.approve;
  const stepTexts = action.payload.uiBlock
    ? (action.payload.steps ?? [])
    : action.payload.steps?.length
      ? action.payload.steps
      : defaultActionSteps(action.kind);
  const hasResolvedExternalResult = Boolean(
    action.payload.sources?.length ||
    action.payload.externalStatus === "verified" ||
    action.payload.externalStatus === "partial" ||
    action.payload.externalStatus === "failed" ||
    action.payload.externalStatus === "not_configured",
  );
  const isInformational = !action.approvalRequired && action.status === "proposed";
  const displayStatus = hasResolvedExternalResult || isInformational
    ? "executed"
    : action.status === "approved"
      ? "working"
      : action.status;
  return {
    id: action.id,
    kind: "action",
    tag: displayStatus === "executed" ? "Hecho" : labels.tag,
    text: action.title,
    status: displayStatus,
    result: action.result,
    payloadPreview: action.payload.draft ?? action.payload.note ?? action.payload.body ?? action.body,
    actionKind: action.kind,
    uiBlock: action.payload.uiBlock,
    approvalLabel: approveLabel,
    rejectLabel: labels.reject,
    steps: stepTexts.map((text) => ({
      text,
      status: displayStatus === "executed"
        ? "done"
        : displayStatus === "rejected"
          ? "waiting"
          : "waiting",
    })),
    files: action.payload.files,
    sources: action.payload.sources,
    planItems: action.payload.planItems,
    contextReview: action.payload.contextReview,
    questions: action.payload.questions,
    missingContext: action.payload.missingContext,
    searchQueries: action.payload.searchQueries,
    researchCriteria: action.payload.researchCriteria,
    records: action.payload.records,
    summaryItems: action.payload.summaryItems,
    totalAmount: action.payload.totalAmount,
    currency: action.payload.currency,
    recommendation: action.payload.recommendation,
    verifiedAt: action.payload.verifiedAt,
    externalStatus: action.payload.externalStatus,
    webMode: action.payload.webMode,
    comparisonItems: action.payload.comparisonItems,
    decisionVote: action.payload.decisionVote,
    decisionAssumption: action.payload.decisionAssumption,
  };
}

function patchUiBlockWithWebResult(action: AssistantAction, result: ReturnType<typeof webResultToPayload>): UiBlock | undefined {
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

function compactTurnItems(items: KoruTurnItem[]): KoruTurnItem[] {
  const actions = items.filter((item) => item.kind === "action");
  const hasStructured = actions.some((item) => item.actionKind === "structured_note");
  const hasPlan = actions.some((item) => item.actionKind === "day_plan");
  const hasQuestion = actions.some((item) => item.actionKind === "clarifying_question");
  const hasRestock = actions.some((item) => item.actionKind === "restock_note");
  const hasShoppingRecord = actions.some((item) =>
    item.actionKind === "structured_note" && item.records?.some((record) => record.kind === "shopping_item"),
  );
  const importantActions = actions.filter((item) => {
    if (hasStructured && !hasShoppingRecord && (item.actionKind === "reminder" || item.actionKind === "restock_note")) return false;
    if (hasShoppingRecord && item.actionKind === "reminder") return true;
    if (hasShoppingRecord && item.actionKind === "restock_note") return false;
    if (hasPlan && item.actionKind === "reminder") return false;
    return true;
  });
  const commitments = items.filter((item) => item.kind === "commitment" && !hasStructured && !hasPlan && !hasQuestion && !hasRestock);
  const memories = items.filter((item) => item.kind === "memory" && !hasStructured && !hasQuestion).slice(0, 1);
  return [...importantActions, ...commitments.slice(0, 1), ...memories].slice(0, 3);
}

function memoryToTurnItem(memory: MemoryFact): KoruTurnItem {
  return {
    id: memory.id,
    kind: "memory",
    tag: memory.status === "confirmed" ? "Guardado" : "Recuerdo",
    text: memory.text,
    status: memory.status === "confirmed" ? "confirmed" : memory.status === "rejected" ? "rejected" : "proposed",
    payloadPreview: memory.rootQuote,
    sourceId: memory.id,
  };
}

function actionConfirmationText(item: KoruTurnItem): string {
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
function isReadableFact(text: string): boolean {
  return text.trim().length > 3;
}

function recordKey(record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">): string {
  const normalize = (value?: string) => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return `${record.domain}|${record.kind}|${normalize(record.title)}|${normalize(record.value)}`;
}

function uiBlockWebMode(block: UiBlock): AssistantAction["payload"]["webMode"] | undefined {
  if (block.type === "weather") return "weather";
  if (block.type === "comparison") return "shopping";
  if (block.type === "research_sources") return block.mode ?? "research";
  if (block.type === "proactive_signal") {
    if (block.category === "world") return "world";
    if (block.category === "news") return "news";
    if (block.category === "weather") return "weather";
    if (block.category === "traffic") return "traffic";
    if (block.category === "market") return "market";
  }
  return undefined;
}

function uiBlockTitle(block: UiBlock): string {
  if ("title" in block && typeof block.title === "string" && block.title.trim()) return block.title.trim();
  if (block.type === "weather") return block.city ? `Clima en ${block.city}` : "Clima";
  if (block.type === "comparison") return "Comparativa";
  if (block.type === "research_sources") return "Fuentes";
  if (block.type === "saved_record") return "Guardado";
  if (block.type === "money_summary") return "Dinero";
  if (block.type === "proactive_signal") return block.title;
  return "Koru";
}

function uiBlockBody(block: UiBlock): string {
  if (block.type === "clarifying_question") return block.question;
  if (block.type === "weather") return block.advice ?? "Clima consultado.";
  if (block.type === "reminder") return [block.dueText, block.note].filter(Boolean).join(" - ") || block.title;
  if (block.type === "alarm") return [block.time, block.note].filter(Boolean).join(" - ");
  if (block.type === "shopping_list") return block.items.join(", ");
  if (block.type === "plan") return block.note ?? `${block.items.length} paso(s) preparados.`;
  if (block.type === "comparison") return block.recommendation ?? `${block.items.length} opcion(es) comparadas.`;
  if (block.type === "research_sources") return block.summary;
  if (block.type === "money_summary") return block.recommendation ?? "Resumen listo.";
  if (block.type === "saved_record") return `${block.records.length} dato(s) guardados.`;
  if (block.type === "proactive_signal") return block.body;
  if (block.type === "activity_group") return block.subtitle ?? block.note ?? block.title;
  if (block.type === "resource_bundle") return block.summary ?? `${block.files.length} archivo(s).`;
  return "Listo.";
}

function uiBlockExternalStatus(block: UiBlock): AssistantAction["payload"]["externalStatus"] | undefined {
  if (block.type === "weather" || block.type === "research_sources" || block.type === "proactive_signal") return block.sourceStatus;
  return undefined;
}

function uiBlockSources(block: UiBlock): AssistantSource[] | undefined {
  if (block.type === "weather" || block.type === "research_sources" || block.type === "comparison" || block.type === "proactive_signal") return block.sources;
  return undefined;
}

function uiBlockRecords(block: UiBlock): Array<Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">> | undefined {
  if (block.type === "saved_record") return block.records;
  if (block.type === "shopping_list") {
    return block.items.map((item) => ({
      domain: "home" as const,
      kind: "shopping_item" as const,
      title: item,
      value: item,
      collection: block.title,
      dueHint: block.dueText,
      notes: block.note,
    }));
  }
  return undefined;
}

function uiBlockToAction(block: UiBlock, entryId: string, createdAt: string): AssistantAction {
  const kind = actionKindForUiBlock(block);
  const sources = uiBlockSources(block);
  const title = uiBlockTitle(block);
  const body = uiBlockBody(block);
  const approvalRequired = false;
  const status: AssistantAction["status"] = "executed";
  return {
    id: createId("act"),
    kind,
    title,
    body,
    status,
    approvalRequired,
    createdAt,
    updatedAt: createdAt,
    executedAt: status === "executed" ? createdAt : undefined,
    sourceEntryId: entryId,
    payload: {
      title,
      body,
      uiBlock: block,
      webMode: uiBlockWebMode(block),
      sources,
      externalStatus: uiBlockExternalStatus(block) ?? (sources?.length ? "verified" : undefined),
      planItems: block.type === "plan" ? block.items : undefined,
      comparisonItems: block.type === "comparison" ? block.items : undefined,
      records: uiBlockRecords(block),
      summaryItems: block.type === "money_summary" ? block.summaryItems : block.type === "proactive_signal" ? block.summaryItems : undefined,
      totalAmount: block.type === "money_summary" ? block.total : undefined,
      currency: block.type === "money_summary" ? block.currency : undefined,
      recommendation: block.type === "comparison" ? block.recommendation : block.type === "money_summary" ? block.recommendation : undefined,
      dueHint: block.type === "reminder" ? block.dueText : block.type === "shopping_list" ? block.dueText : undefined,
      note: "note" in block ? block.note : undefined,
    },
    result: status === "executed" ? body : undefined,
  };
}

function typeToAssistantKind(type?: string): AssistantAction["kind"] {
  if (!type) return "structured_note";
  if (type === "alarm_context") return "alarm";
  if (type === "health_followup" || type === "routine_reminder") return "reminder";
  if (type === "meeting_prep") return "meeting_brief";
  if (type === "subscription_tagging" || type === "transport_tagging") return "money_summary";
  if (type === "metadata_extraction" || type === "save_location") return "structured_note";
  if (type === "meal_suggestion") return "day_plan";
  if (type === "person_followup") return "structured_note";
  return "clarifying_question";
}

function suggestedActionToAssistantAction(
  sa: KoruSuggestedAction,
  entryId: string,
  createdAt: string,
): AssistantAction {
  const kind = typeToAssistantKind(sa.payload?.enhancementType as string | undefined);
  const uiBlock = sa.payload?.uiBlock as UiBlock | undefined;

  return {
    id: sa.id,
    kind,
    title: sa.label,
    body: sa.label,
    status: sa.requiresApproval ? "proposed" : "executed",
    approvalRequired: sa.requiresApproval,
    createdAt,
    updatedAt: createdAt,
    executedAt: sa.requiresApproval ? undefined : createdAt,
    sourceEntryId: entryId,
    payload: {
      title: sa.label,
      body: sa.label,
      uiBlock,
      ...sa.payload,
    },
    result: sa.requiresApproval ? undefined : sa.label,
  };
}

function createBackendEntry(
  text: string,
  transcriptSource: DailyEntry["transcriptSource"],
  result: KoruBackendTurnResponse,
  entryId: string,
  createdAt: string,
  memoryIds: string[],
  commitmentIds: string[],
  actionIds: string[],
  recordIds: string[],
): DailyEntry {
  return {
    id: entryId,
    text,
    createdAt,
    summary: result.understanding.userGoal || result.reply,
    transcriptSource,
    energyAwarded: Math.max(6, Math.min(18, 8 + result.uiBlocks.length * 2 + result.toolResults.length * 2)),
    sentiment: "calm",
    memoryIds,
    commitmentIds,
    actionIds,
    recordIds,
    activeMemoryIds: [],
    brainProvider: result.provider,
    brainModel: result.model ?? result.provider,
  };
}

function applyBackendTurnToState(
  state: KoruState,
  text: string,
  transcriptSource: DailyEntry["transcriptSource"],
  result: KoruBackendTurnResponse,
): { state: KoruState; items: KoruTurnItem[]; entry: DailyEntry } {
  const createdAt = new Date().toISOString();
  const entryId = createId("entry");
  const memories: MemoryFact[] = state.ephemeralMode || !state.durableMemoryEnabled
    ? []
    : result.memoryCandidates
        .filter((candidate) => isReadableFact(candidate.text))
        .map((candidate) => ({
          ...candidate,
          id: createId("mem"),
          createdAt,
          sourceEntryId: entryId,
          status: candidate.status ?? "candidate",
          sensitivity: candidate.sensitivity ?? "normal",
          confidence: candidate.confidence ?? 0.7,
          useForSuggestions: candidate.useForSuggestions ?? candidate.sensitivity !== "sensitive",
        }));
  const commitments: Commitment[] = state.ephemeralMode
    ? []
    : result.commitments
        .filter((candidate) => isReadableFact(candidate.title))
        .map((candidate) => ({
          ...candidate,
          id: createId("commit"),
          createdAt,
          sourceEntryId: entryId,
          dueHint: candidate.dueHint || "sin fecha",
          status: "open",
        }));
  const blockRecords = result.uiBlocks.flatMap((block) => uiBlockRecords(block) ?? []);
  const uniqueRecordCandidates = [...result.records, ...blockRecords].filter((record, index, list) =>
    list.findIndex((candidate) => recordKey(candidate) === recordKey(record)) === index,
  );
  const records: LifeRecord[] = state.ephemeralMode
    ? []
    : uniqueRecordCandidates
        .filter((record) => isReadableFact(record.title))
        .map((record) => ({
          ...record,
          id: createId("rec"),
          createdAt,
          sourceEntryId: entryId,
        }));
  const actions = result.uiBlocks.map((block) => uiBlockToAction(block, entryId, createdAt));
  const suggestedActions = result.suggestedActions.map((sa) => suggestedActionToAssistantAction(sa, entryId, createdAt));
  const allActions = [...actions, ...suggestedActions];
  const items = compactTurnItems([
    ...allActions.map(actionToTurnItem),
    ...commitments.slice(0, 3).map((commitment): KoruTurnItem => ({
      id: commitment.id,
      kind: "commitment",
      tag: "Pendiente",
      text: commitment.title,
      status: "open",
      payloadPreview: commitment.dueHint,
      sourceId: commitment.id,
    })),
    ...memories.slice(0, 2).map(memoryToTurnItem),
  ]);
  const entry = createBackendEntry(
    text,
    transcriptSource,
    result,
    entryId,
    createdAt,
    memories.map((memory) => memory.id),
    commitments.map((commitment) => commitment.id),
    allActions.map((action) => action.id),
    records.map((record) => record.id),
  );
  const energyEvent: EnergyEvent = {
    id: createId("energy"),
    createdAt,
    source: "backend_agent_turn",
    points: entry.energyAwarded,
    explanation: "Turno resuelto por loop de agente con herramientas y bloques UI.",
  };
  const modelCall: ModelCall = {
    id: createId("call"),
    createdAt,
    taskType: "reflection_analysis",
    provider: result.provider,
    model: result.model ?? result.provider,
    success: true,
    latencyMs: 0,
    summary: `${result.provider}${result.fallbackReason ? " fallback" : ""}: ${result.understanding.userGoal}`,
    error: result.fallbackReason,
  };
  const next: KoruState = {
    ...state,
    totalEnergy: state.totalEnergy + entry.energyAwarded,
    trustedEnergy: state.trustedEnergy + Math.round(entry.energyAwarded * (state.ephemeralMode ? 0.35 : 0.6)),
    entries: state.ephemeralMode ? state.entries : [entry, ...state.entries],
    memories: [...memories, ...state.memories],
    commitments: [...commitments, ...state.commitments],
    actions: [...allActions, ...state.actions],
    records: [...records, ...state.records].slice(0, 500),
    energyEvents: state.ephemeralMode ? state.energyEvents : [energyEvent, ...state.energyEvents],
    modelCalls: [modelCall, ...state.modelCalls].slice(0, 120),
    updatedAt: createdAt,
  };
  next.stage = domainStageFor(next);
  saveState(next);
  return { state: next, items, entry };
}

type KoruContextValue = {
  energy: number;
  roots: number;
  stage: Stage;
  userName: string;
  onboarded: boolean;
  ephemeral: boolean;
  priorities: Priority[];
  memories: Memory[];
  history: HistoryEntry[];
  permissions: Permission[];
  processing: boolean;
  activity: AgentActivity | null;
  chatTurns: KoruChatTurn[];
  completeOnboarding: (name: string, facts?: string[]) => void;
  togglePriority: (id: string) => void;
  confirmMemory: (id: string) => void;
  pruneMemory: (id: string) => void;
  editMemory: (id: string, text: string) => void;
  toggleMemoryUse: (id: string) => void;
  completeCommitment: (id: string) => void;
  togglePermission: (id: string) => void;
  setEphemeral: (v: boolean) => void;
  logRitual: (count: number) => void;
  submitEntry: (text: string, transcriptSource?: DailyEntry["transcriptSource"], history?: KoruChatTurn[]) => Promise<{ response: string; items: KoruTurnItem[]; state: KoruState; mascotState?: MascotState }>;
  sendMessage: (text: string, transcriptSource?: DailyEntry["transcriptSource"]) => Promise<KoruChatTurn | null>;
  reviewAction: (id: string, approve: boolean) => KoruTurnItem | null;
  toggleTurnLike: (id: string) => void;
  dismissNudge: (id: string) => void;
  setWorldSignals: (enabled: boolean) => void;
};

const KoruContext = createContext<KoruContextValue | null>(null);

export function KoruProvider({ children }: { children: ReactNode }) {
  const [domainState, setDomainState] = useState<KoruState>(() => createInitialState());
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("koru.onboarded") === "true");
  const [userName, setUserName] = useState(() => localStorage.getItem("koru.username") ?? "");
  const [processing, setProcessing] = useState(false);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [chatTurns, setChatTurns] = useState<KoruChatTurn[]>(() => readChatTurns(localStorage.getItem("koru.username") ?? ""));
  const domainStateRef = useRef(domainState);
  const chatTurnsRef = useRef(chatTurns);

  function commitDomainState(next: KoruState | ((prev: KoruState) => KoruState)) {
    setDomainState((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: KoruState) => KoruState)(prev) : next;
      domainStateRef.current = resolved;
      return resolved;
    });
  }

  function commitChatTurns(next: KoruChatTurn[] | ((prev: KoruChatTurn[]) => KoruChatTurn[])) {
    setChatTurns((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: KoruChatTurn[]) => KoruChatTurn[])(prev) : next;
      chatTurnsRef.current = resolved;
      return resolved;
    });
  }

  useEffect(() => {
    domainStateRef.current = domainState;
  }, [domainState]);

  useEffect(() => {
    chatTurnsRef.current = chatTurns;
  }, [chatTurns]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("koruAudit") !== "1" || params.get("reset") !== "1") return;
      const sessionId = `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(AUDIT_FLAG_KEY, "1");
      sessionStorage.setItem(AUDIT_SESSION_KEY, sessionId);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem("koru.onboarded");
      localStorage.removeItem("koru.username");
      const fresh = resetState();
      commitDomainState(fresh);
      setOnboarded(false);
      setUserName("");
      commitChatTurns([greetingTurn()]);
      params.delete("reset");
      const cleanQuery = params.toString();
      const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", cleanUrl);
      writeAuditEvent({
        type: "audit_reset",
        note: "Koru browser memory, onboarding and chat reset for manual audit.",
        state: auditStateSnapshot(fresh),
      });
    } catch {
      // Audit reset is best-effort and should not block the app.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPersistedState().then((persisted) => {
      if (!cancelled) {
        const nudges = buildHeartbeatNudges(persisted);
        commitDomainState(nudges.length > 0 ? applyHeartbeatNudges(persisted, nudges) : persisted);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const runHeartbeat = () => {
      commitDomainState((prev) => {
        const nudges = buildHeartbeatNudges(prev);
        return nudges.length > 0 ? applyHeartbeatNudges(prev, nudges) : prev;
      });
    };
    const timer = window.setInterval(runHeartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    saveChatTurns(chatTurns, !domainState.ephemeralMode);
  }, [chatTurns, domainState.ephemeralMode]);

  const energy = domainState.trustedEnergy;
  const roots = domainState.memories.filter((m) => m.status === "confirmed").length;
  const stage = domainStageToNew(domainState.stage);
  const ephemeral = domainState.ephemeralMode;

  const priorities: Priority[] = useMemo(() => {
    const actionItems = domainState.actions
      .filter((a) => a.status === "executed")
      .slice(0, 1)
      .map((a) => ({
        id: a.id,
        label: a.title,
        detail: a.result,
        done: true,
        kind: "action" as const,
      }));
    const nudgeItems = domainState.nudges
      .filter((nudge) => !nudge.dismissed)
      .slice(0, 2)
      .map((nudge) => ({
        id: nudge.id,
        label: nudge.title,
        detail: nudge.body || nudge.reason,
        done: false,
        kind: "nudge" as const,
      }));
    const commitments = domainState.commitments
      .filter((c) => c.status === "open")
      .map((c) => ({
        id: c.id,
        label: c.title,
        detail: dueLabel(c.dueAt, c.dueHint),
        done: false,
        kind: "commitment" as const,
      }))
      .slice(0, Math.max(0, 5 - actionItems.length - nudgeItems.length));
    return [...actionItems, ...nudgeItems, ...commitments];
  }, [domainState.actions, domainState.commitments, domainState.nudges]);

  const memories: Memory[] = useMemo(() =>
    domainState.memories
      .filter((m) => m.status !== "rejected")
      .map((m) => ({
        id: m.id,
        text: m.text,
        status: domainStatusToMemoryStatus(m),
        category: domainKindToCategory(m.kind),
        origin: m.rootQuote || "ExtraÃ­do de tu conversaciÃ³n reciente.",
        useForSuggestions: m.useForSuggestions !== false,
        savedOn: m.status === "confirmed" && m.confirmedAt
          ? `Confirmado Â· ${new Date(m.confirmedAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}`
          : m.status === "candidate"
            ? "Por confirmar Â· pendiente"
            : `Reciente Â· ${new Date(m.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}`,
      })),
  [domainState.memories]);

  const history: HistoryEntry[] = useMemo(() => {
    const entries: HistoryEntry[] = [];
    for (const entry of domainState.entries.slice(0, 20)) {
      entries.push({
        id: entry.id,
        time: new Date(entry.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
        kind: "check-in",
        title: "Check-in",
        detail: entry.summary || entry.text.slice(0, 100),
        reason: entry.sentiment === "heavy" ? "Estado cargado" : entry.sentiment === "good" ? "Estado positivo" : "Rutina diaria",
        energy: entry.energyAwarded,
      });
    }
    for (const action of domainState.actions.filter((a) => a.status === "executed").slice(0, 20)) {
      entries.push({
        id: action.id,
        time: new Date(action.executedAt ?? action.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
        kind: "cierre",
        title: action.title,
        detail: action.result ?? action.body,
        reason: "Accion aprobada y ejecutada por Koru",
        energy: 14,
      });
    }
    return entries.slice(0, 30);
  }, [domainState.actions, domainState.entries]);

  const permissions: Permission[] = useMemo(() => [
    {
      id: "perm1",
      title: "Memoria duradera",
      description: "Guardar lo que aprende de ti, siempre editable.",
      enabled: domainState.durableMemoryEnabled && !domainState.ephemeralMode,
    },
    { id: "perm2", title: "Check-ins suaves", description: "Recordatorios proactivos en horas activas.", enabled: domainState.heartbeat.enabled },
    { id: "perm3", title: "Acciones autÃ³nomas", description: "Preparar borradores y eventos (requiere aprobaciÃ³n).", enabled: domainState.actionPreparationEnabled },
    { id: "perm-world", title: "Radar del mundo", description: "Traer seÃ±ales recientes cuando puedan servirte.", enabled: domainState.worldSignalsEnabled },
    { id: "perm4", title: "Modo efÃ­mero", description: "No guardar memoria de esta sesiÃ³n.", enabled: domainState.ephemeralMode },
  ], [domainState.actionPreparationEnabled, domainState.durableMemoryEnabled, domainState.ephemeralMode, domainState.heartbeat.enabled, domainState.worldSignalsEnabled]);

  function completeOnboarding(name: string, facts: string[] = []) {
    const cleanName = name.trim() || "amigo";
    const previousState = domainStateRef.current;
    setUserName(cleanName);
    setOnboarded(true);
    localStorage.setItem("koru.onboarded", "true");
    localStorage.setItem("koru.username", cleanName);
    commitChatTurns((prev) => {
      if (prev.length === 0) return [greetingTurn(cleanName)];
      if (prev.length === 1 && prev[0].role === "koru") {
        return [{ ...prev[0], text: `Hola, ${cleanName}. Cuéntame cómo estás.` }];
      }
      return prev;
    });
    commitDomainState((prev) => {
      const withName = { ...prev, userName: cleanName };
      const next = facts.length ? addOnboardingMemories(withName, facts) : withName;
      if (!facts.length) saveState(next);
      writeAuditEvent({
        type: "onboarding_completed",
        name: cleanName,
        facts,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(previousState, next),
      });
      return next;
    });
  }

  function togglePriority(id: string) {
    commitDomainState((prev) => {
      if (prev.nudges.some((nudge) => nudge.id === id && !nudge.dismissed)) {
        return dismissNudge(prev, id);
      }
      return completeCommitment(prev, id);
    });
  }

  function completeCommitmentInChat(id: string) {
    commitDomainState((prev) => {
      const next = completeCommitment(prev, id);
      writeAuditEvent({
        type: "commitment_completed",
        commitmentId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) =>
          item.id === id && item.kind === "commitment" ? { ...item, status: "executed", tag: "Hecho" } : item,
        ),
      })),
    );
    const confirmation: KoruChatTurn = {
      id: createId("turn"),
      role: "koru",
      text: "Listo. Lo marco como hecho y lo saco de tu carga mental.",
      createdAt: new Date().toISOString(),
      status: "done",
    };
    commitChatTurns((prev) => [...prev, confirmation].slice(-120));
  }

  function confirmMemory(id: string) {
    commitDomainState((prev) => {
      const next = confirmMemoryInStore(prev, id);
      writeAuditEvent({
        type: "memory_confirmed",
        memoryId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) =>
          item.id === id && item.kind === "memory" ? { ...item, status: "confirmed", tag: "Guardado" } : item,
        ),
      })),
    );
  }

  function pruneMemory(id: string) {
    commitDomainState((prev) => {
      const next = rejectMemory(prev, id);
      writeAuditEvent({
        type: "memory_rejected",
        memoryId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) =>
          item.id === id && item.kind === "memory" ? { ...item, status: "rejected", tag: "Soltado" } : item,
        ),
      })),
    );
  }

  function editMemory(id: string, text: string) {
    commitDomainState((prev) => {
      const next = updateMemoryText(prev, id, text);
      writeAuditEvent({
        type: "memory_edited",
        memoryId: id,
        text,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) => (item.id === id && item.kind === "memory" ? { ...item, text } : item)),
      })),
    );
  }

  function toggleMemoryUse(id: string) {
    commitDomainState((prev) => {
      const next = toggleMemorySuggestions(prev, id);
      writeAuditEvent({
        type: "memory_usage_toggled",
        memoryId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
  }

  function togglePermission(id: string) {
    if (id === "perm1") {
      commitDomainState((prev) => setDurableMemoryEnabled(prev, !(prev.durableMemoryEnabled && !prev.ephemeralMode)));
      return;
    }
    if (id === "perm2") {
      commitDomainState((prev) => setHeartbeatEnabled(prev, !prev.heartbeat.enabled));
      return;
    }
    if (id === "perm3") {
      commitDomainState((prev) => setActionPreparationEnabled(prev, !prev.actionPreparationEnabled));
      return;
    }
    if (id === "perm-world") {
      setWorldSignals(!domainStateRef.current.worldSignalsEnabled);
      return;
    }
    if (id === "perm4" || id === "ephemeral") {
      setEphemeral(!domainStateRef.current.ephemeralMode);
    }
  }

  function setWorldSignals(enabled: boolean) {
    commitDomainState((prev) => {
      const next = setWorldSignalsEnabled(prev, enabled);
      writeAuditEvent({
        type: "world_signals_toggled",
        enabled,
        state: auditStateSnapshot(next),
      });
      return next;
    });
    appendKoruConfirmation(
      enabled
        ? "Listo. Te voy a traer este radar solo cuando haya senales utiles."
        : "Listo. No te lo traigo proactivamente por ahora.",
    );
  }

  function setEphemeral(v: boolean) {
    if (v !== domainStateRef.current.ephemeralMode) {
      if (!v) {
        commitChatTurns([greetingTurn(userName)]);
      }
      commitDomainState((prev) => {
        const next = toggleEphemeralMode(prev);
        const resolved = !next.ephemeralMode && !next.durableMemoryEnabled ? setDurableMemoryEnabled(next, true) : next;
        writeAuditEvent({
          type: "ephemeral_mode_toggled",
          enabled: resolved.ephemeralMode,
          state: auditStateSnapshot(resolved),
        });
        return resolved;
      });
    }
  }

  function logRitual(_count: number) {
    // Energy is already awarded via submitReflection
  }

  async function submitEntry(
    text: string,
    transcriptSource: DailyEntry["transcriptSource"] = "typed",
    history: KoruChatTurn[] = chatTurnsRef.current,
  ) {
    setProcessing(true);
    let koruTurnId: string | null = null;
    try {
      const previousState = domainStateRef.current;
      const domainHistory = history
        .filter((turn) => turn.text.trim().length > 0)
        .slice(-12)
        .map((turn) => ({
          role: turn.role === "koru" ? ("assistant" as const) : ("user" as const),
          content: turn.text,
          createdAt: turn.createdAt,
        }));
      const agentResult = await runBackendAgentTurn(text, previousState, domainHistory, (chunk) => {
        const blocksToItems = (blocks: UiBlock[]): KoruTurnItem[] =>
          blocks.map((block) => ({
            id: createId("item"),
            kind: "action" as const,
            tag: block.type,
            text: (block as any).title ?? (block as any).query ?? "",
            status: "working" as const,
            uiBlock: block,
          }));
        if (!koruTurnId) {
          koruTurnId = createId("turn");
          const koruTurn: KoruChatTurn = {
            id: koruTurnId,
            role: "koru",
            text: chunk.reply,
            createdAt: new Date().toISOString(),
            items: blocksToItems(chunk.uiBlocks),
            status: "working" as const,
            mascotState: chunk.mascotState ?? "working",
          };
          commitChatTurns((prev) => [...prev, koruTurn].slice(-120));
        } else {
          const isDone = chunk.stateEvents?.some((e) => e.kind === "done");
          commitChatTurns((prev) =>
            prev.map((turn) =>
              turn.id === koruTurnId
                ? {
                    ...turn,
                    text: chunk.reply,
                    items: blocksToItems(chunk.uiBlocks),
                    mascotState: chunk.mascotState ?? turn.mascotState,
                    status: isDone ? ("done" as const) : ("working" as const),
                  }
                : turn,
            ),
          );
        }
      });
      const result = applyBackendTurnToState(previousState, text, transcriptSource, agentResult);
      commitDomainState(result.state);
      if (koruTurnId) {
        commitChatTurns((prev) =>
          prev.map((turn) =>
            turn.id === koruTurnId
              ? { ...turn, text: agentResult.reply, items: result.items, status: "done" as const, mascotState: agentResult.mascotState ?? "idle" }
              : turn,
          ),
        );
      }
      writeAuditEvent({
        type: "turn_analyzed",
        engine: "backend_agent_loop",
        input: text,
        transcriptSource,
        historyUsed: domainHistory,
        response: agentResult.reply,
        understanding: agentResult.understanding,
        suggestedActions: agentResult.suggestedActions,
        toolResults: agentResult.toolResults,
        provider: agentResult.provider,
        model: agentResult.model,
        fallbackReason: agentResult.fallbackReason,
        items: auditTurnItems(result.items),
        state: auditStateSnapshot(result.state),
        delta: auditStateDelta(previousState, result.state),
      });
      return { response: agentResult.reply, items: result.items, state: result.state, mascotState: agentResult.mascotState, koruTurnId };
    } finally {
      setProcessing(false);
      setActivity(null);
    }
  }

  async function sendMessage(text: string, transcriptSource: DailyEntry["transcriptSource"] = "typed") {
    const cleanText = text.trim();
    if (!cleanText) return null;
    const previousState = domainStateRef.current;
    const userTurn: KoruChatTurn = {
      id: createId("turn"),
      role: "user",
      text: cleanText,
      createdAt: new Date().toISOString(),
      status: "done",
    };
    const historyBeforeUser = chatTurnsRef.current;
    commitChatTurns((prev) => [...prev, userTurn].slice(-120));
    writeAuditEvent({
      type: "user_message",
      turn: userTurn,
      transcriptSource,
      historyBeforeUser: historyBeforeUser.map((turn) => ({
        id: turn.id,
        role: turn.role,
        text: turn.text,
        createdAt: turn.createdAt,
        status: turn.status,
        items: auditTurnItems(turn.items),
      })),
      stateBefore: auditStateSnapshot(previousState),
    });
    setActivity(inferActivity(cleanText));
    try {
      const result = await submitEntry(cleanText, transcriptSource, historyBeforeUser);
      if (!result.koruTurnId) {
        const koruTurn: KoruChatTurn = {
          id: createId("turn"),
          role: "koru",
          text: result.response,
          createdAt: new Date().toISOString(),
          items: result.items,
          status: "done",
          mascotState: result.mascotState ?? "idle",
        };
        commitChatTurns((prev) => [...prev, koruTurn].slice(-120));
        writeAuditEvent({
          type: "koru_message",
          turn: {
            id: koruTurn.id,
            role: koruTurn.role,
            text: koruTurn.text,
            createdAt: koruTurn.createdAt,
            status: koruTurn.status,
            items: auditTurnItems(koruTurn.items),
          },
          stateAfter: auditStateSnapshot(result.state),
        });
      } else {
        commitChatTurns((prev) =>
          prev.map((turn) =>
            turn.id === result.koruTurnId
              ? { ...turn, items: result.items, status: "done" as const, mascotState: result.mascotState ?? "idle" }
              : turn,
          ),
        );
        writeAuditEvent({
          type: "koru_message",
          turn: {
            id: result.koruTurnId,
            role: "koru",
            text: result.response,
            createdAt: new Date().toISOString(),
            status: "done",
            items: auditTurnItems(result.items),
          },
          stateAfter: auditStateSnapshot(result.state),
        });
      }
      const autoWebAction = result.state.actions
        .filter((action) => !previousState.actions.some((existing) => existing.id === action.id))
        .find(shouldAutoRunAction);
      if (autoWebAction) {
        window.setTimeout(() => runReadonlyWebAction(autoWebAction), 0);
      }
      return koruTurn;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallo desconocido del agente.";
      const errorTurn: KoruChatTurn = {
        id: createId("turn"),
        role: "koru",
        text: `No pude contactar bien al agente ahora. No voy a inventarte una respuesta. Detalle: ${message}`,
        createdAt: new Date().toISOString(),
        status: "error",
      };
      commitChatTurns((prev) => [...prev, errorTurn].slice(-120));
      writeAuditEvent({
        type: "turn_error",
        input: cleanText,
        error: message,
        turn: errorTurn,
        state: auditStateSnapshot(domainStateRef.current),
      });
      setActivity(null);
      return errorTurn;
    }
  }

  function replaceActionInChat(item: KoruTurnItem) {
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((existing) => (existing.id === item.id ? item : existing)),
      })),
    );
  }

  function appendKoruConfirmation(text: string) {
    const confirmation: KoruChatTurn = {
      id: createId("turn"),
      role: "koru",
      text,
      createdAt: new Date().toISOString(),
      status: "done",
    };
    commitChatTurns((prev) => [...prev, confirmation].slice(-120));
    writeAuditEvent({
      type: "koru_confirmation",
      turn: confirmation,
      state: auditStateSnapshot(domainStateRef.current),
    });
  }

  function runReadonlyWebAction(original: AssistantAction): KoruTurnItem {
    setActivity({
      kind: "searching",
      label: original.kind === "world_signal" ? "Busco senales reales." : "Consulto fuentes reales.",
    });
    const now = new Date().toISOString();
    const approvedAction: AssistantAction = {
      ...original,
      status: "approved",
      updatedAt: now,
    };
    commitDomainState((prev) => {
      const exists = prev.actions.some((action) => action.id === original.id);
      const next = {
        ...prev,
        actions: exists
          ? prev.actions.map((action) => (action.id === original.id ? approvedAction : action))
          : [approvedAction, ...prev.actions],
        updatedAt: now,
      };
      saveState(next);
      return next;
    });
    const waitingItem = actionToTurnItem(approvedAction);
    replaceActionInChat(waitingItem);

    void (async () => {
      try {
        const result = await runWebNavigation(original.payload);
        const webPayload = webResultToPayload(result);
        const nextUiBlock = patchUiBlockWithWebResult(approvedAction, webPayload);
        const finishedAt = new Date().toISOString();
        const patchedAction: AssistantAction = {
          ...approvedAction,
          payload: {
            ...approvedAction.payload,
            ...webPayload,
            uiBlock: nextUiBlock ?? approvedAction.payload.uiBlock,
          },
          result: result.recommendation,
          status: "executed",
          updatedAt: finishedAt,
          executedAt: finishedAt,
        };
        const patchedItem = actionToTurnItem(patchedAction);
        commitDomainState((prev) => {
          const next = {
            ...prev,
            actions: prev.actions.map((action) => (action.id === original.id ? patchedAction : action)),
            updatedAt: finishedAt,
          };
          saveState(next);
          writeAuditEvent({
            type: "readonly_web_action_finished",
            action: {
              id: patchedAction.id,
              kind: patchedAction.kind,
              title: patchedAction.title,
              status: patchedAction.status,
              result: patchedAction.result,
              payload: patchedAction.payload,
            },
            item: auditTurnItems([patchedItem])[0],
            state: auditStateSnapshot(next),
            delta: auditStateDelta(prev, next),
          });
          return next;
        });
        replaceActionInChat(patchedItem);
      } finally {
        setActivity(null);
      }
    })();
    return waitingItem;
  }

  function reviewAction(id: string, approve: boolean): KoruTurnItem | null {
    const currentState = domainStateRef.current;
    const original = currentState.actions.find((action) => action.id === id);
    if (approve && (original?.kind === "web_research" || original?.kind === "world_signal")) {
      return runReadonlyWebAction(original);
    }

    const nextState = approve ? approveAndExecuteAction(currentState, id) : rejectAction(currentState, id);
    const reviewed = nextState.actions.find((action) => action.id === id);
    if (!reviewed) return null;
    commitDomainState(nextState);
    const item = actionToTurnItem(reviewed);
    replaceActionInChat(item);
    writeAuditEvent({
      type: "action_reviewed",
      actionId: id,
      approved: approve,
      item: auditTurnItems([item])[0],
      state: auditStateSnapshot(nextState),
      delta: auditStateDelta(currentState, nextState),
    });
    appendKoruConfirmation(approve ? actionConfirmationText(item) : "Lo suelto. No hice nada con eso.");

    return item;
  }

  function toggleTurnLike(id: string) {
    commitChatTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, liked: !turn.liked } : turn)));
  }

  const value = useMemo<KoruContextValue>(() => ({
    energy,
    roots,
    stage,
    userName,
    onboarded,
    ephemeral,
    priorities,
    memories,
    history,
    permissions,
    processing,
    activity,
    chatTurns,
    completeOnboarding,
    togglePriority,
    confirmMemory,
    pruneMemory,
    editMemory,
    toggleMemoryUse,
    completeCommitment: completeCommitmentInChat,
    togglePermission,
    setEphemeral,
    logRitual,
    submitEntry,
    sendMessage,
    reviewAction,
    toggleTurnLike,
    setWorldSignals,
    dismissNudge: (id: string) => commitDomainState((prev) => dismissNudge(prev, id)),
  }), [energy, roots, stage, userName, onboarded, ephemeral, priorities, memories, history, permissions, processing, activity, chatTurns]);

  return <KoruContext.Provider value={value}>{children}</KoruContext.Provider>;
}

export function useKoru() {
  const ctx = useContext(KoruContext);
  if (!ctx) throw new Error("useKoru must be used within KoruProvider");
  return ctx;
}

