import type { AssistantPlanItem, AssistantSource, KoruState, LifeRecord, MemoryFact, UiBlock } from "../../domain/types";
import { extractStructuredData, type ChatFn as ExtractorChatFn } from "../../domain/structureExtractor";
import { timeStringFromText as timeFromText } from "../../domain/time";
import { plainLower } from "../../domain/text";
import { asArray, asRecord, cleanText } from "../json";
// FIX: usar globalThis.fetch que ya fue parcheado en el entry point
// (server/index.ts setea globalThis.fetch = undici.fetch).
// No necesitamos eval('require') acá — el entry point ya lo hizo.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...init, signal: controller.signal as any }) as unknown as Response;
  } finally {
    clearTimeout(timeout);
  }
}

import { logger } from "../logger";
import type {
  LocalActionData,
  MemoryCaptureData,
  PersonalCaptureData,
  PersonalQueryData,
  PlanData,
  SearchData,
  WeatherData,
} from "./types";

export function sourceFromUrl(title: string, url: string, snippet?: string): AssistantSource {
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
  if (!response.ok) { console.error("[weather] geocode HTTP", response.status); return null; }
  const data = await response.json().catch((e: any) => { console.error("[weather] geocode parse error:", e?.message); return {}; }) as { results?: Array<{ name?: string; latitude?: number; longitude?: number; country?: string }> };
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
      advice: "No pude ubicar esa ciudad. No invento clima.",
      sources: [],
    };
  }

  let temp: number | undefined;
  let wind: number | undefined;
  let max: number | undefined;
  let min: number | undefined;
  let rain: number | undefined;
  let weatherSource = "Open-Meteo";

  // FUENTE 1: wttr.in (sin límite de requests, sin API key)
  try {
    const wttrUrl = `https://wttr.in/${encodeURIComponent(location.name)}?format=j1`;
    const wttrRes = await fetchWithTimeout(wttrUrl, { headers: { Accept: "application/json" } }, 15_000);
    if (wttrRes.ok) {
      const wttrData = await wttrRes.json().catch(() => ({})) as any;
      const cur = wttrData.current_condition?.[0];
      const today = wttrData.weather?.[0];
      if (cur) {
        temp = Number(cur.temp_C);
        wind = Number(cur.windspeedKmph);
        max = today ? Number(today.maxtempC) : undefined;
        min = today ? Number(today.mintempC) : undefined;
        rain = today?.hourly?.[0]?.chanceofrain ? Number(today.hourly[0].chanceofrain) : undefined;
        weatherSource = "wttr.in";
      }
    }
  } catch { /* fallthrough a open-meteo */ }

  // FUENTE 2 (fallback): open-meteo
  if (temp === undefined) {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(location.latitude));
      url.searchParams.set("longitude", String(location.longitude));
      url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
      url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "1");
      const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 15_000);
      if (response.ok) {
        const data = await response.json().catch(() => ({})) as any;
        temp = data.current?.temperature_2m;
        wind = data.current?.wind_speed_10m;
        max = data.daily?.temperature_2m_max?.[0];
        min = data.daily?.temperature_2m_min?.[0];
        rain = data.daily?.precipitation_probability_max?.[0];
        weatherSource = "Open-Meteo";
      }
    } catch { /* ambas fuentes fallaron */ }
  }

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
    advice: advice || "Clima consultado pero sin datos concretos.",
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
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 15_000);
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
    return {
      type: "personal_capture",
      block: {
        type: "social_interaction",
        name: personName,
        date: dueText || "12 jul",
        remaining: cleanText(cleanArgs.remaining, "Faltan 8 días"),
        gifts: (asArray(cleanArgs.gifts).map((g) => cleanText(g)).filter(Boolean).length
          ? asArray(cleanArgs.gifts).map((g) => ({ emoji: "🎁", title: cleanText(g), detail: "" }))
          : [{ emoji: "🎁", title: "Regalo pendiente", detail: "" }]),
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
