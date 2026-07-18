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
import { SemanticRouter, type EmbedFn, type RouteResult, type RouteCategory, keywordFastPath } from "../domain/semanticRouter";
import { logger, dump } from "./logger";
import type { ToolDefinition } from "../tools/types";

export type ProviderConfig = {
  nvidiaApiKey?: string;
  nvidiaBaseUrl: string;
  nvidiaModel: string;
  nvidiaFastModel?: string;
  nvidiaMediumModel?: string;
  openRouterKeys: string[];
  openRouterModels: string[];
  minimaxAccessToken?: string;
  bluesmindsKeys?: string[];
  bluesmindsModel?: string;
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
  archiveMemoryIds?: string[];
  commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  toolResults: ToolResult[];
  stateEvents: Array<{ kind: "thinking" | "searching" | "comparing" | "planning" | "saving" | "done"; label: string }>;
  provider: "nvidia" | "openrouter" | "minimax" | "bluesminds";
  model?: string;
  fallbackReason?: string;
  mascotState?: MascotState;
  skippedBecauseBoundary?: string[];
  behaviorNotes?: string[];
};

type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
};

export type ProviderToolCall = {
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

export type ProviderResult = {
  provider: "nvidia" | "openrouter" | "minimax" | "bluesminds";
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
  condition?: string;
  range?: string;
  rain?: string;
  wind?: string;
  humidity?: string;
  feel?: string;
  uv?: number;
  advice?: string;
  hourly?: Array<{ hour: string; temp: string; conditionIcon: string; rainPct: number; uv: number }>;
  daily?: Array<{ dayAbbrev: string; hi: string; lo: string; conditionIcon: string }>;
  status?: "need_city";
  sources: AssistantSource[];
};

export type SearchData = {
  type: "search";
  mode: "news" | "research" | "shopping" | "world";
  title: string;
  summary: string;
  sources: AssistantSource[];
  comparisonItems?: NonNullable<Extract<UiBlock, { type: "comparison" }>["items"]>;
  extractedData?: Extract<UiBlock, { type: "data_card" }>;
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

export const TOOL_DEFINITIONS = [
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
          uiBlockType: { type: "string", enum: ["reminder", "alarm", "shopping_list", "saved_record", "money_summary", "birthday_calendar", "birthday_alarm", "social_interaction"] },
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
          uiBlocks: {
            type: "array",
            items: { type: "object" },
            description: "Visual cards shown to the user. Each item MUST include a 'type' field. Available types: weather, restaurant_synthesis, comparison, product_analysis, smart_checklist, outfit, review_score, review_document, review_quote, plan, saved_record, personal_query, match_timeline, live_match, match_stats, crypto_portfolio, market, forex, election_results, election_vote, data_ticker, route_timeline, transport_compare, route_map, travel_planner, birthday_calendar, birthday_alarm, social_interaction, local_action, research_sources, data_card, web_nav, money_summary, morning_brief, generation.",
          },
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
export const ALL_TOOL_DEFINITIONS = [
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
    "image_generate",
  ],
  // research se maneja con su propio pipeline (runDeepResearchFlow); si algo
  // cae al flujo nativo, web_search es el único apoyo razonable.
  research: ["web_search"],
  sports: ["match_schedule", "match_live", "team_follow", "league_standings"],
  market: ["crypto_price", "stock_quote", "exchange_history", "currency_convert"],
  travel: ["travel_itinerary", "flight_search", "hotel_search"],
  directions: ["route_traffic", "weather", "travel_itinerary"],
  elections: ["web_search", "news_topic"],
  review: ["shopping_compare", "web_search", "movie_info", "book_info", "game_info", "product_review"],
  birthday: ["save_personal_item", "query_personal_context"],
  // 🔴 FIX P1: nuevas categorías para tools que ya existían pero no se rutaban
  food: ["recipe_find", "recipe_by_ingredients", "food_info", "wine_pairing", "nutrition_calc", "restaurant_deep_search"],
  media: ["movie_info", "book_info", "game_info", "person_info", "person_filmography", "web_search", "image_generate"],
  knowledge: ["wikipedia_lookup", "dictionary_define", "math_calc", "unit_convert", "web_search"],
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

/**
 * Genera iniciales de un nombre de equipo (máx 3 letras).
 * "Spain" → "SPA", "Real Madrid" → "MAD", "Boca Juniors" → "BJU", "PSG" → "PSG".
 */
function initialsFromName(name: string): string {
  const clean = String(name ?? "").trim().toUpperCase();
  if (!clean) return "???";
  // Si ya es sigla (PSG, MLS, etc), devolverla
  if (/^[A-Z]{2,4}$/.test(clean) && clean.length <= 4) return clean;
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) return words[0].slice(0, 3);
  // Tomar primera letra de las primeras 3 palabras, saltando artículos
  const filtered = words.filter(w => !["DE", "DEL", "LA", "LAS", "EL", "LOS", "Y", "FC", "CF"].includes(w));
  return (filtered.slice(0, 3).map(w => w[0]).join("") || words[0].slice(0, 3)).padEnd(3, "X");
}

/**
 * Formatea una fecha ISO a "DD/MM YYYY" o "Hoy" / "Ayer" según corresponda.
 */
function formatMatchDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((todayStart.getTime() - dStart.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays === -1) return "Mañana";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch { return ""; }
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

/**
 * 🔴 FIX P0 — stripReasoning: elimina razonamiento interno del LLM antes de
 * exponerlo como reply al usuario.
 *
 * Causa raíz del Bug 1: Nemotron Ultra (y otros modelos con modo "thinking")
 * a veces emiten su CoT en el campo `content` en lugar de `reasoning_content`.
 * Esto se ve como: "The user is asking about Argentina's football match...".
 *
 * Estrategias de strippado (en orden):
 *  1. Tags XML-style explícitos: <think>...</think>, <reasoning>...</reasoning>,
 *     <reflection>...</reflection>, <output>...</output> (conservar solo el contenido de <output>).
 *  2. CoT en inglés antes del JSON: si el texto contiene `{"reply"` más adelante,
 *     tirar todo lo anterior al primer `{`.
 *  3. AGRESIVO: si el texto EMPIEZA con un patrón de thinking en inglés
 *     ("The user is asking...", "I need to...", "Let me...", "I should..."),
 *     y NO contiene JSON reply, devolver "" — es thinking puro.
 *     Sin threshold de length: cualquier thinking al inicio = strip.
 *  4. AGRESIVO: si el texto contiene 2+ indicadores de thinking
 *     ("I need to", "Let me", "I should", "I will", "The user..."),
 *     y NO contiene JSON reply, devolver "".
 *
 * Tests verificados:
 *  - "The user is asking about Argentina's match yesterday..." (148 chars) → ""
 *  - "The user is asking about Argentina's football match... Let me use match_live..." (280 chars) → ""
 *  - "¡Hola Juan! ¿Cómo va todo?" → preservado
 *  - "En Madrid hace 29°C ahora..." → preservado
 *  - "Listo, guardado en gastos." → preservado
 */
function stripReasoning(text: string): string {
  if (!text) return "";
  let out = text;
  // 1. Tags XML-style
  out = out
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, "")
    .replace(/<reflection>[\s\S]*$/gi, "") // reflection sin cerrar (truncado)
    .replace(/<\/?think>/gi, "")
    .replace(/<\/?reasoning>/gi, "");
  // Si hay tag <output>, conservar SOLO su contenido
  const outputMatch = out.match(/<output>([\s\S]*?)<\/output>/i);
  if (outputMatch) {
    out = outputMatch[1];
  }
  // 2. Si hay `{"reply"` o `{"reply":` más adelante, tirar todo lo anterior (CoT en inglés)
  const jsonStart = out.search(/\{\s*["']reply["']\s*:/);
  if (jsonStart > 0) {
    out = out.slice(jsonStart);
  }
  // Si ya encontramos JSON reply, no seguir strippando
  const hasJsonReply = /\{\s*["']reply["']\s*:/.test(out);
  if (hasJsonReply) {
    return out;
  }
  // 3. AGRESIVO: si empieza con patrón de thinking en inglés, strip total
  //    Patrones ampliados para cubrir más variantes del CoT de Nemotron.
  const thinkingStartPatterns = [
    /^(the user|the user is|the user wants|the user is asking|i should|i need to|let me|let's think|i'll|i will|i am going to|first,?\s*i|now i|the question|looking at|analyzing|to answer this|based on the|so,?\s*i|this is a|this is an|let's consider|step by step|i have to|i must|i'm going to|the request|the input|the message|i want to|i can|i could|i'm thinking|okay,?\s*(so|i|let|the)|alright,?\s*(so|i|let|the))\b/i,
  ];
  const trimmed = out.trim();
  if (trimmed.length > 20 && thinkingStartPatterns.some(re => re.test(trimmed))) {
    return "";
  }
  // 4. AGRESIVO: si contiene múltiples indicadores de thinking, es thinking
  //    aunque no empiece exactamente con un patrón.
  const thinkingIndicators = (out.match(/\b(i need to|let me|i should|i will|i'll|i am going to|i'm going to|i have to|i must|the user|i want to|i can|step by step|let's think|i think|i believe|first i|then i|next i|finally i)\b/gi) || []).length;
  if (thinkingIndicators >= 2 && trimmed.length > 30) {
    return "";
  }
  return out;
}

function safeJsonObjectFromContent(raw: string): Record<string, unknown> {
  // 🔴 FIX P0: stripar reasoning ANTES de intentar parsear JSON
  const cleaned = stripReasoning(raw);
  const direct = safeJsonParse(cleaned);
  if (direct.reply !== undefined || direct.uiBlocks !== undefined) return direct;
  const extracted = safeJsonParse(extractJsonBlock(cleaned));
  if (extracted.reply !== undefined || extracted.uiBlocks !== undefined) return extracted;
  // Dirty extraction: fields individually with regex
  const reply = extractStringField(cleaned, "reply");
  const mascotState = extractStringField(cleaned, "mascotState") || extractStringField(cleaned, "mascot_state");
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
  // 🔴 FIX P0: stripar reasoning PRIMERO, antes de cualquier otra limpieza
  return stripReasoning(cleanText(value))
    .replace(/\*?\s*uiBlock\s*:\s*[a-z_]+\s*\*?/gi, "")
    .replace(/\buiBlocks?\b\s*[:=]\s*\[[\s\S]*$/i, "")
    .replace(/\b(Hola|Gracias|Perfecto|Listo)(?=[A-ZÁÉÍÓÚÑ])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCompactNumber(value: number, currency?: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    ...(currency ? { style: "currency" as const, currency } : {}),
  });
  return formatter.format(value);
}

/**
 * 🔴 FIX GAP-2: formatea una distancia en metros como "X.Y km" o "Y m".
 * Usado por el mapping `route_plan_search` → `route_map` (campo `distance`).
 */
function formatRouteDistance(meters: unknown): string | undefined {
  const m = Number(meters);
  if (!Number.isFinite(m) || m <= 0) return undefined;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

/**
 * 🔴 FIX GAP-2: formatea una duración en segundos como "Xh Ym", "Y min" o "Z s".
 * Usado por el mapping `route_plan_search` → `route_map` (campos `remaining` y
 * `alternatives[].time`).
 */
function formatRouteDuration(seconds: unknown): string | undefined {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return undefined;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
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

export function hasUsableAssistantMessage(data: unknown): boolean {
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
  modelOverride?: string,
): Promise<ProviderResult> {
  const isOllama = isOllamaUrl(config.nvidiaBaseUrl);
  if (isOllama) {
    const body: Record<string, unknown> = {
      model: modelOverride ?? config.nvidiaModel,
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
    model: modelOverride ?? config.nvidiaModel,
    messages,
    ...(toolsEnabled ? { tools: availableTools ?? TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
    temperature: 0.25,
    top_p: 0.95,
    max_tokens: 8192,
    stream: false,
  };
  // FIX: retry automático para NVIDIA (1 retry con backoff de 2s).
  // ~20% de las requests dan timeout transient.
  let response: Response;
  try {
    response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/v1/chat/completions"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, timeoutMs);
  } catch (firstErr) {
    logger.warn("callNvidia", "First attempt failed, retrying in 2s", { error: firstErr instanceof Error ? firstErr.message : "unknown" });
    await new Promise(resolve => setTimeout(resolve, 2000));
    response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/v1/chat/completions"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, timeoutMs);
  }
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

async function callBlueSmindsCandidate(
  key: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  const response = await fetchWithTimeout("https://api.bluesminds.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
      temperature: 0.25,
      max_tokens: 8192,
      stream: false,
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    throw new Error(`BlueSminds ${model} returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "bluesminds",
    model: asString(asRecord(data).model) ?? model,
    message: asRecord(choice.message) as ProviderMessage,
  };
}

async function callBlueSminds(config: ProviderConfig, messages: ChatMessage[], timeoutMs: number, toolsEnabled = true): Promise<ProviderResult> {
  const keys = (config.bluesmindsKeys ?? []).slice(0, 3);
  const model = config.bluesmindsModel ?? "mimo-v2.5";
  if (!keys.length) throw new Error("BlueSminds is not configured.");
  let lastError: Error | undefined;
  for (const key of keys) {
    try {
      return await callBlueSmindsCandidate(key, model, messages, timeoutMs, toolsEnabled);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn("callBlueSminds", `BlueSminds ${model} failed with a key, trying next`, { reason: lastError.message });
    }
  }
  throw lastError ?? new Error(`BlueSminds ${model} failed with all available keys.`);
}

function providerResultIsValid(result: ProviderResult): boolean {
  const content = result.message?.content ?? "";
  const trimmed = content.trim();
  const hasTools = asArray(result.message?.tool_calls).length > 0;
  const hasContent = trimmed.length > 0;
  return hasContent || hasTools;
}

function isOllamaUrl(baseUrl: string | undefined): boolean {
  const value = (baseUrl ?? "").toLowerCase();
  return value.includes(":11434") || value.includes("ollama");
}

export function inferProviderFromModel(model: string | undefined): "minimax" | "nvidia" | "openrouter" | "bluesminds" | undefined {
  if (!model) return undefined;
  if (model === "MiniMax-M2.7") return "minimax";
  if (model === "mimo-v2.5") return "bluesminds";
  if (model.startsWith("hf.co/")) return "nvidia"; // HuggingFace models served by Ollama
  if (!model.includes("/")) return "nvidia"; // Ollama tags without namespace, e.g. qwen3.6:27b, llama3.1:8b
  if (model.startsWith("nvidia/") && !model.includes(":")) return "nvidia"; // NVIDIA API models
  if (model.startsWith("stepfun-ai/")) return "nvidia"; // Flash model served by NVIDIA API
  if (model.includes("/") && model.includes(":")) return "openrouter"; // OpenRouter free models (e.g. openai/gpt-oss-120b:free)
  return undefined;
}

function nvidiaTimeoutMs(config: ProviderConfig, isOllama: boolean, timeoutMs: number): number {
  if (isOllama) return Math.min(150_000, timeoutMs);
  const isLargeNemotron = config.nvidiaModel.toLowerCase().includes("nemotron-3-ultra");
  // 🔴 FIX P2.4: bumped Nemotron Ultra from 120s → 180s
  // Algunas síntesis con muchos tool results tardan más de 120s.
  return Math.min(isLargeNemotron ? 180_000 : 60_000, timeoutMs);
}

/**
 * Fase 4.1 — Router de modelos NVIDIA.
 *
 * Selecciona el modelo óptimo según la complejidad del input del usuario:
 * - Trivial (hola, gracias, adios): modelo flash (~1-2s)
 * - Normal (clima, gasto, lista): modelo mediano (~5-8s)
 * - Complejo (informe, deep research): modelo ultra (~15s)
 *
 * Esto reduce la latencia percibida para interacciones simples sin
 * sacrificar calidad en tareas complejas.
 */
function selectModelForInput(
  input: string,
  config: ProviderConfig,
  isTrivial: boolean,
  isDeliverable: boolean,
): string | undefined {
  // Si no hay fast/medium model configurado, usar el default
  if (!config.nvidiaFastModel && !config.nvidiaMediumModel) return undefined;

  // Trivial → flash (sin tools, respuesta rápida)
  if (isTrivial && config.nvidiaFastModel) {
    logger.info("modelRouter", "Using fast model", { model: config.nvidiaFastModel, reason: "trivial input" });
    return config.nvidiaFastModel;
  }

  // Deliverable (informe/investigación) → ultra (máxima calidad)
  if (isDeliverable) {
    logger.info("modelRouter", "Using ultra model", { model: config.nvidiaModel, reason: "deliverable" });
    return config.nvidiaModel; // nvidiaModel = ultra por default
  }

  // Normal → medium si está disponible, sino ultra
  if (config.nvidiaMediumModel) {
    logger.info("modelRouter", "Using medium model", { model: config.nvidiaMediumModel, reason: "normal input" });
    return config.nvidiaMediumModel;
  }

  return undefined;
}

export async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
  preferredProvider?: "minimax" | "nvidia" | "openrouter" | "bluesminds",
  availableTools?: ToolDefinition[],
  modelOverride?: string,
): Promise<ProviderResult & { fallbackReason?: string }> {
  const isOllama = isOllamaUrl(config.nvidiaBaseUrl);
  const nvidiaAvailable = Boolean(config.nvidiaApiKey) || isOllama;
  const bluesmindsKeys = config.bluesmindsKeys ?? [];
  const bluesmindsModel = config.bluesmindsModel ?? "mimo-v2.5";
  const bluesmindsAvailable = bluesmindsKeys.length > 0 && bluesmindsModel.length > 0;

  // SALTO DIRECTO si el usuario eligió un provider específico
  if (preferredProvider === "bluesminds" && bluesmindsAvailable) {
    try {
      return await callBlueSminds(config, messages, Math.min(60_000, timeoutMs), toolsEnabled);
    } catch (err: any) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "Preferred BlueSminds failed, falling through", { reason: err?.message });
    }
  }

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
      const result = await callNvidia(config, messages, nvidiaTimeoutMs(config, isOllama, timeoutMs), toolsEnabled, availableTools, modelOverride);
      if (providerResultIsValid(result)) return result;
      logger.warn("callProvider", "Preferred NVIDIA responded but invalid, falling back");
    } catch (err: any) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "Preferred NVIDIA failed, falling back", { reason: err?.message });
    }
  }

  if (preferredProvider === "openrouter" && config.openRouterKeys.length) {
    return callOpenRouter(config, messages, Math.min(115_000, timeoutMs), toolsEnabled);
  }

  // FLUJO NORMAL (sin preferencia o preferencia fallida)
  // BlueSminds es el proveedor principal si está configurado.
  if (bluesmindsAvailable && (!preferredProvider || preferredProvider === "bluesminds")) {
    try {
      const result = await callBlueSminds(config, messages, Math.min(60_000, timeoutMs), toolsEnabled);
      if (providerResultIsValid(result)) {
        logger.info("callProvider", "BlueSminds succeeded");
        return result;
      }
      logger.warn("callProvider", "BlueSminds responded but invalid, falling through");
    } catch (err: any) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "BlueSminds failed, falling through", { reason: err?.message });
    }
  }

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
    return callOpenRouter(config, messages, Math.min(115_000, timeoutMs), toolsEnabled);
  }

  // Si el usuario eligió OpenRouter, saltamos NVIDIA en el flujo normal
  if (!preferredProvider || preferredProvider !== "openrouter") {
    try {
      const result = await callNvidia(config, messages, nvidiaTimeoutMs(config, isOllama, timeoutMs), toolsEnabled, availableTools, modelOverride);
      if (providerResultIsValid(result)) return result;
      logger.warn("callProvider", "NVIDIA responded but invalid, falling back");
    } catch (err: any) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "NVIDIA failed, falling back to OpenRouter", { reason: err?.message });
    }
  }

  if (config.openRouterKeys.length) {
    return callOpenRouter(config, messages, Math.min(115_000, timeoutMs), toolsEnabled);
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
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 15_000);
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
  const requestedCity = cleanText(args.city);
  if (!requestedCity) {
    return {
      type: "weather",
      city: "",
      status: "need_city",
      advice: "No hay ciudad conocida del usuario. Preguntale con calidez en qué ciudad está, avisale que la vas a recordar para la próxima, y NO inventes datos de clima.",
      sources: [],
    };
  }

  // 🔴 FIX MACRO: usar wttr.in como fuente PRINCIPAL (sin rate limits, sin API key).
  // open-meteo como fallback si wttr.in falla.
  try {
    const wttrUrl = `https://wttr.in/${encodeURIComponent(requestedCity)}?format=j1`;
    const wttrRes = await fetchWithTimeout(wttrUrl, { headers: { "User-Agent": "Koru/1.0" } }, 10_000);
    if (wttrRes.ok) {
      const wttr = await wttrRes.json() as {
        current_condition?: Array<{ temp_C?: string; humidity?: string; windspeedKmph?: string; weatherDesc?: Array<{ value?: string }> }>;
        weather?: Array<{ date?: string; mintempC?: string[]; maxtempC?: string[]; hourly?: Array<{ time?: string; tempC?: string; chanceofrain?: string; weatherDesc?: Array<{ value?: string }>; uvIndex?: string }> }>;
        nearest_area?: Array<{ areaName?: Array<{ value?: string }>; country?: Array<{ value?: string }> }>;
      };
      const cur = wttr.current_condition?.[0];
      const area = wttr.nearest_area?.[0];
      const cityName = area?.areaName?.[0]?.value ?? requestedCity;
      const country = area?.country?.[0]?.value ?? "";
      const temp = cur?.temp_C ? parseInt(cur.temp_C) : undefined;
      const wind = cur?.windspeedKmph ? parseInt(cur.windspeedKmph) : undefined;
      const humidity = cur?.humidity ? parseInt(cur.humidity) : undefined;
      const desc = cur?.weatherDesc?.[0]?.value?.trim() ?? "";
      const max = wttr.weather?.[0]?.maxtempC?.[0] ? parseInt(wttr.weather[0].maxtempC[0]) : undefined;
      const min = wttr.weather?.[0]?.mintempC?.[0] ? parseInt(wttr.weather[0].mintempC[0]) : undefined;
      const rain = wttr.weather?.[0]?.hourly?.[0]?.chanceofrain?.[0] ? parseInt(wttr.weather[0].hourly[0].chanceofrain[0]) : undefined;

      // 🔴 KIMI v7 — Extraer hourly (próximas 8 horas) y daily (próximos 7 días)
      const hourlyData: Array<{ hour: string; temp: string; conditionIcon: string; rainPct: number; uv: number }> = [];
      const todayHourly = wttr.weather?.[0]?.hourly ?? [];
      const tomorrowHourly = wttr.weather?.[1]?.hourly ?? [];
      const allHourly = [...todayHourly, ...tomorrowHourly];
      const currentHour = new Date().getHours();
      let count = 0;
      for (let i = 0; i < allHourly.length && count < 8; i++) {
        const h = allHourly[i];
        const hTime = h?.time ? parseInt(h.time.slice(0, 2)) : 0;
        // Empezar desde la hora actual
        if (i < todayHourly.length && hTime < currentHour) continue;
        const hTemp = h?.tempC ? parseInt(h.tempC) : undefined;
        const hRain = h?.chanceofrain ? parseInt(h.chanceofrain) : undefined;
        const hDesc = h?.weatherDesc?.[0]?.value?.trim() ?? "";
        const hUV = h?.uvIndex ? parseInt(h.uvIndex) : 0;
        if (hTemp !== undefined) {
          hourlyData.push({
            hour: hTime ? `${String(hTime).padStart(2, "0")}:00` : "",
            temp: `${hTemp}°`,
            conditionIcon: hDesc || "cloud",
            rainPct: hRain ?? 0,
            uv: hUV,
          });
          count++;
        }
      }

      const dailyData: Array<{ dayAbbrev: string; hi: string; lo: string; conditionIcon: string }> = [];
      const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      for (let i = 0; i < Math.min(7, wttr.weather?.length ?? 0); i++) {
        const w = wttr.weather![i];
        const dMax = w?.maxtempC?.[0] ? parseInt(w.maxtempC[0]) : undefined;
        const dMin = w?.mintempC?.[0] ? parseInt(w.mintempC[0]) : undefined;
        const dDesc = w?.hourly?.[0]?.weatherDesc?.[0]?.value?.trim() ?? "";
        const dateStr = w?.date ?? "";
        let dayAbbrev = dayNames[new Date().getDay()];
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) dayAbbrev = dayNames[d.getDay()];
        }
        if (dMax !== undefined && dMin !== undefined) {
          dailyData.push({
            dayAbbrev: i === 0 ? "Hoy" : dayAbbrev,
            hi: `${dMax}°`,
            lo: `${dMin}°`,
            conditionIcon: dDesc || "cloud",
          });
        }
      }

      if (temp !== undefined) {
        const advice = [
          `${Math.round(temp)} C ahora`,
          rain !== undefined && rain >= 50 ? "conviene paraguas" : rain !== undefined ? "lluvia poco probable" : undefined,
          min !== undefined && min <= 10 ? "lleva abrigo si sales tarde" : undefined,
        ].filter(Boolean).join("; ");
        return {
          type: "weather",
          city: country ? `${cityName}, ${country}` : cityName,
          now: `${Math.round(temp)}°`,
          condition: desc || undefined,
          range: min !== undefined && max !== undefined ? `${Math.round(min)}°–${Math.round(max)}°` : undefined,
          rain: rain !== undefined ? `${rain}%` : undefined,
          wind: wind !== undefined ? `${Math.round(wind)} km/h` : undefined,
          humidity: humidity !== undefined ? `${humidity}%` : undefined,
          feel: temp !== undefined ? `${Math.round(temp - 2)}°` : undefined,
          uv: wttr.weather?.[0]?.hourly?.[0]?.uvIndex ? parseInt(wttr.weather[0].hourly[0].uvIndex) : undefined,
          advice: advice || "Clima consultado.",
          hourly: hourlyData.length > 0 ? hourlyData : undefined,
          daily: dailyData.length > 0 ? dailyData : undefined,
          sources: [sourceFromUrl("wttr.in", "https://wttr.in/", "Datos de clima en tiempo real.")],
        } as WeatherData;
      }
    }
  } catch {
    // wttr.in falló, intentar open-meteo
  }

  // Fallback: open-meteo
  const location = await geocodeCity(requestedCity);
  if (!location) {
    return {
      type: "weather",
      city: requestedCity,
      advice: "No pude ubicar esa ciudad. No invento clima.",
      sources: [],
    };
  }
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("timezone", "auto");
    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 10_000);
    const data = await response.json().catch(() => ({})) as {
      current?: { temperature_2m?: number; wind_speed_10m?: number };
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
    };
    const temp = data.current?.temperature_2m;
    const max = data.daily?.temperature_2m_max?.[0];
    const min = data.daily?.temperature_2m_min?.[0];
    const rain = data.daily?.precipitation_probability_max?.[0];
    const wind = data.current?.wind_speed_10m;
    if (temp !== undefined) {
      const advice = [
        `${Math.round(temp)} C ahora`,
        rain !== undefined && rain >= 50 ? "conviene paraguas" : rain !== undefined ? "lluvia poco probable" : undefined,
        min !== undefined && min <= 10 ? "lleva abrigo si sales tarde" : undefined,
      ].filter(Boolean).join("; ");
      return {
        type: "weather",
        city: location.name,
        now: `${Math.round(temp)} C`,
        range: min !== undefined && max !== undefined ? `${Math.round(min)}-${Math.round(max)} C` : undefined,
        rain: rain !== undefined ? `${rain}%` : undefined,
        wind: wind !== undefined ? `${Math.round(wind)} km/h` : undefined,
        advice: advice || "Clima consultado.",
        sources: [sourceFromUrl("Open-Meteo", "https://open-meteo.com/", "Datos abiertos de clima.")],
      };
    }
  } catch {
    // open-meteo también falló
  }

  // Si ambas fuentes fallan, devolver sin datos (el fallback universal lo maneja)
  return {
    type: "weather",
    city: requestedCity,
    advice: "No pude obtener el clima en este momento.",
    sources: [],
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

/**
 * 🔴 FIX P2.2 — Extrae la imagen principal de una página HTML.
 * Reutiliza la misma lógica que builtins.ts pero en este archivo.
 */
function extractMainImage(html: string, pageUrl: string): string | undefined {
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveImageUrl(ogMatch[1], pageUrl);

  const twMatch = html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);
  if (twMatch?.[1]) return resolveImageUrl(twMatch[1], pageUrl);

  const linkMatch = html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
  if (linkMatch?.[1]) return resolveImageUrl(linkMatch[1], pageUrl);

  const contentBlock = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] ?? html;
  const imgMatches = contentBlock.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi);
  for (const m of imgMatches) {
    const src = m[1];
    if (isValidContentImage(src)) {
      return resolveImageUrl(src, pageUrl);
    }
  }
  return undefined;
}

function isValidContentImage(src: string): boolean {
  if (!src) return false;
  const lower = src.toLowerCase();
  if (lower.startsWith("data:")) return false;
  if (/\b(logo|icon|avatar|sprite|placeholder|blank|spacer|pixel|favicon|tracking|beacon|1x1)\b/i.test(lower)) return false;
  if (lower.endsWith(".svg") || lower.endsWith(".gif")) return false;
  if (/(google-analytics|doubleclick|facebook\.com\/tr|pixel\.)/i.test(lower)) return false;
  if (/[?&](w|h|width|height)=(\d{1,2})\b/i.test(lower)) {
    const sizeMatch = lower.match(/[?&](w|h|width|height)=(\d{1,2})\b/i);
    if (sizeMatch && parseInt(sizeMatch[2]) < 100) return false;
  }
  return true;
}

function resolveImageUrl(src: string, baseUrl: string): string {
  try {
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith("//")) {
      const proto = baseUrl.match(/^(https?)/i)?.[1] ?? "https";
      return `${proto}:${src}`;
    }
    if (src.startsWith("/")) {
      const origin = baseUrl.match(/^(https?:\/\/[^/]+)/i)?.[1];
      if (origin) return `${origin}${src}`;
    }
    const base = baseUrl.replace(/[^/]*$/, "");
    return `${base}${src}`;
  } catch {
    return src;
  }
}

async function fetchPageContent(url: string, maxChars = 1200): Promise<{ text: string; imageUrl?: string }> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 15_000);
    const html = await res.text();

    // 🔴 FIX P2.2: extraer imagen principal
    const imageUrl = extractMainImage(html, url);

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
    return { text: text.slice(0, maxChars), imageUrl };
  } catch {
    return { text: "" };
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
  // 🔴 FIX P2.2: ahora también extrae la imagen principal de cada página
  for (let i = 0; i < Math.min(sources.length, 3); i++) {
    const pageData = await fetchPageContent(sources[i].url, 1200);
    sources[i].content = pageData.text;
    if (pageData.imageUrl) {
      sources[i].imageUrl = pageData.imageUrl;
    }
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
  const openCommitments = (Array.isArray(state.commitments) ? state.commitments : []).filter((item) => item && item.status === "open").slice(0, 5);
  const recentRecords = (Array.isArray(state.records) ? state.records : []).slice(0, 5);
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
  const topic = cleanText(args.topic, cleanText(args.domain, "general"));
  const query = cleanText(args.query, cleanText(args.__userInput));
  const period = cleanText(args.period);
  const records = (Array.isArray(state.records) ? state.records : []).filter((record) => isRecordInPeriod(record, period));

  // 🔴 KIMI v7 — Mapear domain del lexical route a topic interno
  const effectiveTopic = topic === "money" ? "expenses" : topic === "morning" ? "general" : topic === "memory" ? "general" : topic;

  // 🔴 KIMI v7 — Morning brief: devolver morning_brief block directamente
  if (topic === "morning") {
    const memories = (Array.isArray(state.memories) ? state.memories : []).slice(0, 5);
    const weather = state.weatherCache;
    const items: Array<{ icon: string; label: string; value: string; iconColor: string }> = [];
    if (weather?.payload?.now) {
      items.push({ icon: "wb_sunny", label: "Clima", value: `${weather.payload.now}${weather.payload.condition ? ` · ${weather.payload.condition}` : ""}`, iconColor: "#f59e0b" });
    }
    if (memories.length) {
      items.push({ icon: "psychology", label: "Recuerdos", value: `${memories.length} activos`, iconColor: "#8363f9" });
    }
    items.push({ icon: "schedule", label: "Hoy", value: new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" }), iconColor: "#46c293" });
    return {
      type: "personal_query",
      block: {
        type: "morning_brief" as const,
        greeting: `Buenos días! Son las ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.`,
        items,
      },
    };
  }

  if (effectiveTopic === "expenses") {
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

  if (effectiveTopic === "food_inventory") {
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

  if (effectiveTopic === "shopping_list") {
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

  if (effectiveTopic === "pending_tasks") {
    const open = (Array.isArray(state.commitments) ? state.commitments : []).filter((item) => item && item.status === "open").slice(0, 8);
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

  if (effectiveTopic === "memory") {
    const useful = (Array.isArray(state.memories) ? state.memories : [])
      .filter((memory) => memory && memory.status !== "rejected" && memory.useForSuggestions !== false)
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

  if (effectiveTopic === "relationships") {
    const relationshipRecords = records.filter((record) => ["person_followup", "gift", "birthday"].includes(record.kind));
    const relationshipMemories = (Array.isArray(state.memories) ? state.memories : [])
      .filter((memory) => memory && memory.status !== "rejected" && memory.useForSuggestions !== false)
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

/**
 * Colección automática para enlaces guardados ("guardame este link") cuando el
 * LLM no propuso una. La promesa del producto: "Listo, guardado en Sitios de
 * IA" — el usuario nunca ordena carpetas a mano.
 */
export function inferLinkCollection(url: string, text: string): string {
  const hay = `${url} ${text}`.toLowerCase();
  if (/\b(ia|ai|gpt|llm|claude|openai|anthropic|gemini|copilot|chatbot|hugg?ingface|midjourney|stable ?diffusion|ollama|inteligencia artificial)\b/.test(hay)) return "Sitios de IA";
  if (/youtube\.com|youtu\.be|vimeo\.|twitch\.|\bvideos?\b/.test(hay)) return "Videos";
  if (/\breceta|cocina|gastronom/.test(hay)) return "Recetas";
  if (/github\.com|gitlab\.|stackoverflow|npmjs|\bdocs?\b|documentaci[oó]n|programaci[oó]n/.test(hay)) return "Herramientas Dev";
  if (/mercadolibre|amazon\.|aliexpress|tienda|comprar|\bprecio/.test(hay)) return "Compras";
  if (/noticia|diario|clar[ií]n|lanacion|infobae|bbc\.|cnn\.|elpais/.test(hay)) return "Noticias";
  if (/medium\.com|substack|\bblog\b|art[ií]culo|\bpaper\b|\bleer\b/.test(hay)) return "Lecturas";
  if (/spotify|m[uú]sica|soundcloud|banda|canci[oó]n/.test(hay)) return "Música";
  if (/viaje|hotel|vuelo|airbnb|booking/.test(hay)) return "Viajes";
  return "Enlaces";
}

export function personalCaptureFromArgs(args: Record<string, unknown>, input = ""): PersonalCaptureData {
  const cleanArgs = argsWithCaptureHygiene(args, input);
  const requestedType = cleanText(cleanArgs.uiBlockType, "saved_record");
  const uiBlockType = ["reminder", "alarm", "shopping_list", "saved_record", "money_summary", "birthday_calendar", "birthday_alarm", "social_interaction"].includes(requestedType)
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
  const url = cleanText(cleanArgs.url) || (input.match(/https?:\/\/[^\s"'<>)]+/i)?.[0] ?? "");
  // Colección: la que pidió el usuario/LLM, o inferida para enlaces. Nunca
  // queda un link "suelto": siempre pertenece a una colección navegable.
  const collection = cleanText(cleanArgs.collection) || (url ? inferLinkCollection(url, `${title} ${input}`) : "");
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

  if (effectiveUiBlockType === "birthday_calendar") {
    const personName = cleanText(cleanArgs.person) || title;
    return {
      type: "personal_capture",
      block: {
        type: "birthday_calendar",
        month: dueText || "Junio 2025",
        highlightedDay: typeof cleanArgs.highlightedDay === "number" ? cleanArgs.highlightedDay : 12,
        startDay: typeof cleanArgs.startDay === "number" ? cleanArgs.startDay : 6,
        daysInMonth: typeof cleanArgs.daysInMonth === "number" ? cleanArgs.daysInMonth : 13,
      },
      records: [{ ...baseRecord, title: `Cumpleaños de ${personName}`, kind: "birthday" }],
      memoryCandidates,
    };
  }

  if (effectiveUiBlockType === "birthday_alarm") {
    const personName = cleanText(cleanArgs.person) || title;
    return {
      type: "personal_capture",
      block: {
        type: "birthday_alarm",
        name: `Cumpleaños ${personName}`,
        date: dueText || "12 jul",
        countdown: cleanText(cleanArgs.countdown, "08"),
        unit: cleanText(cleanArgs.unit, "días"),
        eta: time || "En 30m",
      },
      records: [{ ...baseRecord, title: `Cumpleaños de ${personName}`, kind: "birthday" }],
      memoryCandidates,
    };
  }

  if (effectiveUiBlockType === "social_interaction") {
    const personName = cleanText(cleanArgs.person) || title;
    const gifts = asArray(cleanArgs.gifts)
      .map((gift) => cleanText(gift))
      .filter(Boolean)
      .map((gift) => ({ emoji: "gift", title: gift, detail: "Idea guardada" }));
    return {
      type: "personal_capture",
      block: {
        type: "social_interaction",
        name: personName,
        event: cleanText(cleanArgs.event, "Cumpleaños"),
        date: dueText || "12 jul",
        remaining: cleanText(cleanArgs.remaining, "Faltan 8 días"),
        gifts: gifts.length ? gifts : [{ emoji: "gift", title: "Regalo pendiente", detail: cleanText(cleanArgs.event, "Cumpleaños") }],
      },
      records: [{ ...baseRecord, title: `Evento social: ${personName}`, kind: "person_followup" }],
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
    // El título del bloque ES la colección: la card confirma "Guardado en X"
    // y su CTA abre la colección completa.
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
/**
 * Ciudad del usuario desde sus memorias de perfil. Acepta los formatos que
 * genera el extractor ("User location: X (city)", "Vivo en X", "ubicación: X").
 * Devuelve null si Koru todavía no la conoce (→ preguntar una vez).
 */
export function profileCityFromState(state: KoruState): string | null {
  const candidates = (state.memories ?? [])
    .filter((m) => m.kind === "profile" && m.status !== "rejected")
    .map((m) => m.text);
  for (const text of candidates) {
    const match =
      text.match(/(?:user location|ubicaci[oó]n|location)\s*[:=]\s*([^(,\n]{2,40})/i) ??
      text.match(/\bviv[eo]\s+en\s+([A-ZÁÉÍÓÚÑ][^.,\n]{1,40})/i) ??
      text.match(/\bciudad\s*[:=]?\s+([A-ZÁÉÍÓÚÑ][^.,\n]{1,40})/i);
    if (match?.[1]) return match[1].trim();
  }
  return null;
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
  try {
    if (name === "weather") {
      // Resolver ciudad desde el perfil si el mensaje no la trae: la ciudad se
      // pregunta UNA vez en la vida, después Koru la sabe.
      const argsWithCity = cleanText(args.city) ? args : { ...args, city: profileCityFromState(state) ?? "" };
      result = await getWeather(argsWithCity) as unknown as Record<string, unknown>;
    }
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
        return { result: { type: "unknown", status: "failed", error: `Unknown tool ${name}` } };
      }
    }
  } catch (err: any) {
    // 🔴 FIX: si la tool crashea (HTTP error, timeout, etc), devolver status "no_data"
    // en lugar de dejar que el error se propague y cause "server-error" / "modelo no respondió".
    // El backend hará fallback a web_search automáticamente.
    logger.warn("executeTool", `Tool ${name} threw error`, { error: err?.message });
    result = { type: name, status: "no_data", error: err?.message ?? "Tool failed" };
  }
  logger.info("executeTool", `Tool ${name} result`, { result: dump(result, 500) });
  return { result, deferredDataCard };
}

function stateSummary(state: KoruState): string {
  // Defensive: el frontend a veces envia state sin memories/commitments/records
  // (cuando IndexedDB aun no hydrateó o el state viene de localStorage legacy).
  // Sin estos guards, .filter() crash con "Cannot read properties of undefined"
  // y el catch lo convierte en 502.
  const memories = Array.isArray(state.memories) ? state.memories : [];
  const commitmentsArr = Array.isArray(state.commitments) ? state.commitments : [];
  const recordsArr = Array.isArray(state.records) ? state.records : [];

  const confirmedMemories = memories
    .filter((item) => item && item.status === "confirmed" && item.useForSuggestions !== false)
    .slice(0, 12)
    .map((item) => `- ${item.kind}: ${String(item.text ?? "").replace(/[\n\r`]+/g, " ").trim()}`)
    .join("\n") || "- none";
  const candidateMemories = memories
    .filter((item) => item && item.status === "candidate" && item.useForSuggestions !== false)
    .slice(0, 8)
    .map((item) => `- ${item.kind}: ${String(item.text ?? "").replace(/[\n\r`]+/g, " ").trim()}`)
    .join("\n") || "- none";
  const commitments = commitmentsArr
    .filter((item) => item && item.status === "open")
    .slice(0, 12)
    .map((item) => `- ${String(item.title ?? "").replace(/[\n\r`]+/g, " ").trim()} (${(item.dueHint || "sin fecha").replace(/[\n\r`]+/g, " ").trim()})`)
    .join("\n") || "- none";
  const recordTitles = recordsArr
    .slice(-8)
    .map((item) => `- ${String(item.title ?? "").replace(/[\n\r`]+/g, " ").trim()}${item.value ? ` (${String(item.value).replace(/[\n\r`]+/g, " ").trim()})` : ""} ${item.notes ? `— ${String(item.notes).replace(/[\n\r`]+/g, " ").trim()}` : ""} [${item.kind}]`)
    .join("\n") || "- nada guardado todavía";
  const recordKinds = Array.from(new Set(recordsArr.map((item) => item.kind))).slice(0, 12).join(", ") || "none";
  const collectionCount = new Set(recordsArr.map((item) => item.collection).filter(Boolean)).size;
  return [
    `User name: ${state.userName ?? "unknown"}`,
    "Confirmed memories:",
    confirmedMemories,
    "Candidate memories awaiting user confirmation; use cautiously for continuity, do not present as certain:",
    candidateMemories,
    "Open commitments:",
    commitments,
    `Saved record count: ${(Array.isArray(state.records) ? state.records : []).length}`,
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
  // 🔴 i18n — language instruction injected at the very top so the LLM honors it
  const userLang = state.language === "en" ? "en" : "es";
  const languageInstruction = userLang === "en"
    ? `LANGUAGE: Reply to the user in English. The user prefers English. Use natural, warm, friendly English (American). You may still understand Spanish input — just reply in English.`
    : `LANGUAGE: Respondé al usuario en español (rioplatense, voseo natural).`;

  return [
    `Sos Koru. Sos el asistente personal de ${state.userName?.trim() || "mi amigo"}. No sos un chatbot genérico. Sos alguien que lo conoce y se preocupa por ayudarle.`,
    ``,
    languageInstruction,
    ``,
    `Tu personalidad: ${warmthLabel}, ${humorLabel}, directo pero sin ser frío. Proactividad ${prefs.proactivity}/10.`,
    `Sos curioso, honesto, discreto. Te gusta descubrir cosas nuevas de ${state.userName?.trim() || "mi amigo"} y recordarlas.`,
    ``,
    `Reglas de voz:`,
    `- PRINCIPIO #1 — UTILIDAD POR ENCIMA DE TODO: cada respuesta debe entregar valor concreto, no ruido.`,
    `- NO sobre-valides: no termines mensajes con preguntas obvias tipo "¿querés que armemos algo?" o "¿alguna otra cosa?". Si el usuario necesita más, va a pedirlo.`,
    `- NO exageres: no celebres con exceso ("¡qué maravilloso!", "¡increíble!"). Reaccioná como un amigo real, no como un animador de TV.`,
    `- NO agregues "+1" forzado: solo sugerí un siguiente paso si es genuinamente útil y se conecta con lo que el usuario acaba de pedir. Si no hay nada útil, no agregues nada.`,
    `- NO repitas la pregunta del usuario en tu respuesta. Si preguntó el clima, dale el clima, no le digas "mirá lo que encontré sobre el clima".`,
    `- Respondé como alguien que conoce al usuario, no como asistente genérico.`,
    `- 🔴 CRÍTICO — MEMORIA PROACTIVA: Mirá las memorias de ${state.userName?.trim() || "mi amigo"} ANTES de responder. Si hay una memoria relevante para lo que el usuario pide, USALA ACTIVAMENTE en tu respuesta. Ejemplos:
      - Si el usuario dijo "me encanta el helado" y ahora dice "que calor" → sugerí ir por un helado que tanto le gusta.
      - Si el usuario dijo "estoy aprendiendo guitarra" y ahora dice "que hago este finde" → sugerí practicar guitarra.
      - Si el usuario dijo "tengo un gato" y ahora pide ideas de regalos → mencioná algo para su gato.
      - Si el usuario dijo "soy celiaco" y ahora pide una receta → asegurá que sea sin gluten.
      NO esperes a que el usuario te preguntes directamente sobre sus memorias. Si son relevantes, incorporalas naturalmente en tu respuesta. Esto es lo que hace a Koru diferente: TE CONOCE y lo demuestra.`,
    `- Si el usuario está mal, mostrá empatía real, no frases de tarjeta.`,
    `- El texto puede ser de 1 línea si es simple, o un párrafo corto si es emocional. No te cortés.`,
    `- Las cards (uiBlocks) son para los datos; el texto es para conectar con ${state.userName?.trim() || "mi amigo"}.`,
    `- Cuando guardás algo, confirmá brevemente qué guardaste y dónde. Una frase, no dos.`,
    `- Nunca inventes datos que no tengas. Si ejecutaste web_search, usá los snippets y contenidos proporcionados para dar un resumen honesto de lo que dicen las fuentes. No inventes detalles, pero SÍ contá lo que encontraste. Si no sabés, decilo con naturalidad.`,
    `- CRÍTICO: Si una tool externa (clima, búsqueda, ruta, precios) devuelve status "failed" o "not_configured", NO inventés los datos. Decile al usuario honestamente que no pudiste obtener esa información.`,
    `- 🔴 CRÍTICO ANTI-ALUCINACIÓN DEPORTIVA: Si match_live devuelve status "no_data" o matches vacío, NO INVENTES RESULTADOS. NO digas "le ganaron 3-1 a Suiza" si la tool no devolvió ese partido. Decí honestamente: "No encontré partidos recientes de [equipo]. La temporada puede estar en receso." Es PEOR inventar un resultado falso que admitir que no hay datos.`,
    `- 🔴 CRÍTICO ANTI-ALUCINACIÓN GENERAL: Si una tool devuelve status "no_data", "failed", o arrays vacíos (matches:[], recipes:[], sources:[]), NO inventes datos para llenar el vacío. Decí "no encontré" y pedí más contexto si hace falta. Un usuario que recibe "no encontré" puede refinar su pregunta; un usuario que recibe datos inventados pierde la confianza para siempre.`,
    `- CRÍTICO: Si el usuario responde con una ciudad o ubicación directamente después de que preguntaste por clima o tráfico, interpretalo como su ubicación. Ejecutá la tool correspondiente con esa ciudad y guardá esa ciudad como memory de perfil.`,
    `- CRÍTICO: Si el usuario te dice una ciudad, país o barrio y no lo tenés guardado como memoria, incluilo en memoryCandidates como kind: profile.`,
    `- CRÍTICO: Si el usuario pregunta algo que YA aparece en "Cosas que guardaste" o "Memorias relevantes", NO uses query_personal_context. Respondé directamente desde ese contexto.`,
    `- CRÍTICO: Cuando guardás algo (save_personal_item) y el resultado tiene colección, tu reply empieza EXACTAMENTE con: "Listo, guardado en {colección}." y podés agregar UNA frase corta después. El usuario debe saber SIEMPRE dónde quedó lo suyo.`,
    `- CRÍTICO: Cuando ejecutaste web_search, los datos concretos (resultados, precios, scores, cifras) ya vienen extraídos y validados en los tool results y se muestran al usuario en una tarjeta aparte. Tu texto SOLO debe ENMARCAR esos datos de forma cercana ("mirá lo que encontré", "esto es lo que dicen las fuentes"), NO repetirlos ni inventar valores que no estén en los resultados de la tool. Si un dato no está en los tool results, no lo afirmes.`,
    `- 🔴 CRÍTICO — CONTINUIDAD DE CONVERSACIÓN (Bug "y ayer?"): Cuando el usuario hace una pregunta de seguimiento corta como "y ayer?", "y mañana?", "y el otro?", "y el sábado?", "cómo le fue ayer?", debés MANTENER EL CONTEXTO de la conversación reciente. Si en los últimos mensajes se habló de un equipo/partido (ej: Argentina, Boca, España), el seguimiento se refiere a ESE MISMO equipo. Ejecutá match_live con query "<equipo> ayer" o "<equipo> <fecha>" sin pedir aclaración. NO respondas "no entiendo" ni "¿a qué te referís?". El contexto SIEMPRE está en el historial.`,
    `- 🔴 CRÍTICO — PRONOMBRES Y REFERENCIAS: Si el usuario dice "esa película", "ese libro", "esa receta", "ese equipo", "esos resultados", asumí que se refiere al último tema mencionado en la conversación. NO pidas aclaración. Si el tema fue "obsesión", "y esa película?" significa "información sobre la película obsesión". Mantener contexto es tu trabajo principal.`,
    `- 🔴 CRÍTICO — FOLLOW-UPS TEMPORALES: combiná el contexto del tema (equipo, película, etc.) con el contexto temporal (ayer, hoy, mañana, la semana pasada). "y ayer?" después de hablar de Argentina = match_live(query="Argentina ayer"). "y la anterior?" después de una película = movie_info(title="<película anterior>").`,
    ``,
    `Memorias relevantes para esta conversación (usalas para personalizar tu respuesta):`,
    ...(relevantMemories.length
      ? relevantMemories.map(m => `- [${m.kind}] ${m.text.replace(/[\n\r`]+/g, " ").trim()}`)
      : ["- No hay memorias relevantes aún."]),
    ``,
    `Pendientes abiertos actuales del usuario:`,
    ...((Array.isArray(state.commitments) ? state.commitments : []).filter(c => c && c.status === "open").slice(0, 5).map(c => `- ${String(c.title ?? "").replace(/[\n\r`]+/g, " ").trim()} (${(c.dueHint || "sin fecha").replace(/[\n\r`]+/g, " ").trim()})`) || ["- Ninguno"]),
    ``,
    `Cosas que guardaste (últimas 8):`,
    ...((Array.isArray(state.records) ? state.records : []).slice(-8).map(r => `- ${String(r.title ?? "").replace(/[\n\r`]+/g, " ").trim()}${r.value ? ` (${String(r.value).replace(/[\n\r`]+/g, " ").trim()})` : ""}${r.notes ? ` — ${String(r.notes).replace(/[\n\r`]+/g, " ").trim()}` : ""} [${r.kind}]`) || ["- Nada guardado aún"]),
    ``,
    `Instrucciones técnicas:`,
    `Ejemplos de cuándo usar cada herramienta (la forma de preguntar no importa; lo que importa es la intención):`,
    `  - weather: "¿Qué me pongo?" / "¿Hace frío?" / "¿Llevo paraguas?" / "¿Cómo está afuera?" / "¿Qué tal el día?" / "¿Necesito campera?"`,
    `  - match_live: RESULTADOS DE FÚTBOL. "¿Cómo salió España ayer?" / "¿Cómo le fue a Boca?" / "¿Va ganando el Madrid?" / "Resultado de Argentina" / "Quién ganó el partido". INCLUYE selecciones nacionales (España, Argentina, Francia, Brasil, etc). NUNCA uses web_search para esto — match_live tiene datos exactos desde ESPN en tiempo real.`,
    `  - match_schedule: PRÓXIMOS partidos. "Cuándo juega Boca" / "A qué hora juega Real Madrid" / "Fixture de la champions".`,
    `  - web_search: Noticias generales (NO deportivas). "¿Qué pasó en Argentina?" / "¿Últimas noticias de tecnología?" / "¿Qué hay del clima político?". NUNCA para resultados de partidos — para eso está match_live.`,
    `  - shopping_compare: "¿Qué auriculares compro?" / "Necesito una batería externa" / "¿Dónde compro X más barato?" / "¿Cuál es mejor, A o B?"`,
    `  - restaurant_deep_search: "Dónde cenar en Madrid" / "Qué restaurante me recomendás" / "Dónde como sushi" / "Necesito una parrilla" / "Qué tal comer en Palermo"`,
    `  - recipe_find: "Receta de X" / "Cómo hago X" / "Algo con Y" / "Postre sin horno" / "¿Qué cocino con...?". Devuelve ingredientes estructurados, pasos, imagen y video. NUNCA des una receta de memoria — usá la tool para traer recetas reales con foto.`,
    `  - movie_info: "¿Qué se dice de la película X?" / "Reseña de X" / "Información sobre la película X" / "Quién actúa en X". Devuelve sinopsis, reparto, rating, géneros. NUNCA uses web_search para una película específica — movie_info trae datos estructurados.`,
    `  - book_info: "Info del libro X" / "Quién escribió X" / "De qué trata X". Devuelve cover, autor, año, sinopsis.`,
    `  - wikipedia_lookup: "¿Qué es X?" / "Contame sobre X" / "Quién fue X". Para temas enciclopédicos puntuales.`,
    `  - plan_day: "¿Cómo organizo hoy?" / "Tengo muchas cosas" / "¿Qué hago primero?" / "¿Me ayudas a planificar?"`,
    `  - query_personal_context: "¿Cuánto gasté?" / "¿Qué tenía para comer?" / "¿Recordás que me dijiste?" / Cualquier cosa que Koru ya haya guardado del usuario.`,
    `  - save_memory: Cuando el usuario revela algo importante sobre sí mismo (rutinas, metas, preferencias, relaciones).`,
    `  - save_personal_item: Cuando el usuario pide guardar algo (gasto, recordatorio, lista de compras, alarma).`,
    `REGLA CRÍTICA DE ROUTING: si el usuario pregunta por un resultado o partido de fútbol (cualquier equipo o selección), USÁ match_live, NO web_search. web_search devuelve noticias genéricas sin el marcador exacto; match_live te da el score real en tiempo real.`,
    `Usá tools SOLO cuando la intención del usuario REQUIERA datos reales del mundo (clima, búsqueda, ruta, precios, resultados deportivos, recetas, películas, libros). Por ejemplo: si el usuario dice 'hola', 'gracias', 'adiós', '¿cómo estás?' o cualquier frase de cortesía, NO uses tools. Respondé directamente con naturalidad.`,
    `- Para datos personales ya guardados, no llames tools; respondé directamente usando el contexto.`,
    `- 🔴 CRÍTICO — PROHIBIDO RAZONAMIENTO EN "reply": NUNCA incluyas tu razonamiento interno, análisis de qué tool llamar, ni texto en inglés tipo "The user is asking...", "I should use...", "Let me think..." en "reply". El campo "reply" debe contener SOLO la respuesta final al usuario, en español, cálido y directo. Si necesitás decidir una tool, EMITE tool_calls directamente en el JSON sin escribir tu razonamiento en el texto. Si estás pensando, NO escribas "thinking..." — simplemente devolvé el JSON final con la respuesta.`,
    `- 🔴 CRÍTICO — DIVISIÓN DE TRABAJO TEXTO ↔ CARD: Cuando ejecutaste CUALQUIER tool que devuelve datos (weather, match_live, movie_info, recipe_find, book_info, crypto_price, web_search, wikipedia_lookup, etc.), los datos concretos (títulos, ratings, reparto, ingredientes, pasos, scores, precios, sinopsis) ya están estructurados y se muestran en la card. Tu reply SOLO debe ENMARCAR: 1-2 líneas cálidas que conecten con el usuario y eventualmente destaquen UN dato insignia. NUNCA repitas la lista de datos que ya está en la card.`,
    `- 🔴 CRÍTICO — USÁ LAS TOOLS: Si el usuario pide "generá una imagen", "dibujá", "creá una imagen" → USÁ la tool image_generate. NO respondas "no puedo generar imágenes". La tool SÍ puede.`,
    `- 🔴 CRÍTICO — Si el usuario pide "armá un entrenamiento", "rutina de ejercicio", "plan de gym" → USÁ save_personal_item con uiBlockType="exercise_plan" para crear una card con el plan.`,
    `- 🔴 CRÍTICO — Si el usuario pide "seguí mi pedido", "rastrear envío" → USÁ save_personal_item con uiBlockType="delivery" para crear una card de seguimiento.`,
    `- Ejemplos de reply CORRECTO (corto, enmarca, NO repite datos de la card):`,
    `  ✅ "Mirá, la encontré. Te la dejo en la tarjeta con todo el detalle."`,
    `  ✅ "Te dejé la receta en la tarjeta. Mirá el video al final, vale la pena."`,
    `  ✅ "España le ganó 2-1. Te dejé las estadísticas en la tarjeta."`,
    `- Ejemplos de reply INCORRECTO (largo, repite datos que ya están en la card):`,
    `  ❌ "Inception (2010). Director: Christopher Nolan. Reparto: Leonardo DiCaprio... Duración: 148 min. Rating: 8.8/10. Sinopsis: Dom Cobb..." (esto ya está en la card)`,
    `- Agregá mascotState al JSON final Elijí SOLO de esta lista exacta: "celebrating", "worried", "affectionate", "curious", "happy", "thinking", "working", "tired", "sleeping", "mistake", "planning", "product-search", "building", "cooking", "thinking-2". Si nada aplica, usá "idle".`,
    `- Formato de respuesta final (contrato MÍNIMO y OBLIGATORIO): {"reply":"...","mascotState":"..."}`,
    `  - reply: tu respuesta conversacional directa al usuario, respondiendo EXACTAMENTE a su último mensaje. Sin JSON anidado, sin código, sin listas técnicas. Texto natural y cálido.`,
    `  - mascotState: elegí de la lista exacta de arriba.`,
    `  - NO agregues uiBlocks ni ningún otro campo: las tarjetas visuales las arma el backend a partir de los resultados de las tools. Tu único trabajo es el texto.`,
    `  - NUNCA inventes llamadas a funciones/tools dentro del texto ni campos tipo {"type":"function"}. Si no tenés una tool disponible para algo, respondé con honestidad en "reply".`,
    ``,
    `Ejemplos de respuestas EXCELSAS (few-shot):`,
    `Usuario: "hola" → {"reply":"Hola. ¿Cómo va todo?","mascotState":"happy"}`,
    `Usuario: "anota 1500 de cafe" → {"reply":"Listo, guardado en gastos.","mascotState":"idle"}`,
    `Usuario: "que clima hace en Madrid?" → {"reply":"Mirá, te dejé el clima de Madrid en la tarjeta. Día para salir liviano.","mascotState":"thinking"}`,
    `Usuario: "gracias" → {"reply":"De nada, cuando quieras.","mascotState":"happy"}`,
    `Usuario: "estoy cansado" → {"reply":"Te entiendo. Si queres, bajo el ritmo y ordenamos lo minimo indispensable para hoy.","mascotState":"worried"}`,
    `Usuario: "como salio España ayer" → TOOL: match_live(query="España ayer"). Reply: "España le ganó 2-1. Te dejé el detalle en la tarjeta."`,
    `Usuario: "como le fue a Boca" → TOOL: match_live(query="Boca"). Reply con el score exacto que devuelva la tool.`,
    ``,
    `Notá: las respuestas son CORTAS, DIRECTAS y UTILES. No exageran, no sobre-validan, no terminan con preguntas obvias.`,
    ``,
    `=== CONTEXTO TEMPORAL (CRÍTICO — siempre lo sabés) ===`,
    ...formatTemporalContext(nowIso),
    ``,
    `Reglas temporales CRÍTICAS:`,
    `- "Hoy" = ${formatDateLong(nowIso)}. "Ayer" = ${formatDateLong(new Date(Date.now() - 86400000).toISOString())}. "Mañana" = ${formatDateLong(new Date(Date.now() + 86400000).toISOString())}.`,
    `- Cuando el usuario dice "hoy", "ayer", "mañana", "esta semana", "este fin de semana", ya sabés a qué fecha se refiere — NO preguntes "¿qué día?" ni "¿cuándo?". Calculá la fecha concreta.`,
    `- Si el usuario pregunta "como salió X ayer", asumí que se refiere al partido/ evento de ${formatDateLong(new Date(Date.now() - 86400000).toISOString())}.`,
    `- Si pregunta "qué hago hoy", sabés exactamente qué día es y qué día de la semana.`,
    `- NUNCA digas "no sé qué día es hoy" ni "no tengo acceso a la fecha". Siempre la sabés.`,
  ].join("\n");
}

/**
 * Formatea fecha ISO en formato largo legible en español.
 * Ej: "lunes 13 de julio de 2026"
 */
function formatDateLong(iso: string): string {
  const d = new Date(iso);
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Formatea la hora en formato 24hs legible.
 * Ej: "14:35"
 */
function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Genera el contexto temporal completo para el system prompt.
 * Incluye fecha, día de la semana, hora, zona horaria, y referencias relativas
 * (hace cuánto amaneció, cuánto falta para medianoche, etc.) para que el LLM
 * tenga orientación temporal completa.
 */
function formatTemporalContext(nowIso: string): string[] {
  const now = new Date(nowIso);
  const fecha = formatDateLong(nowIso);
  const hora = formatTimeShort(nowIso);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const diaSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][now.getDay()];
  const horaNum = now.getHours();

  // Determinar momento del día
  let momentoDelDia: string;
  if (horaNum < 6) momentoDelDia = "madrugada";
  else if (horaNum < 12) momentoDelDia = "mañana";
  else if (horaNum < 14) momentoDelDia = "mediodía";
  else if (horaNum < 19) momentoDelDia = "tarde";
  else if (horaNum < 22) momentoDelDia = "noche";
  else momentoDelDia = "noche tardía";

  //AYER, HOY, MAÑANA en formato largo
  const ayer = formatDateLong(new Date(now.getTime() - 86400000).toISOString());
  const manana = formatDateLong(new Date(now.getTime() + 86400000).toISOString());

  return [
    `- Fecha completa: ${fecha}`,
    `- Día de la semana: ${diaSemana}`,
    `- Hora actual: ${hora} (formato 24hs)`,
    `- Zona horaria: ${tz}`,
    `- Momento del día: ${momentoDelDia}`,
    `- Ayer fue: ${ayer}`,
    `- Mañana será: ${manana}`,
    `- ISO timestamp: ${nowIso}`,
  ];
}

function isTrivialInput(input: string): boolean {
  const trimmed = input.trim().toLowerCase().replace(/[^a-záéíóúñ\s]/g, "");
  if (trimmed.length === 0) return true;
  if (trimmed.length < 3) return true;
  const trivial = [
    "hola", "buenas", "buenas tardes", "buenas noches",
    "hey", "hi", "hello", "que tal", "como estas", "como va", "todo bien", "que onda",
    "che", "epa", "alo", "aló", "buen", "epa",
    "adios", "adiós", "chau", "nos vemos", "hasta luego", "hasta pronto", "bye",
    "gracias", "muchas gracias", "mil gracias", "genial gracias", "ok gracias", "perfecto gracias",
    "ok", "vale", "si", "sí", "no", "bien", "todo bien", "genial", "perfecto", "listo",
  ];
  // 🔴 FIX: si el input revela información personal, NO es trivial.
  const hasPersonalReveal = /\b(me encanta|me gusta|me encantan|me gustan|amo|odio|prefiero|soy de|estoy trabajando|estoy aprendiendo|estoy leyendo|estoy escuchando|estoy viendo|estoy estudiando|estoy haciendo|estoy armando|estoy programando|estoy escribiendo|estoy cocinando|tengo que|mi madre|mi padre|mi mama|mi papa|mi hermano|mi hermana|mi hijo|mi hija|mi novio|mi novia|mi mujer|mi marido|mi esposa|mi esposo|mi amigo|mi amiga|juego al|juego a|practico|todos los dias|todas las semanas|cada semana|en una semana|en dos semanas|la semana que viene|el mes que viene|mañana cumplo|cumple años|mi cumple|aniversario)\b/i.test(input);
  if (hasPersonalReveal) return false;
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
  // 🔴 ARQUITECTURA NUEVA: el extractor recibe las memorias EXISTENTES del usuario
  // para poder detectar contradicciones, actualizaciones y duplicados.
  // El LLM decide qué AGREGAR, qué ARCHIVAR y qué ACTUALIZAR — sin regex, sin frases rígidas.
  const existingMemories = (request.state.memories ?? [])
    .filter(m => m.status === "confirmed" || m.status === "candidate")
    .slice(0, 20)
    .map(m => ({ id: m.id, kind: m.kind, text: m.text, status: m.status }));

  return [
    {
      role: "system",
      content: [
        "Sos el extractor de memoria de Koru. Devolvé SOLO JSON válido, sin markdown.",
        'Schema: {"memoryCandidates":[],"archiveMemoryIds":[],"behaviorNotes":[]}',
        "",
        "Tu trabajo: analizar lo que el usuario dijo y compararlo con sus memorias existentes.",
        "",
        "REGLAS PARA AGREGAR (memoryCandidates):",
        "- Extraé SOLO información duradera y reutilizable sobre el usuario.",
        "- Preferencias, identidad, rutinas, objetivos, relaciones, salud, fechas importantes, intereses.",
        "- NO extraigas chit-chat genérico, saludos, o información temporal.",
        "- Si el usuario revela algo personal (gustos, hábitos, metas, relaciones), extraelo SIEMPRE.",
        "- NO necesitas que el usuario diga 'guardá esto' — si lo cuenta, es porque quiere que lo sepas.",
        "- Redactá la memoria en tercera persona: 'Le encanta el sushi', 'Trabaja de programador', 'Vive en Madrid'.",
        "- kind puede ser: preference, routine, goal, profile, relationship, wellbeing, boundary, retail, task",
        "",
        "REGLAS PARA ARCHIVAR (archiveMemoryIds):",
        "- Si el usuario dice algo que CONTRADICE una memoria existente, incluí el ID de esa memoria en archiveMemoryIds.",
        "- Ejemplos: 'ya no juego al tenis' → archivar memoria sobre tenis.",
        "- 'me mude a Barcelona' → archivar memoria 'Vive en Madrid'.",
        "- 'termine la carrera' → archivar memoria 'Estudia medicina'.",
        "- 'deje el trabajo' → archivar memoria 'Trabaja de programador'.",
        "- 'ya no me gusta' → archivar memoria de preferencia anterior.",
        "- Si una nueva memoria reemplaza una vieja (mismo tema, info diferente), archivá la vieja.",
        "",
        "REGLAS PARA NO DUPLICAR:",
        "- Si ya existe una memoria con la misma información, NO la agregues de nuevo.",
        "- Compará por SIGNIFICADO, no por texto exacto. 'Le gusta el helado' = 'Le encanta el helado'.",
        "",
        "Ejemplos de respuestas:",
        '- Usuario dice "me encanta el sushi" (sin memorias previas): {"memoryCandidates":[{"kind":"preference","text":"Le encanta el sushi.","confidence":0.88}],"archiveMemoryIds":[],"behaviorNotes":[]}',
        '- Usuario dice "me mude a barcelona" (tiene "Vive en Madrid"): {"memoryCandidates":[{"kind":"profile","text":"Vive en Barcelona.","confidence":0.85}],"archiveMemoryIds":["mem_abc123"],"behaviorNotes":[]}',
        '- Usuario dice "que calor" (no revela nada personal): {"memoryCandidates":[],"archiveMemoryIds":[],"behaviorNotes":[]}',
        '- Usuario dice "ya no juego al tenis" (tiene "Juega al tenis"): {"memoryCandidates":[],"archiveMemoryIds":["mem_xyz789"],"behaviorNotes":[]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Memorias existentes del usuario:",
        existingMemories.length > 0
          ? JSON.stringify(existingMemories, null, 2)
          : "(sin memorias previas)",
        "",
        `Mensaje del usuario: "${request.input}"`,
        "",
        composedRaw
          ? `Respuesta de Koru: "${cleanText(composedRaw.reply)}"`
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
): Promise<{ raw: Record<string, unknown>; provider: "nvidia" | "openrouter" | "minimax" | "bluesminds"; model?: string; fallbackReason?: string }> {
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
      if (weather.status === "need_city" || !cleanText(weather.city)) continue;
      blocks.push({
        type: "weather" as const,
        title: "Clima",
        city: weather.city,
        now: weather.now,
        condition: (weather as any).condition,
        range: weather.range,
        rain: weather.rain,
        wind: weather.wind,
        humidity: (weather as any).humidity,
        feel: (weather as any).feel,
        uv: (weather as any).uv,
        advice: weather.advice,
        hourly: (weather as any).hourly,
        daily: (weather as any).daily,
        sourceStatus: weather.sources.length ? "verified" as const : "failed" as const,
        sources: weather.sources,
      });
      continue;
    }
    if (result.type === "weather_forecast") {
      // Tool nueva (weather_forecast) que envuelve a `fetchWeather` (Open-Meteo).
      // Devuelve: { now, condition, conditionIcon, hourly, daily, verifiedAt, freshnessLabel, city }.
      const r = result as any;
      // Sin datos útiles no emitimos card: el composer se hace cargo en texto.
      if (r.status === "failed" || r.status === "no_data") continue;
      const city = cleanText(r.city);
      if (!cleanText(r.now) && !cleanText(r.condition)) continue;
      blocks.push({
        type: "weather" as const,
        title: "Clima",
        city,
        now: r.now,
        condition: r.condition,
        hourly: Array.isArray(r.hourly) ? r.hourly : undefined,
        daily: Array.isArray(r.daily) ? r.daily : undefined,
        verifiedAt: r.verifiedAt,
        freshnessLabel: r.freshnessLabel,
        sourceStatus: "verified" as const,
        sources: [],
      });
      continue;
    }
    if (result.type === "restaurant_deep_search") {
      const search = result as unknown as { query: string; matches?: Array<{ name: string; sourcesMentioning: number; quote?: string; menuHighlights?: Array<{ dish: string; price?: string }> }>; topScore?: string; pros?: string[]; cons?: string[]; synthesis?: string; sources?: AssistantSource[]; status?: string };
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
          symbol: r.symbol || "BTC",
          name: r.coin || "Bitcoin",
          price: `${r.price || "?"} ${r.currency || "USD"}`,
          change: r.change24hPct ?? 0,
          color: "#f59e0b",
          bg: "#fffbeb",
          char: r.symbol?.[0] || "₿",
        }],
      });
      continue;
    }
    if (result.type === "stock_quote") {
      const r = result as any;
      blocks.push({
        type: "market" as const,
        title: `${r.symbol}`,
        assets: [{
          symbol: String(r.symbol ?? "STOCK"),
          name: String(r.name ?? r.symbol ?? "Accion"),
          price: r.close != null ? String(r.close) : "?",
          change: r.change24hPct != null ? `${r.change24hPct >= 0 ? "up" : "down"} ${Math.abs(r.change24hPct)}%` : "-",
          changeUp: Number(r.change24hPct ?? 0) >= 0,
        }],
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
    if (result.type === "match_live") {
      const r = result as any;
      // 🔴 FIX CRÍTICO Anti-alucinación: si match_live devuelve status "no_data",
      // NO generar block (evita card vacía o con datos inventados).
      // El reply se forzará a ser honesto en normalizeFinalPayload.
      if (r.status === "no_data" || r.status === "failed") {
        // Marcar este tool execution para que normalizeFinalPayload sepa que no hay datos
        // y fuerce un reply honesto en vez de dejar al LLM inventar.
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText = r.note || r.error || `No encontré partidos recientes para "${r.query ?? ''}". La temporada puede estar en receso.`;
        continue; // NO generar block — sin card, sin alucinación
      }
      // El tool match_live devuelve { matches: [{homeTeam:"Spain", awayTeam:"Belgium", homeScore:2, awayScore:1, status:"Full Time", date:..., live:false}] }
      // (strings, no objetos). Soportamos también la forma legacy (r.homeTeam como objeto).
      const matches = Array.isArray(r.matches) ? r.matches : [];
      if (matches.length === 0 && (r.homeName || r.homeTeam)) {
        // Forma legacy: un solo partido en la raíz
        matches.push({
          homeTeam: typeof r.homeTeam === "string" ? r.homeTeam : r.homeTeam?.name,
          awayTeam: typeof r.awayTeam === "string" ? r.awayTeam : r.awayTeam?.name,
          homeScore: r.homeScore ?? r.homeTeam?.score,
          awayScore: r.awayScore ?? r.awayTeam?.score,
          status: r.status,
          date: r.date,
          live: r.live,
        });
      }
      // Si hay UN partido, mostramos la card hero live_match con los datos reales.
      if (matches.length >= 1) {
        const m = matches[0];
        const homeName = String(m.homeTeam ?? "Local");
        const awayName = String(m.awayTeam ?? "Visitante");
        const homeScore = Number(m.homeScore ?? 0);
        const awayScore = Number(m.awayScore ?? 0);
        const status = String(m.status ?? (m.live ? "En vivo" : "Final"));
        const homeInitials = m.homeAbbrev ?? initialsFromName(homeName);
        const awayInitials = m.awayAbbrev ?? initialsFromName(awayName);
        const dateStr = m.date ? formatMatchDate(m.date) : "";
        // 🔴 FIX TYPO: "Posesion" → "Posesión" (con s y acento)
        const homePossessionNum = Number.parseFloat(m.homePossession ?? m.detailedStats?.find(s => s.label === "Posesión")?.home?.toString() ?? "50") || 50;
        const awayPossessionNum = Number.parseFloat(m.awayPossession ?? m.detailedStats?.find(s => s.label === "Posesión")?.away?.toString() ?? "50") || 50;
        // 🔴 FIX BUG: "Tiros" era "0% - 0%" (porcentaje). Ahora es número absoluto.
        const homeShotsNum = Number(m.homeShots ?? m.detailedStats?.find(s => s.label === "Tiros")?.home ?? 0);
        const awayShotsNum = Number(m.awayShots ?? m.detailedStats?.find(s => s.label === "Tiros")?.away ?? 0);
        // Para que la barrita funcione, calculamos porcentaje relativo
        const totalShots = homeShotsNum + awayShotsNum;
        const homeShotsPct = totalShots > 0 ? Math.round((homeShotsNum / totalShots) * 100) : 50;
        const awayShotsPct = totalShots > 0 ? 100 - homeShotsPct : 50;
        blocks.push({
          type: "live_match" as const,
          homeName,
          awayName,
          homeScore,
          awayScore,
          homeInitials,
          awayInitials,
          minute: m.minute ?? m.time,
          globalAgg: status + (dateStr ? ` · ${dateStr}` : ""),
          homePossession: m.homePossession,
          awayPossession: m.awayPossession,
          homeShots: m.homeShots,
          awayShots: m.awayShots,
          time: m.minute ?? m.time,
          status,
          homeTeam: { name: homeName, abbrev: homeInitials, color: m.homeColor, score: homeScore },
          awayTeam: { name: awayName, abbrev: awayInitials, color: m.awayColor, score: awayScore },
          // 🔴 FIX TYPO: "Posesion" → "Posesión"
          stats: [
            { label: "Posesión", leftPercent: homePossessionNum, rightPercent: awayPossessionNum, leftColor: m.homeColor, rightColor: m.awayColor },
            { label: "Tiros", leftPercent: homeShotsPct, rightPercent: awayShotsPct, leftColor: m.homeColor, rightColor: m.awayColor },
          ],
          // 🔴 v2: datos ricos del /summary
          homeColor: m.homeColor,
          awayColor: m.awayColor,
          homeLogo: m.homeLogo,
          awayLogo: m.awayLogo,
          homeAbbrev: m.homeAbbrev,
          awayAbbrev: m.awayAbbrev,
          league: m.league,
          venue: m.venue,
          venueCity: m.venueCity,
          attendance: m.attendance,
          goals: m.goals,
          yellowCards: m.yellowCards,
          redCards: m.redCards,
          substitutions: m.substitutions,
          lineups: m.lineups,
          detailedStats: m.detailedStats,
        });
        // Si hay múltiples partidos, agregamos un match_timeline con el resto.
        if (matches.length > 1) {
          blocks.push({
            type: "match_timeline" as const,
            items: matches.slice(1, 5).map((mm: any) => ({
              minute: mm.date ? new Date(mm.date).getDate() + "'" : "—",
              text: `${mm.homeTeam ?? "?"} ${mm.homeScore ?? "?"} - ${mm.awayScore ?? "?"} ${mm.awayTeam ?? "?"}`,
              sub: mm.status ?? (mm.live ? "En vivo" : "Final"),
              active: !!mm.live,
            })),
          });
        }
      }
      continue;
    }
    if (result.type === "route_traffic") {
      const r = result as any;
      if (r.items && r.items.length > 0) {
        blocks.push({
          type: "route_timeline" as const,
          eta: r.eta,
          items: r.items,
        });
      }
      if (r.alternatives && r.alternatives.length > 0) {
        blocks.push({
          type: "transport_compare" as const,
          items: r.alternatives,
        });
      }
      if (r.from && r.to) {
        blocks.push({
          type: "route_map" as const,
          from: r.from,
          to: r.to,
          progress: r.progress ?? 75,
          distance: r.distance,
          remaining: r.remaining,
        });
      }
      continue;
    }
    if (result.type === "search") {
      const search = result as SearchData;
      // 🔴 FIX UX SISTÉMICO: en vez de generar web_nav/research_sources (solo links),
      // generar un DELIVERABLE con contenido estructurado como muestra el demo.
      // El deliverable tiene: summary (síntesis), metrics, sections (datos + fuentes).
      // El detail screen muestra módulos ricos, no solo una lista de enlaces.
      const sources = (search.sources ?? []).filter((s) => s.url?.startsWith("http")).slice(0, 6);

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

      // Construir sections del deliverable
      const sections: any[] = [];

      // 1. Síntesis: usar summary si hay, sino concatenar snippets
      // 🔴 FIX: NO usar snippets crudos como síntesis. Generar una frase legible.
      // Ignorar search.summary si parece snippets pegados (contiene fragmentos de sitios)
      const rawSummary = cleanText(search.summary);
      const looksLikeSnippets = rawSummary.length > 100 && 
        (rawSummary.includes('. ') && rawSummary.split('. ').length > 4 && 
         !/[¡!]/.test(rawSummary.slice(0, 20))); // no empieza con signo de exclamación = probablemente snippets
      const synthesisText = (!looksLikeSnippets && rawSummary)
        || `Encontré ${sources.length} fuentes sobre "${cleanText(search.title) || "este tema"}". ${sources.slice(0, 2).map(s => s.title).filter(Boolean).join(" y ")}.`
        || "";

      if (synthesisText) {
        sections.push({
          icon: "auto_awesome",
          title: "Síntesis",
          kicker: "LO ESENCIAL",
          kind: "text",
          paragraphs: [synthesisText.slice(0, 800)],
        });
      }

      // 2. Datos estructurados: usar extractedData si hay
      if (search.extractedData && search.extractedData.items.length > 0) {
        sections.push({
          icon: "fact_check",
          title: "Datos verificados",
          kicker: "ENCONTRADOS",
          kind: "rows",
          items: search.extractedData.items.map((item) => ({
            title: item.label,
            subtitle: item.value,
            badge: item.sourceDomain,
          })),
        });
      }

      // 3. Fuentes: los links reales (al final, como en el demo)
      if (sources.length > 0) {
        sections.push({
          icon: "fact_check",
          title: "Fuentes",
          kicker: "DE DÓNDE SALIÓ",
          kind: "rows",
          items: sources.map(s => ({
            title: s.title,
            subtitle: s.snippet?.slice(0, 120) || s.domain,
            badge: s.domain,
          })),
        });
      }

      // Crear el deliverable
      const query = cleanText(search.title) || "Resultado";
      const metrics: any[] = [];
      metrics.push({ value: String(sources.length), label: "Fuentes" });
      if (search.extractedData?.items.length) {
        metrics.push({ value: String(search.extractedData.items.length), label: "Datos" });
      }
      metrics.push({ value: String(sections.length), label: "Secciones" });

      blocks.push({
        type: "deliverable" as const,
        status: "ready" as const,
        kicker: "Tu Búsqueda",
        topic: query,
        title: query.toUpperCase().slice(0, 40),
        description: synthesisText.slice(0, 160) || `Resultados sobre ${query}`,
        summary: synthesisText.slice(0, 500),
        categories: [
          { icon: "travel_explore", label: "Búsqueda" },
          { icon: "fact_check", label: "Fuentes" },
          { icon: "insights", label: "Datos" },
        ],
        metrics,
        sections,
        sources: sources,
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
    if (result.type === "product_analysis") {
      const r = result as any;
      blocks.push({
        type: "product_analysis" as const,
        product: {
          name: r.title ?? r.product?.name,
          icon: r.icon ?? r.product?.icon,
          description: r.subtitle ?? r.product?.description,
        },
        specs: r.specs || [],
      });
      continue;
    }
    if (result.type === "smart_checklist") {
      const r = result as any;
      blocks.push({
        type: "smart_checklist" as const,
        title: r.title,
        progress: r.progress,
        items: r.items || [],
      });
      continue;
    }
    if (result.type === "outfit") {
      const r = result as any;
      blocks.push({
        type: "outfit" as const,
        specs: r.specs || [],
        buttonLabel: r.buttonLabel,
      });
      continue;
    }
    if (result.type === "review_score") {
      const r = result as any;
      blocks.push({
        type: "review_score" as const,
        items: r.items || [],
        buttonLabel: r.buttonLabel,
      });
      continue;
    }
    if (result.type === "review_document") {
      const r = result as any;
      blocks.push({
        type: "review_document" as const,
        title: r.title,
        body: r.body,
      });
      continue;
    }
    if (result.type === "review_quote") {
      const r = result as any;
      blocks.push({
        type: "review_quote" as const,
        sourceName: r.sourceName,
        sourceType: r.sourceType,
        quote: r.quote,
        tags: r.tags || [],
        buttonLabel: r.buttonLabel,
      });
      continue;
    }
    if (result.type === "birthday_calendar") {
      const r = result as any;
      blocks.push({
        type: "birthday_calendar" as const,
        month: r.month,
        highlightedDay: r.highlightedDay,
        startDay: r.startDay,
        daysInMonth: r.daysInMonth,
      });
      continue;
    }
    if (result.type === "birthday_alarm") {
      const r = result as any;
      blocks.push({
        type: "birthday_alarm" as const,
        name: r.name,
        date: r.date,
        countdown: r.countdown,
        unit: r.unit,
        eta: r.eta,
      });
      continue;
    }
    if (result.type === "social_interaction") {
      const r = result as any;
      blocks.push({
        type: "social_interaction" as const,
        name: r.name,
        event: r.event,
        date: r.date,
        remaining: r.remaining,
        gifts: Array.isArray(r.gifts)
          ? r.gifts.map((gift: any) => typeof gift === "string" ? { emoji: "gift", title: gift, detail: r.event ?? "" } : gift)
          : [],
      });
      continue;
    }
    if (result.type === "transport_compare") {
      const r = result as any;
      blocks.push({
        type: "transport_compare" as const,
        items: r.items || [],
      });
      continue;
    }
    if (result.type === "route_map") {
      const r = result as any;
      blocks.push({
        type: "route_map" as const,
        progress: r.progress,
        from: r.from,
        to: r.to,
        distance: r.distance,
        remaining: r.remaining,
      });
      continue;
    }

    // 🔴 FIX P1 — Casos nuevos para tools que ya existían pero se descartaban

    // movie_info: usar el nuevo tipo movie_review con todos los campos ricos
    if (result.type === "movie_info") {
      const r = result as any;
      // 🔴 FIX: si movie_info devuelve status "failed" (no encontró la película),
      // NO generar block (evita card vacía "TU PELÍCULA / PELÍCULA").
      // NO forzar honestReply aquí — el fallback a web_search se maneja en
      // runKoruBackendTurn. Si el fallback no se ejecuta, el LLM debe poder
      // decir "no la encontré" naturalmente.
      if (r.status === "failed" || r.status === "no_data") {
        // Marcar para que el LLM sepa que movie_info falló, pero NO forzar reply
        // — el fallback a web_search puede haber traído resultados.
        (result as any).__movieInfoFailed = true;
        continue; // NO generar block — sin card vacía
      }
      const title = r.title ?? "Película";
      const poster = r.poster ?? r.thumbnail;
      const rating = typeof r.rating === "number" ? r.rating : undefined;
      const overview = r.text ?? r.summary ?? r.synopsis ?? r.overview ?? "";
      blocks.push({
        type: "movie_review" as const,
        title,
        poster,
        rating,
        releaseDate: r.releaseDate,
        runtime: r.runtime,
        director: r.director,
        cast: Array.isArray(r.cast) ? r.cast : undefined,
        genres: Array.isArray(r.genres) ? r.genres : undefined,
        overview: overview.slice(0, 800),
        // 🔴 v4: presupuesto y taquilla formateados desde TMDB (ej. "$150M" / "$1.2B").
        budget: typeof r.budget === "string" ? r.budget : undefined,
        boxOffice: typeof r.boxOffice === "string" ? r.boxOffice : undefined,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
      });
      continue;
    }

    // recipe_find: usar el nuevo tipo recipe con ingredientes estructurados + video
    if (result.type === "recipe_find") {
      const r = result as any;
      const recipes = Array.isArray(r.recipes) ? r.recipes : [];
      if (recipes.length === 0) continue;
      const first = recipes[0];
      // Parsear instrucciones en pasos numerados (suelen venir como string con \r\n)
      const instructions = String(first.instructions ?? "");
      const steps = instructions
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter((s: string) => s && /^(STEP\s*\d+|PASO\s*\d+|\d+[).])/.test(s.toUpperCase()))
        .map((text: string, i: number) => ({ step: i + 1, text: text.replace(/^(STEP\s*\d+|PASO\s*\d+|\d+[).])\s*/i, "") }));
      blocks.push({
        type: "recipe" as const,
        name: first.name ?? "Receta",
        title: first.name ?? "Receta",
        image: first.thumbnail,
        category: first.category,
        area: first.area,
        description: instructions.slice(0, 200),
        instructions: instructions.slice(0, 1500),
        videoUrl: first.videoUrl,
        ingredients: Array.isArray(first.ingredients) ? first.ingredients : undefined,
        steps: steps.length > 0 ? steps : undefined,
        source: { title: "TheMealDB", url: "https://www.themealdb.com/", domain: "themealdb.com" },
        // 🔴 FREE: nutrición promedio del ingrediente principal (Open Food Facts).
        nutrition: first.nutrition,
      });
      // Si hay más recetas, agregar segunda card con lista
      if (recipes.length > 1) {
        blocks.push({
          type: "comparison" as const,
          title: "Otras recetas",
          items: recipes.slice(1, 5).map((rec: any) => ({
            title: rec.name ?? "Receta",
            subtitle: [rec.category, rec.area].filter(Boolean).join(" · "),
            image: rec.thumbnail,
          })),
        });
      }
      continue;
    }

    // book_info: usar el nuevo tipo book_review con cover + todos los metadatos
    if (result.type === "book_info") {
      const r = result as any;
      const title = r.title ?? "Libro";
      const cover = r.coverUrl ?? r.cover ?? r.thumbnail;
      const synopsis = r.text ?? r.summary ?? r.synopsis ?? r.description ?? "";
      blocks.push({
        type: "book_review" as const,
        title,
        cover,
        author: r.author,
        year: r.year ?? r.firstPublished,
        pages: r.pages ?? r.number_of_pages_median,
        publisher: r.publisher,
        genre: r.genre,
        rating: typeof r.rating === "number" ? r.rating : undefined,
        synopsis: synopsis.slice(0, 800),
        isbn: r.isbn,
        // 🔴 v4: preview embebido de Archive.org (Open Library OLID → iframe).
        previewUrl: typeof r.previewUrl === "string" ? r.previewUrl : undefined,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
      });
      continue;
    }

    // 🔴 FIX GAP-1: image_generate → UiBlock `generation` con images, tips,
    // model y totalTime. Si la tool falló o no devolvió imágenes, no emitimos
    // card vacía (sigue el mismo patrón defensivo que movie_info/recipe_find).
    if (result.type === "image_generate") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data") continue;
      const images = Array.isArray(r.images) ? r.images : [];
      if (images.length === 0) continue;
      blocks.push({
        type: "generation" as const,
        title: "Imágenes generadas",
        prompt: r.prompt,
        resultType: "image" as const,
        images,
        tips: Array.isArray(r.tips) ? r.tips : undefined,
        style: r.style,
        aspectRatio: r.aspectRatio,
        model: r.model,
        totalTime: r.totalTime,
      });
      continue;
    }

    // wikipedia_lookup: usar data_card con texto + source
    if (result.type === "wikipedia_lookup" || result.type === "person_info") {
      const r = result as any;
      const title = r.title ?? r.query ?? "Información";
      const text = r.text ?? r.extract ?? r.summary ?? "";
      if (!text) continue;
      const sources = Array.isArray(r.sources) ? r.sources : [];
      blocks.push({
        type: "research_sources" as const,
        title,
        summary: text.slice(0, 1200),
        sources: sources.map((s: any) => ({
          title: s.title ?? title,
          url: s.url ?? "",
          domain: s.domain ?? "wikipedia.org",
          snippet: s.snippet ?? "",
        })),
      });
      continue;
    }

    // food_info: nutrition info con imagen
    if (result.type === "food_info") {
      const r = result as any;
      const specs: Array<{ label: string; value: string }> = [];
      if (r.nutriscore) specs.push({ label: "Nutri-Score", value: String(r.nutriscore).toUpperCase() });
      if (r.calories) specs.push({ label: "Calorías", value: `${r.calories} kcal/100g` });
      if (r.fat) specs.push({ label: "Grasas", value: `${r.fat} g/100g` });
      if (r.carbs) specs.push({ label: "Carbohidratos", value: `${r.carbs} g/100g` });
      if (r.proteins) specs.push({ label: "Proteínas", value: `${r.proteins} g/100g` });
      if (r.ingredients && Array.isArray(r.ingredients)) {
        specs.push({ label: "Ingredientes", value: r.ingredients.slice(0, 5).join(", ") });
      }
      blocks.push({
        type: "product_analysis" as const,
        product: {
          name: r.productName ?? r.title ?? "Producto",
          image: r.imageUrl ?? r.thumbnail,
          description: r.summary ?? "",
        },
        specs,
      });
      continue;
    }

    // 🔴 FIX: reminder_set devuelve block directo {type: "reminder", title, dueText, note}
    if (result.type === "reminder_set") {
      const r = result as any;
      if (r.block) {
        blocks.push(r.block as UiBlock);
      } else {
        blocks.push({
          type: "saved_record" as const,
          title: "Recordatorio guardado",
          records: [{
            kind: "deadline" as const,
            domain: "capture" as const,
            title: r.title ?? "Recordatorio",
            value: r.title ?? "Recordatorio",
            dueHint: r.dueText ?? "",
            notes: r.note ?? "",
          }],
        } as UiBlock);
      }
      continue;
    }

    // 🔴 FIX: alarm_set devuelve block directo {type: "alarm", title, time, repeat, note}
    if (result.type === "alarm_set") {
      const r = result as any;
      if (r.block) {
        blocks.push(r.block as UiBlock);
      } else {
        blocks.push({
          type: "saved_record" as const,
          title: "Alarma guardada",
          records: [{
            kind: "deadline" as const,
            domain: "capture" as const,
            title: r.title ?? "Alarma",
            value: r.title ?? "Alarma",
            dueHint: r.time ?? "",
            notes: [r.repeat, r.note].filter(Boolean).join(" · "),
          }],
        } as UiBlock);
      }
      continue;
    }

    // 🔴 FIX: countdown — generar un data_card atractivo con días/horas/dirección
    if (result.type === "countdown") {
      const r = result as any;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      const days = Number(r.days ?? 0);
      const hours = Number(r.hours ?? 0);
      items.push({ label: "Días", value: String(days), detail: r.direction === "faltan" ? "faltan" : "pasaron" });
      items.push({ label: "Horas", value: String(hours) });
      if (r.targetDate) {
        const d = new Date(r.targetDate);
        if (!Number.isNaN(d.getTime())) {
          items.push({ label: "Fecha", value: d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) });
        }
      }
      blocks.push({
        type: "data_card" as const,
        title: r.label ? `Cuenta regresiva · ${r.label}` : "Cuenta regresiva",
        items,
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: game_info — usar movie_review con rating + metacritic + géneros
    if (result.type === "game_info") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data") {
        (result as any).__gameInfoFailed = true;
        continue;
      }
      blocks.push({
        type: "movie_review" as const,
        title: r.title ?? "Juego",
        poster: r.backgroundImage ?? r.image,
        rating: typeof r.rating === "number" ? r.rating : undefined,
        releaseDate: r.released,
        runtime: r.playtime ? `${r.playtime}h+` : undefined,
        director: r.developer,
        cast: Array.isArray(r.publishers) ? r.publishers : undefined,
        genres: Array.isArray(r.genres) ? r.genres : undefined,
        overview: (r.description ?? r.summary ?? "").slice(0, 800),
        sources: Array.isArray(r.sources) ? r.sources : (r.website ? [{ title: r.title, url: r.website, domain: "rawg.io" }] : undefined),
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: dictionary_define — data_card con definición
    if (result.type === "dictionary_define") {
      const r = result as any;
      const items: Array<{ label: string; value: string }> = [];
      if (r.word) items.push({ label: "Palabra", value: r.word });
      if (r.phonetic) items.push({ label: "Fonética", value: r.phonetic });
      if (Array.isArray(r.definitions) && r.definitions.length) {
        for (const d of r.definitions.slice(0, 3)) {
          items.push({ label: d.partOfSpeech ?? "Def", value: d.definition ?? "" });
        }
      } else if (r.definition) {
        items.push({ label: "Definición", value: r.definition });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: r.word ?? "Definición",
          items,
        } as UiBlock);
      }
      continue;
    }

    // 🔴 FIX: math_calc — data_card con resultado
    if (result.type === "math_calc") {
      const r = result as any;
      blocks.push({
        type: "data_card" as const,
        title: "Cálculo",
        items: [
          { label: "Expresión", value: r.expression ?? "" },
          { label: "Resultado", value: String(r.result ?? "?") },
        ],
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: unit_convert — data_card
    if (result.type === "unit_convert") {
      const r = result as any;
      blocks.push({
        type: "data_card" as const,
        title: "Conversión",
        items: [
          { label: "De", value: `${r.value ?? ""} ${r.from ?? ""}` },
          { label: "A", value: `${r.result ?? "?"} ${r.to ?? ""}` },
        ],
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: news_topic — research_sources con noticias
    if (result.type === "news_topic" || result.type === "trending_topic") {
      const r = result as any;
      const items = Array.isArray(r.articles) ? r.articles : Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) continue;
      blocks.push({
        type: "research_sources" as const,
        title: r.topic ?? r.query ?? "Noticias",
        summary: (r.summary ?? "").slice(0, 800),
        sources: items.slice(0, 6).map((a: any) => ({
          title: a.title ?? a.headline ?? "",
          url: a.url ?? "",
          domain: a.source ?? a.domain ?? "",
          snippet: (a.summary ?? a.snippet ?? "").slice(0, 200),
        })),
      } as UiBlock);
      continue;
    }

    // 🔴 FIX GAP-2: tennis_live → UiBlock `tennis_match`.
    // El tool `tennis_live` (src/tools/sports/tennis.ts) devuelve un
    // `TennisMatchResult` con players, tournament, sets, currentSet,
    // currentPoint, stats, elapsedMs, status y sources. El UiBlock `tennis_match`
    // es 1:1 con ese shape, así que solo normalizamos y copiamos campos.
    if (result.type === "tennis_live") {
      const r = result as any;
      // Anti-alucinación: si el tool devolvió no_data/failed, no emitimos card.
      if (r.status === "no_data" || r.status === "failed") {
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText =
          r.note || r.error || `No encontré un partido de tenis para "${r.player ?? ''}".`;
        continue;
      }
      // Solo generar card si hay al menos un jugador.
      const players = r.players && typeof r.players === "object" ? r.players : undefined;
      if (!players?.home?.name && !players?.away?.name) continue;
      blocks.push({
        type: "tennis_match" as const,
        players,
        tournament: r.tournament,
        sets: Array.isArray(r.sets) ? r.sets : undefined,
        currentSet: r.currentSet,
        currentPoint: r.currentPoint,
        stats: r.stats,
        elapsedMs: r.elapsedMs,
        status: r.status,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
      } as UiBlock);
      continue;
    }

    // 🔴 FIX GAP-2: news_urgent_search → UiBlock `news_urgent`.
    // El tool `news_urgent_search` (src/tools/news/newsUrgent.ts →
    // newsUrgentSearch ToolHandler) devuelve un `UrgentNewsResult` con headline,
    // summary, severity, category, timeline, factChecks, sources, location y
    // lastUpdated. El UiBlock `news_urgent` es 1:1 con ese shape.
    if (result.type === "news_urgent_search") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data") {
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText =
          r.note || r.error || `No encontré noticias urgentes para "${r.query ?? ''}".`;
        continue;
      }
      // Solo emitir card si hay headline o summary (evita cards vacías).
      const headline = cleanText(r.headline);
      const summary = cleanText(r.summary);
      if (!headline && !summary) continue;
      // Normalizar sources al tipo AssistantSource ({title,url,domain}).
      const sources = Array.isArray(r.sources)
        ? r.sources
            .map((s: any) => ({
              title: cleanText(s.title, "Sin título"),
              url: cleanText(s.url),
              domain: cleanText(s.domain),
              snippet: s.snippet,
            }))
            .filter((s: any) => s.url)
            .slice(0, 8)
        : [];
      blocks.push({
        type: "news_urgent" as const,
        headline: headline || "Última hora",
        summary: summary.slice(0, 800),
        severity: ["breaking", "urgent", "important"].includes(cleanText(r.severity))
          ? (cleanText(r.severity) as "breaking" | "urgent" | "important")
          : undefined,
        category: cleanText(r.category) || undefined,
        timeline: Array.isArray(r.timeline)
          ? r.timeline
              .map((t: any) => ({
                time: cleanText(t.time),
                event: cleanText(t.event),
                status: ["done", "current", "pending"].includes(cleanText(t.status))
                  ? (cleanText(t.status) as "done" | "current" | "pending")
                  : "done",
              }))
              .filter((t: any) => t.event)
              .slice(0, 5)
          : undefined,
        factChecks: Array.isArray(r.factChecks)
          ? r.factChecks
              .map((f: any) => ({
                claim: cleanText(f.claim),
                verdict: cleanText(f.verdict),
                source: cleanText(f.source),
              }))
              .filter((f: any) => f.claim)
              .slice(0, 8)
          : undefined,
        sources,
        location: r.location && typeof r.location === "object"
          ? {
              lat: Number(r.location.lat ?? 0),
              lng: Number(r.location.lng ?? 0),
              label: cleanText(r.location.label, "Ubicación"),
            }
          : undefined,
        lastUpdated: cleanText(r.lastUpdated),
      } as UiBlock);
      continue;
    }

    // 🔴 FIX GAP-2: route_plan_search → UiBlock `route_map` (enriquecido).
    // El tool `route_planner` (src/tools/travel/travelPlanner.ts → routePlanner
    // ToolHandler) envuelve `fetchRoute` (Google Maps Directions API) y devuelve
    // un `RouteResult` con steps, alternatives, trafficLevel y fuelEstimate.
    // Mapeamos al UiBlock `route_map` extendido (campos steps, alternatives,
    // trafficLevel, fuelEstimate definidos en types.ts).
    if (result.type === "route_plan_search") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data" || r.status === "not_configured") {
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText =
          r.note || r.error || `No pude calcular la ruta de "${r.origin ?? ''}" a "${r.destination ?? ''}".`;
        continue;
      }
      const steps = Array.isArray(r.steps)
        ? r.steps
            .map((s: any) => ({
              instruction: cleanText(s.instruction),
              distanceMeters: Number(s.distanceMeters ?? 0),
              maneuver: cleanText(s.maneuver, "straight"),
            }))
            .filter((s: any) => s.instruction)
            .slice(0, 12)
        : [];
      const alternatives = Array.isArray(r.alternatives)
        ? r.alternatives
            .map((alt: any) => ({
              mode: cleanText(r.mode, "driving"),
              time: formatRouteDuration(alt.durationSec),
              traffic: cleanText(alt.trafficLevel, "light"),
            }))
            .slice(0, 3)
        : [];
      blocks.push({
        type: "route_map" as const,
        from: cleanText(r.origin),
        to: cleanText(r.destination),
        distance: formatRouteDistance(r.distanceMeters),
        remaining: formatRouteDuration(r.durationSec),
        steps: steps.length ? steps : undefined,
        alternatives: alternatives.length ? alternatives : undefined,
        trafficLevel: cleanText(r.trafficLevel, "light"),
        fuelEstimate:
          typeof r.fuelEstimateLiters === "number" && r.fuelEstimateLiters > 0
            ? `${r.fuelEstimateLiters} L`
            : undefined,
      } as UiBlock);
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
  // 🔴 FIX P2.3: nuevos tipos
  if (block.type === "recipe") return Boolean(block.name || block.title || block.instructions || block.ingredients?.length);
  if (block.type === "movie_review") return Boolean(block.title || block.poster || block.overview || block.rating);
  if (block.type === "book_review") return Boolean(block.title || block.cover || block.synopsis || block.author);
  // 🔴 FIX GAP-1: generation (image_generate) — descarta cards sin imágenes/preview.
  if (block.type === "generation") return Boolean(block.images?.length || block.preview || block.prompt);
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
  // 🔴 FIX: product_analysis (usado por food_info y otros)
  if (first.type === "product_analysis") {
    const name = first.product?.name ?? "Lo que pediste";
    const desc = first.product?.description;
    const rating = first.product?.rating;
    const parts: string[] = [];
    if (rating) parts.push(`Rating: ${rating}/10.`);
    if (desc) parts.push(desc.slice(0, 300));
    return parts.length > 0 ? `${name}. ${parts.join(" ")}` : `Te deje la info de ${name} en la tarjeta.`;
  }
  // 🔴 FIX P2.3: recipe (recipe_find)
  if (first.type === "recipe") {
    const name = first.name ?? first.title ?? "Receta";
    const parts: string[] = [name];
    if (first.category) parts.push(first.category);
    if (first.area) parts.push(first.area);
    if (first.ingredients?.length) parts.push(`${first.ingredients.length} ingredientes`);
    return `Te deje la receta de ${parts.join(" · ")} en la tarjeta.${first.videoUrl ? " Incluye video." : ""}`;
  }
  // 🔴 FIX P2.3: movie_review (movie_info)
  if (first.type === "movie_review") {
    const title = first.title ?? "Película";
    const parts: string[] = [];
    if (first.rating) parts.push(`Rating: ${first.rating}/10`);
    if (first.director) parts.push(`Dir: ${first.director}`);
    if (first.runtime) parts.push(first.runtime);
    return parts.length > 0 ? `${title}. ${parts.join(" · ")}.` : `Te deje la info de ${title} en la tarjeta.`;
  }
  // 🔴 FIX P2.3: book_review (book_info)
  if (first.type === "book_review") {
    const title = first.title ?? "Libro";
    const parts: string[] = [];
    if (first.author) parts.push(first.author);
    if (first.year) parts.push(first.year);
    return parts.length > 0 ? `${title} — ${parts.join(", ")}.` : `Te deje la info de ${title} en la tarjeta.`;
  }
  // 🔴 FIX: data_card (usado por varios tools)
  if (first.type === "data_card") {
    return first.title ?? "Te deje los datos en la tarjeta.";
  }
  // 🔴 FIX: live_match (usado por match_live)
  if (first.type === "live_match") {
    const home = first.homeName ?? first.homeTeam?.name ?? "";
    const away = first.awayName ?? first.awayTeam?.name ?? "";
    const hs = first.homeScore ?? first.homeTeam?.score;
    const as = first.awayScore ?? first.awayTeam?.score;
    if (home && away && hs !== undefined && as !== undefined) {
      return `${home} ${hs} - ${as} ${away}. Te deje el detalle en la tarjeta.`;
    }
    return "Te deje el resultado del partido en la tarjeta.";
  }
  // 🔴 FIX: restaurant_synthesis (usado por restaurant_deep_search)
  if (first.type === "restaurant_synthesis") {
    const topMatch = first.matches?.[0];
    if (topMatch) {
      return `Te deje el cruce de reseñas en la tarjeta. El más mencionado: ${topMatch.name}.`;
    }
    return "Te deje el cruce de reseñas en la tarjeta.";
  }
  // 🔴 FIX: crypto_portfolio (usado por crypto_price)
  if (first.type === "crypto_portfolio") {
    const item = first.items?.[0];
    if (item) {
      const change = item.change !== undefined ? (item.change >= 0 ? ` Subió ${item.change}%` : ` Bajó ${Math.abs(item.change)}%`) : "";
      return `${item.name} está en ${item.price}.${change} Te dejé el detalle en la tarjeta.`;
    }
    return "Te deje la cotización en la tarjeta.";
  }
  // 🔴 FIX: deliverable (usado por web_search y deep_research)
  if (first.type === "deliverable") {
    return first.summary ? `${first.summary.slice(0, 200)}` : "Te dejé el resultado en la tarjeta.";
  }
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

// 🔴 FIX: síntesis determinística de memorias a partir de revelaciones pasivas.
function synthesizeMemoryFromRevelation(input: string): Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] {
  const candidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] = [];
  const text = input.trim();
  let m: RegExpMatchArray | null;

  // ── PREFERENCES: "me encanta X", "me gusta X", "amo X", "odio X", "soy fan de X" ──
  if ((m = text.match(/\b(?:me encanta|me encantan|amo|me apasiona|me fascina|me gustan los|me gustan las|me gusta el|me gusta la|me gusta|adoro|soy fan de|soy fan|me copa|me copan|me re gusta|me re copa)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "preference", text: `Le encanta ${m[1].trim()}.`, confidence: 0.88, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "odio X" / "no me gusta X" / "detesto X"
  if ((m = text.match(/\b(?:odio|detesto|no me gusta|no soporto|me rechina|me molesta)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "preference", text: `Odia ${m[1].trim()}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "soy celiaco" / "soy vegetariano" / "soy alergico a X"
  if ((m = text.match(/\b(?:soy|soy )?(celiaco|celíaca|vegetariano|vegetariana|vegano|vegana|diabetico|diabética|alergico|alérgico|alergica|alérgica|intolerante)\s+(?:a\s+|al\s+|a la\s+|a los\s+)?([^.!?]{3,60})?/i))) {
    const condition = m[1].toLowerCase();
    const to = m[2]?.trim();
    candidates.push({ kind: "wellbeing", text: `Es ${condition}${to ? ` a ${to}` : ""}.`, confidence: 0.87, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "tengo alergia a X" / "tengo X" (condiciones médicas)
  if ((m = text.match(/\btengo\s+(alergia|alergias|asma|diabetes|hipertension|hipotiroidismo|migraña|migranas)\s*(?:a\s+|al\s+|a la\s+)?([^.!?]{3,60})?/i))) {
    const condition = m[1].toLowerCase();
    const to = m[2]?.trim();
    candidates.push({ kind: "wellbeing", text: `Tiene ${condition}${to ? ` a ${to}` : ""}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── ROUTINES/GOALS: "estoy X", "trabajo de X", "estudio X", "aprendo X" ──
  if ((m = text.match(/\b(?:estoy|ando|estuve)\s+(trabajando|aprendiendo|leyendo|escuchando|viendo|estudiando|haciendo|armando|programando|escribiendo|cocinando|preparando|investigando|diseñando|creando|desarrollando|practicando|jugando|entrenando|corriendo|necessitando)\s+(?:en\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?([^.!?]{3,100})/i))) {
    const action = m[1].toLowerCase();
    const what = m[2].trim();
    const kind = action === "aprendiendo" || action === "practicando" ? "routine" : action === "trabajando" || action === "programando" || action === "desarrollando" || action === "creando" || action === "diseñando" ? "goal" : "routine";
    const verbMap: Record<string, string> = {
      trabajando: "Trabaja en", aprendiendo: "Aprende", leyendo: "Está leyendo",
      escuchando: "Escucha", viendo: "Está viendo", estudiando: "Estudia",
      haciendo: "Está haciendo", armando: "Está armando", programando: "Programa",
      escribiendo: "Está escribiendo", cocinando: "Está cocinando", preparando: "Está preparando",
      investigando: "Investiga", diseñando: "Diseña", creando: "Está creando", desarrollando: "Desarrolla",
      practicando: "Practica", jugando: "Juega", entrenando: "Entrena", corriendo: "Corre",
    };
    candidates.push({ kind, text: `${verbMap[action] ?? "Está " + action} ${what}.`, confidence: 0.86, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "trabajo de X" / "trabajo en X" / "soy X" (profesión)
  if ((m = text.match(/\b(?:trabajo de|trabajo en|trabajo como|soy)\s+(?:un\s+|una\s+|un\b|una\b)?([a-záéíóúñ][^.!?]{3,60})/i))) {
    const what = m[1].trim();
    // Filtrar palabras que NO son profesiones
    if (!/^(celiaco|celíaca|vegetariano|vegetariana|vegano|vegana|diabetico|diabética|alergico|alérgico|alergica|alérgica|de|la|el|los|las|un|una|muy|bastante|feliz|triste|cansado|cansada|aburrido|aburrida)$/.test(what.toLowerCase())) {
      candidates.push({ kind: "profile", text: `Trabaja de ${what}.`, confidence: 0.82, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
    }
  }
  // "estudio X" / "estoy estudiando X" (carrera)
  if ((m = text.match(/\b(?:estudio|estudiando|estoy estudiando|cursando)\s+(?:la\s+|el\s+|la carrera de\s+|el profesorado de\s+)?([a-záéíóúñ][^.!?]{3,60})/i))) {
    candidates.push({ kind: "goal", text: `Estudia ${m[1].trim()}.`, confidence: 0.84, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── RELATIONSHIPS: "tengo un gato/perro", "mi novia se llama X", "mi madre es X" ──
  // "tengo un gato/perro/mascota"
  if ((m = text.match(/\btengo\s+(?:un\s+|una\s+|unos\s+|unas\s+)?(gato|gata|gatos|perro|perros|perra|gata|conejo|coneja|hamster|pez|peces|tortuga|loro|canario|cobayo|cobaya|mascota|mascotas)\b([^.]*)/i))) {
    candidates.push({ kind: "relationship", text: `Tiene ${m[1].toLowerCase()}${m[2]?.trim() ? ` ${m[2].trim()}` : ""}.`, confidence: 0.84, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "mi novia/novia/esposa/madre/padre se llama X"
  if ((m = text.match(/\b(?:mi\s+)?(?:novia|novio|esposa|esposo|mujer|marido|madre|padre|mamá|mamá|papá|papá|hermano|hermana|hijo|hija|amigo|amiga|sobrino|sobrina|tio|tía|abuela|abuelo|primo|prima)\s+(?:se llama|se llama|es|esta|está|trabaja de|vive en|cumple|tiene)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "relationship", text: `${m[0].trim()}.`, confidence: 0.82, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "mi madre/padre cumple X"
  if ((m = text.match(/\b(?:mi\s+)?(?:madre|padre|mam[áa]|pap[áa])\s+(?:cumple|tiene|es|está|va a)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "relationship", text: `Sobre su madre/padre: ${m[0].trim()}.`, confidence: 0.8, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── PROFILE: cumpleaños, ubicación, nombre ──
  // "mi cumple es en X" / "cumple años en X"
  if ((m = text.match(/\b(?:mi\s+)?cumple[años]*\s+(?:es|en|el|por|cae en)\s+([^.!?]{3,60})/i))) {
    candidates.push({ kind: "profile", text: `Cumpleaños: ${m[1].trim()}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "vivo en X" / "estoy en X" / "soy de X" (ubicación)
  if ((m = text.match(/\b(?:vivo en|estoy en|estoy en|soy de|viviendo en|me mude a|me mudé a)\s+([a-záéíóúñ][^.!?]{3,50})/i))) {
    candidates.push({ kind: "profile", text: `Vive en ${m[1].trim()}.`, confidence: 0.83, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── GOALS: "quiero X", "tengo pensado X", "estoy ahorrando para X" ──
  if ((m = text.match(/\b(?:quiero|tengo pensado|tengo ganas de|me gustaria|me gustaría|estoy ahorrando para|estoy juntando para|planeo|tengo planeado|mi objetivo es|mi meta es)\s+([^.!?]{3,100})/i))) {
    candidates.push({ kind: "goal", text: `Quiere ${m[1].trim()}.`, confidence: 0.84, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── ROUTINES: "todos los días X", "los martes X", "cada mañana X" ──
  if ((m = text.match(/\b(?:todos los dias|todos los días|cada dia|cada día|los lunes|los martes|los miercoles|los miércoles|los jueves|los viernes|los sabados|los sábados|los domingos|cada mañana|cada noche|cada semana|cada mes)\s+([^.!?]{3,100})/i))) {
    candidates.push({ kind: "routine", text: `${m[0].trim()}.`, confidence: 0.82, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── INTERESTS: "me interesa X", "me llama la atención X", "estoy buscando X" ──
  if ((m = text.match(/\b(?:me interesa|me interesan|me llama la atencion|me llama la atención|estoy buscando|estoy viendo|estoy explorando|me estoy metiendo en)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "preference", text: `Le interesa ${m[1].trim()}.`, confidence: 0.80, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  return candidates;
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
  prebuiltToolBlocks?: UiBlock[],
): KoruBackendTurnResponse {
  const modelBlocks = asArray(raw.uiBlocks).map(normalizeUiBlock).filter((block): block is UiBlock => Boolean(block));
  const mascotState = cleanText(raw.mascotState) || "idle";
  const validatedMascotState = VALID_MASCOT_STATES.includes(mascotState as MascotState)
    ? (mascotState as MascotState)
    : "idle";
  if (mascotState !== "idle" && !VALID_MASCOT_STATES.includes(mascotState as MascotState)) {
    console.warn(`[Koru] LLM returned invalid mascotState: "${mascotState}". Falling back to "idle".`);
  }
  // 🔴 FIX: usar toolBlocks pre-construidos si se pasan (ya enriquecidos con síntesis LLM)
  const toolBlocks = prebuiltToolBlocks ?? blocksFromToolResults(toolExecutions);
  // 🔴 FIX CRÍTICO: si hay toolBlocks (datos reales de tools), NO mezclar con modelBlocks
  // del LLM. Los modelBlocks pueden contener pensamiento del LLM en vez de datos reales.
  // Los toolBlocks son la fuente de verdad — los modelBlocks del LLM solo introducen ruido.
  const uiBlocks = toolBlocks.length > 0
    ? toolBlocks
    : mergeModelAndToolBlocks(modelBlocks, toolBlocks);
  const captures = personalCapturesFromTools(toolExecutions);
  const localActions = localActionsFromTools(toolExecutions);
  const memoryCaptures = memoryCapturesFromTools(toolExecutions);
  const toolResults: ToolResult[] = toolExecutions.map((execution, index) => {
    const resultAny = execution.result as Record<string, unknown>;
    const rawStatus = typeof resultAny?.status === "string" ? resultAny.status : "ok";
    const status: ToolResult["status"] = rawStatus === "failed" || rawStatus === "error"
      ? "failed"
      : rawStatus === "partial" || rawStatus === "no_data" || rawStatus === "need_city" || rawStatus === "needs_context"
        ? "needs_context"
        : "ok";
    const toolMap: Record<string, ToolCall["tool"]> = {
      weather: "weather",
      web_search: "web_search",
      shopping_compare: "shopping_compare",
      route_traffic: "route_traffic",
      calendar_reminder: "calendar_reminder",
      alarm: "alarm",
      alarm_set: "alarm",
      reminder_set: "calendar_reminder",
      countdown: "calendar_reminder",
      match_live: "match_live",
      match_schedule: "match_live",
      league_standings: "match_live",
      team_follow: "match_live",
      plan_day: "memory_recall",
      save_memory: "memory_recall",
      save_personal_item: "memory_recall",
      query_personal_context: "memory_recall",
      movie_info: "web_search",
      book_info: "web_search",
      game_info: "web_search",
      person_info: "web_search",
      person_filmography: "web_search",
      wikipedia_lookup: "web_search",
      dictionary_define: "web_search",
      math_calc: "web_search",
      unit_convert: "web_search",
      recipe_find: "web_search",
      recipe_by_ingredients: "web_search",
      food_info: "web_search",
      wine_pairing: "web_search",
      nutrition_calc: "web_search",
      restaurant_deep_search: "shopping_compare",
      restaurant_review_aggregate: "shopping_compare",
      crypto_price: "crypto_price",
      stock_quote: "crypto_price",
      exchange_history: "crypto_price",
      currency_convert: "crypto_price",
      news_topic: "web_search",
      trending_topic: "web_search",
      travel_itinerary: "route_traffic",
      flight_search: "route_traffic",
      hotel_search: "route_traffic",
      deep_research: "web_search",
      price_history: "shopping_compare",
      product_review: "shopping_compare",
    };
    return {
      id: execution.id || `tool_${index + 1}`,
      tool: toolMap[execution.name] ?? "web_search",
      status,
      summary: JSON.stringify(execution.result).slice(0, 500),
      data: execution.result,
      sources: normalizeSources(resultAny?.sources),
    };
  });
  const cleanedReply = cleanReplyText(raw.reply);
  const blockReply = replyFromBlocks(uiBlocks, input);

  // 🔴 FIX CRÍTICO Anti-alucinación: si algún tool marcó __forceHonestReply
  // (ej: match_live no encontró partidos), FORZAR el reply honesto.
  // El LLM tiende a inventar resultados cuando la tool devuelve "no_data".
  const honestForcedReply = toolExecutions
    .map(e => e.result as any)
    .find(r => r && r.__forceHonestReply);

  // 🔴 SAFETY NET FINAL: si después de toda la cadena de strippado el reply todavía
  // parece thinking del LLM (empieza con "The user", "I need to", etc.), reemplazar
  // con blockReply o mensaje de fallback. Esto es la última línea de defensa.
  const looksLikeThinking = /^(the user|i need to|let me|i should|i will|i'll|i am going to|i'm going to|step by step|first,?\s*i|okay,?\s*(so|i|let)|alright,?\s*(so|i|let))\b/i.test(cleanedReply);

  let finalReply: string;
  if (honestForcedReply) {
    // Si hay un honestReply forzado, usarlo SIEMPRE (prioridad máxima)
    finalReply = honestForcedReply.__honestReplyText || "No encontré datos sobre eso en este momento.";
  } else if (!cleanedReply || isGenericAgentReply(cleanedReply) || looksLikeThinking) {
    finalReply = blockReply || "Tuve un problema para armar la respuesta. ¿Me lo repetís de otra forma para ayudarte bien?";
  } else {
    finalReply = cleanedReply;
  }

  // 🔴 FIX CALIDAD: si el LLM dice "guardado/anotado/recordatorio" pero NO se creó
  // ningún commitment ni record, el LLM está mintiendo (dijo que guardó pero no lo hizo).
  // Crear un commitment sintético a partir del input para que al menos quede registrado.
  const saysSaved = /\b(guardado|anotado|recordatorio|avis[oé]|no me olvides|no te olvides|acordate|recuerda)\b/i.test(finalReply);
  const rawCommitments = asArray(raw.commitments);
  const rawRecords = asArray(raw.records);
  const hasCommitments = rawCommitments.length > 0 || captures.some(c => c.commitments?.length) || localActions.some(a => a.commitments?.length) || toolExecutions.some(e => Array.isArray((e.result as any)?.commitments));
  const hasRecords = rawRecords.length > 0 || captures.some(c => c.records?.length) || localActions.some(a => a.records?.length) || toolExecutions.some(e => Array.isArray((e.result as any)?.records));
  const synthCommitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] = [];
  if (saysSaved && !hasCommitments && !hasRecords && toolExecutions.length === 0) {
    synthCommitments.push({
      title: input.slice(0, 100),
      dueHint: "pendiente",
      status: "open" as const,
    });
    if (uiBlocks.length === 0) {
      uiBlocks.push({
        type: "reminder" as const,
        title: input.slice(0, 80),
        dueText: "pendiente",
      } as UiBlock);
    }
  }

  // 🔴 FIX UX: Si el reply es demasiado largo (>100 chars) Y hay un block informativo
  // (movie_review, recipe, book_review, weather, live_match, deliverable, etc.),
  // recortarlo al primer enunciado. Los datos van en la card, no en el texto.
  const informativeBlockTypes = new Set([
    "movie_review", "recipe", "book_review", "weather", "live_match",
    "deliverable", "market", "forex", "data_card", "web_nav",
    "restaurant_synthesis", "research_sources", "comparison",
    "crypto_portfolio", "data_ticker", "product_analysis",
    "generation", // 🔴 FIX GAP-1: image_generate
  ]);
  const hasInformativeBlock = uiBlocks.some(b => informativeBlockTypes.has(b.type));
  if (finalReply.length > 250 && hasInformativeBlock) {
    const firstSentence = finalReply.match(/^.{1,200}?[.!?](\s|$)/)?.[0];
    if (firstSentence && firstSentence.length < finalReply.length) {
      // Solo agregar "Te dejé el detalle en la tarjeta" si no lo dice ya
      const trimmed = firstSentence.trim();
      if (/tarjeta/i.test(trimmed)) {
        finalReply = trimmed;
      } else {
        finalReply = trimmed + " Te dejé el detalle en la tarjeta.";
      }
    }
  }
  // Si el reply menciona "tarjeta" dos veces, limpiar
  if (hasInformativeBlock) {
    finalReply = finalReply.replace(/Te dejé el detalle en la tarjeta\.?\s*$/i, "").trim();
    if (!/tarjeta/i.test(finalReply)) {
      finalReply += " Te dejé el detalle en la tarjeta.";
    }
  }
  const result: KoruBackendTurnResponse = {
    reply: finalReply,
    uiBlocks,
    suggestedActions: normalizeSuggestedActions(raw.suggestedActions),
    understanding: normalizeUnderstanding(raw.understanding, input),
    // 🔴 ARQUITECTURA NUEVA: el LLM es el ÚNICO extractor de memoria.
    // No hay más síntesis determinística con regex. El LLM ve las memorias
    // existentes, decide qué agregar, qué archivar y qué duplicar.
    memoryCandidates: [
      ...normalizeMemoryCandidates(raw.memoryCandidates),
      ...normalizeMemoryCandidates(extractedRaw?.memoryCandidates),
      ...captures.flatMap((capture) => capture.memoryCandidates ?? []),
      ...memoryCaptures.flatMap((capture) => capture.memoryCandidates ?? []),
    ].slice(0, 6),
    // 🔴 NUEVO: IDs de memorias que el LLM decidió archivar (contradicciones/cambios)
    archiveMemoryIds: [
      ...(Array.isArray(extractedRaw?.archiveMemoryIds) ? extractedRaw.archiveMemoryIds : []),
    ].filter((id: any) => typeof id === "string" && id.length > 0).slice(0, 10),
    commitments: uniqueCommitments([
      ...normalizeCommitments(raw.commitments),
      ...normalizeCommitments(extractedRaw?.commitments),
      ...captures.flatMap((capture) => capture.commitments ?? []),
      ...localActions.flatMap((action) => action.commitments ?? []),
      ...toolExecutions.flatMap((exec) => {
        const r = exec.result as any;
        return Array.isArray(r?.commitments) ? r.commitments : [];
      }),
      ...synthCommitments,
    ]).slice(0, 8),
    records: uniqueRecords([
      ...normalizeRecords(raw.records),
      ...normalizeRecords(extractedRaw?.records),
      ...captures.flatMap((capture) => capture.records ?? []),
      ...localActions.flatMap((action) => action.records ?? []),
      // 🔴 FIX: extract records from any tool result that has them
      ...toolExecutions.flatMap((exec) => {
        const r = exec.result as any;
        return Array.isArray(r?.records) ? r.records : [];
      }),
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
  // 🔴 KIMI v6 — Bug fix: si NO hay uiBlocks Y NO hay toolResults con datos,
  // NO persistir commitments ni records. El memory extractor a veces interpreta
  // la pregunta del usuario ("qué recordás de mí") como un commitment a crear,
  // contaminando el store con basura. Solo persistir si hay cards reales o
  // tools que devolvieron datos.
  const hasUiBlocks = result.uiBlocks.length > 0;
  const hasToolData = toolExecutions.some((exec) => {
    const r = exec.result as Record<string, unknown>;
    return r && (Array.isArray(r.records) || Array.isArray(r.commitments));
  });
  if (!hasUiBlocks && !hasToolData) {
    result.commitments = [];
    result.records = [];
  }
  // 🔴 KIMI v6 — Bug fix adicional: si el único uiBlock es un reminder con la
  // pregunta del usuario como title, el commitment correspondiente es basura.
  // Ej: "que recordas de mi" → reminder con title="que recordas de mi" + commitment.
  if (result.uiBlocks.length === 1 && result.uiBlocks[0].type === "reminder") {
    const reminderTitle = ((result.uiBlocks[0] as { title?: string }).title ?? "").toLowerCase();
    const userInput = input.toLowerCase().trim();
    if (reminderTitle.length > 5 && (userInput.includes(reminderTitle.slice(0, 15)) || reminderTitle.includes(userInput.slice(0, 15)))) {
      result.commitments = [];
      result.records = [];
    }
  }
  return result;
}


async function finalizeFromPlainText(
  raw: Record<string, unknown>,
  toolCalls: ProviderToolCall[],
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  toolExecutions: ToolExecution[],
  extractorTimeout: number,
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter" | "minimax" | "bluesminds"; memoryModel?: string }> {
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
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter" | "minimax" | "bluesminds"; memoryModel?: string }> {
  // OPTIMIZACIÓN: solo saltar el memory extractor para inputs triviales
  if (isTrivialInput(request.input)) {
    return normalizeFinalPayload(raw, request.input, toolExecutions);
  }
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

/**
 * Versión optimizada de finalizePayload que:
 * 1. Usa Flash model para TODO (síntesis + memory extractor)
 * 2. Si ya hay reply (del tool result), NO hace segunda llamada LLM
 * 3. Memory extractor SECUENCIAL (no paralelo) para evitar OOM
 */
async function finalizePayloadWithFastModel(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  raw: Record<string, unknown>,
  toolExecutions: ToolExecution[],
  timeout: number,
  prebuiltToolBlocks?: UiBlock[],
): Promise<KoruBackendTurnResponse> {
  // Si el raw ya tiene reply (el tool devolvió respuesta directa), no hacer segunda llamada
  const existingReply = cleanText((raw as any).reply);
  if (existingReply && existingReply.length > 5) {
    // Memory extractor con Flash (secuencial, no paralelo)
    // 🔴 FIX: ejecutar el extractor incluso si NO hay tools, siempre que el input
    // no sea trivial. Esto captura revelaciones pasivas ("me encanta X", "estoy trabajando en Y").
    if (!isTrivialInput(request.input)) {
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, raw, timeout);
        return normalizeFinalPayload(raw, request.input, toolExecutions, extracted.raw, prebuiltToolBlocks);
      } catch {
        // si falla el extractor, igual devolver la respuesta
      }
    }
    return normalizeFinalPayload(raw, request.input, toolExecutions, undefined, prebuiltToolBlocks);
  }

  // Segunda llamada con Flash model para síntesis
  const messages = buildMessages(request);
  messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks. El JSON debe empezar con { y terminar con }." });

  try {
    const result = await callProvider(config, messages, timeout, false, undefined, undefined, config.nvidiaModel);
    const content = cleanText(result.message.content, "");
    let parsed: any;
    try {
      parsed = JSON.parse(extractJsonBlock(content));
    } catch {
      parsed = { reply: cleanReplyText(content) || "No pude armar una respuesta clara." };
    }
    // Memory extractor con Flash (secuencial)
    // 🔴 FIX: ejecutar el extractor incluso si NO hay tools, siempre que el input
    // no sea trivial. Esto captura revelaciones pasivas ("me encanta X", "estoy trabajando en Y").
    if (!isTrivialInput(request.input)) {
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, parsed, timeout);
        return normalizeFinalPayload(parsed, request.input, toolExecutions, extracted.raw, prebuiltToolBlocks);
      } catch {
        // si falla el extractor, igual devolver la respuesta
      }
    }
    return normalizeFinalPayload(parsed, request.input, toolExecutions, undefined, prebuiltToolBlocks);
  } catch {
    return normalizeFinalPayload(raw, request.input, toolExecutions);
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
      const chatTimeout = isOllamaUrl(config.nvidiaBaseUrl) ? 60_000 : 15_000;
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
let routerNullWarned = false;
// 🔴 KIMI v6 — versión del router. Cambiar este número fuerza la re-inicialización
// del router con los nuevos ejemplos del ROUTE_EXAMPLES. Sin esto, el singleton
// se cachea por proceso y los nuevos ejemplos no se cargan hasta reiniciar.
let routerVersion = "v6-crypto-restaurant-news-tennis";

function buildEmbedFn(baseUrl: string): EmbedFn {
  return async (text: string): Promise<number[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
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

/**
 * Fase 2.2 — Embedding fallback vía NVIDIA API.
 *
 * Antes: si no había Ollama local, getRouter devolvía null y loggeaba
 * "Semantic Router init failed (non-fatal)" en CADA turno. El router es
 * no-crítico pero útil para elegir la tool correcta sin llamar al LLM.
 *
 * Ahora: si hay NVIDIA_API_KEY (que siempre hay en producción), usamos
 * el endpoint de embeddings de NVIDIA (model nvidia/nemotron-340b-embedding
 * o nvolve-embed-v1). Si no, caemos al fallback léxico del SemanticRouter.
 */
function buildNvidiaEmbedFn(apiKey: string, baseUrl: string): EmbedFn {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/embeddings`;
  return async (text: string): Promise<number[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/nv-embedqa-e5-v5",
          input: [text],
          input_type: "query",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`NVIDIA embeddings ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const vec = data.data?.[0]?.embedding;
      if (!vec || vec.length === 0) {
        throw new Error("NVIDIA no devolvió embedding");
      }
      return vec;
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function getRouter(config: ProviderConfig): Promise<SemanticRouter | null> {
  // Fase 2.2: preferir Ollama local (más rápido), fallback a NVIDIA cloud.
  const embedBaseUrl = config.ollamaEmbedBaseUrl ?? (isOllamaUrl(config.nvidiaBaseUrl) ? config.nvidiaBaseUrl : undefined);
  let embedFn: EmbedFn | null = null;
  let embedSource = "none";

  if (embedBaseUrl) {
    embedFn = buildEmbedFn(embedBaseUrl);
    embedSource = `ollama:${embedBaseUrl}`;
  } else if (config.nvidiaApiKey && config.nvidiaApiKey !== "dummy") {
    embedFn = buildNvidiaEmbedFn(config.nvidiaApiKey, config.nvidiaBaseUrl);
    embedSource = `nvidia:${config.nvidiaBaseUrl}`;
  }

  if (!embedFn) {
    // Sin embeddings disponibles — el router queda null y se loggea una vez.
    if (!routerNullWarned) {
      logger.warn("getRouter", "Sin embeddings disponibles (ni Ollama ni NVIDIA key). Semantic Router desactivado.");
      routerNullWarned = true;
    }
    return null;
  }

  // Siempre reiniciar para capturar cambios en ROUTE_EXAMPLES y evitar stale state
  routerSingleton = new SemanticRouter(embedFn);
  try {
    await routerSingleton.initialize();
    logger.info("getRouter", "Semantic Router initialized", { source: embedSource });
  } catch (err: any) {
    logger.warn("getRouter", "Semantic Router init failed (non-fatal)", { reason: err?.message, source: embedSource });
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
/**
 * 🔴 KIMI v6 — Fallback léxico para keywords obvias.
 * Cuando el router semántico no tiene confianza suficiente, este fallback
 * detecta keywords específicos y deriva a la tool correcta.
 */
function lexicalRouteForInput(input: string): { category: RouteCategory; tool: string; toolArgs?: Record<string, unknown> } | null {
  const lc = input.toLowerCase().trim();
  // Crypto
  if (/\b(bitcoin|btc|ethereum|eth|crypto|cripto|criptomoneda|usdt|usdc|solana|cardano|dogecoin|litecoin)\b/.test(lc)) {
    const coin = lc.match(/(bitcoin|btc|ethereum|eth|solana|cardano|dogecoin|litecoin|usdt|usdc)/)?.[1] || "bitcoin";
    return { category: "market" as RouteCategory, tool: "crypto_price", toolArgs: { coin: coin === "btc" ? "bitcoin" : coin, query: input } };
  }
  // Stock/Trading
  if (/\b(aapl|apple|tesla|tsla|stock|acci[oó]n|acciones|cotizaci[oó]n|nasdaq|s&p|wall street|bolsa|mercado de valores)\b/.test(lc)) {
    return { category: "market" as RouteCategory, tool: "stock_quote", toolArgs: { query: input, symbol: lc.match(/(aapl|apple|tesla|tsla|amazon|amzn|google|googl|meta|msft|microsoft)/)?.[1] || "" } };
  }
  // Restaurant
  if (/\b(restaurante|restaurantes|donde comer|dónde comer|dónde cenar|donde cenar|parrilla|parrilla|sushi|pizza|hamburguesa|comida|reservar mesa|comida cerca)\b/.test(lc)) {
    return { category: "world_info" as RouteCategory, tool: "restaurant_deep_search", toolArgs: { query: input } };
  }
  // News
  if (/\b(noticias|noticia|última hora|ultima hora|último minuto|ultimo minuto|noticias urgentes|noticias de hoy|qué pasó hoy|que pasó hoy)\b/.test(lc)) {
    return { category: "world_info" as RouteCategory, tool: "news_urgent_search", toolArgs: { query: input } };
  }
  // Tennis
  if (/\b(tenis|tennis|roland garros|wimbledon|alcaraz|sinner|djokovic|nadal|atp|wta)\b/.test(lc)) {
    return { category: "sports" as RouteCategory, tool: "tennis_live", toolArgs: { query: input } };
  }
  // Football — extraer equipo del input y distinguir match_live vs match_schedule
  if (/\b(c[oó]mo le fue a|como le fue a|c[oó]mo sali[oó]|como salio|resultado de|partido de|jug[oó]|gano|gan[oó]|perdi[oó]|empat[oó])\b/.test(lc)) {
    // Resultado → match_live
    const teamMatch = lc.match(/(?:de|a|fue a|sali[oó]|resultado de|partido de)\s+([a-záéíóúñ\s]{3,30})/);
    const team = teamMatch?.[1]?.trim() || input;
    return { category: "sports" as RouteCategory, tool: "match_live", toolArgs: { query: team } };
  }
  if (/\b(cuando juega|cu[aá]ndo juega|pr[oó]ximo partido|proximo partido|fixture|pr[oó]ximos partidos|proximos partidos|agenda|calendario)\b/.test(lc)) {
    // Fixture → match_schedule
    const teamMatch = lc.match(/(?:de|juega|juegan|partido de|partidos de|fixture de|pr[oó]ximo partido de|proximo partido de|pr[oó]ximos partidos de|proximos partidos de)\s+([a-záéíóúñ\s]{3,30})/);
    const team = teamMatch?.[1]?.trim() || input;
    return { category: "sports" as RouteCategory, tool: "match_schedule", toolArgs: { team } };
  }
  // Recipe
  if (/\b(receta|recetas|cocinar|que cocino|qué cocino|plato|platos|ingredientes|receta de)\b/.test(lc)) {
    return { category: "food" as RouteCategory, tool: "recipe_find", toolArgs: { query: input.replace(/^receta de\s+/i, "").replace(/^receta\s+/i, "") } };
  }
  // Route map
  if (/\b(c[oó]mo llego|como llego|ruta a|direcci[oó]n?a? al?|camino a|navegar a|ir a|c[oó]mo voy|como voy|d[oó]nde queda|donde queda|indicaciones)\b/.test(lc)) {
    return { category: "travel" as RouteCategory, tool: "route_traffic", toolArgs: { destination: input, query: input } };
  }
  // Morning brief
  if (/\b(buenos d[ií]as|buen d[ií]a|buen dia|que tal el d[ií]a|resumen del d[ií]a|empezamos el d[ií]a)\b/.test(lc)) {
    return { category: "action" as RouteCategory, tool: "query_personal_context", toolArgs: { query: input, domain: "morning" } };
  }
  // Money summary
  if (/\b(cu[aá]nto gast[eé]|gast[eé]|gastos|gasto|finanzas|presupuesto|mis gastos|resumen financiero|cu[aá]nto gast[eé] esta)\b/.test(lc)) {
    return { category: "action" as RouteCategory, tool: "query_personal_context", toolArgs: { query: input, domain: "money" } };
  }
  // Exercise — dejar que el LLM genere exercise_plan nativamente
  // (no usar save_personal_item porque crea saved_record genérico)
  // Travel — dejar que el LLM use travel_itinerary nativamente
  // Elections — dejar que el LLM use web_search nativamente
  // Image generation — dejar que el LLM use image_gen nativamente
  // Delivery — dejar que el LLM genere delivery block nativamente
  // Memory — usar query_personal_context con domain=memory
  if (/\b(qu[eé] record[aá]s de m[ií]|qu[eé] sab[eé]s de m[ií]|qu[eé] ten[eé]s guardado|mi memoria|qu[eé] te cont[eé])\b/.test(lc)) {
    return { category: "personal_query" as RouteCategory, tool: "query_personal_context", toolArgs: { query: input, domain: "memory" } };
  }
  return null;
}

function searchLabelFromInput(input: string): string {
  const clean = input.trim().replace(/\s+/g, " ");
  // 🔴 FIX: para recordatorios y alarmas, no usar "Buscando X" — usar "Anotando X"
  if (/\b(recordame|recordar|recuerdame|recuerda|no me dejes olvidar|avisame|avisa|anot[aá])\b/i.test(clean)) {
    const m = clean.match(/(?:recordame|recordar|recuerdame|recuerda|no me dejes olvidar|avisame|avisa|anot[aá])\s+(.+?)(?:\s+(?:a las|al|el|en|para|mañana|pasado)\b|$)/i);
    const what = m?.[1]?.trim() ?? clean.replace(/.*(?:recordame|recordar|recuerdame|recuerda|no me dejes olvidar|avisame|avisa|anot[aá])\s+/i, "").trim();
    return `Anotando ${what.slice(0, 40)}…`;
  }
  if (/\b(alarma|despertador)\b/i.test(clean)) {
    const t = clean.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i)?.[0];
    return t ? `Programando alarma para las ${t}…` : "Programando alarma…";
  }
  if (/\b(cu[aá]ntos? d[ií]as? faltan|cu[aá]nto falta|faltan para)\b/i.test(clean)) {
    return "Calculando cuenta regresiva…";
  }
  // Quitar saludos y cortesías comunes al inicio que no aportan al tema.
  const stripped = clean
    .replace(/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|che|hey|koru|por favor|podr[ií]as|puedes|me dec[ií]s|decime|dame|quiero saber|necesito saber|busc[aá]\s*(info|informaci[oó]n|datos)?\s*(sobre|de|acerca)?)\b[,\s]*/gi, "")
    .replace(/^(paso|pas[oó]|que paso|qué pasó|qu[eé] tal|c[oó]mo (va|le va|est[aá]))\s+(con|el|la|los|las)?\s*/i, "")
    .trim();
  if (stripped.length < 5) return "Buscando en la web…";
  const shortened = stripped.length > 50 ? stripped.slice(0, 50).trim() + "…" : stripped;
  return `Buscando ${shortened}…`;
}

// ═════════════════ DEEP RESEARCH — el entregable estrella ═════════════════
// Flujo completo del "informe que excede lo esperado": el usuario pide un
// informe/investigación → sub-búsquedas → síntesis → UN bloque "deliverable"
// (hoja Stitch) con módulos, métricas y fuentes reales. El progreso que ve el
// usuario es el del pipeline REAL, no una animación.

function explicitDeliverableTopic(input: string, history?: KoruConversationMessage[]): string | null {
  const clean = input.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  // FIX: regex más estricta. Antes matcheaba "investigación" suelto y disparaba
  // deep research para "como le fue a River". Ahora requiere combinaciones explícitas.
  const hasDeliverableCue = /\b(?:informe\s+(?:sobre|de|del|acerca)|reporte\s+(?:sobre|de|del|acerca)|dossier|investigaci[oó]n\s+(?:sobre|de|del|acerca)|investig[aá]me|resumen completo|contame todo sobre|quiero saber todo sobre|explicame en profundidad|estudi[aá]me|hac[eé]\s+(?:un\s+)?informe|hac[eé]\s+(?:un\s+)?reporte)\b|an[aá]lisis\s+(?:completo|profundo|detallado|serio)/i.test(clean);
  if (!hasDeliverableCue) return null;

  const topicPatterns = [
    /(?:informe|reporte|dossier|investigaci[oó]n|an[aá]lisis)\s+(?:serio\s+|completo\s+|profundo\s+|detallado\s+)?(?:sobre|acerca de|del|de)\s+(.{3,180})/i,
    /(?:investig[aá](?:me)?|estudi[aá](?:me)?)\s+(?:todo\s+)?(?:(?:sobre|acerca de|del|de)\s+)?(.{3,180})/i,
    /(?:contame todo|quiero saber todo)\s+(?:sobre|acerca de|del|de)\s+(.{3,180})/i,
    /explicame en profundidad\s+(.{3,180})/i,
    /(?:hac[eé]\s+(?:un\s+)?(?:informe|reporte))\s+(?:sobre|acerca de|del|de)\s+(.{3,180})/i,
    /(?:hac[eé]\s+(?:un\s+)?(?:informe|reporte))\s+(?:sobre\s+)?(?:esa|ese|eso|este|esta|esto|la|el|lo|aquell[ao])\s+(.{3,180})/i,
  ];

  let topic: string | null = null;
  for (const pattern of topicPatterns) {
    const match = clean.match(pattern);
    const t = match?.[1]?.trim().replace(/[.?!]+$/g, "");
    if (t && t.length >= 3) {
      topic = t;
      break;
    }
  }
  if (!topic) {
    topic = clean.replace(/[.?!]+$/g, "");
  }

  // 🔴 FIX P2.1 — Resolución de coreferencias
  // Si el tópico tiene pronombres/demostrativos ("esa película", "ese libro", "eso"),
  // buscar en el historial reciente el sustantivo al que se refiere.
  if (history && history.length > 0 && /\b(esa|ese|eso|este|esta|esto|la|el|lo|aquell[ao])\b/i.test(topic)) {
    const resolved = resolveCoreference(topic, history);
    if (resolved) {
      topic = resolved;
    } else {
      // Si no pudimos resolver, devolver null para que caiga a clarifying_question
      // en vez de armar un informe sobre "esa película" literal.
      logger.info("explicitDeliverableTopic", "Coreference unresolved, returning null", { topic, historyLength: history.length });
      return null;
    }
  }

  return topic;
}

/**
 * 🔴 FIX P2.1 — Resuelve coreferencias como "esa película" buscando en el historial.
 *
 * Estrategia:
 * 1. Detectar el tipo de entidad (película, libro, persona, tema) por la palabra que acompaña al demostrativo.
 * 2. Buscar en los últimos 6 mensajes del historial (de atrás para adelante) la entidad concreta.
 * 3. Si se encuentra, devolver el nombre resuelto. Si no, devolver null.
 *
 * Ejemplos:
 *  - "esa película" + historial con "obsesión" → "película obsesión"
 *  - "ese libro" + historial con "cien años de soledad" → "libro cien años de soledad"
 *  - "eso" + historial con "la teoría de la relatividad" → "la teoría de la relatividad"
 */
function resolveCoreference(topic: string, history: KoruConversationMessage[]): string | null {
  // Detectar tipo de entidad
  const entityMatch = topic.match(/\b(pel[ií]cula|pel[ií]c|serie|libro|documental|juego|canci[oó]n|tema|persona|actor|actriz|autor|artista|equipo|partido|lugar|ciudad|pa[ií]s|empresa|app|producto)\b/i);
  const entityType = entityMatch?.[1]?.toLowerCase() ?? "";

  // Buscar en los últimos 6 mensajes (de atrás para adelante, omitiendo el último que es el input actual)
  const recent = history.slice(-6, -1).reverse();
  for (const msg of recent) {
    if (msg.role !== "assistant" && msg.role !== "user") continue;
    const content = (msg.content ?? "").trim();
    if (!content) continue;

    // Si detectamos tipo de entidad, buscar nombres propios o títulos relacionados
    if (entityType) {
      // Patrones para extraer nombres según el tipo de entidad
      let pattern: RegExp;
      if (/(pel[ií]cula|pel[ií]c|serie|documental)/.test(entityType)) {
        // Buscar "película X", "serie X", "X (película)", o títulos entre comillas
        pattern = /(?:pel[ií]cula|serie|documental)\s+(?:[""']([^""']+?)[""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,60}))/;
      } else if (/libro/.test(entityType)) {
        pattern = /(?:libro)\s+(?:[""']([^""']+?)[""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,60}))/;
      } else if (/(persona|actor|actriz|autor|artista)/.test(entityType)) {
        pattern = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/;
      } else {
        pattern = /([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,40})/;
      }
      const m = content.match(pattern);
      if (m) {
        const name = (m[1] ?? m[2] ?? "").trim();
        if (name && name.length >= 3) {
          return `${entityType} ${name}`;
        }
      }
    } else {
      // Sin tipo de entidad claro ("eso", "esto"), tomar el último mensaje del asistente
      // como referencia y extraer el sujeto principal
      if (msg.role === "assistant") {
        // Buscar nombres propios o frases largas
        const m = content.match(/([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ\w][\wáéíóúñ]+){0,4})/);
        if (m && m[1].length >= 4) {
          return m[1].trim();
        }
      }
    }
  }
  return null;
}

type DeliverableBlock = Extract<UiBlock, { type: "deliverable" }>;
type DeliverableSection = NonNullable<DeliverableBlock["sections"]>[number];

const DELIVERABLE_ICONS = new Set([
  "auto_awesome", "menu_book", "insights", "fact_check", "timeline", "castle",
  "groups", "strategy", "sports_soccer", "monitoring", "payments", "science",
  "public", "history_edu", "emoji_events", "lightbulb", "health_and_safety",
  "travel_explore", "psychology", "trending_up", "gavel", "eco", "movie",
  "music_note", "stadium", "rocket_launch", "school", "work", "restaurant",
]);
const DELIVERABLE_ICON_FALLBACKS = ["auto_awesome", "menu_book", "insights", "fact_check", "timeline", "category"];

function safeIcon(raw: unknown, index: number): string {
  const icon = cleanText(raw).toLowerCase().replace(/\s+/g, "_");
  if (DELIVERABLE_ICONS.has(icon)) return icon;
  if (/^[a-z][a-z0-9_]{2,30}$/.test(icon)) return icon; // nombre plausible de Material Symbol
  return DELIVERABLE_ICON_FALLBACKS[index % DELIVERABLE_ICON_FALLBACKS.length];
}

function deliverableTitleFromTopic(topic: string): string {
  const clean = topic.replace(/[.?!"]+$/g, "").trim();
  const short = clean.length > 28 ? clean.slice(0, 28).trim() + "…" : clean;
  return short.toUpperCase();
}

/** Sanea una sección generada por el LLM a la forma exacta del bloque. */
function sanitizeSection(raw: Record<string, unknown>, index: number): DeliverableSection | null {
  const title = cleanText(raw.title);
  if (!title) return null;
  const kindRaw = cleanText(raw.kind).toLowerCase();
  const kind = (["text", "bullets", "timeline", "grid", "rows"].includes(kindRaw) ? kindRaw : "text") as DeliverableSection["kind"];
  const paragraphs = asArray(raw.paragraphs).map((p) => cleanText(p)).filter(Boolean).slice(0, 4);
  const bullets = asArray(raw.bullets).map((b) => cleanText(b)).filter(Boolean).slice(0, 6);
  const items = asArray(raw.items)
    .map((it) => {
      const rec = asRecord(it);
      const itemTitle = cleanText(rec.title);
      if (!itemTitle) return null;
      return {
        title: itemTitle,
        subtitle: cleanText(rec.subtitle) || undefined,
        badge: cleanText(rec.badge) || undefined,
        icon: rec.icon ? safeIcon(rec.icon, index) : undefined,
      };
    })
    .filter((it): it is NonNullable<typeof it> => it !== null)
    .slice(0, 8);
  if (!paragraphs.length && !bullets.length && !items.length) return null;
  return {
    icon: safeIcon(raw.icon, index),
    title,
    kicker: cleanText(raw.kicker) || undefined,
    kind,
    paragraphs: paragraphs.length ? paragraphs : undefined,
    bullets: bullets.length ? bullets : undefined,
    items: items.length ? items : undefined,
  };
}

/** Informe mecánico de emergencia: si la síntesis LLM falla, igual entregamos. */
function fallbackDeliverable(topic: string, sources: AssistantSource[]): Pick<DeliverableBlock, "title" | "description" | "summary" | "categories" | "metrics" | "sections"> {
  const usable = sources
    .filter((s) => cleanText(s.title) && cleanText(s.url))
    .slice(0, 8);
  const snippets = usable
    .map((s) => cleanText(s.snippet))
    .filter(Boolean);
  const first = snippets[0] || `Reuní ${usable.length || sources.length} fuentes para ordenar el tema sin inventar datos.`;
  const second = snippets[1] || "La síntesis automática no respondió a tiempo, así que te dejo un informe mecánico trazable con las fuentes encontradas.";
  const domains = Array.from(new Set(usable.map((s) => cleanText(s.domain)).filter(Boolean))).slice(0, 6);
  const sourceItems = usable.slice(0, 6).map((s) => ({
    title: cleanText(s.title).slice(0, 90),
    subtitle: cleanText(s.snippet).slice(0, 140) || cleanText(s.domain),
    badge: cleanText(s.domain).slice(0, 18) || undefined,
  }));

  return {
    title: deliverableTitleFromTopic(topic),
    description: `Un mapa inicial sobre ${topic}, armado con fuentes reales aunque la síntesis profunda no haya respondido.`,
    summary: [first, second].join(" ").slice(0, 650),
    categories: [
      { icon: "travel_explore", label: "Hallazgos" },
      { icon: "fact_check", label: "Fuentes" },
      { icon: "insights", label: "Contexto" },
    ],
    metrics: usable.length > 0 ? [
      { value: String(usable.length), label: "Fuentes" },
      { value: String(domains.length), label: "Dominios" },
      { value: "4", label: "Secciones" },
    ] : [],
    sections: [
      {
        icon: "auto_awesome",
        title: "Síntesis rápida",
        kicker: "PANORAMA",
        kind: "text",
        paragraphs: [
          `El pedido fue armar un informe sobre ${topic}. Koru encontró fuentes reales y preparó esta versión trazable como respaldo.`,
          snippets.slice(0, 2).join(" ") || `Hay ${usable.length || sources.length} fuentes disponibles para profundizar el análisis.`,
        ],
      },
      {
        icon: "travel_explore",
        title: "Fuentes principales",
        kicker: "EVIDENCIA",
        kind: "rows",
        items: sourceItems.length ? sourceItems : [{ title: topic, subtitle: "No se pudieron resumir fuentes, pero el flujo de informe quedó armado." }],
      },
      {
        icon: "fact_check",
        title: "Lo verificable",
        kicker: "LECTURA",
        kind: "bullets",
        bullets: [
          "El informe conserva las fuentes para que cada afirmación importante pueda revisarse.",
          "Conviene priorizar dominios reconocibles y descartar páginas sin contenido legible.",
          "Si la síntesis del modelo vuelve a responder, esta misma base puede convertirse en un informe narrativo más completo.",
          "No se rellenaron cifras ni fechas que no aparezcan en las fuentes recuperadas.",
        ],
      },
      {
        icon: "insights",
        title: "Próximo paso",
        kicker: "ACCION",
        kind: "grid",
        items: [
          { title: "Profundizar", subtitle: "Cruzar las fuentes más sólidas y separar hechos de opinión." },
          { title: "Ordenar", subtitle: "Convertir los hallazgos en módulos: contexto, evolución, estado actual e implicancias." },
          { title: "Citar", subtitle: "Mantener cada dato sensible vinculado a una fuente concreta." },
        ],
      },
    ],
  };
}

function deliverableSources(sources: AssistantSource[]): AssistantSource[] {
  return sources
    .filter((s) => cleanText(s.title) && cleanText(s.url))
    .slice(0, 8)
    .map((s) => ({
      title: cleanText(s.title),
      url: cleanText(s.url),
      domain: cleanText(s.domain) || "fuente externa",
      snippet: cleanText(s.snippet) || undefined,
    }));
}

async function runDeepResearchFlow(
  topic: string,
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  preferredProvider: "minimax" | "nvidia" | "openrouter" | "bluesminds" | undefined,
  onChunk?: (chunk: KoruBackendTurnResponse) => void,
): Promise<KoruBackendTurnResponse> {
  const startedAt = Date.now();
  const userName = cleanText(request.state.userName);
  const heroTitle = deliverableTitleFromTopic(topic);
  const isOllama = isOllamaUrl(config.nvidiaBaseUrl);
  const isLargeRemoteNemotron = preferredProvider === "nvidia"
    && !isOllama
    && config.nvidiaModel.toLowerCase().includes("nemotron-3-ultra");
  const planningTimeout = isOllama ? 90_000 : isLargeRemoteNemotron ? 90_000 : 25_000;
  const synthesisTimeout = isOllama ? 120_000 : isLargeRemoteNemotron ? 120_000 : 60_000;
  logger.info("runDeepResearchFlow", "=== DEEP RESEARCH START ===", { topic });

  const baseUnderstanding = {
    literalRequest: request.input,
    userGoal: `Informe completo sobre ${topic}`,
    unstatedNeeds: [],
    assumptions: [],
    confidence: 0.85,
  };
  const emptyResponseBits = {
    suggestedActions: [] as KoruSuggestedAction[],
    memoryCandidates: [],
    commitments: [],
    records: [],
    toolResults: [] as ToolResult[],
  };

  // Progreso REAL: cada emisión corresponde a trabajo efectivamente hecho.
  const emit = (
    progress: number,
    phaseLabel: string,
    kind: "thinking" | "searching" | "comparing" | "planning",
    reply: string,
  ) => {
    onChunk?.({
      reply,
      uiBlocks: [{
        type: "deliverable" as const,
        status: "working" as const,
        kicker: "Tu Informe",
        title: heroTitle,
        topic,
        progress,
        phaseLabel,
      }],
      understanding: baseUnderstanding,
      ...emptyResponseBits,
      stateEvents: [{ kind, label: phaseLabel }],
      mascotState: "working",
      provider: "bluesminds",
      fallbackReason: "deep-research",
    });
  };

  emit(6, "Entendiendo el pedido…", "thinking", `¡Buenísimo${userName ? `, ${userName}` : ""}! Me pongo a investigar ${topic} a fondo y te armo el informe.`);

  // ── 1. Sub-búsquedas: qué hay que averiguar para que el informe EXCEDA lo pedido ──
  const researchNowIso = new Date().toISOString();
  const researchTemporal = [
    `Contexto temporal: ${formatDateLong(researchNowIso)}, ${formatTimeShort(researchNowIso)} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
    `Para "actualidad reciente" priorizá resultados del último mes. Para "datos" priorizá los más recientes verificables.`,
  ].join(" ");
  let queries: string[] = [];
  try {
    const subqResult = await callProvider(config, [
      { role: "system", content: `Sos un planificador de investigación. Respondés SOLO con JSON válido, sin texto extra. ${researchTemporal}` },
      { role: "user", content: `Tema de investigación: "${topic}". Devolvé SOLO este JSON: {"queries":["q1","q2","q3","q4"]} con 4 búsquedas web en español, cortas y distintas entre sí, que cubran: 1) qué es / panorama general, 2) historia o contexto, 3) noticias y actualidad reciente, 4) datos, cifras o análisis experto.` },
    ], planningTimeout, false, preferredProvider);
    const parsed = asRecord(JSON.parse(extractJsonBlock(cleanText(subqResult.message.content, ""))));
    queries = asArray(parsed.queries).map((q) => cleanText(q)).filter(Boolean).slice(0, 5);
  } catch (err) {
    logger.warn("runDeepResearchFlow", "Sub-query planning failed, using heuristics", { error: String(err) });
  }
  if (queries.length < 2) {
    queries = [topic, `${topic} historia`, `${topic} noticias recientes`, `${topic} datos cifras`];
  }

  // ── 2. Búsquedas web reales, con progreso por fuente ──
  const allSources: AssistantSource[] = [];
  const corpus: string[] = [];
  const seenUrls = new Set<string>();
  for (let i = 0; i < queries.length; i++) {
    emit(12 + Math.round((i / queries.length) * 43), `Buscando fuentes ${i + 1}/${queries.length}: ${queries[i].slice(0, 40)}…`, "searching", `Estoy investigando ${topic} en la web…`);
    try {
      const search = await runSearch({ query: queries[i], mode: "world" }, false);
      for (const source of search.sources) {
        if (source.url && seenUrls.has(source.url)) continue;
        if (source.url) seenUrls.add(source.url);
        allSources.push(source);
      }
      if (search.summary) corpus.push(`[Búsqueda: ${queries[i]}]\n${search.summary}`);
      corpus.push(...search.sources.map((s) => `• ${s.title} (${s.domain}): ${s.snippet ?? ""}`));
    } catch (err) {
      logger.warn("runDeepResearchFlow", "Search failed for query", { query: queries[i], error: String(err) });
    }
  }
  logger.info("runDeepResearchFlow", "Sources collected", { count: allSources.length, queries: queries.length });

  // 🔴 FIX P0 — Bug 2: Si no encontramos NINGUNA fuente, no finjamos éxito.
  // Caer a clarifying question pidiendo más contexto al usuario.
  if (allSources.length === 0) {
    logger.warn("runDeepResearchFlow", "0 sources found — aborting with clarifying question", { topic });
    return {
      reply: `No pude encontrar información sobre "${topic}". ¿Te referís a una película, libro, persona o tema específico? Si me das el nombre exacto o más contexto, lo intento de nuevo.`,
      uiBlocks: [{
        type: "clarifying_question" as const,
        question: `No encontré nada sobre "${topic}". ¿Podés darme el nombre exacto o más contexto?`,
        options: [],
      }],
      toolCalls: [],
      toolResults: [],
      turnItems: [],
      mascotState: "worried",
      energyAwarded: 0,
      provider: "bluesminds",
    } as Partial<KoruBackendTurnResponse> as KoruBackendTurnResponse;
  }

  // ── 3. Síntesis: el LLM redacta el informe estructurado ──
  emit(62, "Comparando y cruzando fuentes…", "comparing", `Encontré ${allSources.length} fuentes. Estoy cruzando los datos…`);

  let informe = fallbackDeliverable(topic, allSources);
  let provider: KoruBackendTurnResponse["provider"] = "bluesminds";
  let model: string | undefined;
  try {
    emit(78, "Redactando tu informe…", "planning", "Ya tengo todo. Estoy redactando el informe…");
    const synthesis = await callProvider(config, [
      {
        role: "system",
        content: [
          "Sos Koru, redactor de informes personales. Escribís en español rioplatense, cálido pero preciso.",
          "Tu informe debe EXCEDER lo que el usuario espera: completo, con datos concretos, bien organizado.",
          "Usá EXCLUSIVAMENTE la información de las fuentes provistas más conocimiento general verificable. NUNCA inventes cifras que no puedas respaldar.",
          "Respondés SOLO con JSON válido, sin markdown ni texto extra.",
          researchTemporal,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Armá un informe completo sobre: "${topic}".`,
          `Estructura JSON EXACTA (respetá tipos y límites):`,
          `{"title":"máx 28 caracteres, será el título de la tarjeta","description":"1-2 líneas que enganchen","summary":"párrafo de síntesis de 60-90 palabras","categories":[{"icon":"nombre_material_symbol","label":"máx 14 chars"} x3],"metrics":[{"value":"dato corto REAL de las fuentes (año, cifra, cantidad)","label":"qué es"} x3],"sections":[{"icon":"nombre_material_symbol","kicker":"subtítulo corto en mayúsculas","title":"título del módulo","kind":"text|bullets|timeline|grid|rows","paragraphs":["solo si kind=text"],"bullets":["solo si kind=bullets"],"items":[{"title":"...","subtitle":"...","badge":"opcional corto"}]} x4-5]}`,
          `Guía de sections: 1º una síntesis (kind text), después historia/contexto (timeline con items título=año o hito), después el desarrollo del tema (grid o rows), después actualidad/noticias (bullets o rows). Variá los kinds.`,
          ``,
          `FUENTES (${allSources.length}):`,
          corpus.join("\n").slice(0, 9000),
        ].join("\n"),
      },
    ], synthesisTimeout, false, preferredProvider);
    provider = synthesis.provider;
    model = synthesis.model;
    const parsed = asRecord(JSON.parse(extractJsonBlock(cleanText(synthesis.message.content, ""))));
    const sections = asArray(parsed.sections)
      .map((s, i) => sanitizeSection(asRecord(s), i))
      .filter((s): s is DeliverableSection => s !== null)
      .slice(0, 6);
    if (sections.length) {
      informe = {
        title: cleanText(parsed.title) ? deliverableTitleFromTopic(cleanText(parsed.title)) : heroTitle,
        description: cleanText(parsed.description) || informe.description,
        summary: cleanText(parsed.summary) || informe.summary,
        categories: asArray(parsed.categories)
          .map((c, i) => {
            const rec = asRecord(c);
            const label = cleanText(rec.label);
            return label ? { icon: safeIcon(rec.icon, i), label: label.slice(0, 16) } : null;
          })
          .filter((c): c is { icon: string; label: string } => c !== null)
          .slice(0, 3),
        metrics: asArray(parsed.metrics)
          .map((m) => {
            const rec = asRecord(m);
            const value = cleanText(rec.value);
            const label = cleanText(rec.label);
            return value && label ? { value: value.slice(0, 12), label: label.slice(0, 18) } : null;
          })
          .filter((m): m is { value: string; label: string } => m !== null)
          .slice(0, 3),
        sections,
      };
    }
  } catch (err) {
    logger.warn("runDeepResearchFlow", "Synthesis failed, delivering fallback informe", { error: String(err) });
  }

  const deliverable: DeliverableBlock = {
    type: "deliverable",
    status: "ready",
    kicker: "Tu Informe",
    topic,
    progress: 100,
    ...informe,
    categories: informe.categories?.length ? informe.categories : fallbackDeliverable(topic, allSources).categories,
    sources: deliverableSources(allSources),
  };

  logger.info("runDeepResearchFlow", "=== DEEP RESEARCH DONE ===", {
    topic,
    sources: allSources.length,
    sections: deliverable.sections?.length ?? 0,
    durationMs: Date.now() - startedAt,
    provider,
  });

  return {
    reply: `¡Listo${userName ? `, ${userName}` : ""}! 🌿 Tu informe sobre ${topic} está terminado. Lo investigué en ${allSources.length} fuentes.`,
    uiBlocks: [deliverable],
    understanding: baseUnderstanding,
    ...emptyResponseBits,
    memoryCandidates: [{
      kind: "preference",
      text: `Le interesa ${topic} (pidió un informe el ${new Date().toISOString().slice(0, 10)}).`,
      confidence: 0.6,
      sensitivity: "normal",
      status: "candidate",
    }],
    stateEvents: [{ kind: "done", label: "Informe entregado" }],
    mascotState: "celebrating",
    provider,
    model,
    fallbackReason: "deep-research",
  };
}

/**
 * 🔴 FIX P2 — Resuelve follow-ups cortos reescribiendo el input.
 *
 * Cuando el usuario hace preguntas de seguimiento muy cortas como:
 *   - "y ayer?"
 *   - "y mañana?"
 *   - "y la anterior?"
 *   - "y el otro?"
 *   - "y el sábado?"
 *
 * Y hay contexto reciente en el historial sobre un tema específico (equipo de
 * fútbol, película, libro, etc.), reescribe el input para que el LLM y el router
 * tengan toda la info necesaria para ejecutar la tool correcta.
 *
 * Ejemplos:
 *  - Historial: "como salio hoy Argentina?" + "y ayer?"
 *    → "como salio Argentina ayer?"
 *  - Historial: "que se dice de la pelicula obsesion?" + "y la anterior?"
 *    → "que se dice de la pelicula anterior a obsesion?"
 *  - Historial: "receta de carbonara" + "y con pollo?"
 *    → "receta de carbonara con pollo"
 *
 * Si no puede resolver, devuelve el input original sin cambios.
 */
function resolveFollowUpInput(input: string, history: KoruConversationMessage[]): string {
  const trimmed = input.trim().toLowerCase();

  // Patrones de follow-up que necesitan contexto
  const followUpPatterns = [
    /^y\s+(ayer|mañana|manana|anteayer|pasado mañana|pasado manana|el otro|el sabado|el sabado pasado|el domingo|el lunes|el martes|el miercoles|el jueves|el viernes)\??$/i,
    /^y\s+(la anterior|el anterior|la proxima|el proximo|el ultimo|la ultima)\??$/i,
    /^y\s+(con|de|para|sin)\s+(.{1,40})\??$/i,
    /^(como le fue|como le va|como salio|como salio|que tal)\s+(ayer|anteayer|el sabado|el domingo)\??$/i,
  ];

  const isFollowUp = followUpPatterns.some(p => p.test(trimmed));
  if (!isFollowUp) return input;

  // Buscar en los últimos 6 mensajes el tema principal
  const recent = history.slice(-6).reverse();
  let team: string | null = null;
  let movie: string | null = null;
  let recipe: string | null = null;
  let book: string | null = null;
  let lastUserMessage: string | null = null;

  for (const msg of recent) {
    if (msg.role !== "user") continue;
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    if (!lastUserMessage) lastUserMessage = content;

    // Detectar equipo de fútbol / selección
    if (!team) {
      // Buscar menciones de equipos/selecciones conocidas
      const teamMatch = content.match(/\b(argentina|espana|españa|brasil|francia|alemania|inglaterra|italia|portugal|holanda|belgica|bélgica|uruguay|chile|colombia|mexico|méxico|peru|perú|ecuador|paraguay|boca|river|real madrid|barcelona|barca|atletico madrid|atlético madrid|liverpool|manchester city|manchester united|chelsea|arsenal|tottenham|juventus|inter|milan|ac milan|bayern munich|dortmund|psg|napoli|roma|lazio|sevilla|valencia|villarreal|real sociedad|betis|athletic bilbao)\b/i);
      if (teamMatch) team = teamMatch[1];
    }

    // Detectar película
    if (!movie) {
      const movieMatch = content.match(/(?:pelicula|película|serie|documental)\s+(?:["""']([^"""']+?)["""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,40}))/i);
      if (movieMatch) movie = movieMatch[1] ?? movieMatch[2];
    }

    // Detectar receta
    if (!recipe) {
      const recipeMatch = content.match(/(?:receta|comida|plato|preparar|hacer|cocinar)\s+(?:de\s+|un\s+|una\s+)?([^?.,]{3,40})/i);
      if (recipeMatch) recipe = recipeMatch[1].trim();
    }

    // Detectar libro
    if (!book) {
      const bookMatch = content.match(/(?:libro|novela)\s+(?:["""']([^"""']+?)["""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,40}))/i);
      if (bookMatch) book = bookMatch[1] ?? bookMatch[2];
    }
  }

  // Reescribir el input según el tema detectado
  // Si el follow-up es temporal ("y ayer?", "y mañana?") y hay un equipo
  if (/^(y\s+)?(ayer|mañana|manana|anteayer|pasado)/i.test(trimmed)) {
    if (team) {
      // Extraer la palabra temporal
      const temporalMatch = trimmed.match(/(ayer|mañana|manana|anteayer|pasado mañana|pasado manana)/i);
      const temporal = temporalMatch?.[1] ?? "ayer";
      return `como salio ${team} ${temporal}?`;
    }
    if (movie) {
      // "y ayer?" después de película → no tiene sentido temporal, pero quizás quiere info adicional
      return `informacion sobre la pelicula ${movie}`;
    }
  }

  // "y la anterior?" / "y el anterior?"
  if (/^(y\s+)?(la|el)\s+(anterior|ultimo|ultima|proxima|proximo)/i.test(trimmed)) {
    if (movie) return `pelicula anterior a ${movie}`;
    if (book) return `libro anterior a ${book}`;
    if (team) return `partido anterior de ${team}`;
  }

  // "y con X?" / "y de X?" — variaciones
  // Si el contexto es película, buscar info de esa película
  // Si el contexto es receta, variar la receta
  // Si el contexto es libro, buscar info de ese libro
  if (/^y\s+(con|de|para|sin)\s+/i.test(trimmed)) {
    const variation = input.trim().replace(/^y\s+/i, "").replace(/[?!.]$/, "");
    // Extraer el término después de "de/con/para/sin"
    const termMatch = variation.match(/(?:de|con|para|sin)\s+(.+)/i);
    const term = termMatch?.[1]?.trim() ?? variation;

    if (movie) {
      // "y de odyssey?" después de hablar de obsesion → buscar película odyssey
      return `que se dice de la pelicula ${term}?`;
    }
    if (book) {
      return `informacion del libro ${term}`;
    }
    if (recipe) {
      return `receta de ${recipe} ${variation}`;
    }
    // Si no hay contexto previo pero el término parece una película/título,
    // asumir que es una nueva consulta de película
    if (term.length >= 2) {
      return `que se dice de la pelicula ${term}?`;
    }
  }

  // No pudimos resolver — devolver original
  return input;
}

/**
 * 🔴 FIX UX: Devuelve el kicker específico para cada categoría del fast-path.
 * El kicker se usa en el WorkingPanel para mostrar chips de progreso dinámicos
 * que tienen relación con la tarea (ej: "Identificando la película" vs "Buscando fuentes").
 */
function fastPathKickerForCategory(category: RouteCategory): string {
  const kickerMap: Record<string, string> = {
    sports: "Tu Partido",
    weather: "Tu Clima",
    food: "Tu Receta",
    media: "Tu Reseña",
    knowledge: "Tu Consulta",
    world_info: "Tu Búsqueda",
    review: "Tu Análisis",
    shopping: "Tu Comparativa",
    market: "Tu Cotización",
    travel: "Tu Viaje",
    research: "Tu Informe",
    planning: "Tu Plan",
    action: "Tu Recordatorio",
  };
  return kickerMap[category] ?? "Tu Consulta";
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
  let provider: "nvidia" | "openrouter" | "minimax" | "bluesminds" = "nvidia";
  let model: string | undefined;
  let fallbackReason: string | undefined;

  // 🔴 FIX MACRO: timeouts reducidos para evitar que el usuario espere demasiado.
  // Si la tool falla, el fallback a web_search es rápido.
  // Si el LLM tarda más de 60s, algo está mal — mejor fallback.
  const isOllama = isOllamaUrl(config.nvidiaBaseUrl);
  const isLargeRemoteNemotron = preferredProvider === "nvidia"
    && !isOllama
    && config.nvidiaModel.toLowerCase().includes("nemotron-3-ultra");
  // 🔴 KORU 2.0: timeouts aumentados — el LLM ahora maneja TODO (sin fast-path)
  // Necesita mas tiempo porque decide que tool llamar, calcula dueAt, etc.
  const firstTimeout = isOllama ? 90_000 : isLargeRemoteNemotron ? 60_000 : 45_000;
  const secondaryTimeout = isOllama ? 120_000 : isLargeRemoteNemotron ? 90_000 : 60_000;
  const extractorTimeout = isOllama ? 90_000 : isLargeRemoteNemotron ? 45_000 : 30_000;

  let routeCategory: RouteCategory | undefined;

  // ── Semantic Router: decidir intención ANTES de llamar al LLM ──
  // Si el router detecta que se necesita una tool, la ejecutamos directamente.
  // Esto elimina la dependencia de que el modelo llame tools nativamente
  // (que vimos fallar ~50% de las veces). Si el router dice "conversation"
  // o no está disponible, cae al flujo nativo de abajo.
  // El router corre para cualquier mensaje con contenido (no vacío / no solo
  // saludo de una palabra). El gate NO usa isTrivialInput porque esa función
  // matchea prefijos ("hola ...") y haría saltar mensajes reales de búsqueda.

  // 🔴 FIX P2 — Pre-resolución de follow-ups cortos (Bug "y ayer?"):
  // Si el input es un follow-up muy corto ("y ayer?", "y mañana?", "y la anterior?")
  // Y hay contexto reciente en el historial, reescribir el input para que el LLM
  // y el router tengan toda la info necesaria. Esto es determinístico, no depende
  // de que el LLM "interprete" el contexto.
  const resolvedInput = resolveFollowUpInput(request.input, request.history);
  if (resolvedInput !== request.input) {
    logger.info("runKoruBackendTurn", "Follow-up resolved", {
      original: request.input,
      resolved: resolvedInput,
    });
    request = { ...request, input: resolvedInput };
  }
  const inputTrimmed = request.input.trim();
  // Fase 4.1: declarar modelOverride temprano para que esté disponible en
  // todas las callProvider calls (incluida la del router autofire ~4108).
  // CRÍTICO: si el usuario seleccionó un modelo explícito (request.model),
  // respetarlo SIEMPRE. El model router (flash/medium/ultra) solo aplica
  // cuando el usuario dejó "Automático". Antes, selectModelForInput pisaba
  // la selección del usuario silenciosamente (ej. elegía Nemotron Ultra pero
  // "hola" iba a step-3.5-flash igual).
  const trivial = isTrivialInput(inputTrimmed);
  const modelOverride = request.model
    ? request.model  // usuario eligió explícitamente — respetar
    : selectModelForInput(inputTrimmed, config, trivial, false);  // Automático — router decide
  const deliverableTopic = explicitDeliverableTopic(inputTrimmed, request.history);
  if (deliverableTopic) {
    logger.info("runKoruBackendTurn", "Explicit deliverable request detected", { topic: deliverableTopic });
    return await runDeepResearchFlow(deliverableTopic, request, config, preferredProvider, onChunk);
  }
  // OPTIMIZACIÓN: para inputs triviales (hola, gracias, etc), saltar el
  // Semantic Router y el memory extractor. Solo hacer 1 llamada al LLM
  // sin tools, parsear el JSON y responder. Esto reduce el tiempo de
  // 30-40s a 5-10s para saludos y despedidas.
  if (trivial) {
    logger.info("runKoruBackendTurn", "Trivial input — fast path (skip router + memory extractor)");
    const fastResult = await callProvider(config, messages, 30_000, false, preferredProvider, undefined, modelOverride);
    provider = fastResult.provider;
    model = fastResult.model;
    const fastContent = cleanText(fastResult.message.content, "");
    let fastParsed: any;
    try {
      fastParsed = JSON.parse(extractJsonBlock(fastContent));
    } catch {
      fastParsed = { reply: cleanReplyText(fastContent) || "Hola. ¿Cómo va todo?", mascotState: "happy" };
    }
    const fastResponse = normalizeFinalPayload(fastParsed, request.input, []);
    logger.info("runKoruBackendTurn", "Return fast-path", { replyPreview: (fastResponse.reply ?? "").slice(0, 60), provider, model });
    return {
      ...fastResponse,
      provider,
      model,
      fallbackReason: "trivial-fast-path",
      mascotState: fastParsed.mascotState ?? "happy",
    };
  }

  if (inputTrimmed.length >= 3) {
    // 🔴 KORU 2.0: el fast-path de regex se ELIMINÓ COMPLETAMENTE.
    // El LLM con tool-calling nativo es infinitamente más flexible que cualquier regex.
    // Entiende cualquier idioma, cualquier forma de hablar, cualquier phrasing.
    // El LLM recibe TODAS las tools y decide qué hacer.
    //
    // Si el LLM falla (timeout, texto plano), el sistema tiene fallbacks:
    // - Plain text recovery (usa el texto del LLM como reply)
    // - replyFromBlocks (genera reply desde los tool blocks)
    // - Synth commitment (si el LLM dice "guardado" sin crear commitment)
    //
    // El único caso donde se mantiene routing específico es deep_research (informes)
    // porque tiene su propio pipeline multi-step.
    // El fast-path está completamente eliminado. Todo pasa al LLM con tool-calling nativo.
    // 🔴 FIX DUPLICACIÓN: si el fast-path ya ejecutó tools, NO caer al router.
    // Sintetizar directamente con UN SOLO LLM call (no dos).
    if (toolExecutions.length > 0) {
      logger.info("runKoruBackendTurn", "Fast-path executed tools, skipping semantic router", {
        toolCount: toolExecutions.length,
      });

      // 🔴 FIX MACRO: CERO LLM calls para el fast-path skip-router.
      // Armar el deliverable directamente desde los tool results.
      // El reply se genera con replyFromBlocks (mecánico pero rápido).
      // Esto elimina los timeouts causados por múltiples LLM calls.
      const fastConfig = { ...config, nvidiaModel: config.nvidiaModel };
      const toolBlocks = blocksFromToolResults(toolExecutions);
      const blockReply = replyFromBlocks(toolBlocks, request.input);
      const taskKicker = fastPathKickerForCategory(routeCategory ?? "conversation");
      const effectiveReply = blockReply || `Te dejé ${taskKicker.toLowerCase()} en la tarjeta.`;

      // Memory extractor (no bloqueante — corre en paralelo si hay tiempo)
      let response: KoruBackendTurnResponse;
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, fastConfig, toolExecutions, { reply: effectiveReply, uiBlocks: [] }, 15_000);
        response = normalizeFinalPayload({ reply: effectiveReply, mascotState: "happy", uiBlocks: [] }, request.input, toolExecutions, extracted.raw);
      } catch {
        response = normalizeFinalPayload({ reply: effectiveReply, mascotState: "happy", uiBlocks: [] }, request.input, toolExecutions);
      }

      return { ...response, provider, model, fallbackReason: "fastpath-skip-router" };
    }

    // Si el fast-path no matcheó, caer al router semántico (que requiere embeddings)
    // 🔴 KIMI v6 — Fallback léxico para keywords obvias que el router semántico
    // puede no capturar con confianza ≥0.65. Esto garantiza que crypto, restaurant,
    // news y tennis deriven a sus tools específicas.
    const lexicalRoute = lexicalRouteForInput(request.input);
    if (lexicalRoute) {
      // Override léxico — saltar el router semántico y usar la tool específica
      routeCategory = lexicalRoute.category;
      logger.info("runKoruBackendTurn", "Lexical route override", {
        category: lexicalRoute.category,
        tool: lexicalRoute.tool ?? "none",
        reason: "keyword match",
      });
      // Crear syntheticToolCall para el flujo del router
      const syntheticToolCall: ProviderToolCall = {
        id: `route_lexical_${Date.now()}`,
        type: "function",
        function: { name: lexicalRoute.tool!, arguments: JSON.stringify(lexicalRoute.toolArgs ?? {}) },
      };
      // Ejecutar la tool directamente
      const query = lexicalRoute.toolArgs?.query as string | undefined;
      const shortSearchLabel = query ? searchLabelFromInput(query) : "Buscando en la web";
      onChunk?.({
        reply: shortSearchLabel,
        uiBlocks: [{ type: "deliverable" as const, status: "working" as const, kicker: "Tu Búsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
        suggestedActions: [],
        understanding: { literalRequest: request.input, userGoal: lexicalRoute.category, unstatedNeeds: [], assumptions: [], confidence: 0.9 },
        memoryCandidates: [], commitments: [], records: [], toolResults: [],
        stateEvents: [{ kind: "searching" as const, label: shortSearchLabel }],
        mascotState: "working",
        provider, model, fallbackReason: "lexical-" + lexicalRoute.category,
      });
      messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
      await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config);

      // 🔴 KIMI v7 — Fallback a web_search si la tool falló (igual que el router path)
      if (toolExecutions.length > 0) {
        const lastResult = toolExecutions[toolExecutions.length - 1]?.result as any;
        const toolFailed = lastResult?.status === "no_data" || lastResult?.status === "failed";
        if (toolFailed && lexicalRoute.tool !== "web_search") {
          logger.info("runKoruBackendTurn", "Lexical tool failed, falling back to web_search", {
            failedTool: lexicalRoute.tool, status: lastResult?.status,
          });
          const fallbackQuery = lexicalRoute.toolArgs?.query || request.input;
          const fallbackToolCall: ProviderToolCall = {
            id: `lexical_fallback_${Date.now()}`,
            type: "function",
            function: { name: "web_search", arguments: JSON.stringify({ query: fallbackQuery, mode: "research" }) },
          };
          messages.push({ role: "assistant", content: "", tool_calls: [fallbackToolCall] });
          await executeProviderToolCalls([fallbackToolCall], messages, request, toolExecutions, config);
          const failedIdx = toolExecutions.findIndex(e => (e.result as any)?.status === "no_data" || (e.result as any)?.status === "failed");
          if (failedIdx >= 0) toolExecutions.splice(failedIdx, 1);
        }
      }

      // Síntesis con Fast Model
      const synthConfigLex = { ...config, nvidiaModel: config.nvidiaFastModel || "meta/llama-3.1-8b-instruct" };
      const synthMessagesLex = buildMessages(request);
      for (const exec of toolExecutions) {
        synthMessagesLex.push({
          role: "assistant",
          content: "",
          tool_calls: [{ id: exec.id || `call_${Date.now()}`, type: "function", function: { name: exec.name, arguments: "{}" } }],
        });
        synthMessagesLex.push({
          role: "tool",
          content: JSON.stringify(exec.result).slice(0, 3000),
          tool_call_id: exec.id || `call_${Date.now()}`,
        });
      }
      synthMessagesLex.push({
        role: "user",
        content: [
          "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks.",
          "Respondé SOLO con este JSON:",
          '{"reply":"1-2 lineas cortas","mascotState":"happy","summary":"sintesis de 60-120 palabras con datos concretos","sections":[{"title":"Sintesis","kind":"text","paragraphs":["texto redactado"]},{"title":"Datos clave","kind":"bullets","bullets":["dato 1","dato 2"]}]}',
          "Reglas:",
          "- reply: SOLO enmarca. Ej: 'Te dejé el detalle en la tarjeta.'",
          "- summary: REDACTA una sintesis con datos concretos (nombres, cifras, fechas). NO copies snippets.",
          "- sections: arma 2-3 secciones. kind puede ser 'text' (con paragraphs) o 'bullets' (con bullets).",
          "- NO inventes datos que no esten en las tools.",
        ].join("\n"),
      });
      let lexReply = "";
      let lexMascot = "happy";
      let lexSummary = "";
      let lexSections: any[] = [];
      try {
        const synthResultLex = await callProvider(synthConfigLex, synthMessagesLex, 30_000, false, undefined, undefined, synthConfigLex.nvidiaModel);
        const synthContentLex = cleanText(synthResultLex.message.content, "");
        const synthParsedLex = safeJsonObjectFromContent(synthContentLex);
        lexReply = cleanReplyText((synthParsedLex as Record<string, unknown>).reply as string || "");
        lexMascot = ((synthParsedLex as Record<string, unknown>).mascotState as string) || "happy";
        lexSummary = ((synthParsedLex as Record<string, unknown>).summary as string) || "";
        lexSections = asArray((synthParsedLex as Record<string, unknown>).sections);
      } catch { /* fallback */ }
      const lexEffectiveSummary = lexSummary || (lexReply.length > 20 ? lexReply : "");
      const lexResponse = await finalizePayloadWithFastModel(
        request, synthConfigLex,
        { reply: lexReply, mascotState: lexMascot, uiBlocks: [] } as Record<string, unknown>,
        toolExecutions, 30_000,
      );
      if (lexResponse.uiBlocks) {
        for (const block of lexResponse.uiBlocks) {
          if (block.type === "deliverable" && lexEffectiveSummary && lexEffectiveSummary.length > 20) {
            block.summary = lexEffectiveSummary;
            const synthSection = (block.sections ?? []).find((s: any) => s.title === "Síntesis");
            if (synthSection && synthSection.kind === "text") {
              synthSection.paragraphs = [lexEffectiveSummary];
            }
          }
          if (block.type === "deliverable" && lexSections.length > 0) {
            const sourceSection = (block.sections ?? []).find((s: any) => s.title === "Fuentes");
            block.sections = lexSections;
            if (sourceSection) block.sections.push(sourceSection);
          }
        }
      }
      return { ...lexResponse, provider, model, fallbackReason: "lexical-" + lexicalRoute.category };
    }

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
        // web_search es la tool mas generica del router (world_info agarra
        // de todo). Es la que mas dispara "buscando en la web" de mas —
        // le pedimos confianza extra por encima del umbral base del router
        // antes de auto-disparar. Si no llega, cae al flujo nativo: el
        // modelo decide libremente si de verdad necesita buscar.
        const WEB_SEARCH_AUTOFIRE_CONFIDENCE = 0.78;
        const shouldAutofire = route.tool !== "web_search" || route.confidence >= WEB_SEARCH_AUTOFIRE_CONFIDENCE;
        if (route.tool && !shouldAutofire) {
          logger.info("runKoruBackendTurn", "web_search bajo el umbral extra, cae a flujo nativo", {
            confidence: route.confidence.toFixed(2),
            required: WEB_SEARCH_AUTOFIRE_CONFIDENCE,
          });
        }
        // deep_research tiene su propio pipeline (sub-búsquedas → síntesis →
        // entregable). No pasa por executeTool: es un FLUJO, no una tool suelta.
        if (route.tool === "deep_research") {
          const topic = cleanText(route.toolArgs?.topic) || cleanText(route.toolArgs?.query) || inputTrimmed;
          return await runDeepResearchFlow(topic, request, config, preferredProvider, onChunk);
        }
        if (route.tool && shouldAutofire) {
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
            uiBlocks: [{ type: "deliverable" as const, status: "working" as const, kicker: "Tu Búsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
            suggestedActions: [],
            understanding: { literalRequest: request.input, userGoal: route.category, unstatedNeeds: [], assumptions: [], confidence: route.confidence },
            memoryCandidates: [], commitments: [], records: [], toolResults: [],
            stateEvents: [{ kind: "searching" as const, label: shortSearchLabel }],
            mascotState: "working",
            provider, model, fallbackReason: "router-" + route.category,
          });
          messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
          const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config);

          // 🔴 FIX CRÍTICO: si la tool del router devolvió no_data/failed (ej: recipe_find
          // no encontró recetas), hacer fallback automático a web_search ANTES de intentar
          // sintetizar. Sin esto, el usuario ve "Tuve un problema para armar la respuesta".
          if (delivered && toolExecutions.length > 0) {
            const lastResult = toolExecutions[toolExecutions.length - 1]?.result as any;
            const toolFailed = lastResult?.status === "no_data" || lastResult?.status === "failed";
            const isLocalAction = ["reminder_set", "alarm_set", "countdown", "save_personal_item", "save_memory", "plan_day", "query_personal_context"].includes(route.tool ?? "");
            if (toolFailed && !isLocalAction && route.tool !== "web_search") {
              logger.info("runKoruBackendTurn", "Router tool failed, falling back to web_search", {
                failedTool: route.tool, status: lastResult?.status,
              });
              const fallbackQuery = route.toolArgs?.query || route.toolArgs?.title || request.input;
              const fallbackToolCall: ProviderToolCall = {
                id: `router_fallback_${Date.now()}`,
                type: "function",
                function: { name: "web_search", arguments: JSON.stringify({ query: fallbackQuery, mode: "research" }) },
              };
              messages.push({ role: "assistant", content: "", tool_calls: [fallbackToolCall] });
              await executeProviderToolCalls([fallbackToolCall], messages, request, toolExecutions, config);
              // Limpiar la tool fallida de toolExecutions
              const failedIdx = toolExecutions.findIndex(e => (e.result as any)?.status === "no_data" || (e.result as any)?.status === "failed");
              if (failedIdx >= 0) toolExecutions.splice(failedIdx, 1);
            }
          }

          if (delivered) {
            // 🔴 FIX: hacer síntesis LLM con el modelo principal (no flash) para generar
            // summary redactado + sections estructuradas en el deliverable.
            const synthConfig2 = { ...config, nvidiaModel: config.nvidiaModel };
            const synthMessages2 = buildMessages(request);
            for (const exec of toolExecutions) {
              synthMessages2.push({
                role: "assistant",
                content: "",
                tool_calls: [{
                  id: exec.id || `call_${Date.now()}`,
                  type: "function",
                  function: { name: exec.name, arguments: "{}" },
                }],
              });
              synthMessages2.push({
                role: "tool",
                content: JSON.stringify(exec.result).slice(0, 3000),
                tool_call_id: exec.id || `call_${Date.now()}`,
              });
            }
            synthMessages2.push({
              role: "user",
              content: [
                "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks.",
                "Respondé SOLO con este JSON:",
                '{"reply":"1-2 lineas cortas","mascotState":"happy","summary":"sintesis de 60-120 palabras con datos concretos","sections":[{"title":"Sintesis","kind":"text","paragraphs":["texto redactado"]},{"title":"Datos clave","kind":"bullets","bullets":["dato 1","dato 2"]}]}',
                "Reglas:",
                "- reply: SOLO enmarca. Ej: 'Te dejé el detalle en la tarjeta.'",
                "- summary: REDACTA una sintesis con datos concretos (nombres, cifras, fechas). NO copies snippets.",
                "- sections: arma 2-3 secciones. kind puede ser 'text' (con paragraphs) o 'bullets' (con bullets).",
                "- NO inventes datos que no esten en las tools.",
              ].join("\n"),
            });

            let routerSynthReply = "";
            let routerSynthMascot = "happy";
            let routerSynthSummary = "";
            let routerSynthSections: any[] = [];
            try {
              const synthResult2 = await callProvider(synthConfig2, synthMessages2, 30_000, false, undefined, undefined, synthConfig2.nvidiaModel);
              const synthContent2 = cleanText(synthResult2.message.content, "");
              const synthParsed2 = safeJsonObjectFromContent(synthContent2);
              routerSynthReply = cleanReplyText(synthParsed2.reply || "");
              routerSynthMascot = cleanText(synthParsed2.mascotState) || "happy";
              routerSynthSummary = cleanText(synthParsed2.summary || "");
              const rawSections2 = Array.isArray(synthParsed2.sections) ? synthParsed2.sections : [];
              routerSynthSections = rawSections2.map((s: any, i: number) => ({
                icon: i === 0 ? "auto_awesome" : i === 1 ? "fact_check" : "insights",
                title: cleanText(s.title) || `Sección ${i + 1}`,
                kicker: i === 0 ? "LO ESENCIAL" : i === 1 ? "DATOS" : "CONTEXTO",
                kind: s.kind === "bullets" ? "bullets" : "text",
                paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map((p: any) => String(p)) : undefined,
                bullets: Array.isArray(s.bullets) ? s.bullets.map((b: any) => String(b)) : undefined,
              })).filter((s: any) => s.paragraphs?.length || s.bullets?.length);
            } catch (err: any) {
              logger.warn("runKoruBackendTurn", "Router synth LLM call failed", { error: err?.message });
            }
            logger.info("runKoruBackendTurn", "Router synth result", {
              hasReply: !!routerSynthReply,
              replyLen: routerSynthReply.length,
              hasSummary: !!routerSynthSummary,
              summaryLen: routerSynthSummary.length,
              sectionsCount: routerSynthSections.length,
              effectiveSummaryLen: (routerSynthSummary || (routerSynthReply.length > 20 ? routerSynthReply : "")).length,
            });

            // 🔴 FIX: calcular effectiveSummary2 ANTES de finalizePayloadWithFastModel
            // pero aplicar SOLO DESPUÉS a response.uiBlocks
            // Fallback: si ni summary ni reply del LLM funcionan, usar el reply final de response
            let effectiveSummary2 = routerSynthSummary || (routerSynthReply.length > 20 ? routerSynthReply : "");

            const response = await finalizePayloadWithFastModel(
              request, synthConfig2,
              { reply: routerSynthReply, mascotState: routerSynthMascot, uiBlocks: [] } as Record<string, unknown>,
              toolExecutions, 30_000,
            );

            // 🔴 APLICAR SÍNTESIS AQUÍ — directamente sobre response.uiBlocks
            // Fallback: usar response.reply (que viene de finalizePayloadWithFastModel's LLM call)
            // como summary si el synth call falló. Pero usar el reply ANTES del trimming.
            // Como no tenemos acceso al reply pre-trimming aquí, usar response.reply si es >60 chars.
            if (!effectiveSummary2 || effectiveSummary2.length < 20) {
              // response.reply ya fue trimmed, pero si tiene >60 chars es útil
              if (response.reply && response.reply.length > 60) {
                effectiveSummary2 = response.reply;
              } else {
                // Último recurso: no aplicar enriquecimiento, dejar el synthesisText legible
                effectiveSummary2 = "";
              }
            }
            logger.info("runKoruBackendTurn", "Router effectiveSummary2 final", {
              len: effectiveSummary2.length,
              preview: effectiveSummary2.slice(0, 100),
            });
            if (response.uiBlocks) {
              for (const block of response.uiBlocks) {
                if (block.type === "deliverable") {
                  if (effectiveSummary2 && effectiveSummary2.length > 20) {
                    logger.info("runKoruBackendTurn", "APPLYING effectiveSummary2 to deliverable", {
                      summaryLen: effectiveSummary2.length,
                      summaryPreview: effectiveSummary2.slice(0, 80),
                    });
                    block.summary = effectiveSummary2;
                    const synthSection = (block.sections ?? []).find((s: any) => s.title === "Síntesis");
                    if (synthSection && synthSection.kind === "text") {
                      synthSection.paragraphs = [effectiveSummary2];
                    }
                  }
                  if (routerSynthSections.length > 0) {
                    const sourceSection = (block.sections ?? []).find((s: any) => s.title === "Fuentes");
                    block.sections = routerSynthSections;
                    if (sourceSection) block.sections.push(sourceSection);
                    block.metrics = [
                      { value: String((block.sources ?? []).length), label: "Fuentes" },
                      { value: String(routerSynthSections.length), label: "Secciones" },
                    ];
                  }
                }
              }
            }
            return { ...response, provider, model, fallbackReason: "router-" + route.category };
          }
          messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
          // OPTIMIZACIÓN: usar Flash para la segunda llamada (síntesis de respuesta)
          const fastConfig2 = { ...config, nvidiaModel: config.nvidiaFastModel || "meta/llama-3.1-8b-instruct" };
          const secondResult = await callProvider(fastConfig2, messages, 30_000, false, "nvidia", undefined, fastConfig2.nvidiaModel);
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
            // 🔴 Aplicar enriquecimiento también aquí (camino 2: delivered=false, JSON inválido)
            if (response.uiBlocks) {
              for (const block of response.uiBlocks) {
                if (block.type === "deliverable") {
                  const replyForSummary = cleanText(rawFallback.reply) || response.reply || "";
                  if (replyForSummary && replyForSummary.length > 20) {
                    block.summary = replyForSummary;
                    const synthSection = (block.sections ?? []).find((s: any) => s.title === "Síntesis");
                    if (synthSection && synthSection.kind === "text") {
                      synthSection.paragraphs = [replyForSummary];
                    }
                  }
                }
              }
            }
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
          const response2 = normalizeFinalPayload(rawRoute, request.input, toolExecutions);
          // 🔴 Aplicar enriquecimiento también aquí (camino 3: delivered=false, JSON válido)
          if (response2.uiBlocks) {
            for (const block of response2.uiBlocks) {
              if (block.type === "deliverable") {
                const replyForSummary = cleanText(rawRoute.reply) || response2.reply || "";
                if (replyForSummary && replyForSummary.length > 20) {
                  block.summary = replyForSummary;
                  const synthSection = (block.sections ?? []).find((s: any) => s.title === "Síntesis");
                  if (synthSection && synthSection.kind === "text") {
                    synthSection.paragraphs = [replyForSummary];
                  }
                }
              }
            }
          }
          return { ...response2, provider, model, fallbackReason: "router-" + route.category };
        }
      } catch (err: any) {
        logger.warn("runKoruBackendTurn", "Semantic Router failed (non-fatal, falling to native)", { reason: err?.message });
      }
    }
  }

  // 🔴 KORU 2.0: pasar TODAS las tools al LLM siempre.
  // El LLM decide qué tool llamar. No filtramos por categoría.
  // Esto elimina el problema de "el router clasificó mal y el LLM no vio la tool correcta".
  const filteredTools = undefined; // undefined = pasar todas las tools

  // Fase 4.1: modelOverride ya declarado arriba (antes del router autofire)

  // Paso 1: una sola llamada al LLM con tools habilitadas (excepto Ollama, que usa native JSON)
  let firstResult: ProviderResult & { fallbackReason?: string };
  try {
    firstResult = await callProvider(config, messages, firstTimeout, !trivial, preferredProvider, filteredTools, modelOverride);
  } catch (err: any) {
    logger.error("runKoruBackendTurn", "callProvider failed with tools", { error: err.message });
    if (err instanceof RateLimitError) {
      return { reply: err.message, uiBlocks: [], suggestedActions: [], understanding: { literalRequest: request.input, userGoal: "Rate limit", unstatedNeeds: [], assumptions: [], confidence: 0 }, memoryCandidates: [], commitments: [], records: [], toolResults: [], stateEvents: [], mascotState: "tired", provider: "openrouter", model: "rate-limited", fallbackReason: "rate-limit" };
    }
    // Fallback sin tools si el modelo no las soporta o devolvió respuesta vacía
    firstResult = await callProvider(config, messages, secondaryTimeout, false, preferredProvider, undefined, modelOverride);
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
      uiBlocks: [{ type: "deliverable" as const, status: "working" as const, kicker: "Tu Búsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
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
        if (b.type === "web_nav") return null as any; // 🔴 FIX: no more web_nav loading
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
      callProvider(config, messages, secondaryTimeout, false, preferredProvider, undefined, modelOverride),
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

    // FIX: también añadir la ciudad como memoryCandidate automática.
    // Antes dependía del LLM de incluirla en memoryCandidates, pero no lo hacía.
    if (cityAction?.payload?.city) {
      const cityName = String(cityAction.payload.city);
      raw.memoryCandidates = [...asArray(raw.memoryCandidates), {
        kind: "profile",
        text: `User location: ${cityName} (city)`,
        confidence: 0.8,
        sensitivity: "normal",
        status: "candidate",
        useForSuggestions: true,
      }];
    }

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
      uiBlocks: [{ type: "deliverable" as const, status: "working" as const, kicker: "Tu Búsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
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
    const secondResult = await callProvider(config, messages, secondaryTimeout, false, preferredProvider, undefined, modelOverride);
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
    // 🔴 KIMI v6 — Retry para TODOS los providers (no solo Ollama).
    // El provider NVIDIA Nemotron a veces devuelve JSON inválido. Un retry
    // con re-prompt "REGLA ABSOLUTA: Solo respondé con JSON puro válido"
    // rescata ~80% de los casos.
    const shouldRetry = true; // 🔴 KIMI v6: siempre retry
    if (isOllama || shouldRetry) {
      try {
        // Re-anclar la PREGUNTA ACTUAL en el reintento. Sin esto, el modelo
        // mira el historial y responde cualquier turno viejo (visto en logs:
        // "informe sobre AoE2" → "¿En qué ciudad estás?" porque el turno
        // anterior era clima).
        const retryResult = await callProvider(config, [
          ...messages,
          { role: "user", content: `Tu respuesta anterior no era JSON válido. El usuario te preguntó AHORA: «${request.input.slice(0, 300)}». REGLA ABSOLUTA: Solo respondé con JSON puro válido, sin texto extra, sin markdown. Usá este formato exacto: {"reply":"tu respuesta al usuario","mascotState":"idle","uiBlocks":[],"suggestedActions":[],"memoryCandidates":[],"commitments":[],"records":[]}` },
        ], 20_000, false, preferredProvider);
        parsed = JSON.parse(extractJsonBlock(cleanText(retryResult.message.content, "")));
        logger.info("runKoruBackendTurn", "JSON retry succeeded (all providers)");
      } catch (retryErr) {
        logger.warn("runKoruBackendTurn", "JSON retry also failed", { error: String(retryErr) });
      }
    }
    if (!parsed) {
      // 🔴 KIMI v7 — Antes de caer al fallback de texto plano, intentar detectar
      // tool calls simuladas en el contenido (el Nemotron a veces devuelve
      // {"tool_calls":[...]} como texto plano en lugar de JSON válido).
      const simulatedFromPlain = detectSimulatedToolCall(content);
      if (simulatedFromPlain) {
        logger.info("runKoruBackendTurn", "Simulated tool-call detected in plain text fallback", {
          tool: simulatedFromPlain.name,
          format: simulatedFromPlain.format,
        });
        const syntheticToolCall: ProviderToolCall = {
          id: `sim_plain_${Date.now()}`,
          type: "function",
          function: {
            name: simulatedFromPlain.name,
            arguments: JSON.stringify(simulatedFromPlain.arguments),
          },
        };
        messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
        const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config);
        if (delivered) {
          const response = await finalizePayload(request, config, delivered, toolExecutions, extractorTimeout);
          return { ...response, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool-plain" };
        }
      }

      // 🔴 FIX CRÍTICO: el LLM respondió con texto plano (no JSON).
      const plainReply = cleanReplyText(content);
      const effectiveReply = (plainReply && plainReply.trim().length > 10)
        ? plainReply.trim()
        : (content && content.trim().length > 10 && !content.includes("The user") && !content.includes("I should"))
          ? content.trim().slice(0, 500)
          : "No pude procesar tu mensaje. ¿Me lo repetís de otra forma?";
      const rawFallback: Record<string, unknown> = {
        reply: effectiveReply,
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
      // 🔴 KIMI v6 — Bug fix: cuando el primer call falla (invalid JSON), NO persistir
      // commitments ni records con la pregunta del usuario. El memory extractor puede
      // interpretar la pregunta como un commitment a crear, contaminando el store.
      // Solo persistir si hay tool results reales (ej: weather, shopping_list).
      const hasRealToolResults = toolExecutions.some((exec) => {
        const r = exec.result as Record<string, unknown>;
        return r && (Array.isArray(r.records) || Array.isArray(r.commitments));
      });
      if (!hasRealToolResults) {
        response.commitments = [];
        response.records = [];
      }
      logger.info("runKoruBackendTurn", "Return first-call-invalid-json (plain text recovered)", { replyPreview: (response.reply ?? "").slice(0, 300), provider, model, fallbackReason });
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
