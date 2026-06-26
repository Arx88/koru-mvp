import type {
  AssistantPlanItem,
  AssistantSource,
  Commitment,
  KoruConversationMessage,
  KoruState,
  LifeRecord,
  MemoryFact,
  MascotState,
  RelevantMemory,
  ToolCall,
  ToolResult,
  UiBlock,
} from "../domain/types";
import { VALID_MASCOT_STATES } from "../domain/types";
import { selectRelevantMemories } from "../domain/store";
import { generateEnhancements, enhancementPrompt } from "../domain/enhancementEngine";
import { extractOpportunities } from "../domain/enhancementExtractor";
import { extractStructuredData, type ChatFn as ExtractorChatFn, type ExtractionResult } from "../domain/structureExtractor";
import { detectSimulatedToolCall } from "../domain/simulatedToolDetector";
import { SemanticRouter, type EmbedFn, type RouteResult, type RouteCategory } from "../domain/semanticRouter";
import { logger, dump } from "./logger";
import type { ToolDefinition } from "../tools/types";

export type ProviderConfig = {
  nvidiaApiKey?: string;
  nvidiaBaseUrl: string;
  nvidiaModel: string;
  openRouterKeys: string[];
  openRouterModels: string[];
  minimaxAccessToken?: string;
  /** URL de Ollama para embeddings del Semantic Router (nomic-embed-text). */
  ollamaEmbedBaseUrl?: string;
};

export type KoruBackendTurnRequest = {
  input: string;
  history: KoruConversationMessage[];
  state: KoruState;
  model?: string;
  
};

export type KoruUnderstanding = {
  literalRequest: string;
  userGoal: string;
  unstatedNeeds: string[];
  assumptions: string[];
  confidence: number;
};

export type KoruSuggestedAction = {
  id: string;
  label: string;
  kind: "save" | "remind" | "watch" | "compare_more" | "approve" | "calendar" | "research";
  requiresApproval: boolean;
  payload?: Record<string, unknown>;
};

export type KoruBackendTurnResponse = {
  reply: string;
  uiBlocks: UiBlock[];
  suggestedActions: KoruSuggestedAction[];
  understanding: KoruUnderstanding;
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
  commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  toolResults: ToolResult[];
  stateEvents: Array<{ kind: "thinking" | "searching" | "comparing" | "planning" | "saving" | "done"; label: string }>;
  provider: "nvidia" | "openrouter" | "minimax";
  model?: string;
  fallbackReason?: string;
  mascotState?: MascotState;
  skippedBecauseBoundary?: string[];
  behaviorNotes?: string[];
};

type ChatRole = "system" | "user" | "assistant" | "tool";

type ChatMessage = {
  role: ChatRole;
  content?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
};

type ProviderToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type ProviderMessage = {
  content?: string | null;
  tool_calls?: ProviderToolCall[];
};

type ProviderResult = {
  provider: "nvidia" | "openrouter" | "minimax";
  model?: string;
  message: ProviderMessage;
};

type ToolExecution = {
  id: string;
  name: string;
  result: Record<string, unknown>;
};

export type WeatherData = {
  type: "weather";
  city: string;
  now?: string;
  range?: string;
  rain?: string;
  wind?: string;
  advice?: string;
  sources: AssistantSource[];
};

export type SearchData = {
  type: "search";
  mode: "news" | "research" | "shopping" | "world";
  title: string;
  summary: string;
  sources: AssistantSource[];
  comparisonItems?: NonNullable<Extract<UiBlock, { type: "comparison" }>["items"]>;
  /**
   * Promesa diferida que resuelve a un data_card validado (o null si no hay datos).
   * El extractor corre en paralelo al Composer para no sumar latencia al turno.
   * El llamador la awaiting junto con la composición del reply (Promise.all).
   */
  deferredDataCard?: Promise<UiBlock | null>;
};

type PlanData = {
  type: "plan";
  title: string;
  items: AssistantPlanItem[];
  context: string[];
};

export type LocalActionData = {
  type: "local_action";
  block: UiBlock;
  requiresApproval: boolean;
  records?: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  commitments?: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
};

export type PersonalCaptureData = {
  type: "personal_capture";
  block: UiBlock;
  commitments?: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records?: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  memoryCandidates?: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
};

export type PersonalQueryData = {
  type: "personal_query";
  block: UiBlock;
  reply?: string;
};

type MemoryCaptureData = {
  type: "memory_capture";
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
};

// ── ToolBox externo (doc 09): las tools nuevas viven en src/tools/ ──
// Se combinan con las builtin de abajo. El motor no cambia su lógica;
// solo ahora "conoce" más tools. Añadir tools = añadirlas en src/tools/.
import { ALL_TOOL_DEFINITIONS as EXTERNAL_TOOL_DEFINITIONS, TOOL_BOX } from "../tools/toolbox";

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "weather",
      description: "Obtén el clima actual de una ciudad cuando el usuario necesite información sobre condiciones meteorológicas para planificar actividades, vestimenta o desplazamientos. El usuario puede expresar esta necesidad en cualquiera de estas formas: clima, lluvia, nieve, calor, frío, sol, nublado, temporal, outfit, ropa, paraguas, campera, que me pongo, viste, layer, abrigo, o preguntas como '¿Qué tal está afuera?', '¿Necesito chaqueta?', '¿Hace frío?'.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          city: { type: "string", description: "City or location. Do NOT guess. If the user has not stated a location, ask for it first." },
          purpose: { type: "string", description: "Why the user needs this weather, e.g. outfit, meeting, umbrella." },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Busca información actualizada en internet cuando el usuario pregunte sobre algo que ocurre en el mundo exterior y que no está en su contexto personal. Esto incluye: eventos recientes, noticias, figuras públicas, tendencias, avances científicos, datos de mercados, precios de activos, deportes, política, cultura, o cualquier tema que requiera consultar fuentes externas porque cambia con el tiempo. El usuario puede pedir esto de cualquier forma: '¿Qué pasó con...?', '¿Cómo va...?', '¿Quién ganó...?', '¿Cuáles son las últimas...?', o incluso solo mencionando el tema sin pedir explícitamente una búsqueda.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          mode: { type: "string", enum: ["news", "research", "world"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "shopping_compare",
      description: "Compara productos con evidencia de precios, fuentes y pros/contras cuando el usuario esté considerando una compra o necesite evaluar opciones de productos. El usuario puede expresar esto de muchas formas: pidiendo recomendaciones de algo para comprar, mencionando que necesita un producto, comparando dos cosas, buscando la mejor opción, o preguntando dónde comprar algo. También activa cuando el usuario pide review o comparativa de productos técnicos.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          budget: { type: "string" },
          constraints: { type: "array", items: { type: "string" } },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_day",
      description: "Crea un plan práctico para el día considerando los compromisos abiertos, la energía y el contexto del usuario cuando necesite organizar su tiempo o priorizar tareas. El usuario puede pedir esto de cualquier forma: '¿Cómo organizo hoy?', '¿Qué hago primero?', 'Tengo muchas cosas', '¿Me ayudas a planificar?', '¿En qué orden?', 'Siento que no me da el tiempo', o mencionando múltiples tareas pendientes.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          focus: { type: "string" },
          energy: { type: "string", enum: ["low", "medium", "high", "unknown"] },
        },
        required: ["focus"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_personal_context",
      description: "Consulta el contexto personal guardado de Koru para responder preguntas sobre gastos, comida en casa, tareas pendientes, links guardados, notas médicas, personas que conoce, o lo que Koru recuerda. Úsala SIEMPRE que la pregunta pueda resolverse con los datos personales del usuario. NO uses esta herramienta para hechos del mundo exterior.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: { type: "string", enum: ["expenses", "food_inventory", "shopping_list", "pending_tasks", "saved_links", "health", "relationships", "memory", "general"] },
          period: { type: "string", description: "Optional period, e.g. this week, today, this month." },
          query: { type: "string" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save durable reusable memory about the user or people important to the user: preferences, identity, routines, goals, relationships, boundaries, wellbeing, teams/topics to follow. Use this when Koru should know it later.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          memories: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string", description: "Reusable memory sentence in the user's language." },
                kind: { type: "string", enum: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"] },
                sensitivity: { type: "string", enum: ["normal", "sensitive"] },
                useForSuggestions: { type: "boolean" },
                rootQuote: { type: "string" },
              },
              required: ["text", "kind"],
            },
          },
        },
        required: ["memories"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_personal_item",
      description: "Save a personal task, reminder, alarm, shopping item, expense, health item, idea, home task, relationship follow-up, tool link, or any user-owned information. Use instead of only saying it was saved.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          uiBlockType: { type: "string", enum: ["reminder", "alarm", "shopping_list", "saved_record", "money_summary"] },
          title: { type: "string" },
          dueText: { type: "string" },
          time: { type: "string" },
          repeat: { type: "string" },
          note: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          domain: { type: "string", enum: ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"] },
          recordKind: { type: "string", enum: ["expense", "medication", "meal_inventory", "tool_link", "meeting_note", "deadline", "person_followup", "gift", "birthday", "home_task", "shopping_item", "idea", "recommendation", "medical_info", "sleep", "decision"] },
          amount: { type: "number" },
          currency: { type: "string" },
          expenses: {
            type: "array",
            description: "Use when the user mentions multiple expenses in one turn.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                amount: { type: "number" },
                currency: { type: "string" },
                notes: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["title", "amount"],
            },
          },
          person: { type: "string" },
          url: { type: "string" },
          collection: { type: "string", description: "Optional named collection/folder, e.g. Mis enlaces, Regalos mama, Ideas de videos." },
          tags: { type: "array", items: { type: "string" } },
          rememberAs: { type: "string", description: "A durable memory sentence if this is a user preference, identity, routine, goal, relationship detail, or personal context Koru should reuse." },
          memoryKind: { type: "string", enum: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"] },
          sensitivity: { type: "string", enum: ["normal", "sensitive"] },
          useForSuggestions: { type: "boolean" },
          listTitle: { type: "string" },
          summaryTitle: { type: "string" },
        },
        required: ["uiBlockType", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deliver_response",
      description: "Deliver the final Koru response after tools. This is the only valid final answer.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reply: { type: "string" },
          understanding: {
            type: "object",
            additionalProperties: false,
            properties: {
              literalRequest: { type: "string" },
              userGoal: { type: "string" },
              unstatedNeeds: { type: "array", items: { type: "string" } },
              assumptions: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
            required: ["literalRequest", "userGoal", "unstatedNeeds", "assumptions", "confidence"],
          },
          uiBlocks: { type: "array", items: { type: "object" } },
          suggestedActions: { type: "array", items: { type: "object" } },
          memoryCandidates: { type: "array", items: { type: "object" } },
          commitments: { type: "array", items: { type: "object" } },
          records: { type: "array", items: { type: "object" } },
          sentiment: { type: "string", enum: ["calm", "heavy", "busy", "good"] },
        },
        required: ["reply", "understanding", "uiBlocks", "suggestedActions", "memoryCandidates", "commitments", "records"],
      },
    },
  },
] as const;

/**
 * Definiciones finales que el LLM ve = builtin (arriba) + externas (ToolBox).
 * El motor referencia ALL_TOOL_DEFINITIONS en callProvider/callNvidia/etc.
 * Así cualquier tool añadida en src/tools/ queda disponible sin tocar más nada.
 */
const ALL_TOOL_DEFINITIONS = [
  ...TOOL_DEFINITIONS,
  ...EXTERNAL_TOOL_DEFINITIONS,
];

/**
 * Mapeo de categorías del Semantic Router a las tools relevantes.
 * Solo estas tools se envían al LLM cuando el router detecta una categoría
 * con alta confianza, reduciendo drásticamente el tamaño del prompt
 * (especialmente crítico para Ollama local con modelos pequeños).
 */
const CATEGORY_TOOLS: Record<RouteCategory, string[]> = {
  weather: ["weather", "weather_travel"],
  world_info: [
    "web_search",
    "restaurant_deep_search",
    "news_topic",
    "trending_twitter",
    "person_info",
    "world_signal",
  ],
  shopping: ["shopping_compare", "price_history", "product_review"],
  planning: [
    "plan_day",
    "route_plan",
    "reminder_set",
    "alarm_set",
    "calendar_add",
    "travel_itinerary",
  ],
  personal_query: [
    "query_personal_context",
    "expense_track",
    "budget_check",
    "save_memory",
    "save_personal_item",
  ],
  action: [
    "save_memory",
    "save_personal_item",
    "expense_track",
    "reminder_set",
    "alarm_set",
    "restaurant_deep_search",
  ],
  sports: ["match_schedule", "match_live", "team_follow", "league_standings"],
  market: ["crypto_price", "stock_quote", "exchange_history", "currency_convert"],
  travel: ["travel_itinerary", "flight_search", "hotel_search"],
  directions: ["route_traffic", "weather", "travel_itinerary"],
  elections: ["web_search", "news_topic"],
  review: ["shopping_compare", "web_search"],
  birthday: ["save_personal_item", "query_personal_context"],
  conversation: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function cleanText(value: unknown, fallback = ""): string {
  return asString(value)?.replace(/\s+/g, " ").trim() ?? fallback;
}

function plainLower(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function timeFromText(value: string): string | undefined {
  const match = /\b(?:a\s+las|las)\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(plainLower(value));
  if (!match) return undefined;
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = match[2] ? Math.max(0, Math.min(59, Number(match[2]))) : 0;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(raw || "{}"));
  } catch {
    return {};
  }
}

function extractJsonBlock(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (c === "\\") { escapeNext = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text;
}

function safeJsonObjectFromContent(raw: string): Record<string, unknown> {
  const direct = safeJsonParse(raw);
  if (direct.reply !== undefined || direct.uiBlocks !== undefined) return direct;
  const extracted = safeJsonParse(extractJsonBlock(raw));
  if (extracted.reply !== undefined || extracted.uiBlocks !== undefined) return extracted;
  // Dirty extraction: fields individually with regex
  const reply = extractStringField(raw, "reply");
  const mascotState = extractStringField(raw, "mascotState") || extractStringField(raw, "mascot_state");
  if (reply && reply.length > 3) {
    return { reply, mascotState: mascotState || "idle", uiBlocks: [] };
  }
  return {};
}

function extractStringField(raw: string, field: string): string | undefined {
  const idx = raw.toLowerCase().indexOf(`"${field.toLowerCase()}"`);
  if (idx === -1) return undefined;
  let start = raw.indexOf('"', idx + field.length + 2);
  if (start === -1) return undefined;
  start++;
  let i = start;
  let escaped = false;
  while (i < raw.length) {
    const c = raw[i];
    if (escaped) { escaped = false; i++; continue; }
    if (c === '\\') { escaped = true; i++; continue; }
    if (c === '"') break;
    i++;
  }
  return raw.slice(start, i);
}

function cleanReplyText(value: unknown): string {
  return cleanText(value)
    .replace(/\*?\s*uiBlock\s*:\s*[a-z_]+\s*\*?/gi, "")
    .replace(/\buiBlocks?\b\s*[:=]\s*\[[\s\S]*$/i, "")
    .replace(/\b(Hola|Gracias|Perfecto|Listo)(?=[A-ZÁÉÍÓÚÑ])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function wait(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("timeout"), ms);
  });
}

function providerUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function hasUsableAssistantMessage(data: unknown): boolean {
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  const message = asRecord(choice.message);
  return Boolean(asString(message.content) || asString(message.reasoning) || asArray(message.tool_calls).length);
}

async function callMinimax(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  const accessToken = config.minimaxAccessToken;
  if (!accessToken) throw new Error("MiniMax access token not configured");
  logger.info("callMinimax", "Requesting MiniMax", { model: "MiniMax-M2.7", msgCount: messages.length, toolsEnabled });
  const minimaxMessages = messages.map((m) => {
    if (m.role === "tool") {
      let content = m.content ?? "";
      try {
        const data = JSON.parse(content);
        if (data.type === "search" && Array.isArray(data.sources)) {
          const formatted = data.sources
            .map((s: any, i: number) => {
              const text = s.content || s.snippet || "";
              return `${i + 1}. ${s.title} (${s.domain})\n${text}`;
            })
            .filter((s: string) => s.trim().length > 3)
            .join("\n\n");
          content = formatted || `Búsqueda: ${data.title || ""}`;
        } else if (data.type === "weather") {
          content = `Clima - Ciudad: ${data.city || "?"}, Ahora: ${data.now || "?"}, Rango: ${data.range || "?"}, Lluvia: ${data.rain || "?"}, Viento: ${data.wind || "?"}`;
        }
      } catch {
        // mantener contenido original si no es JSON
      }
      return { role: "user" as const, content: `Resultado de herramienta (${m.tool_call_id ?? "unknown"}):\n${content}` };
    }
    if (m.role === "assistant" && m.tool_calls) {
      return {
        role: "assistant" as const,
        content: m.content ?? `Voy a usar herramientas: ${m.tool_calls.map((t) => t.function.name).join(", ")}`,
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });
  const response = await fetchWithTimeout("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: minimaxMessages,
      ...(toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
      temperature: 0.25,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
      reasoning_split: true,
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  const assistantMsg = asRecord(choice.message);
  const content = asString(assistantMsg.content) ?? "";
  const toolCalls = asArray(assistantMsg.tool_calls);
  const reasoningContent = asString(assistantMsg.reasoning_content) ?? "";
  logger.info("callMinimax", `Response HTTP ${response.status}`, { contentPreview: content.slice(0, 500), reasoningPreview: reasoningContent.slice(0, 200), hasTools: toolCalls.length > 0, usage: dump(data.usage, 300) });
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    logger.error("callMinimax", `MiniMax returned ${response.status}`, { body: dump(data, 1000) });
    throw new Error(`MiniMax returned ${response.status}`);
  }
  return {
    provider: "minimax",
    model: asString(asRecord(data).model) ?? "MiniMax-M2.7",
    message: assistantMsg as ProviderMessage,
  };
}

async function callNvidia(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
  availableTools?: ToolDefinition[],
): Promise<ProviderResult> {
  const isOllama = config.nvidiaBaseUrl.includes(":11434") || config.nvidiaBaseUrl.includes("ollama");
  if (isOllama) {
    const body: Record<string, unknown> = {
      model: config.nvidiaModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content ?? "" })),
      ...(toolsEnabled ? {} : { format: "json" }),
      options: { temperature: 0.0, top_p: 0.95, num_predict: 8192 },
      stream: false,
    };
    if (toolsEnabled) {
      body.tools = availableTools ?? ALL_TOOL_DEFINITIONS;
    }
    const response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, timeoutMs);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.message) {
      throw new Error(`Ollama returned ${response.status}`);
    }
    const msg = asRecord(data.message);
    const rawToolCalls = asArray(msg.tool_calls);
    const toolCalls = rawToolCalls.map((tc, index) => {
      const t = asRecord(tc);
      const fn = asRecord(t.function);
      return {
        id: asString(t.id) || `call_${Date.now()}_${index}`,
        type: asString(t.type) || "function",
        function: {
          name: cleanText(fn.name),
          arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments),
        },
      };
    });
    return {
      provider: "nvidia",
      model: asString(data.model) ?? config.nvidiaModel,
      message: {
        role: asString(msg.role) ?? "assistant",
        content: asString(msg.content),
        tool_calls: toolCalls,
      } as ProviderMessage,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.nvidiaApiKey && config.nvidiaApiKey !== "dummy") {
    headers.Authorization = `Bearer ${config.nvidiaApiKey}`;
  }
  const body: Record<string, unknown> = {
    model: config.nvidiaModel,
    messages,
    ...(toolsEnabled ? { tools: availableTools ?? TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
    temperature: 0.25,
    top_p: 0.95,
    max_tokens: 8192,
    stream: false,
  };
  const response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/v1/chat/completions"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    throw new Error(`NVIDIA returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "nvidia",
    model: asString(asRecord(data).model) ?? config.nvidiaModel,
    message: asRecord(choice.message) as ProviderMessage,
  };
}

async function callOpenRouterCandidate(
  key: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": "Koru Agent Loop",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
      temperature: 0.25,
      max_tokens: 8192,
      stream: false,
      response_format: { type: "json_object" },
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    // eslint-disable-next-line no-console
    console.error(`[DEBUG] OpenRouter ${model} unusable. status=${response.status} body=`, JSON.stringify(data).slice(0, 500));
    throw new Error(`OpenRouter ${model} returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "openrouter",
    model: asString(asRecord(data).model) ?? model,
    message: asRecord(choice.message) as ProviderMessage,
  };
}

async function callOpenRouter(config: ProviderConfig, messages: ChatMessage[], timeoutMs: number, toolsEnabled = true): Promise<ProviderResult> {
  const candidates = config.openRouterKeys
    .slice(0, 3)
    .flatMap((key) => config.openRouterModels.slice(0, 3).map((model) => ({ key, model })));
  if (!candidates.length) throw new Error("OpenRouter fallback is not configured.");
  return Promise.any(candidates.map((candidate) => callOpenRouterCandidate(candidate.key, candidate.model, messages, timeoutMs, toolsEnabled)));
}

function providerResultIsValid(result: ProviderResult): boolean {
  const content = result.message?.content ?? "";
  const trimmed = content.trim();
  const hasTools = asArray(result.message?.tool_calls).length > 0;
  const hasContent = trimmed.length > 0;
  return hasContent || hasTools;
}

function isOllamaUrl(baseUrl: string): boolean {
  return baseUrl.includes(":11434") || baseUrl.includes("ollama");
}

function inferProviderFromModel(model: string | undefined): "minimax" | "nvidia" | "openrouter" | undefined {
  if (!model) return undefined;
  if (model === "MiniMax-M2.7") return "minimax";
  if (model.startsWith("hf.co/")) return "nvidia"; // HuggingFace models served by Ollama
  if (!model.includes("/")) return "nvidia"; // Ollama tags without namespace, e.g. qwen3.6:27b, llama3.1:8b
  if (model.startsWith("nvidia/") && !model.includes(":")) return "nvidia"; // NVIDIA API models
  if (model.includes("/") && model.includes(":")) return "openrouter"; // OpenRouter free models (e.g. openai/gpt-oss-120b:free)
  return undefined;
}

async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
  preferredProvider?: "minimax" | "nvidia" | "openrouter",
  availableTools?: ToolDefinition[],
): Promise<ProviderResult & { fallbackReason?: string }> {
  const isOllama = isOllamaUrl(config.nvidiaBaseUrl);
  const nvidiaAvailable = Boolean(config.nvidiaApiKey) || isOllama;

  // SALTO DIRECTO si el usuario eligió un provider específico
  if (preferredProvider === "minimax" && config.minimaxAccessToken) {
    try {
      const result = await callMinimax(config, messages, timeoutMs, toolsEnabled);
      if (providerResultIsValid(result)) {
        logger.info("callProvider", "Preferred MiniMax succeeded");
        return result;
      }
      logger.warn("callProvider", "Preferred MiniMax responded but invalid, falling through");
    } catch (err: any) {
      logger.warn("callProvider", "Preferred MiniMax failed, falling through", { reason: err?.message });
    }
  }

  if (preferredProvider === "nvidia" && nvidiaAvailable) {
    try {
      const result = await callNvidia(config, messages, Math.min(isOllama ? 90_000 : 20_000, timeoutMs), toolsEnabled, availableTools);
      if (providerResultIsValid(result)) return result;
      logger.warn("callProvider", "Preferred NVIDIA responded but invalid, falling back");
    } catch (err: any) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "Preferred NVIDIA failed, falling back", { reason: err?.message });
    }
  }

  if (preferredProvider === "openrouter" && config.openRouterKeys.length) {
    return callOpenRouter(config, messages, Math.min(18_000, timeoutMs), toolsEnabled);
  }

  // FLUJO NORMAL (sin preferencia o preferencia fallida)
  // Si el usuario eligió un provider específico que no es MiniMax, no lo intentamos.
  if (config.minimaxAccessToken && (!preferredProvider || preferredProvider === "minimax")) {
    try {
      const result = await callMinimax(config, messages, timeoutMs, toolsEnabled);
      if (providerResultIsValid(result)) {
        logger.info("callProvider", "MiniMax succeeded");
        return result;
      }
      logger.warn("callProvider", "MiniMax responded but invalid, falling through");
    } catch (err: any) {
      logger.warn("callProvider", "MiniMax failed, falling through", { reason: err?.message });
    }
  }

  if (!nvidiaAvailable) {
    return callOpenRouter(config, messages, Math.min(18_000, timeoutMs), toolsEnabled);
  }

  // Si el usuario eligió OpenRouter, saltamos NVIDIA en el flujo normal
  if (!preferredProvider || preferredProvider !== "openrouter") {
    try {
      const result = await callNvidia(config, messages, Math.min(isOllama ? 90_000 : 20_000, timeoutMs), toolsEnabled, availableTools);
      if (providerResultIsValid(result)) return result;
      logger.warn("callProvider", "NVIDIA responded but invalid, falling back");
    } catch (err: any) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "NVIDIA failed, falling back to OpenRouter", { reason: err?.message });
    }
  }

  if (config.openRouterKeys.length) {
    return callOpenRouter(config, messages, Math.min(18_000, timeoutMs), toolsEnabled);
  }

  throw new Error("Ningún proveedor de IA respondió. Verificá la conexión o las credenciales.");
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

function isRateLimitError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota") || msg.includes("free-models-per-day");
}

function sourceFromUrl(title: string, url: string, snippet?: string): AssistantSource {
  let domain = "fuente externa";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = "fuente externa";
  }
  return { title, url, domain, snippet };
}

async function geocodeCity(city: string): Promise<{ name: string; latitude: number; longitude: number } | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 8_000);
  const data = await response.json().catch(() => ({})) as { results?: Array<{ name?: string; latitude?: number; longitude?: number; country?: string }> };
  const result = data.results?.[0];
  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") return null;
  return {
    name: [result.name, result.country].filter(Boolean).join(", "),
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

export async function getWeather(args: Record<string, unknown>): Promise<WeatherData> {
  const requestedCity = cleanText(args.city, "Madrid");
  const location = await geocodeCity(requestedCity);
  if (!location) {
    return {
      type: "weather",
      city: requestedCity,
      advice: "No pude ubicar esa ciudad con Open-Meteo. No invento clima.",
      sources: [],
    };
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
  url.searchParams.set("hourly", "precipitation_probability,temperature_2m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 8_000);
  const data = await response.json().catch(() => ({})) as {
    current?: { temperature_2m?: number; precipitation?: number; wind_speed_10m?: number };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
  };
  const current = data.current;
  const max = data.daily?.temperature_2m_max?.[0];
  const min = data.daily?.temperature_2m_min?.[0];
  const rain = data.daily?.precipitation_probability_max?.[0];
  const wind = current?.wind_speed_10m;
  const temp = current?.temperature_2m;
  const advice = [
    temp !== undefined ? `${Math.round(temp)} C ahora` : undefined,
    rain !== undefined && rain >= 50 ? "conviene paraguas" : rain !== undefined ? "lluvia poco probable" : undefined,
    min !== undefined && min <= 10 ? "lleva abrigo si sales tarde" : undefined,
  ].filter(Boolean).join("; ");
  return {
    type: "weather",
    city: location.name,
    now: temp !== undefined ? `${Math.round(temp)} C` : undefined,
    range: min !== undefined && max !== undefined ? `${Math.round(min)}-${Math.round(max)} C` : undefined,
    rain: rain !== undefined ? `${rain}%` : undefined,
    wind: wind !== undefined ? `${Math.round(wind)} km/h` : undefined,
    advice: advice || "Clima consultado con fuente abierta.",
    sources: [sourceFromUrl("Open-Meteo", "https://open-meteo.com/", "Datos abiertos de clima y pronostico.")],
  };
}

function htmlText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchDuckDuckGo(query: string): Promise<AssistantSource[]> {
  const response = await fetchWithTimeout(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 KoruAgent/1.0",
      Accept: "text/html",
    },
  }, 10_000);
  const html = await response.text();
  const sources: AssistantSource[] = [];
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultRe.exec(html)) && sources.length < 6) {
    const rawUrl = match[1];
    let url = rawUrl;
    try {
      const parsed = new URL(rawUrl, "https://duckduckgo.com");
      url = parsed.searchParams.get("uddg") ?? parsed.href;
    } catch {
      url = rawUrl;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    const domain = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "";
      }
    })();
    if (/duckduckgo\.com|google\.com|bing\.com/i.test(domain)) continue;
    sources.push(sourceFromUrl(htmlText(match[2]), url, htmlText(match[3]).slice(0, 260)));
  }
  return sources;
}

async function searchGdelt(query: string): Promise<AssistantSource[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "6");
  url.searchParams.set("sort", "HybridRel");
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 10_000);
  const data = await response.json().catch(() => ({})) as { articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }> };
  return (data.articles ?? [])
    .filter((item) => item.title && item.url)
    .slice(0, 6)
    .map((item) => sourceFromUrl(item.title!, item.url!, item.seendate));
}

async function fetchPageContent(url: string, maxChars = 1200): Promise<string> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 8_000);
    const html = await res.text();

    // Extraer contenido principal: intentar <article>, luego <main>, luego clases comunes
    let contentHtml = html;
    const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      contentHtml = articleMatch[1];
    } else {
      const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) {
        contentHtml = mainMatch[1];
      } else {
        const classMatch = html.match(/<(?:div|section)\b[^>]*\b(?:class|id)="(?:entry-content|article-body|post-content|story-body|content-body|texto-nota|nota-content|article__content|main-content|nota-texto|content-text)[^"]*"[^>]*>([\s\S]*?)<\/\1>/i);
        if (classMatch) {
          contentHtml = classMatch[2] ?? classMatch[1];
        }
      }
    }

    // Si no encontramos nada semántico, buscar la zona con más <p> consecutivos
    if (contentHtml === html) {
      const pMatches = html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
      const paragraphs: string[] = [];
      for (const m of pMatches) {
        const text = m[1].replace(/<[^>]+>/g, " ").trim();
        if (text.length > 40) paragraphs.push(text);
      }
      if (paragraphs.length > 0) {
        contentHtml = paragraphs.slice(0, 8).join(" ");
      }
    }

    const text = contentHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

export async function runSearch(
  args: Record<string, unknown>,
  shopping = false,
  extractorCtx?: { userInput: string; chatFn: ExtractorChatFn; onDeferredChunk?: (block: UiBlock) => void },
): Promise<SearchData> {
  const query = cleanText(args.query, "noticias importantes hoy");
  const mode = shopping ? "shopping" : cleanText(args.mode, "research") as SearchData["mode"];
  const expanded = mode === "world"
    ? `${query} ultimos 30 dias tendencias`
    : mode === "news"
      ? `${query} noticias recientes`
      : shopping
        ? `${query} precio opiniones entrega`
        : query;
  const gdelt = mode === "news" || mode === "world" ? await searchGdelt(expanded).catch(() => []) : [];
  const duck = gdelt.length ? [] : await searchDuckDuckGo(expanded).catch(() => []);
  let sources = [...gdelt, ...duck].slice(0, 6);
  const comparisonItems = shopping
    ? sources.slice(0, 4).map((source, index) => ({
        title: source.title,
        vendor: source.domain,
        url: source.url,
        evidence: source.snippet,
        score: Math.max(55, 88 - index * 8),
      }))
    : undefined;

  // Scrape content from first 3 sources for synthesis
  for (let i = 0; i < Math.min(sources.length, 3); i++) {
    sources[i].content = await fetchPageContent(sources[i].url, 1200);
  }

  // ── Extracción de estructura validada (NO BLOQUEANTE) ──
  // runSearch devuelve inmediatamente con los sources (web_nav). La extracción
  // corre como promesa diferida que el llamador espera EN PARALELO con la
  // composición del reply. Así el extractor (~11s) queda oculto detrás del
  // Composer, no suma latencia al turno. Si encuentra datos validados, se
  // convierten en un data_card que se adjunta al resultado final.
  let deferredDataCard: Promise<UiBlock | null> | undefined;
  if (extractorCtx && !shopping && sources.length > 0) {
    const sourcesCopy = sources.map((s) => ({ ...s }));
    const userInput = extractorCtx.userInput;
    const chatFn = extractorCtx.chatFn;
    const extractStart = Date.now();
    deferredDataCard = (async (): Promise<UiBlock | null> => {
      try {
        const extracted = await extractStructuredData({ userInput, sources: sourcesCopy, chatFn });
        logger.info("runSearch", "Structure extraction (deferred)", {
          extracted: extracted ? `${extracted.items.length} items` : "none",
          durationMs: Date.now() - extractStart,
        });
        if (!extracted || extracted.items.length === 0) return null;
        return {
          type: "data_card" as const,
          title: extracted.title,
          items: extracted.items.map((it) => ({
            label: it.label,
            value: it.value,
            detail: it.detail,
            quote: it.quote,
            sourceUrl: it.sourceUrl,
            sourceDomain: it.sourceDomain,
          })),
        };
      } catch (err: any) {
        logger.warn("runSearch", "Deferred structure extraction failed (non-fatal)", { reason: err?.message });
        return null;
      }
    })();
  }

  return {
    type: "search",
    mode,
    title: shopping ? "Comparativa" : mode === "news" ? "Noticias importantes" : mode === "world" ? "El mundo esta hablando de esto" : "Busqueda",
    summary: sources.length ? "" : "No pude conseguir fuentes útiles con los conectores abiertos. No inventes resultados.",
    sources,
    comparisonItems,
    deferredDataCard,
  };
}

export function planFromState(state: KoruState, args: Record<string, unknown>): PlanData {
  const openCommitments = state.commitments.filter((item) => item.status === "open").slice(0, 5);
  const recentRecords = state.records.slice(0, 5);
  const focus = cleanText(args.focus, "ordenar el dia");
  const candidates = openCommitments.length
    ? openCommitments.map((item) => item.title)
    : recentRecords.length
      ? recentRecords.map((item) => item.title)
      : [focus, "Elegir el primer paso", "Cerrar con una accion chica"];
  const items: AssistantPlanItem[] = candidates.slice(0, 4).map((title, index) => ({
    time: index === 0 ? "Ahora" : index === 1 ? "+25m" : index === 2 ? "+50m" : "+75m",
    title: index === 0 ? `Primer paso: ${title}` : title,
    priority: index === 0 ? "Alta" : index === 1 ? "Media" : "Baja",
    durationMinutes: index === 0 ? 25 : 15,
    mode: index === 0 ? "focus" : "quick",
    rationale: index === 0 ? "Empieza por lo que mas reduce carga mental." : "Lo dejo chico para que no bloquee.",
  }));
  return {
    type: "plan",
    title: "Plan accionable",
    items,
    context: [
      ...openCommitments.map((item) => `Pendiente: ${item.title} (${item.dueHint})`),
      ...recentRecords.map((item) => `Dato: ${item.title}`),
    ].slice(0, 8),
  };
}

export function localReminderFromArgs(args: Record<string, unknown>, input = ""): LocalActionData {
  const title = cleanText(args.title, input || "Recordatorio");
  const dueText = cleanText(args.dueText ?? args.dueHint ?? args.startsAt, "sin fecha");
  const note = cleanText(args.note);
  return {
    type: "local_action",
    requiresApproval: true,
    block: {
      type: "reminder",
      title,
      dueText,
      note,
    },
    commitments: [{ title, dueHint: dueText, status: "open" }],
    records: [{
      domain: "capture",
      kind: "deadline",
      title,
      value: title,
      dueHint: dueText,
      notes: note,
    }],
  };
}

export function localAlarmFromArgs(args: Record<string, unknown>, input = ""): LocalActionData {
  const title = cleanText(args.title, input || "Alarma");
  const time = cleanText(args.time ?? args.startsAt ?? args.hour) || timeFromText(`${title} ${cleanText(args.note)} ${cleanText(args.dueText)}`) || "hora pendiente";
  const repeat = cleanText(args.repeat);
  const note = cleanText(args.note);
  return {
    type: "local_action",
    requiresApproval: true,
    block: {
      type: "alarm",
      title,
      time,
      repeat,
      note,
    },
    commitments: [{ title, dueHint: time, status: "open" }],
    records: [{
      domain: "capture",
      kind: "deadline",
      title,
      value: title,
      dueHint: time,
      notes: note,
    }],
  };
}

function isRecordInPeriod(record: LifeRecord, period: string): boolean {
  const normalized = plainLower(period);
  if (!normalized || !record.createdAt) return true;
  const created = new Date(record.createdAt);
  if (Number.isNaN(created.getTime())) return true;
  const now = new Date();
  const ageMs = now.getTime() - created.getTime();
  if (/\bhoy|today\b/.test(normalized)) return ageMs >= 0 && ageMs <= 36 * 60 * 60 * 1000;
  if (/\bsemana|week\b/.test(normalized)) return ageMs >= 0 && ageMs <= 8 * 24 * 60 * 60 * 1000;
  if (/\bmes|month\b/.test(normalized)) return ageMs >= 0 && ageMs <= 32 * 24 * 60 * 60 * 1000;
  return true;
}

function rowsFromRecords(records: LifeRecord[]): NonNullable<Extract<UiBlock, { type: "activity_group" }>["sections"][number]["rows"]> {
  return records.slice(0, 8).map((record) => ({
    title: record.title,
    detail: [record.value && record.value !== record.title ? record.value : undefined, record.notes].filter(Boolean).join(" - "),
    meta: [record.person, record.dueHint, record.amount !== undefined ? `${record.amount} ${record.currency || ""}`.trim() : undefined].filter(Boolean).join(" · "),
    actionLabel: record.url ? "Abrir" : undefined,
  }));
}

function emptyContextBlock(title: string, _note: string): Extract<UiBlock, { type: "activity_group" }> {
  return {
    type: "activity_group",
    title,
    subtitle: "No tengo datos guardados para eso todavia.",
    sections: [
      {
        title: "Siguiente paso",
        tone: "neutral",
        rows: [{ title: _note }],
      },
    ],
    note: _note,
  };
}

function recordSearchText(record: LifeRecord): string {
  return [
    record.kind,
    record.domain,
    record.title,
    record.value,
    record.notes,
    record.url,
    record.collection,
    record.person,
    ...(record.tags ?? []),
  ].filter(Boolean).join(" ");
}

function queryTokens(query: string): string[] {
  return plainLower(query)
    .replace(/[^\p{L}\p{N}\s:/._-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !["que", "con", "por", "sin", "mas", "los", "las", "del", "una", "uno", "mis", "tengo", "sobre", "guarde", "guardado", "guardaste"].includes(token));
}

function semanticRecordMatches(records: LifeRecord[], query: string, limit = 8): LifeRecord[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  return records
    .map((record) => {
      const haystack = plainLower(recordSearchText(record));
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { record, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.record)
    .slice(0, limit);
}

function uniqueLifeRecords(records: LifeRecord[]): LifeRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.id}|${record.domain}|${record.kind}|${plainLower(record.title)}|${plainLower(record.value ?? "")}|${plainLower(record.url ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function queryPersonalContextFromState(state: KoruState, args: Record<string, unknown>): PersonalQueryData {
  const topic = cleanText(args.topic, "general");
  const query = cleanText(args.query, cleanText(args.__userInput));
  const period = cleanText(args.period);
  const records = state.records.filter((record) => isRecordInPeriod(record, period));

  if (topic === "expenses") {
    const expenses = records.filter((record) => record.kind === "expense");
    if (!expenses.length) {
      return {
        type: "personal_query",
        block: {
          type: "money_summary",
          title: "Gastos",
          summaryItems: [{ label: "Registros", value: "0" }],
          recommendation: "No tengo gastos guardados para ese periodo. Si me decis uno, lo anoto y despues puedo sumarlo.",
        },
      };
    }
    const currency = expenses.find((record) => record.currency)?.currency || "EUR";
    const withAmount = expenses.filter((record) => typeof record.amount === "number");
    const total = withAmount.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    return {
      type: "personal_query",
      block: {
        type: "money_summary",
        title: "Gastos registrados",
        total: withAmount.length ? Number(total.toFixed(2)) : undefined,
        currency,
        summaryItems: [
          { label: "Con monto", value: String(withAmount.length), detail: `${expenses.length} registro(s) en total` },
          ...(expenses.length - withAmount.length > 0 ? [{ label: "Sin monto", value: String(expenses.length - withAmount.length), detail: "Los cuento, pero no los sumo." }] : []),
        ],
        recommendation: withAmount.length
          ? `Tengo registrado ${Number(total.toFixed(2))} ${currency} en ${withAmount.length} gasto(s).`
          : "Tengo gastos guardados, pero sin monto. No invento el total.",
      },
    };
  }

  if (topic === "food_inventory") {
    const food = records.filter((record) => record.kind === "meal_inventory");
    if (!food.length) return { type: "personal_query", block: { type: "saved_record", title: "Comida en casa", records: [] } };
    return {
      type: "personal_query",
      block: {
        type: "activity_group",
        title: "Comida en casa",
        subtitle: `Tengo ${food.length} cosa(s) guardadas.`,
        sections: [
          {
            title: "Disponible",
            tone: "green",
            tiles: food.slice(0, 6).map((record) => ({
              kind: "food" as const,
              label: "En casa",
              value: record.title,
              detail: record.notes || record.value,
            })),
          },
          {
            title: "Ideas rapidas",
            tone: "amber",
            rows: [{ title: `Con ${food.slice(0, 3).map((record) => record.title).join(", ")} podes armar algo simple sin comprar primero.` }],
          },
        ],
      },
    };
  }

  if (topic === "shopping_list") {
    const shopping = records.filter((record) => record.kind === "shopping_item");
    if (!shopping.length) return { type: "personal_query", block: emptyContextBlock("Compras", "No tengo una lista de compras activa guardada.") };
    const items = shopping.map((record) => record.title).filter(Boolean).slice(0, 30);
    return {
      type: "personal_query",
      block: {
        type: "shopping_list",
        title: "Lista del super",
        items,
        note: "La arme desde tus pendientes guardados.",
      },
    };
  }

  if (topic === "pending_tasks") {
    const open = state.commitments.filter((item) => item.status === "open").slice(0, 8);
    if (!open.length) return { type: "personal_query", block: emptyContextBlock("Pendientes", "No veo pendientes abiertos. Si queres, tirame una descarga de cosas y las ordeno.") };
    return {
      type: "personal_query",
      block: {
        type: "plan",
        title: "Pendientes abiertos",
        items: open.map((item, index) => ({
          time: index === 0 ? "Ahora" : undefined,
          title: item.title,
          priority: index === 0 ? "Alta" : index < 3 ? "Media" : "Baja",
          durationMinutes: index === 0 ? 25 : 10,
          mode: index === 0 ? "focus" : "quick",
          rationale: item.dueHint,
        })),
        note: "Los ordene desde lo que Koru tiene guardado.",
      },
    };
  }

  const kindByTopic: Record<string, LifeRecord["kind"][]> = {
    saved_links: ["tool_link"],
    health: ["medication", "medical_info", "sleep"],
    relationships: ["person_followup", "gift", "birthday"],
    memory: [],
    general: ["idea", "recommendation", "deadline", "home_task", "meeting_note", "decision"],
  };

  if (topic === "memory") {
    const useful = state.memories
      .filter((memory) => memory.status !== "rejected" && memory.useForSuggestions !== false)
      .slice(0, 8);
    if (!useful.length) return { type: "personal_query", block: { type: "saved_record", title: "Memoria", records: [] } };
    return {
      type: "personal_query",
      block: {
        type: "activity_group",
        title: "Lo que tengo presente",
        subtitle: `${useful.length} recuerdo(s) utiles.`,
        sections: [
          {
            title: "Memoria",
            tone: "purple",
            rows: useful.map((memory) => ({
              title: memory.text,
              meta: memory.kind,
              detail: memory.rootQuote,
            })),
          },
        ],
      },
    };
  }

  if (topic === "relationships") {
    const relationshipRecords = records.filter((record) => ["person_followup", "gift", "birthday"].includes(record.kind));
    const relationshipMemories = state.memories
      .filter((memory) => memory.status !== "rejected" && memory.useForSuggestions !== false)
      .filter((memory) => memory.kind === "relationship" || semanticRecordMatches([{
        id: memory.id,
        domain: "relationship",
        kind: "person_followup",
        title: memory.text,
        value: memory.rootQuote,
        createdAt: memory.createdAt,
        sourceEntryId: memory.sourceEntryId,
      }], query, 1).length > 0)
      .slice(0, 8);
    const semanticRelationships = semanticRecordMatches(records, query).filter((record) => record.domain === "relationship" || ["person_followup", "gift", "birthday"].includes(record.kind));
    const finalRecords = uniqueLifeRecords([...relationshipRecords, ...semanticRelationships]).slice(0, 8);
    if (!finalRecords.length && !relationshipMemories.length) {
      return { type: "personal_query", block: emptyContextBlock("Relaciones", "No encontre datos guardados sobre esa persona todavia.") };
    }
    return {
      type: "personal_query",
      block: {
        type: "activity_group",
        title: "Relaciones",
        subtitle: `${finalRecords.length + relationshipMemories.length} dato(s) para tener en cuenta.`,
        sections: [
          ...(finalRecords.length ? [{
            title: "Guardado",
            tone: "purple" as const,
            rows: rowsFromRecords(finalRecords),
          }] : []),
          ...(relationshipMemories.length ? [{
            title: "Memoria",
            tone: "purple" as const,
            rows: relationshipMemories.map((memory) => ({
              title: memory.text,
              detail: memory.rootQuote,
              meta: memory.kind,
            })),
          }] : []),
        ],
      },
    };
  }

  const acceptedKinds = kindByTopic[topic] ?? kindByTopic.general;
  const queryLower = plainLower(query);
  const semanticMatches = semanticRecordMatches(records, query);
  const matching = topic === "saved_links"
    ? records.filter((record) =>
        record.kind === "tool_link" ||
        Boolean(record.url) ||
        Boolean(record.collection && queryLower.includes(plainLower(record.collection))) ||
        Boolean(record.tags?.some((tag) => queryLower.includes(plainLower(tag))))
      )
    : topic === "general"
      ? (query ? [] : records)
      : acceptedKinds.length ? records.filter((record) => acceptedKinds.includes(record.kind)) : records;
  const finalMatches = uniqueLifeRecords([...matching, ...semanticMatches]).slice(0, 8);
  if (!finalMatches.length) return { type: "personal_query", block: { type: "saved_record", title: "Contexto guardado", records: [] } };
  return {
    type: "personal_query",
    block: {
      type: "activity_group",
      title: topic === "saved_links" ? "Enlaces guardados" : topic === "health" ? "Salud" : topic === "relationships" ? "Relaciones" : "Contexto guardado",
      subtitle: `${finalMatches.length} dato(s) encontrados.`,
      sections: [
        {
          title: "Guardado",
          tone: topic === "health" ? "blue" : topic === "relationships" ? "purple" : "neutral",
          rows: rowsFromRecords(finalMatches),
        },
      ],
    },
  };
}

function inputMentionsValue(input: string, value: string): boolean {
  if (!value) return false;
  return plainLower(input).includes(plainLower(value));
}

function argsWithCaptureHygiene(args: Record<string, unknown>, input: string): Record<string, unknown> {
  const next = { ...args };
  let uiBlockType = cleanText(next.uiBlockType);
  let recordKind = cleanText(next.recordKind);
  const collection = cleanText(next.collection);
  const title = cleanText(next.title);
  const items = asArray(next.items).map((item) => cleanText(item)).filter(Boolean);
  const inputLower = plainLower(input);

  if (collection && !inputMentionsValue(input, collection) && !/\b(esa|ahi|alli|misma|mismo|carpeta|coleccion)\b/i.test(inputLower)) {
    delete next.collection;
  }

  if (uiBlockType === "shopping_list" || recordKind === "shopping_item") {
    next.uiBlockType = "shopping_list";
    next.recordKind = "shopping_item";
    next.domain = "home";
    uiBlockType = "shopping_list";
    recordKind = "shopping_item";
    if (!items.length && title) next.items = [title];
    if (!inputMentionsValue(input, cleanText(next.collection))) delete next.collection;
  }

  if (recordKind === "meal_inventory") {
    next.uiBlockType = "saved_record";
    next.recordKind = "meal_inventory";
    next.domain = "home";
    uiBlockType = "saved_record";
    recordKind = "meal_inventory";
  }

  if ((uiBlockType === "money_summary" || recordKind === "expense") && asArray(next.expenses).length) {
    next.uiBlockType = "money_summary";
    next.recordKind = "expense";
    next.domain = "money";
    uiBlockType = "money_summary";
    recordKind = "expense";
  }

  return next;
}

export function memoryCaptureFromArgs(args: Record<string, unknown>, input = ""): MemoryCaptureData {
  const memories = asArray(args.memories).map(asRecord).map((item) => {
    const kind = ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(cleanText(item.kind))
      ? cleanText(item.kind) as MemoryFact["kind"]
      : "profile";
    const sensitivity = cleanText(item.sensitivity) === "sensitive" ? "sensitive" as const : "normal" as const;
    return {
      kind,
      text: cleanText(item.text),
      confidence: 0.84,
      sensitivity,
      status: "candidate" as const,
      rootQuote: cleanText(item.rootQuote ?? item.root_quote, input),
      useForSuggestions: item.useForSuggestions === false || item.use_for_suggestions === false ? false : sensitivity !== "sensitive",
    };
  }).filter((memory) => memory.text.length > 4).slice(0, 8);
  return { type: "memory_capture", memoryCandidates: memories };
}

export function personalCaptureFromArgs(args: Record<string, unknown>, input = ""): PersonalCaptureData {
  const cleanArgs = argsWithCaptureHygiene(args, input);
  const requestedType = cleanText(cleanArgs.uiBlockType, "saved_record");
  const uiBlockType = ["reminder", "alarm", "shopping_list", "saved_record", "money_summary"].includes(requestedType)
    ? requestedType
    : "saved_record";
  const title = cleanText(cleanArgs.title, input || "Dato guardado");
  const dueText = cleanText(cleanArgs.dueText);
  const note = cleanText(cleanArgs.note);
  const time = cleanText(cleanArgs.time) || timeFromText(`${cleanText(cleanArgs.time)} ${cleanText(cleanArgs.dueText)}`) || "";
  const repeat = cleanText(cleanArgs.repeat);
  const domain = ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"].includes(cleanText(cleanArgs.domain))
    ? cleanText(cleanArgs.domain) as LifeRecord["domain"]
    : "capture";
  const url = cleanText(cleanArgs.url);
  const collection = cleanText(cleanArgs.collection);
  const tags = [
    ...asArray(cleanArgs.tags).map((tag) => cleanText(tag)).filter(Boolean),
    ...(collection ? [collection] : []),
  ];
  const remembered = cleanText(cleanArgs.rememberAs);
  const requestedMemoryKind = cleanText(cleanArgs.memoryKind);
  const memoryKind = ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(requestedMemoryKind)
    ? requestedMemoryKind as MemoryFact["kind"]
    : "profile";
  const memorySensitivity = cleanText(cleanArgs.sensitivity) === "sensitive" ? "sensitive" as const : "normal" as const;
  const memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] = remembered
    ? [{
        kind: memoryKind,
        text: remembered,
        confidence: 0.82,
        sensitivity: memorySensitivity,
        status: "candidate",
        rootQuote: input || remembered,
        useForSuggestions: cleanArgs.useForSuggestions === false ? false : memorySensitivity !== "sensitive",
      }]
    : [];
  const recordKind = url
    ? "tool_link"
    : ["expense", "medication", "meal_inventory", "tool_link", "meeting_note", "deadline", "person_followup", "gift", "birthday", "home_task", "shopping_item", "idea", "recommendation", "medical_info", "sleep", "decision"].includes(cleanText(cleanArgs.recordKind))
    ? cleanText(cleanArgs.recordKind) as LifeRecord["kind"]
    : uiBlockType === "shopping_list"
      ? "shopping_item"
      : uiBlockType === "money_summary"
        ? "expense"
        : "idea";
  const items = asArray(cleanArgs.items).map((item) => cleanText(item)).filter(Boolean);
  const amount = typeof cleanArgs.amount === "number" ? cleanArgs.amount : undefined;
  const currency = cleanText(cleanArgs.currency) || (amount !== undefined ? "EUR" : "");
  const expenses = asArray(cleanArgs.expenses).map(asRecord).map((expense) => ({
    title: cleanText(expense.title),
    amount: typeof expense.amount === "number" ? expense.amount : undefined,
    currency: cleanText(expense.currency, currency || "EUR"),
    notes: cleanText(expense.notes),
    tags: asArray(expense.tags).map((tag) => cleanText(tag)).filter(Boolean),
  })).filter((expense): expense is { title: string; amount: number; currency: string; notes: string; tags: string[] } => Boolean(expense.title && expense.amount !== undefined));
  const effectiveUiBlockType = recordKind === "expense" && amount !== undefined ? "money_summary" : uiBlockType;
  const baseRecord: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
    domain,
    kind: recordKind,
    title,
    value: items.length ? items.join(", ") : title,
    amount,
    currency,
    person: cleanText(cleanArgs.person),
    url,
    collection,
    dueHint: dueText,
    notes: note,
    tags,
  };

  if (effectiveUiBlockType === "alarm") {
    return {
      type: "personal_capture",
      block: { type: "alarm", title, time: time || dueText || "hora pendiente", repeat, note },
      commitments: [{ title, dueHint: time || dueText || "hora pendiente", status: "open" }],
      records: [baseRecord],
      memoryCandidates,
    };
  }

  if (effectiveUiBlockType === "reminder") {
    return {
      type: "personal_capture",
      block: { type: "reminder", title, dueText, note },
      commitments: [{ title, dueHint: dueText || "sin fecha", status: "open" }],
      records: [baseRecord],
      memoryCandidates,
    };
  }

  if (effectiveUiBlockType === "shopping_list") {
    const shoppingItems = items.length ? items : [title];
    return {
      type: "personal_capture",
      block: { type: "shopping_list", title: cleanText(cleanArgs.listTitle, "Lista de compras"), items: shoppingItems, dueText, note },
      commitments: [{ title: `Comprar ${shoppingItems.join(", ")}`, dueHint: dueText || "proxima compra", status: "open" }],
      records: shoppingItems.map((item) => ({
      domain: "home",
      kind: "shopping_item",
      title: item,
      value: item,
      collection,
      dueHint: dueText,
      notes: note,
      tags,
      })),
      memoryCandidates,
    };
  }

  if (recordKind === "meal_inventory") {
    const inventoryItems = items.length ? items : [title];
    const records = inventoryItems.map((item) => ({
      domain: "home" as const,
      kind: "meal_inventory" as const,
      title: item,
      value: item,
      collection,
      notes: note,
      tags,
    }));
    return {
      type: "personal_capture",
      block: { type: "saved_record", title: collection || "Comida en casa", records },
      records,
      memoryCandidates,
    };
  }

  if (expenses.length) {
    const total = Number(expenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
    const expenseRecords = expenses.map((expense) => ({
      domain: "money" as const,
      kind: "expense" as const,
      title: expense.title,
      value: expense.title,
      amount: expense.amount,
      currency: expense.currency,
      notes: expense.notes,
      tags: expense.tags,
    }));
    return {
      type: "personal_capture",
      block: {
        type: "money_summary",
        title: cleanText(cleanArgs.summaryTitle, "Gastos anotados"),
        total,
        currency: expenses[0]?.currency || "EUR",
        summaryItems: expenses.map((expense) => ({ label: expense.title, value: `${expense.amount} ${expense.currency}`, detail: expense.notes })),
        recommendation: note || `${expenses.length} gasto(s) registrados.`,
      },
      records: expenseRecords,
      memoryCandidates,
    };
  }

  if (effectiveUiBlockType === "money_summary") {
    return {
      type: "personal_capture",
      block: {
        type: "money_summary",
        title: cleanText(cleanArgs.summaryTitle, "Gasto anotado"),
        total: amount,
        currency: currency || "EUR",
        recommendation: note || title,
      },
      records: [{ ...baseRecord, domain: "money", kind: "expense" }],
      memoryCandidates,
    };
  }

  return {
    type: "personal_capture",
    block: { type: "saved_record", title: collection || "Guardado", records: [baseRecord] },
    records: [baseRecord],
    memoryCandidates: [
      ...memoryCandidates,
      ...(recordKind === "idea" || recordKind === "recommendation"
        ? [{ kind: "preference" as const, text: title, confidence: 0.65, sensitivity: "normal" as const, status: "candidate" as const, rootQuote: title, useForSuggestions: true }]
        : []),
    ],
  };
}
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: KoruState,
  extractorCtx?: { userInput: string; chatFn: ExtractorChatFn },
): Promise<{ result: Record<string, unknown>; deferredDataCard?: Promise<UiBlock | null> }> {
  logger.info("executeTool", `Executing tool: ${name}`, { argsKeys: Object.keys(args) });
  let result: Record<string, unknown>;
  let deferredDataCard: Promise<UiBlock | null> | undefined;
  if (name === "weather") result = await getWeather(args) as unknown as Record<string, unknown>;
  else if (name === "web_search") {
    const searchData = await runSearch(args, false, extractorCtx);
    deferredDataCard = searchData.deferredDataCard;
    result = searchData as unknown as Record<string, unknown>;
  }
  else if (name === "shopping_compare") result = await runSearch(args, true) as unknown as Record<string, unknown>;
  else if (name === "route_traffic") result = await runSearch({ ...args, mode: "research", query: cleanText(args.query) || [cleanText(args.origin), cleanText(args.destination)].filter(Boolean).join(" a ") || cleanText(args.__userInput) }, false) as unknown as Record<string, unknown>;
  else if (name === "calendar_reminder") result = localReminderFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  else if (name === "alarm") result = localAlarmFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  else if (name === "plan_day") result = planFromState(state, args) as unknown as Record<string, unknown>;
  else if (name === "query_personal_context") result = queryPersonalContextFromState(state, args) as unknown as Record<string, unknown>;
  else if (name === "save_memory") result = memoryCaptureFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  else if (name === "save_personal_item") result = personalCaptureFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  else {
    // ── ToolBox externo (doc 09): tools nuevas viven en src/tools/ ──
    // Si la tool no es builtin, la buscamos en el ToolBox. El motor no cambia
    // su lógica; solo delega al handler externo si existe.
    const handler = TOOL_BOX.get(name);
    if (handler) {
      const runResult = await handler.run({ ...args, __userInput: cleanText(args.__userInput) }, {
        userInput: cleanText(args.__userInput),
        state,
        chatFn: extractorCtx?.chatFn as never,
      });
      result = runResult as Record<string, unknown>;
      deferredDataCard = runResult.deferredDataCard;
    } else {
      logger.warn("executeTool", `Unknown tool: ${name}`);
      return { result: { type: "unknown", error: `Unknown tool ${name}` } };
    }
  }
  logger.info("executeTool", `Tool ${name} result`, { result: dump(result, 500) });
  return { result, deferredDataCard };
}

function stateSummary(state: KoruState): string {
  const confirmedMemories = state.memories
    .filter((item) => item.status === "confirmed" && item.useForSuggestions !== false)
    .slice(0, 12)
    .map((item) => `- ${item.kind}: ${item.text.replace(/[\n\r`]+/g, " ").trim()}`)
    .join("\n") || "- none";
  const candidateMemories = state.memories
    .filter((item) => item.status === "candidate" && item.useForSuggestions !== false)
    .slice(0, 8)
    .map((item) => `- ${item.kind}: ${item.text.replace(/[\n\r`]+/g, " ").trim()}`)
    .join("\n") || "- none";
  const commitments = state.commitments
    .filter((item) => item.status === "open")
    .slice(0, 12)
    .map((item) => `- ${item.title.replace(/[\n\r`]+/g, " ").trim()} (${(item.dueHint || "sin fecha").replace(/[\n\r`]+/g, " ").trim()})`)
    .join("\n") || "- none";
  const recordTitles = state.records
    .slice(-8)
    .map((item) => `- ${item.title.replace(/[\n\r`]+/g, " ").trim()}${item.value ? ` (${item.value.replace(/[\n\r`]+/g, " ").trim()})` : ""} ${item.notes ? `— ${item.notes.replace(/[\n\r`]+/g, " ").trim()}` : ""} [${item.kind}]`)
    .join("\n") || "- nada guardado todavía";
  const recordKinds = Array.from(new Set(state.records.map((item) => item.kind))).slice(0, 12).join(", ") || "none";
  const collectionCount = new Set(state.records.map((item) => item.collection).filter(Boolean)).size;
  return [
    `User name: ${state.userName ?? "unknown"}`,
    "Confirmed memories:",
    confirmedMemories,
    "Candidate memories awaiting user confirmation; use cautiously for continuity, do not present as certain:",
    candidateMemories,
    "Open commitments:",
    commitments,
    `Saved record count: ${state.records.length}`,
    `Saved record kinds: ${recordKinds}`,
    "Cosas que guardaste (últimas 8):",
    recordTitles,
    `Saved collection count: ${collectionCount}`,
  ].join("\n");
}

function systemPrompt(nowIso: string, state: KoruState, relevantMemories: RelevantMemory[]): string {
  const prefs = state.voicePreference ?? { warmth: 7, directness: 6, humor: 3, detail: 5, proactivity: 3 };
  const warmthLabel = prefs.warmth >= 7 ? "muy cálido" : prefs.warmth >= 5 ? "cálido" : "neutral";
  const humorLabel = prefs.humor >= 5 ? "con humor" : prefs.humor >= 3 ? "con un toque de humor" : "serio";

  return [
    `Sos Koru. Sos el asistente personal de ${state.userName?.trim() || "mi amigo"}. No sos un chatbot genérico. Sos alguien que lo conoce y se preocupa por ayudarle.`,
    ``,
    `Tu personalidad: ${warmthLabel}, ${humorLabel}, directo pero sin ser frío. Proactividad ${prefs.proactivity}/10.`,
    `Sos curioso, honesto, discreto. Te gusta descubrir cosas nuevas de ${state.userName?.trim() || "mi amigo"} y recordarlas.`,
    ``,
    `Reglas de voz:`,
    `- NO respondas como asistente genérico. Respondé como alguien que conoce al usuario.`,
    `- Mirá las memorias de ${state.userName?.trim() || "mi amigo"} antes de responder. Usalas para personalizar.`,
    `- Si el usuario está mal, mostrá empatía real, no frases de tarjeta.`,
    `- Si hay una buena noticia, celebrá con él.`,
    `- Ofrecé un +1: un siguiente paso útil, una pregunta cariñosa, o una observación que se adelante a lo que necesita.`,
    `- El texto puede ser de 1 línea si es simple, o un párrafo corto si es emocional. No te cortés.`,
    `- Las cards (uiBlocks) son para los datos; el texto es para conectar con ${state.userName?.trim() || "mi amigo"}.`,
    `- Nunca inventes datos que no tengas. Si ejecutaste web_search, usá los snippets y contenidos proporcionados para dar un resumen honesto de lo que dicen las fuentes. No inventes detalles, pero SÍ contá lo que encontraste. Si no sabés, decilo con naturalidad y ofrecé el siguiente paso.`,
    `- CRÍTICO: Si una tool externa (clima, búsqueda, ruta, precios) devuelve status "failed" o "not_configured", NO inventés los datos. Decile al usuario honestamente que no pudiste obtener esa información y preguntá si quiere que lo intente de otra forma.`,
    `- CRÍTICO: Si el usuario responde con una ciudad o ubicación directamente después de que preguntaste por clima o tráfico, interpretalo como su ubicación. Ejecutá la tool correspondiente con esa ciudad y guardá esa ciudad como memory de perfil.`,
    `- CRÍTICO: Si el usuario te dice una ciudad, país o barrio y no lo tenés guardado como memoria, incluilo en memoryCandidates como kind: profile.`,
    `- CRÍTICO: Si el usuario pregunta algo que YA aparece en "Cosas que guardaste" o "Memorias relevantes", NO uses query_personal_context. Respondé directamente desde ese contexto.`,
    `- CRÍTICO: Cuando ejecutaste web_search, los datos concretos (resultados, precios, scores, cifras) ya vienen extraídos y validados en los tool results y se muestran al usuario en una tarjeta aparte. Tu texto SOLO debe ENMARCAR esos datos de forma cercana ("mirá lo que encontré", "esto es lo que dicen las fuentes"), NO repetirlos ni inventar valores que no estén en los resultados de la tool. Si un dato no está en los tool results, no lo afirmes.`,
    ``,
    `Memorias relevantes para esta conversación (usalas para personalizar tu respuesta):`,
    ...(relevantMemories.length
      ? relevantMemories.map(m => `- [${m.kind}] ${m.text.replace(/[\n\r`]+/g, " ").trim()}`)
      : ["- No hay memorias relevantes aún."]),
    ``,
    `Pendientes abiertos actuales del usuario:`,
    ...(state.commitments?.filter(c => c.status === "open").slice(0, 5).map(c => `- ${c.title.replace(/[\n\r`]+/g, " ").trim()} (${(c.dueHint || "sin fecha").replace(/[\n\r`]+/g, " ").trim()})`) || ["- Ninguno"]),
    ``,
    `Cosas que guardaste (últimas 8):`,
    ...(state.records?.slice(-8).map(r => `- ${r.title.replace(/[\n\r`]+/g, " ").trim()}${r.value ? ` (${r.value.replace(/[\n\r`]+/g, " ").trim()})` : ""}${r.notes ? ` — ${r.notes.replace(/[\n\r`]+/g, " ").trim()}` : ""} [${r.kind}]`) || ["- Nada guardado aún"]),
    ``,
    `Instrucciones técnicas:`,
    `Ejemplos de cuándo usar cada herramienta (la forma de preguntar no importa; lo que importa es la intención):`,
    `  - weather: "¿Qué me pongo?" / "¿Hace frío?" / "¿Llevo paraguas?" / "¿Cómo está afuera?" / "¿Qué tal el día?" / "¿Necesito campera?"`,
    `  - web_search: "¿Qué pasó en Argentina?" / "¿Cómo va el mundial?" / "¿Quién ganó?" / "¿Últimas noticias de...?" / Solo mencionar un tema actual del mundo exterior.`,
    `  - shopping_compare: "¿Qué auriculares compro?" / "Necesito una batería externa" / "¿Dónde compro X más barato?" / "¿Cuál es mejor, A o B?"`,
    `  - restaurant_deep_search: "Dónde cenar en Madrid" / "Qué restaurante me recomendás" / "Dónde como sushi" / "Necesito una parrilla" / "Qué tal comer en Palermo"`,
    `  - plan_day: "¿Cómo organizo hoy?" / "Tengo muchas cosas" / "¿Qué hago primero?" / "¿Me ayudas a planificar?"`,
    `  - query_personal_context: "¿Cuánto gasté?" / "¿Qué tenía para comer?" / "¿Recordás que me dijiste?" / Cualquier cosa que Koru ya haya guardado del usuario.`,
    `  - save_memory: Cuando el usuario revela algo importante sobre sí mismo (rutinas, metas, preferencias, relaciones).`,
    `  - save_personal_item: Cuando el usuario pide guardar algo (gasto, recordatorio, lista de compras, alarma).`,
    `Usá tools SOLO cuando la intención del usuario REQUIERA datos reales del mundo (clima, búsqueda, ruta, precios). Por ejemplo: si el usuario dice 'hola', 'gracias', 'adiós', '¿cómo estás?' o cualquier frase de cortesía, NO uses tools. Respondé directamente con naturalidad.`,
    `- Para datos personales ya guardados, no llames tools; respondé directamente usando el contexto.`,
    `- Agregá mascotState al JSON final Elijí SOLO de esta lista exacta: "celebrating", "worried", "affectionate", "curious", "happy", "thinking", "working", "tired", "sleeping", "mistake", "planning", "product-search", "building", "cooking", "thinking-2". Si nada aplica, usá "idle".`,
    `- Tipos de uiBlocks válidos:`,
    `  - "weather": clima por ciudad`,
    `  - "web_nav": resultado de búsqueda web. status "complete" (lista de links) o "report" (SIEMPRE que sintetizaste varias fuentes en un análisis propio). Para "report" AGREGÁ "summary" (párrafo narrativo) y "findings" (array de 3-5 bullets clave). Las fuentes van en "results".`,
    `  - "alarm": alarma con time y repeat`,
    `  - "reminder": recordatorio con dueText`,
    `  - "plan": plan de pasos con items`,
    `  - "comparison": comparativa de productos`,
    `  - "research_sources": fuentes verificadas`,
    `  - "shopping_list": lista de compras`,
    `  - "money_summary": resumen de gastos`,
    `  - "activity_group": grupo de actividad`,
    `  - "proactive_signal": señal del mundo`,
    `  - "clarifying_question": pregunta de clarificación`,
    `  - "saved_record": registro guardado`,
    `  - "resource_bundle": archivos descargables`,
    `  - "restaurant_synthesis": síntesis de búsqueda de restaurante`,
    `- Formato de respuesta final: {"reply":"...","uiBlocks":[],"mascotState":"..."}`,
    `  - reply: tu respuesta conversacional directa al usuario. Sin JSON, sin código, sin listas técnicas. Texto natural.`,
    `  - uiBlocks: DEJALO VACÍO ([]). El backend agrega los blocks automáticamente a partir de los tool results.`,
    `  - mascotState: elegí de la lista exacta.`,
    `Hora actual: ${nowIso}`,
  ].join("\n");
}

function isTrivialInput(input: string): boolean {
  const trimmed = input.trim().toLowerCase().replace(/[^a-záéíóúñ\s]/g, "");
  const trivial = [
    "hola", "buenos dias", "buen dia", "buenas", "buenas tardes", "buenas noches",
    "hey", "hi", "hello", "que tal", "como estas", "como va", "todo bien", "que onda",
    "che", "epa", "alo", "aló", "buen", "epa",
    "adios", "adiós", "chau", "nos vemos", "hasta luego", "hasta pronto", "bye",
    "gracias", "muchas gracias", "mil gracias", "genial gracias", "ok gracias", "perfecto gracias",
    "ok", "vale", "si", "sí", "no", "bien", "todo bien", "genial", "perfecto", "listo",
  ];
  return trivial.some(t => trimmed === t || trimmed.startsWith(t + " "));
}

function cityMemorySuggestion(toolCalls: ProviderToolCall[], state: KoruState): KoruSuggestedAction | null {
  const weatherCall = toolCalls.find((call) => call.function.name === "weather");
  if (!weatherCall) return null;
  const city = cleanText(JSON.parse(weatherCall.function.arguments ?? "{}").city);
  if (!city) return null;
  const cityLower = city.toLowerCase();
  const alreadySaved = state.memories?.some((m) => m.kind === "profile" && m.text.toLowerCase().includes(cityLower));
  if (alreadySaved) return null;
  return {
    id: `save_city_${cityLower.replace(/\s+/g, "_")}`,
    label: `¿Agregar ${city} como mi ubicación?`,
    kind: "save",
    requiresApproval: false,
    payload: { enhancementType: "save_location", city },
  };
}

function buildMessages(request: KoruBackendTurnRequest): ChatMessage[] {
  const relevantMemories = selectRelevantMemories(
    request.state.memories || [],
    request.input,
    5,
  );

  const history = request.history.slice(-10).map((turn): ChatMessage => ({
    role: turn.role === "assistant" ? "assistant" : "user",
    content: turn.content,
  }));
  return [
    { role: "system", content: systemPrompt(new Date().toISOString(), request.state, relevantMemories) },
    ...history,
    { role: "user", content: request.input },
  ];
}

function toolObservationSummary(toolExecutions: ToolExecution[]): string {
  return JSON.stringify(toolExecutions.map((execution) => ({
    id: execution.id,
    tool: execution.name,
    result: execution.result,
  })), null, 2);
}

function buildMemoryExtractorMessages(
  request: KoruBackendTurnRequest,
  toolExecutions: ToolExecution[],
  composedRaw?: Record<string, unknown>,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are Koru's asynchronous memory extractor. Return ONLY valid JSON, no markdown.",
        "Schema: {\"memoryCandidates\":[],\"commitments\":[],\"records\":[],\"behaviorNotes\":[]}",
        "Extract only durable, reusable user-owned context from the current user turn and tool observations.",
        "If the user says 'prefiero...', 'soy de...', 'mi mama...', 'avisame si...', 'todos los dias...', or equivalent meaning, extract it as memory. Do not skip just because another tool was used.",
        "Capture preferences, identity, routines, goals, relationships, medication/health facts, important dates, interests to follow, folders/collections, saved links, inventory, expenses, tasks and decisions.",
        "Do not answer the user. Do not infer from generic chit-chat. Do not duplicate records already present in tool observations.",
        "Use Spanish wording when the user spoke Spanish. Preserve names and dates.",
        "Never inherit collection, person, tags, or domain from previous turns unless the current user explicitly refers to the same object.",
        "Capture behavior notes: if the user corrects Koru's behavior (e.g. 'do not ask me for summaries when I save links', 'I prefer you to be more direct'), extract it as behaviorNote so future turns are governed by it.",
        "If the user provides a city, country, or neighborhood name (e.g. 'Madrid', 'Buenos Aires', 'Barcelona') especially after a weather or traffic question, extract it as a location/profile memory. Example: user input 'Madrid' after assistant asked \"what city?\" -> memory: {kind: 'profile', text: 'User location: Madrid (city)'}. Do not skip just because it looks like a tool argument.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Context:",
        stateSummary(request.state),
        "",
        `Current user input: ${request.input}`,
        "",
        composedRaw
          ? `Respuesta final que Koru enviÃ³ al usuario: "${cleanText(composedRaw.reply)}"`
          : "",
        composedRaw && composedRaw.understanding
          ? `Entendimiento del Composer: ${JSON.stringify(composedRaw.understanding)}`
          : "",
        "",
        "Tool observations:",
        toolObservationSummary(toolExecutions),
      ].filter(Boolean).join("\n"),
    },
  ];
}

async function extractMemoryWithJsonPrompt(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  toolExecutions: ToolExecution[],
  composedRaw: Record<string, unknown> | undefined,
  extractorTimeout: number,
): Promise<{ raw: Record<string, unknown>; provider: "nvidia" | "openrouter" | "minimax"; model?: string; fallbackReason?: string }> {
  const pp = inferProviderFromModel(request.model);
  const result = await callProvider(config, buildMemoryExtractorMessages(request, toolExecutions, composedRaw), extractorTimeout, false, pp);
  const content = cleanText(result.message.content);
  const raw = safeJsonObjectFromContent(content);
  return {
    raw,
    provider: result.provider,
    model: result.model,
    fallbackReason: result.fallbackReason,
  };
}

function toolCallArgs(call: ProviderToolCall): Record<string, unknown> {
  return safeJsonParse(call.function.arguments);
}

function normalizeUnderstanding(raw: unknown, input: string): KoruUnderstanding {
  const value = asRecord(raw);
  return {
    literalRequest: cleanText(value.literalRequest, input),
    userGoal: cleanText(value.userGoal, "Resolver el pedido con el menor esfuerzo posible."),
    unstatedNeeds: asArray(value.unstatedNeeds).map((item) => cleanText(item)).filter(Boolean),
    assumptions: asArray(value.assumptions).map((item) => cleanText(item)).filter(Boolean),
    confidence: typeof value.confidence === "number" ? Math.max(0, Math.min(1, value.confidence)) : 0.65,
  };
}

function normalizeSources(value: unknown): AssistantSource[] {
  return asArray(value)
    .map(asRecord)
    .map((item) => {
      const title = cleanText(item.title);
      const url = cleanText(item.url);
      if (!title || !url) return null;
      return sourceFromUrl(title, url, cleanText(item.snippet));
    })
    .filter((item): item is AssistantSource => Boolean(item))
    .slice(0, 8);
}

function normalizeUiBlock(value: unknown): UiBlock | null {
  const block = asRecord(value);
  const type = cleanText(block.type);
  if (type === "reminder") {
    const title = cleanText(block.title);
    return title ? {
      type: "reminder",
      title,
      dueText: cleanText(block.dueText ?? block.due_text),
      note: cleanText(block.note),
    } : null;
  }
  if (type === "alarm") {
    const title = cleanText(block.title, "Alarma");
    const time = cleanText(block.time);
    return time ? {
      type: "alarm",
      title,
      time,
      repeat: cleanText(block.repeat),
      note: cleanText(block.note),
    } : null;
  }
  if (type === "shopping_list") {
    const items = asArray(block.items).map((item) => cleanText(item)).filter(Boolean).slice(0, 20);
    return items.length ? {
      type: "shopping_list",
      title: cleanText(block.title, "Lista de compras"),
      items,
      dueText: cleanText(block.dueText ?? block.due_text),
      note: cleanText(block.note),
    } : null;
  }
  if (type === "saved_record") {
    const records = normalizeRecords(block.records);
    return records.length ? {
      type: "saved_record",
      title: cleanText(block.title, "Guardado"),
      records,
    } : null;
  }
  if (type === "money_summary") {
    return {
      type: "money_summary",
      title: cleanText(block.title, "Dinero"),
      total: typeof block.total === "number" ? block.total : undefined,
      currency: cleanText(block.currency),
      summaryItems: asArray(block.summaryItems ?? block.summary_items).map(asRecord).map((item) => ({
        label: cleanText(item.label, "Dato"),
        value: cleanText(item.value),
        detail: cleanText(item.detail),
      })).filter((item) => item.value).slice(0, 6),
      recommendation: cleanText(block.recommendation),
    };
  }
  if (type === "weather") {
    return {
      type: "weather",
      title: cleanText(block.title, "Clima"),
      city: cleanText(block.city),
      now: cleanText(block.now),
      range: cleanText(block.range),
      rain: cleanText(block.rain),
      wind: cleanText(block.wind),
      advice: cleanText(block.advice),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus))
        ? cleanText(block.sourceStatus) as Extract<UiBlock, { type: "weather" }>["sourceStatus"]
        : undefined,
      sources: normalizeSources(block.sources),
    };
  }
  if (type === "plan") {
    const items = asArray(block.items).map(asRecord).map((item): AssistantPlanItem => ({
      time: cleanText(item.time),
      title: cleanText(item.title, "Paso"),
      priority: ["Alta", "Media", "Baja"].includes(cleanText(item.priority)) ? cleanText(item.priority) as AssistantPlanItem["priority"] : undefined,
      durationMinutes: typeof item.durationMinutes === "number" ? item.durationMinutes : undefined,
      mode: ["focus", "quick", "admin", "recovery"].includes(cleanText(item.mode)) ? cleanText(item.mode) as AssistantPlanItem["mode"] : undefined,
      rationale: cleanText(item.rationale),
    })).slice(0, 6);
    return items.length ? { type: "plan", title: cleanText(block.title, "Plan"), items, note: cleanText(block.note) } : null;
  }
  if (type === "comparison") {
    const items = asArray(block.items).map(asRecord).map((item) => ({
      title: cleanText(item.title, "Opcion"),
      price: cleanText(item.price),
      vendor: cleanText(item.vendor),
      url: cleanText(item.url),
      evidence: cleanText(item.evidence),
      score: typeof item.score === "number" ? item.score : undefined,
    })).slice(0, 6);
    return items.length ? {
      type: "comparison",
      title: cleanText(block.title, "Comparativa"),
      items,
      criteria: asArray(block.criteria).map((item) => cleanText(item)).filter(Boolean),
      recommendation: cleanText(block.recommendation),
      sources: normalizeSources(block.sources),
    } : null;
  }
  if (type === "research_sources") {
    return {
      type: "research_sources",
      title: cleanText(block.title, "Fuentes"),
      summary: cleanText(block.summary, "Fuentes revisadas."),
      mode: ["news", "shopping", "research", "weather", "traffic", "market", "world"].includes(cleanText(block.mode))
        ? cleanText(block.mode) as Extract<UiBlock, { type: "research_sources" }>["mode"]
        : "research",
      sources: normalizeSources(block.sources),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus))
        ? cleanText(block.sourceStatus) as Extract<UiBlock, { type: "research_sources" }>["sourceStatus"]
        : undefined,
      followUpQuestion: cleanText(block.followUpQuestion),
    };
  }
  if (type === "clarifying_question") {
    return {
      type: "clarifying_question",
      title: cleanText(block.title, "Necesito un dato"),
      question: cleanText(block.question, "Que dato falta?"),
      expectedSlot: cleanText(block.expectedSlot),
      options: asArray(block.options).map((item) => cleanText(item)).filter(Boolean).slice(0, 3),
    };
  }
  if (type === "proactive_signal") {
    const category = cleanText(block.category);
    const severity = cleanText(block.severity);
    const title = cleanText(block.title);
    const body = cleanText(block.body);
    return title && body ? {
      type: "proactive_signal",
      category: ["world", "news", "market", "weather", "traffic", "health", "relationship", "home", "package", "sports", "general"].includes(category)
        ? category as Extract<UiBlock, { type: "proactive_signal" }>["category"]
        : "general",
      severity: ["info", "useful", "important", "urgent"].includes(severity)
        ? severity as Extract<UiBlock, { type: "proactive_signal" }>["severity"]
        : "useful",
      title,
      body,
      timestampLabel: cleanText(block.timestampLabel ?? block.timestamp_label),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus))
        ? cleanText(block.sourceStatus) as Extract<UiBlock, { type: "proactive_signal" }>["sourceStatus"]
        : undefined,
      actionLabel: cleanText(block.actionLabel ?? block.action_label),
      followUpQuestion: cleanText(block.followUpQuestion ?? block.follow_up_question),
      sources: normalizeSources(block.sources),
      summaryItems: asArray(block.summaryItems ?? block.summary_items).map(asRecord).map((item) => ({
        label: cleanText(item.label, "Dato"),
        value: cleanText(item.value),
        detail: cleanText(item.detail),
      })).filter((item) => item.value).slice(0, 4),
    } : null;
  }
  if (type === "web_nav") {
    const results = asArray(block.results).map(asRecord).map((item) => ({
      title: cleanText(item.title, "Resultado"),
      source: cleanText(item.source, "Web"),
      url: cleanText(item.url),
      type: ["article", "pdf", "description", "page"].includes(cleanText(item.type))
        ? cleanText(item.type) as Extract<UiBlock, { type: "web_nav" }>["results"][number]["type"]
        : "page" as const,
      readTime: cleanText(item.readTime ?? item.read_time),
    })).filter((item) => item.title && item.url).slice(0, 6);
    return results.length ? {
      type: "web_nav" as const,
      title: cleanText(block.title, "Web Navigation"),
      status: cleanText(block.status) === "loading" ? "loading" : cleanText(block.status) === "report" ? "report" : "complete",
      query: cleanText(block.query),
      url: cleanText(block.url),
      results,
    } : null;
  }
  return null;
}

export function blocksFromToolResults(results: ToolExecution[]): UiBlock[] {
  const blocks: UiBlock[] = [];
  for (const execution of results) {
    const result = execution.result;
    if (result.type === "weather") {
      const weather = result as WeatherData;
      blocks.push({
        type: "weather" as const,
        title: "Clima",
        city: weather.city,
        now: weather.now,
        range: weather.range,
        rain: weather.rain,
        wind: weather.wind,
        advice: weather.advice,
        sourceStatus: weather.sources.length ? "verified" as const : "failed" as const,
        sources: weather.sources,
      });
      continue;
    }
    if (result.type === "restaurant_deep_search") {
      const search = result as unknown as { query: string; matches?: Array<{ name: string; sourcesMentioning: number; quote?: string }>; topScore?: string; pros?: string[]; cons?: string[]; synthesis?: string; sources?: AssistantSource[]; status?: string };
      blocks.push({
        type: "restaurant_synthesis" as const,
        title: search.query || "Restaurantes encontrados",
        status: search.status === "ok" ? "ok" as const : search.status === "failed" ? "failed" as const : "partial" as const,
        matches: search.matches || [],
        topScore: search.topScore,
        pros: search.pros,
        cons: search.cons,
        synthesis: search.synthesis,
        sources: search.sources || [],
      });
      continue;
    }
    if (result.type === "crypto_price") {
      const r = result as any;
      blocks.push({
        type: "crypto_portfolio" as const,
        items: [{
          symbol: r.symbol || " BTC",
          name: r.coin || "Bitcoin",
          price: `${r.price || "?"} ${r.currency || "USD"}`,
          change: r.change24hPct ?? 0,
          color: "text-orange-500",
          bg: "bg-orange-50",
        }],
      });
      continue;
    }
    if (result.type === "stock_quote") {
      const r = result as any;
      blocks.push({
        type: "market" as const,
        title: `${r.symbol}`,
        subtitle: `Cierre: ${r.close}`,
        change: r.change24hPct ? `${r.change24hPct >= 0 ? "▲" : "▼"} ${Math.abs(r.change24hPct)}%` : "—",
      });
      continue;
    }
    if (result.type === "currency_convert") {
      const r = result as any;
      blocks.push({
        type: "forex" as const,
        items: [{
          pair: `${r.from}/${r.to}`,
          rate: String(r.rate),
          change: 0,
          flag: "US",
          positive: true,
        }],
      });
      continue;
    }
    if (result.type === "match_schedule") {
      const r = result as any;
      const matches = r.matches || [];
      blocks.push({
        type: "match_timeline" as const,
        items: matches.slice(0, 5).map((m: any) => ({
          minute: m.date ? new Date(m.date).getDate() + "'" : "—",
          text: `${r.team || "Equipo"} vs ${m.opponent || "Rival"}`,
          sub: `${m.competition || ""} · ${m.venue || ""}`,
          active: true,
        })),
      });
      continue;
    }
    if (result.type === "search") {
      const search = result as SearchData;
      // Datos estructurados validados: se muestran PRIMERO (mayor valor visual).
      // Cada item viene con cita literal respaldada por un source real → cero alucinación.
      if (search.extractedData && search.extractedData.items.length > 0) {
        blocks.push({
          type: "data_card" as const,
          title: search.extractedData.title,
          items: search.extractedData.items.map((item) => ({
            label: item.label,
            value: item.value,
            detail: item.detail,
            quote: item.quote,
            sourceUrl: item.sourceUrl,
            sourceDomain: item.sourceDomain,
          })),
        });
      }
      if (search.mode === "shopping" && search.comparisonItems?.length) {
        blocks.push({
          type: "comparison" as const,
          title: search.title,
          items: search.comparisonItems,
          recommendation: search.summary,
          sources: search.sources,
        });
        continue;
      }
      if (search.mode === "research" || search.mode === "news" || search.mode === "world") {
        const filtered = search.sources
          .filter((s) => s.url?.startsWith("http"))
          .slice(0, 5);
        if (filtered.length) {
          blocks.push({
            type: "web_nav" as const,
            title: search.title,
            status: "complete" as const,
            query: search.title,
            ...(search.summary ? { summary: search.summary } : {}),
            results: filtered.map((s) => ({
              title: s.title,
              source: s.domain,
              url: s.url,
              type: "page" as const,
              snippet: s.snippet,
            })),
          });
        }
        continue;
      }
      blocks.push({
        type: "research_sources" as const,
        title: search.title,
        summary: search.summary,
        mode: search.mode,
        sources: search.sources,
        sourceStatus: search.sources.length ? "verified" as const : "failed" as const,
      });
      continue;
    }
    if (result.type === "plan") {
      const plan = result as PlanData;
      blocks.push({
        type: "plan" as const,
        title: plan.title,
        items: plan.items,
        note: plan.context.length ? `Use contexto: ${plan.context.slice(0, 2).join(" / ")}` : undefined,
      });
      continue;
    }
    if (result.type === "personal_capture") {
      const capture = result as PersonalCaptureData;
      blocks.push(capture.block);
      continue;
    }
    if (result.type === "personal_query") {
      const query = result as PersonalQueryData;
      blocks.push(query.block);
      continue;
    }
    if (result.type === "local_action") {
      const action = result as LocalActionData;
      blocks.push(action.block);
      continue;
    }
    if (result.type === "crypto_price") {
      const crypto = result as Record<string, unknown>;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      const price = typeof crypto.price === "number" ? crypto.price : undefined;
      const currency = String(crypto.currency ?? "USD");
      if (price !== undefined) {
        items.push({ label: "Precio", value: new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price) });
      }
      if (typeof crypto.marketCap === "number") {
        items.push({ label: "Market Cap", value: formatCompactNumber(crypto.marketCap, currency) });
      }
      if (typeof crypto.change24hPct === "number") {
        const sign = crypto.change24hPct >= 0 ? "+" : "";
        items.push({ label: "24h", value: `${sign}${crypto.change24hPct}%`, detail: crypto.change24hPct >= 0 ? "▲" : "▼" });
      }
      if (typeof crypto.change7dPct === "number") {
        const sign = crypto.change7dPct >= 0 ? "+" : "";
        items.push({ label: "7d", value: `${sign}${crypto.change7dPct}%`, detail: crypto.change7dPct >= 0 ? "▲" : "▼" });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: `${String(crypto.coin ?? crypto.symbol ?? "Crypto")} · ${currency}`,
          items,
        });
      }
      continue;
    }
    if (result.type === "stock_quote") {
      const stock = result as Record<string, unknown>;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      if (typeof stock.close === "number") {
        items.push({ label: "Cierre", value: String(stock.close), detail: String(stock.symbol ?? "") });
      }
      if (typeof stock.open === "number") {
        items.push({ label: "Apertura", value: String(stock.open) });
      }
      if (typeof stock.high === "number") {
        items.push({ label: "Máx", value: String(stock.high) });
      }
      if (typeof stock.low === "number") {
        items.push({ label: "Mín", value: String(stock.low) });
      }
      if (typeof stock.volume === "number") {
        items.push({ label: "Volumen", value: formatCompactNumber(stock.volume, "USD") });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: `${String(stock.symbol ?? "Acción")} · ${String(stock.date ?? "")}`,
          items,
        });
      }
      continue;
    }
    if (result.type === "exchange_history") {
      const fx = result as Record<string, unknown>;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      if (typeof fx.lastRate === "number") {
        items.push({ label: "Último", value: String(fx.lastRate), detail: `${String(fx.from ?? "")}→${String(fx.to ?? "")}` });
      }
      if (typeof fx.firstRate === "number") {
        items.push({ label: "Inicio", value: String(fx.firstRate) });
      }
      if (typeof fx.minRate === "number") {
        items.push({ label: "Mín", value: String(fx.minRate) });
      }
      if (typeof fx.maxRate === "number") {
        items.push({ label: "Máx", value: String(fx.maxRate) });
      }
      if (typeof fx.changePct === "number") {
        const sign = fx.changePct >= 0 ? "+" : "";
        items.push({ label: "Cambio", value: `${sign}${fx.changePct}%`, detail: fx.changePct >= 0 ? "▲" : "▼" });
      }
      if (typeof fx.samples === "number") {
        items.push({ label: "Días", value: String(fx.samples) });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: `${String(fx.from ?? "")}/${String(fx.to ?? "")} · ${String(fx.startDate ?? "")} a ${String(fx.endDate ?? "")}`,
          items,
        });
      }
      continue;
    }
    if (result.type === "election_data" || result.type === "election_results") {
      const r = result as any;
      blocks.push({
        type: "election_results" as const,
        title: r.title,
        status: r.status,
        items: r.items || [],
      });
      continue;
    }
    if (result.type === "election_vote") {
      const r = result as any;
      blocks.push({
        type: "election_vote" as const,
        question: r.question,
        subtitle: r.subtitle,
        options: r.options || [],
      });
      continue;
    }
    if (result.type === "data_ticker") {
      const r = result as any;
      blocks.push({
        type: "data_ticker" as const,
        items: r.items || [],
        alert: r.alert,
      });
      continue;
    }
  }
  return blocks;
}

function hasUsefulBlockContent(block: UiBlock): boolean {
  if (block.type === "weather") {
    return Boolean(block.city || block.now || block.range || block.rain || block.wind || block.advice || block.sources?.length);
  }
  if (block.type === "comparison") return block.items.length > 0;
  if (block.type === "research_sources") return Boolean(block.summary || block.sources.length);
  if (block.type === "plan") return block.items.length > 0;
  if (block.type === "saved_record") return block.records.length > 0;
  if (block.type === "money_summary") return Boolean(block.total || block.summaryItems?.length || block.recommendation);
  return true;
}

function mergeModelAndToolBlocks(modelBlocks: UiBlock[], toolBlocks: UiBlock[]): UiBlock[] {
  const usefulModelBlocks = modelBlocks.filter(hasUsefulBlockContent);
  if (!toolBlocks.length) return usefulModelBlocks;
  if (!usefulModelBlocks.length) return toolBlocks;

  const merged: UiBlock[] = [];
  const usedToolIndexes = new Set<number>();
  for (const modelBlock of usefulModelBlocks) {
    const toolIndex = toolBlocks.findIndex((toolBlock, index) => !usedToolIndexes.has(index) && toolBlock.type === modelBlock.type);
    if (toolIndex < 0) {
      merged.push(modelBlock);
      continue;
    }
    const toolBlock = toolBlocks[toolIndex];
    usedToolIndexes.add(toolIndex);
    if (modelBlock.type === "weather" && toolBlock.type === "weather") {
      merged.push({
        ...modelBlock,
        city: modelBlock.city || toolBlock.city,
        now: modelBlock.now || toolBlock.now,
        range: modelBlock.range || toolBlock.range,
        rain: modelBlock.rain || toolBlock.rain,
        wind: modelBlock.wind || toolBlock.wind,
        advice: modelBlock.advice || toolBlock.advice,
        sourceStatus: modelBlock.sourceStatus ?? toolBlock.sourceStatus,
        sources: modelBlock.sources?.length ? modelBlock.sources : toolBlock.sources,
      });
      continue;
    }
    if (modelBlock.type === "comparison" && toolBlock.type === "comparison") {
      merged.push({
        ...modelBlock,
        items: modelBlock.items.length ? modelBlock.items : toolBlock.items,
        recommendation: modelBlock.recommendation || toolBlock.recommendation,
        sources: modelBlock.sources?.length ? modelBlock.sources : toolBlock.sources,
      });
      continue;
    }
    if (modelBlock.type === "research_sources" && toolBlock.type === "research_sources") {
      merged.push({
        ...modelBlock,
        summary: modelBlock.summary || toolBlock.summary,
        sources: modelBlock.sources.length ? modelBlock.sources : toolBlock.sources,
        sourceStatus: modelBlock.sourceStatus ?? toolBlock.sourceStatus,
      });
      continue;
    }
    if (modelBlock.type === "plan" && toolBlock.type === "plan") {
      merged.push({
        ...modelBlock,
        items: modelBlock.items.length ? modelBlock.items : toolBlock.items,
        note: modelBlock.note || toolBlock.note,
      });
      continue;
    }
    merged.push(modelBlock);
  }

  const finalBlocks = [
    ...merged,
    ...toolBlocks.filter((_, index) => !usedToolIndexes.has(index)),
  ];
  const seen = new Set<string>();
  return finalBlocks.filter((block) => {
    if (block.type === "saved_record" && block.records.every((record) => /^dato guardado$/i.test(record.title))) return false;
    const key = `${block.type}|${plainLower("title" in block && typeof block.title === "string" ? block.title : replyFromBlocks([block], ""))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function replyFromBlocks(blocks: UiBlock[], input: string): string {
  const first = blocks[0];
  if (!first) return "";
  if (first.type === "weather") {
    const facts = [
      first.city ? `En ${first.city}` : "El clima",
      first.now ? `${first.now} ahora` : undefined,
      first.range ? `rango ${first.range}` : undefined,
      first.rain ? `lluvia ${first.rain}` : undefined,
    ].filter(Boolean).join(", ");
    const outfit = /reuni[oó]n|poner|ropa|vestir|campera|chaqueta|paraguas/i.test(input)
      ? " Para reunion, ve prolijo y en capas; si sales tarde, lleva una chaqueta ligera."
      : "";
    return `${facts}. ${first.advice ?? ""}${outfit}`.replace(/\s+/g, " ").trim();
  }
  if (first.type === "plan") {
    const step = first.items[0];
    return step ? `Empezaria por: ${step.title}${step.durationMinutes ? ` (${step.durationMinutes} min)` : ""}.` : first.title ?? "Te deje un plan accionable.";
  }
  if (first.type === "comparison") {
    const best = first.items[0];
    return best ? `Te deje una comparativa inicial. Miraria primero ${best.title}${best.vendor ? ` en ${best.vendor}` : ""}.` : "Te deje una comparativa inicial con evidencia visible.";
  }
  if (first.type === "research_sources") {
    return first.sources.length
      ? `Traje fuentes para revisar sin inventar conclusiones: ${first.sources[0].domain}.`
      : first.summary;
  }
  if (first.type === "activity_group") {
    const firstSection = first.sections[0];
    const firstRow = firstSection?.rows?.[0];
    const firstTile = firstSection?.tiles?.[0];
    if (firstRow) return firstRow.title;
    if (firstTile) return `${firstTile.label}: ${firstTile.value}`;
    return first.subtitle ?? first.note ?? first.title;
  }
  if (first.type === "clarifying_question") return first.question;
  if (first.type === "reminder") return `Lo dejo como recordatorio: ${first.title}.`;
  if (first.type === "alarm") return `Prepare la alarma para ${first.time}.`;
  if (first.type === "shopping_list") {
    return /que|qué|cual|cu[aá]l|\?/i.test(input)
      ? `Tenes para comprar: ${first.items.join(", ")}.`
      : `Lo deje en compras: ${first.items.join(", ")}.`;
  }
  if (first.type === "saved_record") {
    const titles = first.records.map((record) => record.title).filter(Boolean);
    if (/comida/i.test(first.title ?? "") && titles.length) return `Guarde comida en casa: ${titles.slice(0, 4).join(", ")}.`;
    if (titles.length > 1) return `Guarde ${titles.length} datos: ${titles.slice(0, 3).join(", ")}.`;
    return `Guardado: ${titles[0] ?? "dato importante"}.`;
  }
  if (first.type === "money_summary") return first.recommendation ?? "Te deje el resumen de dinero.";
  if (first.type === "proactive_signal") return first.body;
  return "";
}

function isGenericAgentReply(reply: string): boolean {
  const normalized = reply.toLowerCase();
  return [
    "listo. te dejo lo importante y el siguiente paso.",
    "listo. te dejo lo importante en la tarjeta.",
    "no pude componer una respuesta util.",
  ].some((item) => normalized === item);
}

function normalizeMemoryCandidates(value: unknown): Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] {
  return asArray(value).map(asRecord).map((item) => ({
    kind: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(cleanText(item.kind))
      ? cleanText(item.kind) as MemoryFact["kind"]
      : "profile" as const,
    text: cleanText(item.text),
    confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.7,
    sensitivity: cleanText(item.sensitivity) === "sensitive" ? "sensitive" as const : "normal" as const,
    status: "candidate" as const,
    rootQuote: cleanText(item.root_quote ?? item.rootQuote),
    useForSuggestions: item.use_for_suggestions === false || item.useForSuggestions === false ? false : true,
  })).filter((item) => item.text.length > 4).slice(0, 5);
}

function normalizeCommitments(value: unknown): Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] {
  return asArray(value).map(asRecord).map((item) => ({
    title: cleanText(item.title),
    dueHint: cleanText(item.due_hint ?? item.dueHint, "sin fecha"),
    dueAt: cleanText(item.dueAt),
    recurrence: ["daily", "weekly", "monthly"].includes(cleanText(item.recurrence)) ? cleanText(item.recurrence) as Commitment["recurrence"] : undefined,
    status: "open" as const,
  })).filter((item) => item.title.length > 3).slice(0, 5);
}

function normalizeRecords(value: unknown): Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[] {
  return asArray(value).map(asRecord).map((item) => ({
    domain: ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"].includes(cleanText(item.domain))
      ? cleanText(item.domain) as LifeRecord["domain"]
      : "capture" as const,
    kind: cleanText(item.kind) as LifeRecord["kind"],
    title: cleanText(item.title),
    value: cleanText(item.value),
    amount: typeof item.amount === "number" ? item.amount : undefined,
    currency: cleanText(item.currency),
    person: cleanText(item.person),
    url: cleanText(item.url),
    collection: cleanText(item.collection),
    dueHint: cleanText(item.dueHint ?? item.due_hint),
    notes: cleanText(item.notes),
    tags: asArray(item.tags).map((tag) => cleanText(tag)).filter(Boolean),
  })).filter((item) => item.title.length > 2 && item.kind).slice(0, 8);
}

function normalizeSuggestedActions(value: unknown): KoruSuggestedAction[] {
  return asArray(value).map(asRecord).map((item) => ({
    id: cleanText(item.id, createId("suggestion")),
    label: cleanText(item.label, "Usar"),
    kind: ["save", "remind", "watch", "compare_more", "approve", "calendar", "research"].includes(cleanText(item.kind))
      ? cleanText(item.kind) as KoruSuggestedAction["kind"]
      : "research" as const,
    requiresApproval: item.requiresApproval !== false,
    payload: asRecord(item.payload),
  })).filter((item) => item.label.length > 1).slice(0, 4);
}

function personalCapturesFromTools(toolExecutions: ToolExecution[]): PersonalCaptureData[] {
  return toolExecutions
    .map((execution) => execution.result)
    .filter((result): result is PersonalCaptureData => result.type === "personal_capture");
}

function localActionsFromTools(toolExecutions: ToolExecution[]): LocalActionData[] {
  return toolExecutions
    .map((execution) => execution.result)
    .filter((result): result is LocalActionData => result.type === "local_action");
}

function memoryCapturesFromTools(toolExecutions: ToolExecution[]): MemoryCaptureData[] {
  return toolExecutions
    .map((execution) => execution.result)
    .filter((result): result is MemoryCaptureData => result.type === "memory_capture");
}

function uniqueRecords(records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[]): Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (/^dato guardado$/i.test(record.title.trim())) return false;
    const key = `${record.domain}|${record.kind}|${plainLower(record.title)}|${plainLower(record.value ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueCommitments(commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[]): Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] {
  const seen = new Set<string>();
  return commitments.filter((commitment) => {
    const key = `${plainLower(commitment.title)}|${plainLower(commitment.dueHint)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeFinalPayload(
  raw: Record<string, unknown>,
  input: string,
  toolExecutions: ToolExecution[],
  extractedRaw?: Record<string, unknown>,
): KoruBackendTurnResponse {
  const modelBlocks = asArray(raw.uiBlocks).map(normalizeUiBlock).filter((block): block is UiBlock => Boolean(block));
  const mascotState = cleanText(raw.mascotState) || "idle";
  const validatedMascotState = VALID_MASCOT_STATES.includes(mascotState as MascotState)
    ? (mascotState as MascotState)
    : "idle";
  if (mascotState !== "idle" && !VALID_MASCOT_STATES.includes(mascotState as MascotState)) {
    console.warn(`[Koru] LLM returned invalid mascotState: "${mascotState}". Falling back to "idle".`);
  }
  const toolBlocks = blocksFromToolResults(toolExecutions);
  const uiBlocks = mergeModelAndToolBlocks(modelBlocks, toolBlocks);
  const captures = personalCapturesFromTools(toolExecutions);
  const localActions = localActionsFromTools(toolExecutions);
  const memoryCaptures = memoryCapturesFromTools(toolExecutions);
  const toolResults: ToolResult[] = toolExecutions.map((execution, index) => ({
    id: execution.id || `tool_${index + 1}`,
    tool: execution.name === "shopping_compare"
      ? "shopping_compare"
      : execution.name === "weather"
        ? "weather"
        : execution.name === "route_traffic"
          ? "route_traffic"
              : execution.name === "alarm"
                ? "alarm"
                : execution.name === "calendar_reminder"
                  ? "calendar_reminder"
                  : execution.name === "plan_day" || execution.name === "save_memory" || execution.name === "save_personal_item" || execution.name === "query_personal_context"
                ? "memory_recall"
                : "web_search",
    status: "ok",
    summary: JSON.stringify(execution.result).slice(0, 500),
    data: execution.result,
    sources: normalizeSources((execution.result as Record<string, unknown>).sources),
  }));
  const cleanedReply = cleanReplyText(raw.reply);
  const blockReply = replyFromBlocks(uiBlocks, input);
  return {
    reply: !cleanedReply || isGenericAgentReply(cleanedReply) ? blockReply || "Tuve un problema para armar la respuesta. ¿Me lo repetís de otra forma para ayudarte bien?" : cleanedReply,
    uiBlocks,
    suggestedActions: normalizeSuggestedActions(raw.suggestedActions),
    understanding: normalizeUnderstanding(raw.understanding, input),
    memoryCandidates: [
      ...normalizeMemoryCandidates(raw.memoryCandidates),
      ...normalizeMemoryCandidates(extractedRaw?.memoryCandidates),
      ...captures.flatMap((capture) => capture.memoryCandidates ?? []),
      ...memoryCaptures.flatMap((capture) => capture.memoryCandidates ?? []),
    ].slice(0, 6),
    commitments: uniqueCommitments([
      ...normalizeCommitments(raw.commitments),
      ...normalizeCommitments(extractedRaw?.commitments),
      ...captures.flatMap((capture) => capture.commitments ?? []),
      ...localActions.flatMap((action) => action.commitments ?? []),
    ]).slice(0, 8),
    records: uniqueRecords([
      ...normalizeRecords(raw.records),
      ...normalizeRecords(extractedRaw?.records),
      ...captures.flatMap((capture) => capture.records ?? []),
      ...localActions.flatMap((action) => action.records ?? []),
    ]).slice(0, 12),
    toolResults,
    stateEvents: [
      { kind: "thinking", label: "Entendiendo objetivo real" },
      ...(toolExecutions.length ? [{ kind: "searching" as const, label: "Usando herramientas reales" }] : []),
      { kind: "done", label: "Respuesta lista" },
    ],
    provider: "nvidia",
    mascotState: validatedMascotState,
    skippedBecauseBoundary: [...new Set([
      ...asArray(raw.skippedBecauseBoundary).map((v) => cleanText(v)).filter(Boolean),
      ...asArray(extractedRaw?.skippedBecauseBoundary).map((v) => cleanText(v)).filter(Boolean),
    ])],
    behaviorNotes: [...new Set([
      ...asArray(raw.behaviorNotes).map((v) => cleanText(v)).filter(Boolean),
      ...asArray(extractedRaw?.behaviorNotes).map((v) => cleanText(v)).filter(Boolean),
    ])],
  };
}


async function finalizeFromPlainText(
  raw: Record<string, unknown>,
  toolCalls: ProviderToolCall[],
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  toolExecutions: ToolExecution[],
  extractorTimeout: number,
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter" | "minimax"; memoryModel?: string }> {
  const cityAction = cityMemorySuggestion(toolCalls, request.state);
  if (cityAction) raw.suggestedActions = [...asArray(raw.suggestedActions || []), cityAction];

  if (asArray(raw.suggestedActions || []).length === 0) {
    try {
      const { enhancementActions } = await buildEnhancementInstruction(request, config, toolExecutions);
      raw.suggestedActions = [...asArray(raw.suggestedActions || []), ...enhancementActions];
    } catch { /* ignorar */ }
  }

  return finalizePayload(request, config, raw, toolExecutions, extractorTimeout);
}

async function finalizePayload(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  raw: Record<string, unknown>,
  toolExecutions: ToolExecution[],
  extractorTimeout: number,
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter" | "minimax"; memoryModel?: string }> {
  try {
    const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, raw, extractorTimeout);
    return {
      ...normalizeFinalPayload(raw, request.input, toolExecutions, extracted.raw),
      memoryProvider: extracted.provider,
      memoryModel: extracted.model,
      memoryFallbackReason: extracted.fallbackReason,
    };
  } catch (error) {
    return {
      ...normalizeFinalPayload(raw, request.input, toolExecutions),
      memoryFallbackReason: error instanceof Error ? error.message : "memory-extractor-failed",
    };
  }
}

async function executeProviderToolCalls(
  toolCalls: ProviderToolCall[],
  messages: ChatMessage[],
  request: KoruBackendTurnRequest,
  toolExecutions: ToolExecution[],
  config: ProviderConfig,
): Promise<Record<string, unknown> | null> {
  messages.push({
    role: "assistant",
    content: "",
    tool_calls: toolCalls,
  });

  // Reactivar extractor: usar Ollama local (puerto distinto al proveedor principal
  // para evitar serialización). El extractor corre en paralelo al Composer.
  const extractorChatFn: ExtractorChatFn = async (msgs, opts) => {
    const body: Record<string, unknown> = {
      model: config.nvidiaModel || "llama3.1:8b",
      messages: msgs.map(m => ({ role: m.role, content: m.content })),
      format: opts.responseFormat?.type === "json_object" ? "json" : undefined,
      stream: false,
      options: { temperature: opts.temperature ?? 0.1, num_predict: opts.maxTokens ?? 900 },
    };
    if (!config.nvidiaBaseUrl) throw new Error("Ollama no configurado para extractor");
    const r = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/api/chat"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }, 30_000);
    const d = await r.json().catch(() => ({}));
    return { content: d.message?.content ?? "" };
  };
  const extractorCtx = { userInput: request.input, chatFn: extractorChatFn };
  const deferredDataCards: Array<Promise<UiBlock | null>> = [];

  for (const call of toolCalls) {
    const name = call.function.name;
    const args = { ...toolCallArgs(call), __userInput: request.input };
    if (name === "deliver_response") return args;
    const { result: toolResult, deferredDataCard } = await executeTool(name, args, request.state, extractorCtx);
    toolExecutions.push({ id: call.id, name, result: toolResult });
    if (deferredDataCard) deferredDataCards.push(deferredDataCard);
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(toolResult),
    });
  }
  // Adjuntar las promesas diferidas al objeto de retorno para que el llamador
  // las espere en paralelo con el Composer.
  (toolExecutions as ToolExecution[] & { __deferredDataCards?: Array<Promise<UiBlock | null>> }).__deferredDataCards = deferredDataCards;
  return null;
}

async function buildEnhancementInstruction(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  toolExecutions: ToolExecution[],
): Promise<{
  prompt: string;
  enhancementBlocks: UiBlock[];
  enhancementActions: KoruSuggestedAction[];
}> {
  try {
    const uiBlocks = blocksFromToolResults(toolExecutions);

    const toolBlocks: ToolResult[] = toolExecutions.flatMap((t) => {
      const resultStatus = (t.result as Record<string, unknown> | undefined)?.status;
      const status = resultStatus === "verified" ? "ok" : resultStatus === "failed" ? "failed" : "partial";
      return [{
        id: t.id,
        tool: t.name as ToolCall["tool"],
        status,
        summary: typeof t.result === "object" && t.result !== null ? JSON.stringify(t.result).slice(0, 200) : "ok",
        data: typeof t.result === "object" && t.result !== null ? (t.result as Record<string, unknown>) : undefined,
      }];
    });

    const chatFn = async (messages: { role: string; content: string }[], _options: { temperature: number; maxTokens: number }) => {
      const pp = inferProviderFromModel(request.model);
      const chatTimeout = isOllamaUrl(config.nvidiaBaseUrl) ? 60_000 : 8_000;
      const result = await callProvider(config, messages.map((m) => ({ role: m.role as "system" | "user", content: m.content })), chatTimeout, false, pp);
      return { content: result.message.content ?? "" };
    };

    const opportunities = await extractOpportunities({
      input: request.input,
      intent: { domain: "chat", kind: "user_request", confidence: 0.6 },
      uiBlocks,
      toolResults: toolBlocks,
      state: request.state,
      runtime: request.state.runtime,
    }, chatFn);

    const candidates = generateEnhancements(opportunities, request.state);
    const prompt = enhancementPrompt(candidates);

    const enhancementBlocks: UiBlock[] = candidates
      .filter((c): c is typeof c & { action: { mode: "auto"; uiBlock: UiBlock } } =>
        c.action.mode === "auto" && "uiBlock" in c.action && Boolean(c.action.uiBlock)
      )
      .map((c) => c.action.uiBlock);

    const enhancementActions: KoruSuggestedAction[] = candidates
      .filter((c): c is typeof c & { action: { mode: "ask"; question: string; uiBlock?: UiBlock } | { mode: "suggest"; text: string; uiBlock?: UiBlock } } =>
        c.action.mode === "ask" || c.action.mode === "suggest"
      )
      .map((c) => ({
        id: c.id,
        label: c.action.mode === "ask" ? c.action.question : c.action.text,
        kind: c.action.mode === "ask" ? "approve" : "save",
        requiresApproval: c.action.mode === "ask",
        payload: {
          enhancementType: c.title,
          ...(c.action.uiBlock ? { uiBlock: c.action.uiBlock } : {}),
        },
      }));

    return { prompt, enhancementBlocks, enhancementActions };
  } catch {
    return { prompt: "", enhancementBlocks: [], enhancementActions: [] };
  }
}

// ── Semantic Router: singleton instanciado una vez por server ──────────
// Decide la intención del usuario por similitud de embeddings (Ollama local),
// ANTES de llamar al LLM. Si detecta que se necesita una tool, la ejecuta
// directamente sin depender de que el modelo la llame nativamente.
// Es agnóstico al modelo y casi gratis (~26ms por decisión).
let routerSingleton: SemanticRouter | null = null;

function buildEmbedFn(baseUrl: string): EmbedFn {
  return async (text: string): Promise<number[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
        signal: controller.signal,
      });
      const data = await res.json() as { embedding?: number[] };
      if (!data.embedding || data.embedding.length === 0) {
        throw new Error("Ollama no devolvió embedding");
      }
      return data.embedding;
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function getRouter(config: ProviderConfig): Promise<SemanticRouter | null> {
  const embedBaseUrl = config.ollamaEmbedBaseUrl ?? config.nvidiaBaseUrl;
  if (!embedBaseUrl) return null;
  // Siempre reiniciar para capturar cambios en ROUTE_EXAMPLES y evitar stale state
  routerSingleton = new SemanticRouter(buildEmbedFn(embedBaseUrl));
  try {
    await routerSingleton.initialize();
    logger.info("getRouter", "Semantic Router initialized", { baseUrl: embedBaseUrl });
  } catch (err: any) {
    logger.warn("getRouter", "Semantic Router init failed (non-fatal)", { reason: err?.message });
    routerSingleton = null;
    return null;
  }
  return routerSingleton;
}

/**
 * Genera un texto natural corto para mostrar al usuario mientras se busca.
 * NO repite el input literal (ej: "Buscando 'Hola Koru, ¿podrías...'" → malo).
 * Extrae el tema central del mensaje (ej: "Buscando info del mundial").
 * Es heurística simple sobre el input, no matching de intención (eso ya lo hizo el router).
 */
function searchLabelFromInput(input: string): string {
  const clean = input.trim().replace(/\s+/g, " ");
  // Quitar saludos y cortesías comunes al inicio que no aportan al tema.
  const stripped = clean
    .replace(/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|che|hey|koru|por favor|podr[ií]as|puedes|me dec[ií]s|decime|dame|quiero saber|necesito saber|busc[aá]\s*(info|informaci[oó]n|datos)?\s*(sobre|de|acerca)?)\b[,\s]*/gi, "")
    .replace(/^(paso|pas[oó]|que paso|qué pasó|qu[eé] tal|c[oó]mo (va|le va|est[aá]))\s+(con|el|la|los|las)?\s*/i, "")
    .trim();
  // Si quedó muy corto o vacío, fallback genérico.
  if (stripped.length < 5) return "Buscando en la web…";
  // Limitar longitud para que sea legible en la burbuja.
  const shortened = stripped.length > 50 ? stripped.slice(0, 50).trim() + "…" : stripped;
  return `Buscando ${shortened}…`;
}

export async function runKoruBackendTurn(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  onChunk?: (chunk: KoruBackendTurnResponse) => void,
): Promise<KoruBackendTurnResponse> {
  // Permitir override de modelo por turno desde el frontend
  const preferredProvider = inferProviderFromModel(request.model);
  if (request.model) {
    config = { ...config, nvidiaModel: request.model };
  }
  logger.info("runKoruBackendTurn", "=== START TURN ===", { input: request.input.slice(0, 200), model: config.nvidiaModel, preferredProvider });
  const messages = buildMessages(request);
  const toolExecutions: ToolExecution[] = [];
  let provider: "nvidia" | "openrouter" | "minimax" = "nvidia";
  let model: string | undefined;
  let fallbackReason: string | undefined;

  // Timeouts: Ollama necesita mucho más tiempo porque los modelos locales son lentos
  const isOllama = config.nvidiaBaseUrl.includes(":11434") || config.nvidiaBaseUrl.includes("ollama");
  const firstTimeout = isOllama ? 90_000 : 30_000;
  const secondaryTimeout = isOllama ? 120_000 : 30_000;
  const extractorTimeout = isOllama ? 120_000 : 40_000;

  let routeCategory: RouteCategory | undefined;

  // ── Semantic Router: decidir intención ANTES de llamar al LLM ──
  // Si el router detecta que se necesita una tool, la ejecutamos directamente.
  // Esto elimina la dependencia de que el modelo llame tools nativamente
  // (que vimos fallar ~50% de las veces). Si el router dice "conversation"
  // o no está disponible, cae al flujo nativo de abajo.
  // El router corre para cualquier mensaje con contenido (no vacío / no solo
  // saludo de una palabra). El gate NO usa isTrivialInput porque esa función
  // matchea prefijos ("hola ...") y haría saltar mensajes reales de búsqueda.
  const inputTrimmed = request.input.trim();
  if (inputTrimmed.length >= 3) {
    const router = await getRouter(config);
    if (router) {
      try {
        const routeStart = Date.now();
        const route = await router.route(request.input);
        routeCategory = route.category;
        logger.info("runKoruBackendTurn", "Semantic Router decision", {
          category: route.category,
          tool: route.tool ?? "none",
          confidence: route.confidence.toFixed(2),
          durationMs: Date.now() - routeStart,
        });
        if (route.tool) {
          const syntheticToolCall: ProviderToolCall = {
            id: `route_${Date.now()}`,
            type: "function",
            function: { name: route.tool, arguments: JSON.stringify(route.toolArgs ?? {}) },
          };
          const query = route.tool === "web_search" ? cleanText(route.toolArgs?.query as string) : undefined;
          // Texto natural para el usuario: NO le repetimos su mensaje literal.
          // Limpiamos el mensaje a una frase corta de qué estamos buscando.
          const shortSearchLabel = query ? searchLabelFromInput(query) : "Buscando en la web";
          onChunk?.({
            reply: shortSearchLabel,
            uiBlocks: query ? [{ type: "web_nav" as const, title: "Navegación Web", status: "loading" as const, query, results: [] }] : [],
            suggestedActions: [],
            understanding: { literalRequest: request.input, userGoal: route.category, unstatedNeeds: [], assumptions: [], confidence: route.confidence },
            memoryCandidates: [], commitments: [], records: [], toolResults: [],
            stateEvents: [{ kind: "searching" as const, label: shortSearchLabel }],
            mascotState: "working",
            provider, model, fallbackReason: "router-" + route.category,
          });
          messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
          const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config);
          if (delivered) {
            const response = await finalizePayload(request, config, delivered, toolExecutions, extractorTimeout);
            return { ...response, provider, model, fallbackReason: "router-" + route.category };
          }
          messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
          const secondResult = await callProvider(config, messages, secondaryTimeout, false, preferredProvider);
          provider = secondResult.provider;
          model = secondResult.model ?? model;
          const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");
          let parsedRoute: any;
          try {
            parsedRoute = JSON.parse(extractJsonBlock(secondContent));
          } catch {
            const rawFallback: Record<string, unknown> = {
              reply: cleanReplyText(secondContent) || "No pude armar una respuesta clara. ¿Me lo repetís de otra forma?",
              understanding: { literalRequest: request.input, userGoal: route.category, unstatedNeeds: [], assumptions: [], confidence: 0.45 },
              uiBlocks: blocksFromToolResults(toolExecutions),
              suggestedActions: [], memoryCandidates: [], commitments: [], records: [], mascotState: "thinking",
            };
            const response = await finalizeFromPlainText(rawFallback, [syntheticToolCall], request, config, toolExecutions, extractorTimeout);
            return { ...response, provider, model, fallbackReason: "router-" + route.category + "-invalid-json" };
          }
          const rawRoute = {
            reply: cleanText(parsedRoute.reply, secondContent),
            understanding: parsedRoute.understanding || {},
            uiBlocks: asArray(parsedRoute.uiBlocks || []),
            suggestedActions: asArray(parsedRoute.suggestedActions || []),
            memoryCandidates: asArray(parsedRoute.memoryCandidates || []),
            commitments: asArray(parsedRoute.commitments || []),
            records: asArray(parsedRoute.records || []),
            mascotState: parsedRoute.mascotState,
          };
          const response = await finalizePayload(request, config, rawRoute, toolExecutions, extractorTimeout);
          return { ...response, provider, model, fallbackReason: "router-" + route.category };
        }
      } catch (err: any) {
        logger.warn("runKoruBackendTurn", "Semantic Router failed (non-fatal, falling to native)", { reason: err?.message });
      }
    }
  }

  // Filtrar tools según la categoría detectada por el Semantic Router
  const categoryToolNames = routeCategory ? CATEGORY_TOOLS[routeCategory] : undefined;
  const filteredTools = categoryToolNames && categoryToolNames.length > 0
    ? ALL_TOOL_DEFINITIONS.filter((t) => categoryToolNames.includes(t.function.name))
    : undefined;

  // Paso 1: una sola llamada al LLM con tools habilitadas (excepto Ollama, que usa native JSON)
  let firstResult: ProviderResult & { fallbackReason?: string };
  try {
    firstResult = await callProvider(config, messages, firstTimeout, !isTrivialInput(request.input), preferredProvider, filteredTools);
  } catch (err: any) {
    logger.error("runKoruBackendTurn", "callProvider failed with tools", { error: err.message });
    if (err instanceof RateLimitError) {
      return { reply: err.message, uiBlocks: [], suggestedActions: [], understanding: { literalRequest: request.input, userGoal: "Rate limit", unstatedNeeds: [], assumptions: [], confidence: 0 }, memoryCandidates: [], commitments: [], records: [], toolResults: [], stateEvents: [], mascotState: "tired", provider: "openrouter", model: "rate-limited", fallbackReason: "rate-limit" };
    }
    // Fallback sin tools si el modelo no las soporta o devolvió respuesta vacía
    firstResult = await callProvider(config, messages, secondaryTimeout, false, preferredProvider);
    fallbackReason = (fallbackReason ? fallbackReason + " + " : "") + "no-tools-fallback";
  }
  provider = firstResult.provider;
  model = firstResult.model;
  logger.info("runKoruBackendTurn", "Provider responded", { provider, model, hasTools: (firstResult.message?.tool_calls?.length ?? 0) > 0 });
  fallbackReason = firstResult.fallbackReason;
  const firstMessage = firstResult.message;
  const toolCalls = asArray(firstMessage.tool_calls) as ProviderToolCall[];

  // Si el LLM pidió tool calls, emitir loading chunk y ejecutarlas
  if (toolCalls.length > 0) {
    const query = toolCalls.find((t) => t.function?.name === "web_search")?.function?.arguments
      ? JSON.parse(toolCalls.find((t) => t.function?.name === "web_search")!.function.arguments).query
      : undefined;
    const loadingChunk: KoruBackendTurnResponse = {
      reply: query ? `Buscando "${query}"...` : "Buscando en la web...",
      uiBlocks: query ? [{ type: "web_nav" as const, title: "Navegación Web", status: "loading" as const, query: cleanText(query), results: [] }] : [],
      suggestedActions: [],
      understanding: { literalRequest: request.input, userGoal: "Búsqueda web", unstatedNeeds: [], assumptions: [], confidence: 0.8 },
      memoryCandidates: [],
      commitments: [],
      records: [],
      toolResults: [],
      stateEvents: [{ kind: "searching" as const, label: query ? `Buscando "${query}"` : "Buscando en la web" }],
      mascotState: "working",
      provider,
      model,
      fallbackReason,
    };
    onChunk?.(loadingChunk);

    messages.push({ role: "assistant", content: "", tool_calls: toolCalls });

    const delivered = await executeProviderToolCalls(toolCalls, messages, request, toolExecutions, config);
    if (delivered) {
      const response = await finalizePayload(request, config, delivered, toolExecutions, extractorTimeout);
      return { ...response, provider, model, fallbackReason: fallbackReason ?? response.memoryFallbackReason };
    }

    // Emitir chunk intermedio con los resultados de tools para progreso en tiempo real
    if (onChunk && toolExecutions.length > 0) {
      const intermediateBlocks = blocksFromToolResults(toolExecutions).map((b) => {
        if (b.type === "web_nav") return { ...b, status: "loading" as const };
        return b;
      });
      logger.info("runKoruBackendTurn", "Emit intermediate chunk", { blockCount: intermediateBlocks.length });
      onChunk({
        reply: query ? `Buscando "${query}"...` : "Buscando...",
        uiBlocks: intermediateBlocks,
        suggestedActions: [],
        understanding: { literalRequest: request.input, userGoal: query ? "Búsqueda web" : request.input, unstatedNeeds: [], assumptions: [], confidence: 0.8 },
        memoryCandidates: [],
        commitments: [],
        records: [],
        toolResults: [],
        stateEvents: [{ kind: "searching" as const, label: query ? `Buscando "${query}"` : "Buscando..." }],
        mascotState: "working",
        provider,
        model,
        fallbackReason,
      });
    }

    // Paso 2: segunda llamada (sin tools) para que el LLM síntetice la respuesta final.
    // Corre EN PARALELO con las extracciones diferidas de estructura (data_card),
    // para que el extractor (~11s) no sume latencia al turno.
    messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
    const deferredCards = (toolExecutions as ToolExecution[] & { __deferredDataCards?: Array<Promise<UiBlock | null>> }).__deferredDataCards ?? [];
    const [secondResult, ...resolvedCards] = await Promise.all([
      callProvider(config, messages, secondaryTimeout, false),
      ...deferredCards,
    ]);
    provider = secondResult.provider;
    model = secondResult.model ?? model;
    const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");
    logger.info("runKoruBackendTurn", "Parsing second response JSON", { secondContentPreview: secondContent.slice(0, 500) });
    // data_cards validados que llegaron en paralelo (pueden ser null si no había datos)
    const validDeferredCards: UiBlock[] = resolvedCards.filter((b): b is UiBlock => b !== null);

    let parsed: any;
    try {
      parsed = JSON.parse(extractJsonBlock(secondContent));
    } catch (err) {
      logger.warn("runKoruBackendTurn", "Second response JSON parse failed", { error: String(err), secondContentPreview: secondContent.slice(0, 500) });
      const rawFallback: Record<string, unknown> = {
        reply: cleanReplyText(secondContent) || "No pude armar una respuesta clara. ¿Me lo repetís de otra forma?",
        understanding: {
          literalRequest: request.input,
          userGoal: "Resolver el pedido con ayuda de Koru.",
          unstatedNeeds: [],
          assumptions: [],
          confidence: 0.45,
        },
        uiBlocks: [...validDeferredCards, ...blocksFromToolResults(toolExecutions)],
        suggestedActions: [],
        memoryCandidates: [],
        commitments: [],
        records: [],
        mascotState: "thinking",
      };
      const response = await finalizeFromPlainText(rawFallback, toolCalls, request, config, toolExecutions, extractorTimeout);
      logger.info("runKoruBackendTurn", "Return second-call-invalid-json", { replyPreview: (response.reply ?? "").slice(0, 300), provider, model, fallbackReason });
      return { ...response, provider, model, fallbackReason: fallbackReason ?? "second-call-invalid-json" };
    }

    const raw = {
      reply: cleanText(parsed.reply, secondContent),
      understanding: parsed.understanding || {},
      uiBlocks: asArray(parsed.uiBlocks || []),
      suggestedActions: asArray(parsed.suggestedActions || []),
      memoryCandidates: asArray(parsed.memoryCandidates || []),
      commitments: asArray(parsed.commitments || []),
      records: asArray(parsed.records || []),
      mascotState: parsed.mascotState,
    };
    const cityAction = cityMemorySuggestion(toolCalls, request.state);
    if (cityAction) raw.suggestedActions = [...asArray(raw.suggestedActions), cityAction];

    // Inyectar data_cards validados que se extrajeron en paralelo al Composer.
    if (validDeferredCards.length > 0) {
      raw.uiBlocks = [...validDeferredCards, ...asArray(raw.uiBlocks)];
    }
    const response = await finalizePayload(request, config, raw, toolExecutions, extractorTimeout);
    return {
      ...response,
      provider,
      model,
      fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "after-tools",
    };
  }

  // Sin tool calls nativos: antes de tratar el content como JSON final, revisar si
  // el modelo SIMULÓ una tool-call en texto (formatos ```json{"query":...}```,
  // <|tool_call|>call:NAME{...}, ```tool_call NAME {}```). Es una capa de
  // compatibilidad estándar para modelos sin tool-use nativo. Si se detecta,
  // ejecutamos la tool manualmente y seguimos el flujo normal de tools.
  const content = cleanText(firstMessage.content, "No pude componer una respuesta util.");
  const simulatedCall = detectSimulatedToolCall(content);
  if (simulatedCall) {
    logger.info("runKoruBackendTurn", "Simulated tool-call detected", {
      tool: simulatedCall.name,
      format: simulatedCall.format,
      argsKeys: Object.keys(simulatedCall.arguments),
    });
    const syntheticToolCall: ProviderToolCall = {
      id: `sim_${Date.now()}`,
      type: "function",
      function: {
        name: simulatedCall.name,
        arguments: JSON.stringify(simulatedCall.arguments),
      },
    };
    const query = simulatedCall.name === "web_search" ? cleanText(simulatedCall.arguments.query as string) : undefined;
    onChunk?.({
      reply: query ? `Buscando "${query}"...` : "Buscando en la web...",
      uiBlocks: query ? [{ type: "web_nav" as const, title: "Navegación Web", status: "loading" as const, query, results: [] }] : [],
      suggestedActions: [],
      understanding: { literalRequest: request.input, userGoal: query ? "Búsqueda web" : request.input, unstatedNeeds: [], assumptions: [], confidence: 0.8 },
      memoryCandidates: [], commitments: [], records: [], toolResults: [],
      stateEvents: [{ kind: "searching" as const, label: query ? `Buscando "${query}"` : "Buscando en la web" }],
      mascotState: "working",
      provider, model, fallbackReason,
    });
    messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
    const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config);
    if (delivered) {
      const response = await finalizePayload(request, config, delivered, toolExecutions, extractorTimeout);
      return { ...response, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool" };
    }
    // Paso 2: segunda llamada (sin tools) para que el LLM síntetice la respuesta final.
    messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
    const secondResult = await callProvider(config, messages, secondaryTimeout, false, preferredProvider);
    provider = secondResult.provider;
    model = secondResult.model ?? model;
    const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");
    let parsedSim: any;
    try {
      parsedSim = JSON.parse(extractJsonBlock(secondContent));
    } catch {
      const rawFallback: Record<string, unknown> = {
        reply: cleanReplyText(secondContent) || "No pude armar una respuesta clara. ¿Me lo repetís de otra forma?",
        understanding: { literalRequest: request.input, userGoal: "Resolver el pedido con ayuda de Koru.", unstatedNeeds: [], assumptions: [], confidence: 0.45 },
        uiBlocks: blocksFromToolResults(toolExecutions),
        suggestedActions: [], memoryCandidates: [], commitments: [], records: [], mascotState: "thinking",
      };
      const response = await finalizeFromPlainText(rawFallback, [syntheticToolCall], request, config, toolExecutions, extractorTimeout);
      return { ...response, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool-invalid-json" };
    }
    const rawSim = {
      reply: cleanText(parsedSim.reply, secondContent),
      understanding: parsedSim.understanding || {},
      uiBlocks: asArray(parsedSim.uiBlocks || []),
      suggestedActions: asArray(parsedSim.suggestedActions || []),
      memoryCandidates: asArray(parsedSim.memoryCandidates || []),
      commitments: asArray(parsedSim.commitments || []),
      records: asArray(parsedSim.records || []),
      mascotState: parsedSim.mascotState,
    };
    const response = await finalizePayload(request, config, rawSim, toolExecutions, extractorTimeout);
    return { ...response, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool" };
  }

  // Sin tool calls (ni simuladas): parsear la respuesta JSON directamente
  logger.info("runKoruBackendTurn", "Parsing first response JSON", { contentPreview: content.slice(0, 500) });
  let parsed: any;
  try {
    parsed = JSON.parse(extractJsonBlock(content));
  } catch (err) {
    logger.warn("runKoruBackendTurn", "First response JSON parse failed", { error: String(err), contentPreview: content.slice(0, 500) });
    const isOllama = config.nvidiaBaseUrl.includes(":11434") || config.nvidiaBaseUrl.includes("ollama");
    if (isOllama) {
      try {
        const retryResult = await callProvider(config, [
          ...messages,
          { role: "user", content: "Tu respuesta anterior no era JSON perfecto. Reescribí SOLO el JSON puro correcto, sin texto extra." },
        ], 15_000, false, preferredProvider);
        parsed = JSON.parse(extractJsonBlock(cleanText(retryResult.message.content, "")));
        logger.info("runKoruBackendTurn", "Ollama JSON retry succeeded");
      } catch (retryErr) {
        logger.warn("runKoruBackendTurn", "Ollama JSON retry also failed", { error: String(retryErr) });
      }
    }
    if (!parsed) {
      const rawFallback: Record<string, unknown> = {
        reply: cleanReplyText(content) || "No pude armar una respuesta clara. ¿Me lo repetís de otra forma?",
        understanding: {
          literalRequest: request.input,
          userGoal: "Responder la consulta del usuario.",
          unstatedNeeds: [],
          assumptions: [],
          confidence: 0.45,
        },
        uiBlocks: blocksFromToolResults(toolExecutions),
        suggestedActions: [],
        memoryCandidates: [],
        commitments: [],
        records: [],
        mascotState: "thinking",
      };
      const response = await finalizeFromPlainText(rawFallback, toolCalls, request, config, toolExecutions, extractorTimeout);
      logger.info("runKoruBackendTurn", "Return first-call-invalid-json", { replyPreview: (response.reply ?? "").slice(0, 300), provider, model, fallbackReason });
      return { ...response, provider, model, fallbackReason: fallbackReason ?? "first-call-invalid-json" };
    }
  }

  const raw = {
    reply: cleanText(parsed.reply, content),
    understanding: parsed.understanding || {},
    uiBlocks: asArray(parsed.uiBlocks || []),
    suggestedActions: asArray(parsed.suggestedActions || []),
    memoryCandidates: asArray(parsed.memoryCandidates || []),
    commitments: asArray(parsed.commitments || []),
    records: asArray(parsed.records || []),
    mascotState: parsed.mascotState,
  };
  const cityAction = cityMemorySuggestion(toolCalls, request.state);
  if (cityAction) raw.suggestedActions = [...asArray(raw.suggestedActions), cityAction];

  // Solo si el LLM principal no generó sugerencias, intentar enhancement como fallback
  if (asArray(raw.suggestedActions).length === 0) {
    try {
      const { enhancementActions } = await buildEnhancementInstruction(request, config, toolExecutions);
      raw.suggestedActions = [...asArray(raw.suggestedActions), ...enhancementActions];
    } catch { /* ignorar */ }
  }

  const response = await finalizePayload(request, config, raw, toolExecutions, extractorTimeout);
  logger.info("runKoruBackendTurn", "Return first-call", { replyPreview: (response.reply ?? "").slice(0, 300), provider, model, fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "first-call" });
  return {
    ...response,
    provider,
    model,
    fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "first-call",
  };
}
