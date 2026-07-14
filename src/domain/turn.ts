import { createId, saveState, stageFor } from "./store";
import { actionKindForUiBlock } from "./toolRegistry";
import type {
  AssistantAction,
  AssistantArtifact,
  AssistantPlanItem,
  AssistantSource,
  Commitment,
  DailyEntry,
  EnergyEvent,
  KoruState,
  LifeRecord,
  MascotState,
  MemoryFact,
  ModelCall,
  UiBlock,
} from "./types";
import type { KoruBackendTurnResponse, KoruSuggestedAction } from "./backendAgentClient";

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

function defaultActionSteps(kind: AssistantAction["kind"]): string[] {
  const map: Partial<Record<AssistantAction["kind"], string[]>> = {
    day_plan: ["Leí tu pedido", "Revisé pendientes", "Agrupé por prioridad", "Preparé una propuesta"],
    structured_note: ["Guardado", "Clasificado", "Disponible para usar después"],
    money_summary: ["Revisé gastos", "Calculé el total", "Preparé criterio de decisión"],
    morning_brief: ["Revisé agenda", "Crucé pendientes", "Separé lo sabido de lo que falta"],
    meeting_brief: ["Revisé contexto", "Agrupé temas", "Preparé agenda"],
    decision_support: ["Leí el costo", "Comparé con contexto", "Separé recomendación de supuesto"],
    file_bundle: ["Analicé requerimientos", "Ordené entregables", "Generé archivos", "Dejé revisión lista"],
    web_research: ["Definí búsqueda", "Preparé fuentes", "Ordené opciones", "Dejé el siguiente paso"],
    clarifying_question: ["Revisé contexto", "Detecté datos faltantes", "Preparé preguntas útiles"],
    draft_message: ["Entendí el contexto", "Preparé borrador", "Lo dejé para revisar"],
    calendar_event: ["Leí horario", "Preparé evento", "Espero tu visto bueno"],
    alarm: ["Leí la hora", "Preparé la alarma", "Espero tu visto bueno"],
    reminder: ["Detecte pendiente", "Lo deje visible", "Espero tu visto bueno"],
    restock_note: ["Revisé pedido", "Preparé nota", "Espero tu visto bueno"],
    daily_brief: ["Ordené lo importante", "Reduje el ruido", "Preparé un cierre"],
  };
  return map[kind] ?? ["Entendi el pedido", "Prepare una respuesta concreta", "Deje el siguiente paso visible"];
}

function actionLabels(kind: AssistantAction["kind"]): { tag: string; approve: string; reject: string } {
  const map: Partial<Record<AssistantAction["kind"], { tag: string; approve: string; reject: string }>> = {
    day_plan: { tag: "Plan", approve: "Aplicar plan", reject: "Soltar" },
    structured_note: { tag: "Guardado", approve: "Entendido", reject: "Soltar" },
    money_summary: { tag: "Dinero", approve: "Usar resumen", reject: "Soltar" },
    morning_brief: { tag: "Brief", approve: "Usar brief", reject: "Soltar" },
    meeting_brief: { tag: "Reunión", approve: "Usar brief", reject: "Soltar" },
    decision_support: { tag: "Decisión", approve: "Usar criterio", reject: "Soltar" },
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

export function actionToTurnItem(action: AssistantAction): KoruTurnItem {
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
  if (block.type === "data_card") return `${block.items.length} dato(s) verificado(s) de la web.`;
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
      summaryItems: block.type === "money_summary"
        ? block.summaryItems
        : block.type === "proactive_signal"
          ? block.summaryItems
          : block.type === "data_card"
            ? block.items.map((it) => ({ label: it.label, value: it.value, detail: it.detail }))
            : undefined,
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

export function applyBackendTurnToState(
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
        // 🔴 FIX DEDUPLICACIÓN: si ya existe una memoria con el mismo texto (o casi igual),
        // NO agregarla de nuevo. Comparamos por texto normalizado (sin mayúsculas, sin
        // puntuación, sin acentos) para que "Le encanta el helado de pistacho." y
        // "le encanta el helado de pistacho" cuenten como la misma.
        .filter((candidate) => {
          const candidateNorm = candidate.text.toLowerCase().replace(/[áéíóú]/g, (m) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[m]!)).replace(/[^a-z0-9\s]/g, "").trim();
          return !state.memories.some((existing) => {
            const existingNorm = existing.text.toLowerCase().replace(/[áéíóú]/g, (m) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[m]!)).replace(/[^a-z0-9\s]/g, "").trim();
            return candidateNorm === existingNorm;
          });
        })
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
  next.stage = stageFor(next);
  saveState(next);
  return { state: next, items, entry };
}
