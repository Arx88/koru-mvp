/**
 * Enhancement Extractor — Capa de inteligencia que propone oportunidades abstractas
 *
 * Este módulo NO decide frases finales. NO ejecuta acciones. NO hardcodea reglas.
 * Llama a un LLM para detectar, en el input del usuario y el contexto personal,
 * si existe una oportunidad de valor adicional (+1) real y accionable.
 *
 * El resultado es un conjunto de oportunidades abstractas que luego el
 * Enhancement Engine (determinista) rankea, filtra y valida.
 */

import { parseJsonObjectStrict } from "./schemas";
import { runFreeLlmChat, runOpenModelChat } from "./freellmapi";
import type {
  KoruState,
  SemanticIntent,
  ToolResult,
  UiBlock,
  RuntimeSettings,
  ToolRisk,
} from "./types";

export type RawOpportunity = {
  type: string;
  rationale: string;
  confidence: number;
  risk: ToolRisk;
  requiresApproval: boolean;
  contextualQuestion?: string;
  metadata?: Record<string, unknown>;
};

function systemPrompt(): string {
  return [
    "Sos el detector de oportunidades de Koru, un asistente personal con memoria.",
    "Tu trabajo es analizar el mensaje del usuario + contexto personal y detectar si existe UN SOLO enhancement (+1) útil.",
    "",
    "Reglas de oro:",
    "1. NO decidas frases finales del chat. Solo detectás la oportunidad y su riesgo.",
    "2. NO uses reglas de palabra exacta. Razoná por señales abstractas: dominio, categoría, objetivo, consecuencia.",
    "3. Solo proponé si la confianza es >= 0.65.",
    "4. El enhancement debe estar CERCA del objetivo real del usuario. No te vayas de tema.",
    "5. Respetá boundaries: si hay límites explícitos, no proponés nada de ese tipo.",
    "6. Si el usuario está agotado o estresado, no agregues tareas. Ofrecé reducir carga.",
    "7. Si no hay oportunidad real, devolvé un array vacío.",
    "8. CRÍTICO: la contextualQuestion debe ser ESPECÍFICA al caso. NUNCA genérica.",
    "",
    "Mal ejemplo de contextualQuestion:",
    '- "¿Querés que lo conecte con algo práctico?" → GENÉRICA, MALA',
    "",
    "Buenos ejemplos de contextualQuestion:",
    '- farmacia: "¿Querés que prepare alarmas para las tomas del antibiótico?"',
    '- link: "¿Querés que extraiga los ingredientes a la lista de compras?"',
    '- reunión sin contexto: "¿Querés que antes te arme un brief con decisiones abiertas?"',
    '- alarma sola: "¿Querés que le agregue una descripción para que sepas para qué suena?"',
    '- inventario: "¿Querés que sugiera una cena con pollo y arroz antes de que se echen a perder?"',
    '- persona: "¿Querés que tenga en cuenta el té matcha para ideas de regalo?"',
    "",
    "Tipos de oportunidad abstracta (solo para clasificar):",
    "- health_followup, subscription_tagging, metadata_extraction, meeting_prep, alarm_context, meal_suggestion, energy_support, transport_tagging, routine_reminder, person_followup.",
    "",
    "Formato de respuesta (SOLO JSON, sin markdown):",
    '{"opportunities":[{"type":"health_followup","rationale":"...","confidence":0.78,"risk":"local_write","requiresApproval":true,"contextualQuestion":"Pregunta específica y contextualizada aquí","metadata":{}}]}',
  ].join("\n");
}

function userPrompt(
  input: string,
  intent: SemanticIntent,
  uiBlocks: UiBlock[],
  toolResults: ToolResult[],
  state: KoruState,
): string {
  const confirmedMemories = state.memories
    .filter((m) => m.status === "confirmed" && m.useForSuggestions !== false)
    .slice(0, 6)
    .map((m) => `- [${m.kind}] ${m.text.replace(/[\n\r`]+/g, " ").trim()}`)
    .join("\n") || "- ninguna";

  const boundaries = state.memories
    .filter((m) => m.status === "confirmed" && m.kind === "boundary")
    .map((m) => `- ${m.text.replace(/[\n\r`]+/g, " ").trim()}`)
    .join("\n") || "- ninguno";

  const recentRecords = state.records
    .slice(0, 5)
    .map((r) => `- ${r.kind}: ${r.title}${r.amount ? ` (${r.amount} ${r.currency})` : ""}`)
    .join("\n") || "- ninguno";

  const toolObservations = toolResults
    .map((t) => `- ${t.tool}: ${t.summary}`)
    .join("\n") || "- ninguna";

  return [
    `Mensaje del usuario: "${input}"`,
    `Intención detectada: dominio=${intent.domain}, tipo=${intent.kind}, confianza=${intent.confidence}`,
    "",
    "Bloques UI generados:",
    uiBlocks.map((b) => `- ${b.type}`).join("\n") || "- ninguno",
    "",
    "Observaciones de herramientas:",
    toolObservations,
    "",
    "Memorias confirmadas relevantes:",
    confirmedMemories,
    "",
    "Límites del usuario (boundaries):",
    boundaries,
    "",
    "Registros recientes:",
    recentRecords,
  ].join("\n");
}

async function callExtractorLlm(
  runtime: RuntimeSettings,
  input: string,
  intent: SemanticIntent,
  uiBlocks: UiBlock[],
  toolResults: ToolResult[],
  state: KoruState,
): Promise<RawOpportunity[]> {
  const messages = [
    { role: "system" as const, content: systemPrompt() },
    { role: "user" as const, content: userPrompt(input, intent, uiBlocks, toolResults, state) },
  ];

  let result: { content: string };
  if (runtime.openModelEnabled && runtime.openModelBaseUrl.trim()) {
    result = await runOpenModelChat(runtime, messages, {
      temperature: 0.15,
      maxTokens: 600,
      responseFormat: { type: "json_object" },
    });
  } else if (runtime.freeLlmApiEnabled && runtime.freeLlmApiKey.trim()) {
    result = await runFreeLlmChat(runtime, messages, {
      temperature: 0.15,
      maxTokens: 600,
    });
  } else {
    return [];
  }

  try {
    const parsed = parseJsonObjectStrict(result.content) as Record<string, unknown>;
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    return (opportunities as unknown[])
      .map(normalizeOpportunity)
      .filter((o): o is RawOpportunity => o !== null && o.confidence >= 0.65);
  } catch (err) {
    // Fase 2.13: log para debug. Antes era catch silencioso.
    console.warn("[Koru] extractOpportunities parse failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

function normalizeOpportunity(value: unknown): RawOpportunity | null {
  const obj = value as Record<string, unknown> | undefined;
  if (!obj) return null;
  const type = typeof obj.type === "string" && obj.type.trim() ? obj.type.trim() : "";
  if (!type) return null;
  const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0;
  const risk = normalizeRisk(obj.risk);
  return {
    type,
    rationale: typeof obj.rationale === "string" ? obj.rationale.trim() : "",
    confidence,
    risk,
    requiresApproval: typeof obj.requiresApproval === "boolean" ? obj.requiresApproval : risk !== "readonly",
    contextualQuestion: typeof obj.contextualQuestion === "string" && obj.contextualQuestion.trim()
      ? obj.contextualQuestion.trim()
      : undefined,
    metadata: typeof obj.metadata === "object" && obj.metadata !== null ? obj.metadata as Record<string, unknown> : undefined,
  };
}

function normalizeRisk(value: unknown): ToolRisk {
  const valid: ToolRisk[] = ["readonly", "local_write", "external_side_effect", "financial", "destructive"];
  return valid.includes(value as ToolRisk) ? (value as ToolRisk) : "local_write";
}

// ── API pública ────────────────────────────────────────────────────

export type ChatFn = (messages: { role: string; content: string }[], options: { temperature: number; maxTokens: number }) => Promise<{ content: string }>;

export type ExtractorContext = {
  input: string;
  intent: SemanticIntent;
  uiBlocks: UiBlock[];
  toolResults: ToolResult[];
  state: KoruState;
  runtime: RuntimeSettings;
};

// Fase 4.6: caché por hash de input+intent. Evita re-llamar al LLM
// para el mismo input (ej: "hola" dicho 3 veces en la sesión).
const enhancementCache = new Map<string, RawOpportunity[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function hashKey(ctx: ExtractorContext): string {
  // Hash simple: input + intent + toolResults length
  const toolCount = ctx.toolResults?.length ?? 0;
  return `${ctx.input.slice(0, 200)}|${ctx.intent}|${toolCount}`;
}

export async function extractOpportunities(ctx: ExtractorContext, chatFn?: ChatFn): Promise<RawOpportunity[]> {
  // Fase 4.6: check caché
  const key = hashKey(ctx);
  const cached = enhancementCache.get(key);
  if (cached) return cached;
  // Si hay chatFn externo, usarlo (por ejemplo, el mismo provider que el backend principal)
  if (chatFn) {
    try {
      const messages = [
        { role: "system" as const, content: systemPrompt() },
        { role: "user" as const, content: userPrompt(ctx.input, ctx.intent, ctx.uiBlocks, ctx.toolResults, ctx.state) },
      ];
      const llmResult = await chatFn(messages, { temperature: 0.15, maxTokens: 600 });
      const parsed = parseJsonObjectStrict(llmResult.content) as Record<string, unknown>;
      const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
      const result = (opportunities as unknown[])
        .map(normalizeOpportunity)
        .filter((o): o is RawOpportunity => o !== null && o.confidence >= 0.65);
      enhancementCache.set(key, result);
      return result;
    } catch (err) {
      console.warn("[Koru] extractOpportunities (chatFn) failed:", err instanceof Error ? err.message : err);
      return [];
    }
  }

  // Fallback: usar runtime del usuario (FreeLLM/OpenModel)
  if (!ctx.runtime.freeLlmApiEnabled && !ctx.runtime.openModelEnabled) {
    return [];
  }

  try {
    const result = await callExtractorLlm(ctx.runtime, ctx.input, ctx.intent, ctx.uiBlocks, ctx.toolResults, ctx.state);
    enhancementCache.set(key, result);
    return result;
  } catch (err) {
    console.warn("[Koru] extractOpportunities (fallback LLM) failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
