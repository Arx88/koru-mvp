import { buildActionProposalsLocal, normalizeActionDrafts, type ActionDraft } from "./actions";
import { foldAccents, uniqueCommitmentList } from "./commitments";
import { preferredBrainProvider, runFreeLlmEmbedding } from "./freellmapi";
import {
  cleanupShoppingTaskTitle,
  extractShoppingItems,
  hasShoppingIntent,
  hasTaskCue,
  isAvailabilityStatement,
} from "./intent";
import { sanitizeKoruVoice } from "./soul";
import { dueAtFromText, recurrenceFromText } from "./time";
import { orchestrateTurn, uiBlocksToActionProposals } from "./orchestrator";
import type {
  AssistantActionKind,
  SemanticIntent,
  KoruConversationMessage,
  KoruAnalysis,
  KoruState,
  LifeRecord,
  MemoryFact,
  MemoryKind,
  MemorySensitivity,
  UiBlock,
} from "./types";

const relationshipNames = /\b(ana|mama|papa|lucia|juan|martin|socia|socio|cliente|proveedor)\b/gi;

type AnalysisDraft = {
  summary?: string;
  memory_candidates?: unknown;
  commitments?: unknown;
  action_proposals?: unknown;
  records?: unknown;
  sentiment?: unknown;
  reply_intent?: string;
  response?: string;
};

type MemoryDraft = {
  kind?: MemoryKind;
  text?: string;
  confidence?: number;
  sensitivity?: MemorySensitivity;
  root_quote?: string;
  use_for_suggestions?: boolean;
};

type CommitmentDraft = {
  title?: string;
  due_hint?: string;
};

type LifeRecordDraft = Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">;
type ActionProposalLocal = ReturnType<typeof buildActionProposalsLocal>[number];
type ActivityGroupBlock = Extract<UiBlock, { type: "activity_group" }>;
type ActivityTile = NonNullable<ActivityGroupBlock["sections"][number]["tiles"]>[number];
type ActivityTone = NonNullable<ActivityGroupBlock["sections"][number]["tone"]>;

function sentenceCase(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function splitIdeas(input: string): string[] {
  return input
    .split(/[.\n;]+|,\s*(?=(?:tengo|necesito|quiero|hay|debo|prometi|prometí|hablar|preparar|comparar|lanzar|mandar|enviar|llamar|revisar|comprar|buscar|hacer|escribir)\b)|\sy\s(?=(?:tengo|necesito|quiero|me|hay|hoy|manana|mañana|falto|faltó|debo|prometi|prometí|hablar|preparar|comparar|lanzar|mandar|enviar|llamar|revisar|comprar|buscar|hacer|escribir)\b)/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 5)
    .slice(0, 8);
}

function classifyMemoryKind(text: string): MemoryKind {
  const lower = foldAccents(text);
  if (includesAny(lower, ["no quiero", "no me gusta", "prefiero que no", "limite"])) return "boundary";
  if (includesAny(lower, ["quiero", "objetivo", "meta", "me gustaria"])) return "goal";
  if (includesAny(lower, ["rutina", "siempre", "normalmente", "todos los dias"])) return "routine";
  if (includesAny(lower, ["cliente", "stock", "proveedor", "local", "venta", "pedido"])) return "retail";
  if (includesAny(lower, ["ansiedad", "agotado", "quemado", "triste", "solo", "sola", "salud"])) return "wellbeing";
  if (relationshipNames.test(text)) {
    relationshipNames.lastIndex = 0;
    return "relationship";
  }
  relationshipNames.lastIndex = 0;
  if (includesAny(lower, ["prefiero", "me gusta", "odio", "me sirve"])) return "preference";
  return "profile";
}

function isSensitive(text: string): boolean {
  const lower = foldAccents(text);
  return includesAny(lower, [
    "ansiedad",
    "depres",
    "salud",
    "medico",
    "dinero",
    "deuda",
    "pareja",
    "miedo",
    "crisis",
    "abuso",
    "solo",
    "sola",
  ]);
}

function confidenceFor(text: string, sensitivity: MemorySensitivity): number {
  const lower = foldAccents(text);
  if (sensitivity === "sensitive") return 0.58;
  if (includesAny(lower, ["siempre", "prefiero", "mi rutina", "todos los dias"])) return 0.84;
  return 0.74;
}

function detectSentiment(input: string): KoruAnalysis["sentiment"] {
  const lower = foldAccents(input);
  if (includesAny(lower, ["agotado", "quemado", "triste", "mal", "ansiedad", "preocupa", "pesado"])) return "heavy";
  if (includesAny(lower, ["mucho", "mil cosas", "ocupado", "reunion", "urgente"])) return "busy";
  if (includesAny(lower, ["bien", "logre", "feliz", "tranquilo", "tranquila"])) return "good";
  return "calm";
}

function extractAmount(text: string): number | undefined {
  const match = /(?:\$|€|usd|eur|ars)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:\$|€|usd|eur|ars)?/i.exec(text);
  if (!match) return undefined;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? amount : undefined;
}

function isRetrievalQuestion(text: string): boolean {
  const lower = foldAccents(text);
  if (/\b(recordame|recuerdame|acordame|anota|anotar|guardar|guarda|tengo que|debo|necesito|hay que)\b/i.test(lower)) {
    return false;
  }
  return /[?¿]/.test(text) || /\b(que tengo|cuanto|cual|cuales|dime|decime|mostrame|muestrame|recuerdas|recordas)\b/i.test(lower);
}

function isExpenseCapture(text: string): boolean {
  return /\b(anota(?:r)?\s+gasto|gaste|gast[eé]|pague|pagu[eé]|factura|alquiler|recibo|cuota)\b/i.test(foldAccents(text));
}

function inferCurrency(text: string): string | undefined {
  const lower = foldAccents(text);
  if (lower.includes("euro")) return "EUR";
  if (text.includes("€") || lower.includes("eur")) return "EUR";
  if (text.includes("$") || lower.includes("usd")) return "USD";
  if (lower.includes("ars")) return "ARS";
  return undefined;
}

function extractUrl(text: string): string | undefined {
  return /(https?:\/\/[^\s]+|www\.[^\s]+)/i.exec(text)?.[1];
}

function personFromText(text: string): string | undefined {
  const explicit = /\b(?:a|con|de|para)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+)\b/.exec(text);
  if (explicit?.[1]) return explicit[1];
  const known = /\b(Ana|Lucia|Lucía|Juan|Martin|Martín|mama|mamá|papa|papá|socio|socia|cliente|proveedor)\b/i.exec(text);
  return known?.[1];
}

function dueHintFromText(text: string): string | undefined {
  const lower = foldAccents(text);
  if (/\bhoy|ahora|urgente\b/.test(lower)) return "hoy";
  if (/\bmanana\b/.test(lower)) return "mañana";
  if (/\bsemana\b/.test(lower)) return "esta semana";
  if (/\bmes\b/.test(lower)) return "este mes";
  return undefined;
}

function recordKey(record: LifeRecordDraft): string {
  const normalizedTitle = foldAccents(record.value ?? record.title)
    .replace(/\b(anota|anotar|gaste|gasto|pague|pago|compre|compra|recordame|tengo|hay|en casa|hoy|manana|mañana|por la manana|por la mañana)\b/g, " ")
    .replace(/\d+(?:[.,]\d{1,2})?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return [
    record.domain,
    record.kind,
    record.amount ?? "",
    record.currency ?? "",
    foldAccents(record.person ?? ""),
    foldAccents(record.url ?? ""),
    normalizedTitle,
  ].join("|");
}

function extractLifeRecordsLocal(input: string, ideas: string[]): LifeRecordDraft[] {
  const records: LifeRecordDraft[] = [];
  if (isRetrievalQuestion(input)) return records;
  const all = [input, ...ideas];

  for (const idea of all) {
    const lower = foldAccents(idea);
    const amount = extractAmount(idea);
    const url = extractUrl(idea);
    const dueHint = dueHintFromText(idea);
    const person = personFromText(idea);
    const shoppingItems = extractShoppingItems(idea);

    if (amount && /\b(gaste|gast[eé]|pague|pagu[eé]|compre|compr[eé]|factura|alquiler|super|supermercado)\b/i.test(lower)) {
      records.push({
        domain: "money",
        kind: "expense",
        title: sentenceCase(idea),
        amount,
        currency: inferCurrency(idea),
        dueHint,
        notes: idea,
        tags: ["gasto"],
      });
    }

    if (/\b(medicamento|medicacion|pastilla|tomar|dosis|ibuprofeno|sertralina|turno medico|m[eé]dico)\b/i.test(lower)) {
      records.push({
        domain: "health",
        kind: lower.includes("turno") || lower.includes("medico") ? "medical_info" : "medication",
        title: sentenceCase(idea),
        value: amount ? String(amount) : undefined,
        dueHint,
        notes: idea,
        tags: ["salud"],
      });
    }

    if (/\b(dormi|dorm[ií]|sue[nñ]o|horas)\b/i.test(lower) && amount) {
      records.push({
        domain: "health",
        kind: "sleep",
        title: `Dormí ${amount} horas`,
        amount,
        notes: idea,
        tags: ["sueño"],
      });
    }

    if (shoppingItems.length > 0) {
      records.push({
        domain: "home",
        kind: "shopping_item",
        title: cleanupShoppingTaskTitle(idea),
        value: shoppingItems.join(", "),
        dueHint,
        notes: idea,
        tags: ["compras", "casa"],
      });
    }

    if (
      isAvailabilityStatement(idea) &&
      /\b(tengo para comer|hay en casa|heladera|nevera|freezer|despensa|arroz|pollo|pasta|verduras|huevos|leche)\b/i.test(lower)
    ) {
      records.push({
        domain: "home",
        kind: "meal_inventory",
        title: sentenceCase(idea),
        value: cleanupInventoryValue(idea),
        notes: idea,
        tags: ["comida"],
      });
    }

    if (url || /\b(herramienta|tool|link|enlace|me gusto|me gust[oó])\b/i.test(lower)) {
      records.push({
        domain: "work",
        kind: "tool_link",
        title: sentenceCase(idea.replace(url ?? "", "").trim() || url || idea),
        url,
        notes: idea,
        tags: ["herramienta"],
      });
    }

    if (/\b(reunion|reuni[oó]n|meeting|notas|minuta)\b/i.test(lower)) {
      records.push({
        domain: "work",
        kind: "meeting_note",
        title: sentenceCase(idea),
        person,
        dueHint,
        notes: idea,
        tags: ["reunion"],
      });
    }

    if (/\b(deadline|vence|entrega|fecha limite|fecha l[ií]mite)\b/i.test(lower)) {
      records.push({
        domain: "work",
        kind: "deadline",
        title: sentenceCase(idea),
        dueHint,
        notes: idea,
        tags: ["deadline"],
      });
    }

    if (/\b(cumple|cumplea[nñ]os)\b/i.test(lower)) {
      records.push({
        domain: "relationship",
        kind: "birthday",
        title: sentenceCase(idea),
        person,
        dueHint,
        notes: idea,
        tags: ["cumpleaños"],
      });
    }

    if (/\b(regalo|regale|regal[eé])\b/i.test(lower)) {
      records.push({
        domain: "relationship",
        kind: "gift",
        title: sentenceCase(idea),
        person,
        notes: idea,
        tags: ["regalo"],
      });
    }

    if (!isExpenseCapture(idea) && !hasShoppingIntent(idea) && /\b(plomero|fontanero|seguro|paquete|llega|lista del super|lista supermercado)\b/i.test(lower)) {
      records.push({
        domain: "home",
        kind: "home_task",
        title: sentenceCase(idea),
        dueHint,
        notes: idea,
        tags: ["casa"],
      });
    }

    if (/\b(idea|no quiero perder|guardar esto|anota esto|captura)\b/i.test(lower)) {
      records.push({
        domain: "capture",
        kind: "idea",
        title: cleanupTaskText(idea),
        notes: idea,
        tags: ["idea"],
      });
    }

    if (/\b(serie|libro|restaurante|viaje|me recomendaron|quiero probar|empece|empec[eé])\b/i.test(lower)) {
      records.push({
        domain: "interest",
        kind: "recommendation",
        title: sentenceCase(idea),
        person,
        notes: idea,
        tags: ["interes"],
      });
    }

    if (/\b(decidir|decisi[oó]n|puedo permitirme|me conviene)\b/i.test(lower)) {
      records.push({
        domain: amount ? "money" : "capture",
        kind: "decision",
        title: sentenceCase(idea),
        amount,
        currency: inferCurrency(idea),
        notes: idea,
        tags: ["decision"],
      });
    }
  }

  const seen = new Set<string>();
  return records.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function cleanupInventoryValue(text: string): string {
  return text
    .replace(/^(tengo|hay|en casa|para comer|comida)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupTaskText(text: string): string {
  return sentenceCase(text.replace(/^(idea|anota esto|guardar esto|no quiero perder)\s*:?\s*/i, "").trim() || text);
}

function extractCommitmentsLocal(ideas: string[]) {
  return ideas
    .filter((idea) => {
      return hasTaskCue(idea);
    })
    .slice(0, 5)
    .map((idea) => ({
      title: sentenceCase(hasShoppingIntent(idea) ? cleanupShoppingTaskTitle(idea) : idea),
      dueHint: /\bmanana\b/i.test(foldAccents(idea)) ? "mañana" : /\bhoy\b/i.test(foldAccents(idea)) ? "hoy" : "sin fecha",
      dueAt: dueAtFromText(idea),
      recurrence: recurrenceFromText(idea),
      status: "open" as const,
    }));
}

function isTaskLike(text: string): boolean {
  return hasTaskCue(text);
}

function isPureAction(text: string): boolean {
  return /^\s*(tengo que|debo|necesito|prometi|recordar|recordame|recuerdame|acordame|comprar|mandar|enviar|llamar|escribir|preparar|buscar|busca|buscame|investiga|investigar|comparar|compara|comparame|dame|decime|dime)\b/i.test(foldAccents(text));
}

function isDurableMemoryText(text: string): boolean {
  const lower = foldAccents(text);
  if (isPureAction(text)) return false;
  if (/^(debo|tengo que|necesito|recordar|mandar|enviar|llamar|comprar)\b/i.test(text)) return false;
  return includesAny(lower, [
    "soy",
    "trabajo",
    "siempre",
    "normalmente",
    "prefiero",
    "me gusta",
    "no me gusta",
    "quiero",
    "objetivo",
    "meta",
    "me cuesta",
    "me preocupa",
    "mi rutina",
    "cliente",
    "stock",
    "local",
  ]);
}

function extractMemoryCandidatesLocal(input: string, ideas: string[]) {
  return ideas
    .filter((idea) => {
      const lower = foldAccents(idea);
      if (lower.length < 12) return false;
      if (isPureAction(idea)) return false;
      if (isTaskLike(idea) && !includesAny(lower, ["siempre", "prefiero", "cliente", "stock", "proveedor", "me preocupa"])) {
        return false;
      }
      return (
        includesAny(lower, [
          "soy",
          "trabajo",
          "tengo",
          "quiero",
          "prefiero",
          "me preocupa",
          "me cuesta",
          "mi rutina",
          "cliente",
          "stock",
          "ana",
          "mama",
          "no quiero",
        ]) || input.length > 120
      );
    })
    .slice(0, 6)
    .map((idea) => {
      const sensitivity: MemorySensitivity = isSensitive(idea) ? "sensitive" : "normal";
      return {
        kind: classifyMemoryKind(idea),
        text: sentenceCase(idea),
        confidence: confidenceFor(idea, sensitivity),
        sensitivity,
        status: "candidate" as const,
        rootQuote: sentenceCase(idea),
        useForSuggestions: sensitivity === "normal",
      };
    });
}

function summarize(input: string, ideas: string[]): string {
  if (ideas.length === 0) return sentenceCase(input.slice(0, 180));
  return ideas.slice(0, 3).map(sentenceCase).join(" / ");
}

function energyFor(memoryCount: number, commitmentCount: number, actionCount: number, sentiment: KoruAnalysis["sentiment"]) {
  const base = Math.min(46, memoryCount * 9 + commitmentCount * 7 + actionCount * 5);
  const reflection = sentiment === "heavy" ? 8 : 5;
  return Math.max(8, base + reflection);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 3);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    aNorm += a[index] * a[index];
    bNorm += b[index] * b[index];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

export function selectActiveMemories(input: string, state: KoruState, limit = 5, queryEmbedding?: number[]): MemoryFact[] {
  if (queryEmbedding?.length) {
    const vectorMatches = state.memories
      .filter((memory) => memory.status === "confirmed" && memory.useForSuggestions !== false && memory.embedding?.length)
      .map((memory) => ({ memory, score: cosineSimilarity(queryEmbedding, memory.embedding ?? []) }))
      .filter((item) => item.score >= 0.58)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
    if (vectorMatches.length > 0) return vectorMatches;
  }

  const query = new Set(tokenize(input));
  if (query.size === 0) return [];
  return state.memories
    .filter((memory) => memory.status === "confirmed" && memory.useForSuggestions !== false)
    .map((memory) => {
      const words = tokenize(memory.text);
      const overlap = words.filter((word) => query.has(word)).length;
      const recency = Math.max(0, 1 - (Date.now() - new Date(memory.createdAt).getTime()) / 1000 / 60 / 60 / 24 / 60);
      return { memory, score: overlap * 2 + memory.confidence + recency };
    })
    .filter((item) => item.score > 0.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.memory);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function coerceMemoryDraft(value: unknown): MemoryDraft | null {
  if (typeof value === "string") return { text: value };
  const record = asRecord(value);
  if (!record) return null;
  return {
    kind: asString(record.kind) as MemoryKind | undefined,
    text: asString(record.text),
    confidence: typeof record.confidence === "number" ? record.confidence : undefined,
    sensitivity: record.sensitivity === "sensitive" || record.sensitivity === "normal" ? record.sensitivity : undefined,
    root_quote: asString(record.root_quote),
    use_for_suggestions:
      typeof record.use_for_suggestions === "boolean" ? record.use_for_suggestions : undefined,
  };
}

function coerceCommitmentDraft(value: unknown): CommitmentDraft | null {
  if (typeof value === "string") return { title: value, due_hint: "sin fecha" };
  const record = asRecord(value);
  if (!record) return null;
  return {
    title: asString(record.title),
    due_hint: asString(record.due_hint),
  };
}

function coerceActionDraft(value: unknown): ActionDraft | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    kind: asString(record.kind) as ActionDraft["kind"],
    title: asString(record.title),
    body: asString(record.body),
    payload: asRecord(record.payload) ?? undefined,
    source_commitment_title: asString(record.source_commitment_title),
  };
}

function normalizeLifeDomain(value: unknown): LifeRecordDraft["domain"] | undefined {
  const allowed: LifeRecordDraft["domain"][] = ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"];
  return allowed.includes(value as LifeRecordDraft["domain"]) ? (value as LifeRecordDraft["domain"]) : undefined;
}

function normalizeLifeRecordKind(value: unknown): LifeRecordDraft["kind"] | undefined {
  const allowed: LifeRecordDraft["kind"][] = [
    "expense",
    "medication",
    "meal_inventory",
    "tool_link",
    "meeting_note",
    "deadline",
    "person_followup",
    "gift",
    "birthday",
    "home_task",
    "shopping_item",
    "idea",
    "recommendation",
    "medical_info",
    "sleep",
    "decision",
  ];
  return allowed.includes(value as LifeRecordDraft["kind"]) ? (value as LifeRecordDraft["kind"]) : undefined;
}

function coerceStringArray(value: unknown): string[] | undefined {
  const items = asArray(value).filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length ? items.slice(0, 8).map((item) => item.trim()) : undefined;
}

function coerceLifeRecordDraft(value: unknown): LifeRecordDraft | null {
  const record = asRecord(value);
  if (!record) return null;
  const title = sentenceCase(asString(record.title) ?? "");
  const domain = normalizeLifeDomain(record.domain);
  const kind = normalizeLifeRecordKind(record.kind);
  if (!title || title.length < 4 || !domain || !kind) return null;
  const amount = typeof record.amount === "number" && Number.isFinite(record.amount) ? record.amount : undefined;
  return {
    domain,
    kind,
    title,
    value: asString(record.value),
    amount,
    currency: asString(record.currency),
    person: asString(record.person),
    url: asString(record.url),
    dueHint: asString(record.dueHint),
    happenedAt: asString(record.happenedAt),
    notes: asString(record.notes),
    tags: coerceStringArray(record.tags),
  };
}

function normalizeKind(kind: unknown, fallbackText: string): MemoryKind {
  const allowed: MemoryKind[] = ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"];
  return allowed.includes(kind as MemoryKind) ? (kind as MemoryKind) : classifyMemoryKind(fallbackText);
}

function normalizeSentiment(value: unknown, input: string): KoruAnalysis["sentiment"] {
  return value === "heavy" || value === "busy" || value === "good" || value === "calm" ? value : detectSentiment(input);
}

function actionQualityScore(action: ReturnType<typeof buildActionProposalsLocal>[number]): number {
  let score = 0;
  if (action.kind === "clarifying_question") score += 8;
  if (action.kind === "morning_brief") score += 8 + (action.payload.summaryItems?.length ?? 0);
  if (action.kind === "day_plan") score += 7 + (action.payload.planItems?.length ?? 0);
  if (action.kind === "money_summary") score += 7 + (action.payload.summaryItems?.length ?? 0);
  if (action.kind === "meeting_brief") score += 7 + (action.payload.planItems?.length ?? 0);
  if (action.kind === "decision_support") score += 7 + (action.payload.summaryItems?.length ?? 0);
  if (action.kind === "structured_note") score += 5 + (action.payload.records?.length ?? 0);
  if (action.kind === "file_bundle") score += 6 + (action.payload.files?.length ?? 0);
  if (action.kind === "world_signal") score += 7 + (action.payload.searchQueries?.length ?? 0);
  if (action.kind === "web_research") score += 6 + (action.payload.searchQueries?.length ?? 0);
  if (action.kind === "draft_message") score += 5;
  if (action.kind === "calendar_event" || action.kind === "restock_note") score += 4;
  if (action.kind === "reminder" || action.kind === "daily_brief") score += 2;
  if (action.payload.contextReview?.length) score += 2;
  if (action.payload.questions?.length) score += 2;
  if (action.payload.files?.some((file) => /propuesta_koru|plan_koru|resumen_ejecutivo\.txt/i.test(file.name))) score -= 10;
  return score;
}

function mergeActionProposals(
  local: ReturnType<typeof buildActionProposalsLocal>,
  model: ReturnType<typeof buildActionProposalsLocal>,
): ReturnType<typeof buildActionProposalsLocal> {
  const byKind = new Map<AssistantActionKind, ReturnType<typeof buildActionProposalsLocal>[number]>();
  for (const action of [...model, ...local]) {
    const existing = byKind.get(action.kind);
    if (!existing || actionQualityScore(action) >= actionQualityScore(existing)) {
      byKind.set(action.kind, action);
    }
  }
  const order: AssistantActionKind[] = [
    "morning_brief",
    "money_summary",
    "meeting_brief",
    "decision_support",
    "day_plan",
    "structured_note",
    "clarifying_question",
    "draft_message",
    "calendar_event",
    "restock_note",
    "reminder",
    "file_bundle",
    "world_signal",
    "web_research",
    "daily_brief",
  ];
  return Array.from(byKind.values())
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, 3);
}

function normalizeDraft(
  draft: AnalysisDraft,
  input: string,
  state: KoruState,
  activeMemories: MemoryFact[],
  provider: KoruAnalysis["provider"],
  model?: string,
): KoruAnalysis {
  const ideas = splitIdeas(input);
  const localRecords = state.ephemeralMode ? [] : extractLifeRecordsLocal(input, ideas);
  const sentiment = normalizeSentiment(draft.sentiment, input);
  const rawMemories = state.ephemeralMode
    ? []
    : asArray(draft.memory_candidates).map(coerceMemoryDraft).filter((memory): memory is MemoryDraft => Boolean(memory));
  const memoryCandidates = rawMemories
    .map((memory) => {
      if (!memory) return null;
      const text = sentenceCase(memory.text ?? "");
      if (text.length < 8) return null;
      if (!isDurableMemoryText(text)) return null;
      const sensitivity: MemorySensitivity = memory.sensitivity === "sensitive" || isSensitive(text) ? "sensitive" : "normal";
      return {
        kind: normalizeKind(memory.kind, text),
        text,
        confidence: Math.max(0.3, Math.min(0.95, Number(memory.confidence ?? confidenceFor(text, sensitivity)))),
        sensitivity,
        status: "candidate" as const,
        rootQuote: sentenceCase(memory.root_quote ?? text),
        useForSuggestions: memory.use_for_suggestions ?? sensitivity === "normal",
      };
    })
    .filter((memory): memory is NonNullable<typeof memory> => Boolean(memory))
    .slice(0, 6);
  const commitmentsFromModel = asArray(draft.commitments)
    .map(coerceCommitmentDraft)
    .filter((commitment): commitment is CommitmentDraft => Boolean(commitment))
    .map((commitment) => ({
      title: sentenceCase(commitment.title ?? ""),
      dueHint: commitment.due_hint?.trim() || "sin fecha",
      dueAt: dueAtFromText(`${commitment.title ?? ""} ${commitment.due_hint ?? ""}`),
      recurrence: recurrenceFromText(`${commitment.title ?? ""} ${commitment.due_hint ?? ""}`),
      status: "open" as const,
    }))
    .filter((commitment) => commitment.title.length > 5)
    .slice(0, 5);
  const commitments = state.ephemeralMode
    ? []
    : uniqueCommitmentList([
        ...commitmentsFromModel,
        ...extractCommitmentsLocal(ideas),
      ]).slice(0, 6);
  const records = (() => {
    if (state.ephemeralMode) return [];
    const fromModel = asArray(draft.records)
      .map(coerceLifeRecordDraft)
      .filter((record): record is LifeRecordDraft => Boolean(record));
    const seen = new Set<string>();
    return [...fromModel, ...localRecords]
      .filter((record) => {
        const key = recordKey(record);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  })();
  const actionDrafts = asArray(draft.action_proposals).map(coerceActionDraft).filter(Boolean) as ActionDraft[];
  const actionProposalsFromModel = normalizeActionDrafts(actionDrafts, commitments);
  const actionProposalsLocal = buildActionProposalsLocal(input, commitments, sentiment, state, records);
  const actionProposals = mergeActionProposals(actionProposalsLocal, actionProposalsFromModel);
  const summary = sentenceCase(draft.summary ?? summarize(input, ideas));
  const nudges = state.ephemeralMode
    ? []
    : commitments.slice(0, 2).map((commitment) => ({
        title: foldAccents(commitment.dueHint).includes("manana") ? "Mañana lo dejamos visible" : "Lo dejo a mano",
        body: foldAccents(commitment.dueHint).includes("manana")
          ? "Puedo traerlo en el resumen de mañana si lo apruebas."
          : "Lo mantengo visible hasta que lo cierres o lo sueltes.",
        reason: `Lo dijiste asi: "${commitment.title}"`,
        priority: foldAccents(commitment.dueHint).includes("manana") ? ("medium" as const) : ("low" as const),
      }));

  return {
    summary,
    memoryCandidates,
    commitments,
    actionProposals,
    nudges,
    records,
    sentiment,
    energyAwarded: energyFor(memoryCandidates.length, commitments.length + Math.min(2, records.length), actionProposals.length, sentiment),
    activeMemoryIds: activeMemories.map((memory) => memory.id),
    activeMemorySummary: activeMemories.map((memory) => memory.text).join(" / "),
    provider,
    model,
    response: draft.response
      ? sanitizeKoruVoice(draft.response)
      : smartFallback(actionProposals, records, commitments),
  };
}

function smartFallback(
  actionProposals: KoruAnalysis["actionProposals"],
  records: KoruAnalysis["records"],
  commitments: KoruAnalysis["commitments"],
): string {
  const act = actionProposals[0];
  if (act?.kind === "alarm") return `Listo, preparé una alarma. ¿Querés que le agregue algo más?`;
  if (act?.kind === "reminder") return `Listo, dejé el recordatorio. ¿Necesitás algo adicional?`;
  if (act?.kind === "day_plan") return `Te organicé el día en pasos concretos.`;
  if (records.length) return `Guardado. ¿Querés que haga algo más con eso?`;
  if (commitments.length) return `Lo dejé como pendiente. ¿Querés que te avise antes?`;
  if (act) return `Ya preparé lo que pediste. ¿Avanzamos con algo más?`;
  return "¿Me lo repetís de otra forma? Así lo entiendo bien y te ayudo.";
}

function tileKindForLabel(label: string): ActivityTile["kind"] {
  const lower = foldAccents(label);
  if (/\bclima|temperatura|lluvia|ropa|ponerme\b/i.test(lower)) return lower.includes("ropa") ? "outfit" : "weather";
  if (/\btrafico|ruta\b/i.test(lower)) return "traffic";
  if (/\bagenda|reunion|calendario\b/i.test(lower)) return "calendar";
  if (/\bsalud|medic|turno|vitamina\b/i.test(lower)) return "health";
  if (/\bcomida|cena|almuerzo|casa|heladera|nevera\b/i.test(lower)) return "food";
  if (/\bdinero|gasto|presupuesto|costo\b/i.test(lower)) return "money";
  if (/\bsueno|bienestar|caminar\b/i.test(lower)) return "wellbeing";
  if (/\btrabajo|pendiente|cliente|socio|proveedor|demo\b/i.test(lower)) return "work";
  return "research";
}

function toneForKind(kind: ActivityTile["kind"]): ActivityTone {
  if (kind === "weather" || kind === "traffic" || kind === "research") return "blue";
  if (kind === "health" || kind === "wellbeing" || kind === "outfit") return "purple";
  if (kind === "money") return "green";
  if (kind === "calendar" || kind === "relationship") return "amber";
  return "neutral";
}

function activityGroupFromAction(action: ActionProposalLocal): UiBlock | undefined {
  if (!["morning_brief", "meeting_brief", "money_summary", "decision_support"].includes(action.kind)) return undefined;
  const summaryTiles = (action.payload.summaryItems ?? []).map((summary) => {
    const kind = tileKindForLabel(summary.label);
    return {
      kind,
      label: summary.label,
      value: summary.value,
      detail: summary.detail,
      urgent: /\bmedic|urgente|hoy\b/i.test(foldAccents(`${summary.label} ${summary.detail ?? ""}`)),
    };
  });
  const planRows = (action.payload.planItems ?? []).map((item) => ({
    title: item.title,
    detail: [item.time, item.durationMinutes ? `${item.durationMinutes} min` : undefined].filter(Boolean).join(" - "),
    meta: item.priority,
    urgent: item.priority === "Alta",
  }));
  if (action.kind === "decision_support") {
    const vote = action.payload.decisionVote === "wait"
      ? "Yo esperaria"
      : action.payload.decisionVote === "go"
        ? "Yo avanzaria con cuidado"
        : "Me falta un dato";
    summaryTiles.unshift({
      kind: "money",
      label: "Mi voto",
      value: vote,
      detail: action.payload.decisionAssumption,
      urgent: action.payload.decisionVote === "wait",
    });
  }
  const reviewRows = (action.payload.contextReview ?? []).slice(0, 4).map((item) => ({
    title: item.title,
    detail: item.detail,
    meta: item.source,
    urgent: item.priority === "Alta",
  }));
  const sections: ActivityGroupBlock["sections"] = [];
  if (summaryTiles.length) {
    sections.push({
      title: action.kind === "morning_brief" ? "Actividad" : action.kind === "money_summary" ? "Dinero" : "Resumen",
      tone: summaryTiles.some((tile) => tile.kind === "money") ? "green" : toneForKind(summaryTiles[0].kind),
      tiles: summaryTiles.slice(0, 6),
    });
  }
  if (planRows.length) {
    sections.push({
      title: action.kind === "meeting_brief" ? "Trabajo" : "Siguiente paso",
      tone: "green",
      rows: planRows.slice(0, 5),
    });
  }
  if (reviewRows.length && !planRows.length) {
    sections.push({
      title: "Contexto usado",
      tone: "neutral",
      rows: reviewRows,
    });
  }
  if (!sections.length) return undefined;
  return {
    type: "activity_group",
    title: action.payload.title ?? action.title,
    subtitle: action.payload.recommendation ?? action.body,
    sections,
    note: action.payload.missingContext?.[0] ?? action.payload.decisionAssumption,
  };
}

function proactiveSignalFromAction(action: ActionProposalLocal): UiBlock | undefined {
  if (action.kind !== "world_signal" && action.kind !== "web_research") return undefined;
  const mode = action.payload.webMode ?? "research";
  if (!["world", "news", "market", "weather", "traffic"].includes(mode)) return undefined;
  const category = mode === "world" ? "world" : mode === "news" ? "news" : mode === "market" ? "market" : mode === "weather" ? "weather" : "traffic";
  return {
    type: "proactive_signal",
    category,
    severity: mode === "weather" || mode === "traffic" ? "useful" : mode === "world" ? "important" : "info",
    title: action.payload.title ?? action.title,
    body: action.payload.recommendation ?? action.payload.body ?? action.body,
    timestampLabel: action.payload.verifiedAt
      ? new Date(action.payload.verifiedAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : action.payload.externalStatus === "pending" ? "pendiente de verificar" : undefined,
    sourceStatus: action.payload.externalStatus,
    actionLabel: mode === "weather" ? "Ver clima" : mode === "traffic" ? "Ver ruta" : mode === "market" ? "Ver mercado" : "Abrir fuentes",
    followUpQuestion: mode === "world" ? "Quieres que te siga avisando cuando aparezcan senales utiles?" : undefined,
    sources: action.payload.sources,
    summaryItems: action.payload.summaryItems,
  };
}

function uiBlockFromAction(action: ActionProposalLocal): UiBlock | undefined {
  if (action.payload.uiBlock) return action.payload.uiBlock;
  const activity = activityGroupFromAction(action);
  if (activity) return activity;
  const signal = proactiveSignalFromAction(action);
  if (signal) return signal;
  if (action.kind === "file_bundle" && action.payload.files?.length) {
    return {
      type: "resource_bundle",
      title: action.payload.title ?? action.title,
      files: action.payload.files,
      summary: action.body,
    };
  }
  if (action.kind === "day_plan" && action.payload.planItems?.length) {
    return {
      type: "plan",
      title: action.payload.title ?? action.title,
      items: action.payload.planItems,
      note: action.body,
    };
  }
  if (action.kind === "clarifying_question" && action.payload.questions?.[0]) {
    return {
      type: "clarifying_question",
      title: action.payload.title ?? action.title,
      question: action.payload.questions[0],
      expectedSlot: action.payload.missingContext?.[0],
      options: action.payload.questions.slice(1),
    };
  }
  if (action.kind === "restock_note" && action.payload.records?.some((record) => record.kind === "shopping_item")) {
    return {
      type: "shopping_list",
      title: action.payload.title ?? action.title,
      items: action.payload.records
        .filter((record) => record.kind === "shopping_item")
        .map((record) => record.value ?? record.title)
        .filter(Boolean)
        .slice(0, 8) as string[],
      note: action.payload.note ?? action.body,
    };
  }
  if (action.kind === "money_summary") {
    return {
      type: "money_summary",
      title: action.payload.title ?? action.title,
      total: action.payload.totalAmount,
      currency: action.payload.currency,
      summaryItems: action.payload.summaryItems,
      recommendation: action.payload.recommendation ?? action.body,
    };
  }
  if (action.kind === "structured_note" && action.payload.records?.length) {
    return {
      type: "saved_record",
      title: action.payload.title ?? action.title,
      records: action.payload.records.slice(0, 6),
    };
  }
  if (action.kind === "web_research" && action.payload.sources?.length) {
    return {
      type: "research_sources",
      title: action.payload.title ?? action.title,
      summary: action.payload.recommendation ?? action.body,
      mode: action.payload.webMode,
      sources: action.payload.sources,
    };
  }
  return undefined;
}

function enrichActionsWithUiBlocks(
  actions: ActionProposalLocal[],
  semanticIntent: SemanticIntent,
  semanticActions: ActionProposalLocal[],
): ActionProposalLocal[] {
  return actions.map((action) => {
    if (action.payload.uiBlock) return action;
    const matchingSemantic = semanticActions.find((candidate) => candidate.kind === action.kind && candidate.payload.uiBlock);
    const uiBlock = uiBlockFromAction(action) ?? matchingSemantic?.payload.uiBlock;
    if (!uiBlock) return action;
    const hydratedUiBlock: UiBlock =
      uiBlock.type === "research_sources"
        ? {
            ...uiBlock,
            sources: action.payload.sources ?? uiBlock.sources,
            sourceStatus: action.payload.externalStatus ?? uiBlock.sourceStatus,
          }
        : uiBlock.type === "proactive_signal"
          ? {
              ...uiBlock,
              sources: action.payload.sources ?? uiBlock.sources,
              sourceStatus: action.payload.externalStatus ?? uiBlock.sourceStatus,
              summaryItems: action.payload.summaryItems ?? uiBlock.summaryItems,
            }
          : uiBlock;
    return {
      ...action,
      payload: {
        ...action.payload,
        uiBlock: hydratedUiBlock,
        semanticIntent: action.payload.semanticIntent ?? matchingSemantic?.payload.semanticIntent ?? semanticIntent,
      },
    };
  });
}

function mergePhaseCActions(orchestratedActions: ActionProposalLocal[], legacyActions: ActionProposalLocal[]): ActionProposalLocal[] {
  if (legacyActions.length === 0) return orchestratedActions;
  const structuredOnly = legacyActions.filter((action) => action.kind === "structured_note" && action.payload.records?.length);
  if (
    orchestratedActions.length === 0 &&
    structuredOnly.length === 1 &&
    legacyActions.length === 1
  ) {
    return enrichActionsWithUiBlocks(
      structuredOnly,
      structuredOnly[0].payload.semanticIntent ?? { domain: "chat", kind: "structured_capture", confidence: 0.7 },
      [],
    );
  }
  if (orchestratedActions.length === 0) return legacyActions.slice(0, 3);
  const hydratedOrchestrated = orchestratedActions.map((action) => {
    const legacy = legacyActions.find((candidate) => candidate.kind === action.kind);
    if (!legacy) return action;
    return enrichActionsWithUiBlocks([{
      ...action,
      title: legacy.title || action.title,
      body: legacy.body || action.body,
      approvalRequired: action.approvalRequired || legacy.approvalRequired,
      sourceCommitmentId: action.sourceCommitmentId ?? legacy.sourceCommitmentId,
      payload: {
        ...action.payload,
        ...legacy.payload,
        uiBlock: legacy.payload.uiBlock ?? action.payload.uiBlock,
        semanticIntent: action.payload.semanticIntent ?? legacy.payload.semanticIntent,
      },
    }], action.payload.semanticIntent ?? legacy.payload.semanticIntent ?? { domain: "chat", kind: "conversation", confidence: 0.5 }, [action])[0];
  });
  const legacyKinds = new Set(legacyActions.map((action) => action.kind));
  const orchestratedKinds = new Set(hydratedOrchestrated.map((action) => action.kind));
  const additiveLegacyKinds: AssistantActionKind[] = [
    "file_bundle",
    "meeting_brief",
    "morning_brief",
    "money_summary",
    "decision_support",
    "draft_message",
    "day_plan",
    "world_signal",
  ];
  const merged = [...hydratedOrchestrated];
  for (const legacy of legacyActions) {
    if (!additiveLegacyKinds.includes(legacy.kind)) continue;
    if (orchestratedKinds.has(legacy.kind)) continue;
    if (legacy.kind === "world_signal" && orchestratedKinds.has("web_research")) continue;
    const withUi = enrichActionsWithUiBlocks([legacy], legacy.payload.semanticIntent ?? orchestratedActions[0].payload.semanticIntent ?? { domain: "chat", kind: "conversation", confidence: 0.5 }, orchestratedActions)[0];
    merged.push(withUi);
    legacyKinds.delete(legacy.kind);
    if (merged.length >= 3) break;
  }
  return merged.slice(0, 3);
}

function analyzeReflectionLocal(input: string, state: KoruState, activeMemories: MemoryFact[]): KoruAnalysis {
  const ideas = splitIdeas(input);
  const memoryCandidates = state.ephemeralMode ? [] : extractMemoryCandidatesLocal(input, ideas);
  const commitments = extractCommitmentsLocal(ideas);
  return normalizeDraft(
    {
      summary: summarize(input, ideas),
      memory_candidates: memoryCandidates.map((memory) => ({
        kind: memory.kind,
        text: memory.text,
        confidence: memory.confidence,
        sensitivity: memory.sensitivity,
        root_quote: memory.rootQuote,
        use_for_suggestions: memory.useForSuggestions,
      })),
      commitments: commitments.map((commitment) => ({ title: commitment.title, due_hint: commitment.dueHint })),
      action_proposals: buildActionProposalsLocal(
        input,
        commitments,
        detectSentiment(input),
        state,
        state.ephemeralMode ? [] : extractLifeRecordsLocal(input, ideas),
      ),
      sentiment: detectSentiment(input),
    },
    input,
    state,
    activeMemories,
    "local",
  );
}

function extractTurnKnowledge(input: string, state: KoruState, activeMemories: MemoryFact[]): KoruAnalysis {
  return analyzeReflectionLocal(input, state, activeMemories);
}

function simpleRecordReply(record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">): string {
  if (record.kind === "expense") {
    const amount = record.amount !== undefined ? `${record.amount} ${record.currency ?? ""}`.trim() : record.value ?? record.title;
    const where = record.title
      .replace(/^Anota(?:r)? gasto de\s*/i, "")
      .replace(/^\d+(?:[.,]\d{1,2})?\s*(?:euros?|eur|usd|\$)?\s*(?:en)?\s*/i, "")
      .trim();
    return `Anotado: ${amount}${where ? ` en ${where}` : ""}.`;
  }
  return `Guardado: ${record.value ?? record.title}.`;
}

export async function analyzeReflection(
  input: string,
  state: KoruState,
  history: KoruConversationMessage[] = [],
): Promise<KoruAnalysis> {
  const provider = preferredBrainProvider(state.runtime);
  let queryEmbedding: number[] | undefined;
  if (provider === "freellmapi" && state.runtime.embeddingsEnabled && state.runtime.freeLlmApiKey.trim()) {
    try {
      queryEmbedding = (await runFreeLlmEmbedding(state.runtime, input)).embedding;
    } catch {
      queryEmbedding = undefined;
    }
  }
  const activeMemories = selectActiveMemories(input, state, 5, queryEmbedding);
  try {
    const turn = await orchestrateTurn({ input, state, provider, activeMemories, history });
    const extraction = extractTurnKnowledge(input, state, activeMemories);
    const orchestratedActions = uiBlocksToActionProposals(turn.uiBlocks, turn.intent);
    const actionProposals = mergePhaseCActions(orchestratedActions, extraction.actionProposals);
    const simpleRecord = actionProposals.find((action) => action.kind === "structured_note" && action.payload.records?.length === 1)?.payload.records?.[0];
    const baseReply = simpleRecord && /^(Te sigo|Anotado)/i.test(turn.reply)
      ? simpleRecordReply(simpleRecord)
      : turn.reply;
    const response = activeMemories.length > 0 && provider === "local" && !/ate cabos/i.test(baseReply)
      ? `Ate cabos con lo que ya me contaste. ${baseReply}`
      : baseReply;
    return {
      ...extraction,
      response: sanitizeKoruVoice(response),
      actionProposals,
      activeMemoryIds: activeMemories.map((memory) => memory.id),
      activeMemorySummary: activeMemories.map((memory) => memory.text).join(" / "),
      provider,
      model: turn.model ?? extraction.model,
    };
  } catch {
    const fallback = extractTurnKnowledge(input, state, activeMemories);
    const fallbackResponse = fallback.records.length
      ? "Lo guarde como dato simple. No arme una tarjeta en este intento porque prefiero no inventar estructura."
      : fallback.commitments.length
        ? "Lo deje como pendiente simple. No arme una tarjeta en este intento porque prefiero no inventar estructura."
        : "No pude ordenar una respuesta util en este intento. Reformulamelo y lo encaro de nuevo.";
    return {
      ...fallback,
      response: sanitizeKoruVoice(fallbackResponse),
      actionProposals: [],
      nudges: [],
      model: `fallback-after-orchestrator-${provider}`,
    };
  }
}
