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

export type ProviderConfig = {
  nvidiaApiKey?: string;
  nvidiaBaseUrl: string;
  nvidiaModel: string;
  openRouterKeys: string[];
  openRouterModels: string[];
};

export type KoruBackendTurnRequest = {
  input: string;
  history: KoruConversationMessage[];
  state: KoruState;
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
  provider: "nvidia" | "openrouter";
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
  provider: "nvidia" | "openrouter";
  model?: string;
  message: ProviderMessage;
};

type ToolExecution = {
  id: string;
  name: string;
  result: Record<string, unknown>;
};

type WeatherData = {
  type: "weather";
  city: string;
  now?: string;
  range?: string;
  rain?: string;
  wind?: string;
  advice?: string;
  sources: AssistantSource[];
};

type SearchData = {
  type: "search";
  mode: "news" | "research" | "shopping" | "world";
  title: string;
  summary: string;
  sources: AssistantSource[];
  comparisonItems?: NonNullable<Extract<UiBlock, { type: "comparison" }>["items"]>;
};

type PlanData = {
  type: "plan";
  title: string;
  items: AssistantPlanItem[];
  context: string[];
};

type LocalActionData = {
  type: "local_action";
  block: UiBlock;
  requiresApproval: boolean;
  records?: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  commitments?: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
};

type PersonalCaptureData = {
  type: "personal_capture";
  block: UiBlock;
  commitments?: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records?: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  memoryCandidates?: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
};

type PersonalQueryData = {
  type: "personal_query";
  block: UiBlock;
  reply?: string;
};

type MemoryCaptureData = {
  type: "memory_capture";
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "weather",
      description: "Get current weather and daily range for a city. Use for weather, outfit, umbrella, jacket, and what-to-wear questions.",
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
      description: "Search recent web information, news, trends, or general facts with sources.",
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
      description: "Compare products with sources, price evidence, constraints, pros and cons.",
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
      description: "Build a practical day plan from user context, open commitments, calendar, and energy.",
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
      description: "Read Koru's saved local context to answer questions about spending, food at home, pending tasks, saved links, medical notes, people, or what Koru remembers. Never use for external facts.",
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: unknown, fallback = ""): string {
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
  return {};
}

function cleanReplyText(value: unknown, hasStructuredBlocks = false): string {
  const text = cleanText(value)
    .replace(/\*?\s*uiBlock\s*:\s*[a-z_]+\s*\*?/gi, "")
    .replace(/\buiBlocks?\b\s*[:=]\s*\[[\s\S]*$/i, "")
    .replace(/\b(reply|understanding|suggestedActions|memoryCandidates|commitments|records|mascotState)\b\s*[:=]\s*\{?[^,}]*}?/gi, "")
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/\b(Hola|Gracias|Perfecto|Listo)(?=[A-ZÁÉÍÓÚÑ])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  if (!hasStructuredBlocks || text.length <= 260) return text;
  const beforeList = text.split(/\s+\*\*|\s+-\s+/)[0]?.trim();
  if (beforeList && beforeList.length >= 45 && beforeList.length <= 240) return beforeList;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
  const concise = sentences.slice(0, 2).join(" ");
  if (concise.length >= 45 && concise.length <= 240) return concise;
  return `${text.slice(0, 220).trim()}...`;
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

async function callNvidia(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  if (!config.nvidiaApiKey) throw new Error("NVIDIA API key is not configured.");
  const response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/v1/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.nvidiaApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: config.nvidiaModel,
      messages,
      ...(toolsEnabled ? { tools: TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
      temperature: 0.25,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
    }),
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
      ...(toolsEnabled ? { tools: TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
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
  const hasJson = trimmed.startsWith("{") && trimmed.includes('"reply"');
  const hasTools = asArray(result.message?.tool_calls).length > 0;
  return hasJson || hasTools;
}

async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult & { fallbackReason?: string }> {
  if (!config.nvidiaApiKey) {
    return callOpenRouter(config, messages, Math.min(14_000, timeoutMs), toolsEnabled);
  }

  const nvidia = callNvidia(config, messages, timeoutMs, toolsEnabled);
  const nvidiaValidated = nvidia.then((result) => {
    if (providerResultIsValid(result)) return result;
    throw new Error("nvidia-non-structured");
  });
  const first = await Promise.race([
    nvidiaValidated.then(
      (result) => ({ kind: "result" as const, result }),
      (error) => ({ kind: "error" as const, error }),
    ),
    wait(Math.min(5_000, Math.max(2_500, Math.floor(timeoutMs * 0.15)))).then(() => ({ kind: "timeout" as const })),
  ]);

  if (first.kind === "result") return first.result;
  if (!config.openRouterKeys.length) {
    if (first.kind === "error") throw first.error;
    return nvidia;
  }

  const fallbackReason = first.kind === "error"
    ? first.error instanceof Error ? first.error.message : "NVIDIA failed"
    : "NVIDIA exceeded preferred response window";
  try {
    return await Promise.any([
      nvidiaValidated,
      callOpenRouter(config, messages, Math.min(14_000, timeoutMs), toolsEnabled).then((fallback) => ({ ...fallback, fallbackReason })),
    ]);
  } catch {
    const fallback = await callOpenRouter(config, messages, Math.min(18_000, timeoutMs), toolsEnabled);
    return { ...fallback, fallbackReason };
  }
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

async function getWeather(args: Record<string, unknown>): Promise<WeatherData> {
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

async function runSearch(args: Record<string, unknown>, shopping = false): Promise<SearchData> {
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
  const sources = [...gdelt, ...duck].slice(0, 6);
  const comparisonItems = shopping
    ? sources.slice(0, 4).map((source, index) => ({
        title: source.title,
        vendor: source.domain,
        url: source.url,
        evidence: source.snippet,
        score: Math.max(55, 88 - index * 8),
      }))
    : undefined;
  return {
    type: "search",
    mode,
    title: shopping ? "Comparativa" : mode === "news" ? "Noticias importantes" : mode === "world" ? "El mundo esta hablando de esto" : "Busqueda",
    summary: sources.length
      ? "Fuentes abiertas encontradas. Koru debe sintetizar con cautela y ofrecer el siguiente paso."
      : "No pude conseguir fuentes utiles con los conectores abiertos. No inventes resultados.",
    sources,
    comparisonItems,
  };
}

function planFromState(state: KoruState, args: Record<string, unknown>): PlanData {
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

function localReminderFromArgs(args: Record<string, unknown>, input = ""): LocalActionData {
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

function localAlarmFromArgs(args: Record<string, unknown>, input = ""): LocalActionData {
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

function queryPersonalContextFromState(state: KoruState, args: Record<string, unknown>): PersonalQueryData {
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

function memoryCaptureFromArgs(args: Record<string, unknown>, input = ""): MemoryCaptureData {
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

function personalCaptureFromArgs(args: Record<string, unknown>, input = ""): PersonalCaptureData {
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
async function executeTool(name: string, args: Record<string, unknown>, state: KoruState): Promise<Record<string, unknown>> {
  if (name === "weather") return getWeather(args) as Promise<unknown> as Promise<Record<string, unknown>>;
  if (name === "web_search") return runSearch(args) as Promise<unknown> as Promise<Record<string, unknown>>;
  if (name === "shopping_compare") return runSearch(args, true) as Promise<unknown> as Promise<Record<string, unknown>>;
  if (name === "route_traffic") return runSearch({ ...args, mode: "research", query: cleanText(args.query) || [cleanText(args.origin), cleanText(args.destination)].filter(Boolean).join(" a ") || cleanText(args.__userInput) }, false) as Promise<unknown> as Promise<Record<string, unknown>>;
  if (name === "calendar_reminder") return localReminderFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  if (name === "alarm") return localAlarmFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  if (name === "plan_day") return planFromState(state, args) as unknown as Record<string, unknown>;
  if (name === "query_personal_context") return queryPersonalContextFromState(state, args) as unknown as Record<string, unknown>;
  if (name === "save_memory") return memoryCaptureFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  if (name === "save_personal_item") return personalCaptureFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
  return { type: "unknown", error: `Unknown tool ${name}` };
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
    `- Nunca inventes precios, clima, o datos que no tengas. Si no sabés, decilo con naturalidad y ofrecé el siguiente paso.`,
    `- CRÍTICO: Si una tool externa (clima, búsqueda, ruta, precios) devuelve status "failed" o "not_configured", NO inventés los datos. Decile al usuario honestamente que no pudiste obtener esa información y preguntá si quiere que lo intente de otra forma.`,
    `- CRÍTICO: Si el usuario responde con una ciudad o ubicación directamente después de que preguntaste por clima o tráfico, interpretalo como su ubicación. Ejecutá la tool correspondiente con esa ciudad y guardá esa ciudad como memory de perfil.`,
    `- CRÍTICO: Si el usuario te dice una ciudad, país o barrio y no lo tenés guardado como memoria, incluilo en memoryCandidates como kind: profile.`,
    `- CRÍTICO: Si el usuario pregunta algo que YA aparece en "Cosas que guardaste" o "Memorias relevantes", NO uses query_personal_context. Respondé directamente desde ese contexto.`,
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
    `- Usá tools solo cuando necesites datos reales del mundo (clima, búsqueda, ruta, precios).`,
    `- Para datos personales ya guardados, no llames tools; respondé directamente usando el contexto.`,
    `- Agregá mascotState al JSON final Elijí SOLO de esta lista exacta: "celebrating", "worried", "affectionate", "curious", "happy", "thinking", "working", "tired", "sleeping", "mistake", "planning", "product-search", "building", "cooking", "thinking-2". Si nada aplica, usá "idle".`,
    `- Tipos de uiBlocks válidos:`,
    `  - "weather": clima por ciudad (city, now, range, rain, wind, advice, sources)`,
    `  - "web_nav": resultado de búsqueda web. status: "loading" (spinner + lista de fuentes), "complete" (solo lista de fuentes), o "report" (SIEMPRE que hayas sintetizado varias fuentes en un análisis propio). Para "report" AGREGÁ "summary" (párrafo narrativo con tu análisis) y "findings" (array de 3-5 bullets clave). Las fuentes van en "results" (array de {title, source, url, type}).`,
    `  - "alarm": alarma con time y repeat`,
    `  - "reminder": recordatorio con dueText`,
    `  - "plan": plan de pasos con items (time, title, priority, rationale)`,
    `  - "comparison": comparativa de productos con criteria y recommendation`,
    `  - "research_sources": fuentes verificadas con summary, sources, y mode`,
    `  - "shopping_list": lista de compras con items y dueText`,
    `  - "money_summary": resumen de gastos con summaryItems y recommendation`,
    `  - "activity_group": grupo de actividad con tiles y rows`,
    `  - "proactive_signal": señal del mundo con category, severity, title, body`,
    `  - "clarifying_question": pregunta de clarificación con options`,
    `  - "saved_record": registro guardado con records`,
    `  - "resource_bundle": archivos descargables con files`,
    `- Formato de respuesta final: {"reply":"...","uiBlocks":[...],"mascotState":"...",...}`,
    `Hora actual: ${nowIso}`,
  ].join("\n");
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
  composedRaw?: Record<string, unknown>,
): Promise<{ raw: Record<string, unknown>; provider: "nvidia" | "openrouter"; model?: string; fallbackReason?: string }> {
  const result = await callProvider(config, buildMemoryExtractorMessages(request, toolExecutions, composedRaw), 16_000, false);
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
    if (result.type === "search") {
      const search = result as SearchData;
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
        const blockedDomains = new Set(["webyansh.com", "studiomeyer.io", "victormisa.com", "idearium.es", "pinterest.com", "instagram.com", "facebook.com"]);
        const filtered = search.sources
          .filter((s) => !blockedDomains.has(s.domain.toLowerCase()) && s.url?.startsWith("http"))
          .slice(0, 5);
        if (filtered.length) {
          blocks.push({
            type: "web_nav" as const,
            title: search.title,
            status: "complete" as const,
            query: search.title,
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
  const cleanedReply = cleanReplyText(raw.reply, uiBlocks.length > 0);
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

function contentFallback(content: string, input: string, toolExecutions: ToolExecution[]): KoruBackendTurnResponse {
  const toolBlocks = blocksFromToolResults(toolExecutions);
  let reply = cleanReplyText(content, toolBlocks.length > 0);
  // Si cleanReplyText filtró todo pero el contenido original parece una respuesta real, usalo directamente
  if ((!reply || reply.length < 5) && content && content.length > 5 && !content.trim().startsWith("{")) {
    reply = cleanText(content);
  }
  if (!reply || reply.length < 5) {
    reply = "No pude armar una respuesta clara. ¿Me lo repetís de otra forma?";
  }
  return normalizeFinalPayload({
    reply,
    understanding: {
      literalRequest: input,
      userGoal: "Resolver el pedido con ayuda de Koru.",
      unstatedNeeds: [],
      assumptions: [],
      confidence: 0.45,
    },
    uiBlocks: toolBlocks,
    suggestedActions: [],
    memoryCandidates: [],
    commitments: [],
    records: [],
  }, input, toolExecutions);
}

async function finalizePayload(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  raw: Record<string, unknown>,
  toolExecutions: ToolExecution[],
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter"; memoryModel?: string }> {
  try {
    const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, raw);
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
): Promise<Record<string, unknown> | null> {
  messages.push({
    role: "assistant",
    content: "",
    tool_calls: toolCalls,
  });

  for (const call of toolCalls) {
    const name = call.function.name;
    const args = { ...toolCallArgs(call), __userInput: request.input };
    if (name === "deliver_response") return args;
    const toolResult = await executeTool(name, args, request.state);
    toolExecutions.push({ id: call.id, name, result: toolResult });
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(toolResult),
    });
  }
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
      const result = await callProvider(config, messages.map((m) => ({ role: m.role as "system" | "user", content: m.content })), 8_000, false);
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

export async function runKoruBackendTurn(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
): Promise<KoruBackendTurnResponse> {
  const messages = buildMessages(request);
  const toolExecutions: ToolExecution[] = [];
  let provider: "nvidia" | "openrouter" = "nvidia";
  let model: string | undefined;
  let fallbackReason: string | undefined;

  // Paso 1: una sola llamada al LLM con tools habilitadas
  let firstResult: ProviderResult & { fallbackReason?: string };
  try {
    firstResult = await callProvider(config, messages, 30_000, true);
  } catch {
    // Fallback sin tools si el modelo no las soporta o devolvió respuesta vacía
    firstResult = await callProvider(config, messages, 30_000, false);
    fallbackReason = (fallbackReason ? fallbackReason + " + " : "") + "no-tools-fallback";
  }
  provider = firstResult.provider;
  model = firstResult.model;
  fallbackReason = firstResult.fallbackReason;
  const firstMessage = firstResult.message;
  const toolCalls = asArray(firstMessage.tool_calls) as ProviderToolCall[];

  // Si el LLM pidió tool calls, ejecutarlas
  if (toolCalls.length > 0) {
    const delivered = await executeProviderToolCalls(toolCalls, messages, request, toolExecutions);
    if (delivered) {
      const response = await finalizePayload(request, config, delivered, toolExecutions);
      return { ...response, provider, model, fallbackReason: fallbackReason ?? response.memoryFallbackReason };
    }

    // Paso 2: segunda llamada (sin tools) para que el LLM síntetice la respuesta final
    messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
    const secondResult = await callProvider(config, messages, 24_000, false);
    provider = secondResult.provider;
    model = secondResult.model ?? model;
    const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");

    let parsed: any;
    try {
      parsed = JSON.parse(extractJsonBlock(secondContent));
    } catch {
      const response = contentFallback(secondContent, request.input, toolExecutions);
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

    const response = await finalizePayload(request, config, raw, toolExecutions);
    return {
      ...response,
      provider,
      model,
      fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "after-tools",
    };
  }

  // Sin tool calls: parsear la respuesta JSON directamente
  const content = cleanText(firstMessage.content, "No pude componer una respuesta util.");
  let parsed: any;
  try {
    parsed = JSON.parse(extractJsonBlock(content));
  } catch {
    const response = contentFallback(content, request.input, toolExecutions);
    return { ...response, provider, model, fallbackReason: fallbackReason ?? "first-call-invalid-json" };
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

  const response = await finalizePayload(request, config, raw, toolExecutions);
  return {
    ...response,
    provider,
    model,
    fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "first-call",
  };
}
