// News urgent tool — aggregates breaking news from GDELT + USGS + NewsAPI
// + fact-check via Google Fact Check Tools API
//
// Helper library (not a ToolHandler). Expone `fetchUrgentNews` que orquesta
// varias fuentes públicas y devuelve un `UrgentNewsResult` listo para mapear
// al UiBlock `news_urgent`. El ToolHandler histórico vive en `trending.ts`
// (solo GDELT); este módulo lo extiende con USGS, NewsAPI y fact-check.
//
// HTTP: usa `fetchText` de `../shared/fetcher` (con timeout + UA propio) y
// parsea JSON manualmente para tolerar APIs que sirven HTML ante bloqueos.

import { fetchText, domainFromUrl, truncate, normalize } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";
import { defineTool, policies, type ToolHandler } from "../types";
import { fetchMultipleRSS, DEFAULT_RSS_SOURCES, type RssItem } from "./rssFeed";

// ─── Tipos públicos ────────────────────────────────────────────────────────

export type UrgentNewsSeverity = "breaking" | "urgent" | "important";

export type UrgentNewsCategory =
  | "earthquake"
  | "politics"
  | "conflict"
  | "market"
  | "weather"
  | "general";

export type UrgentNewsFactVerdict = "confirmed" | "denied" | "unverified";

export type UrgentNewsTimelineItem = {
  time: string;
  event: string;
  status: "done" | "current" | "pending";
};

export type UrgentNewsFactCheck = {
  claim: string;
  verdict: UrgentNewsFactVerdict;
  source: string;
};

export type UrgentNewsSource = {
  title: string;
  url: string;
  domain: string;
};

export type UrgentNewsResult = {
  headline: string;
  summary: string;
  severity: UrgentNewsSeverity;
  category: UrgentNewsCategory;
  timeline: UrgentNewsTimelineItem[];
  factChecks: UrgentNewsFactCheck[];
  sources: UrgentNewsSource[];
  location?: { lat: number; lng: number; label: string };
  lastUpdated: string;
};

// ─── Detección de categoría por palabras clave ────────────────────────────

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: UrgentNewsCategory }> = [
  { pattern: /terremoto|earthquake|seism|temblor/i, category: "earthquake" },
  { pattern: /guerra|war|conflicto|ataque|attack/i, category: "conflict" },
  { pattern: /mercado|market|bolsa|stock|crypto/i, category: "market" },
  { pattern: /tormenta|storm|huracán|hurricane|inundación|inundacion|flood/i, category: "weather" },
  { pattern: /política|politica|election|gobierno|government/i, category: "politics" },
];

function detectCategory(...texts: string[]): UrgentNewsCategory {
  const blob = texts.join(" ");
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(blob)) return category;
  }
  return "general";
}

// ─── Severidad por antigüedad ──────────────────────────────────────────────

function severityFromAge(ageMs: number): UrgentNewsSeverity {
  const thirtyMin = 30 * 60 * 1000;
  const twoHours = 2 * 60 * 60 * 1000;
  if (ageMs < thirtyMin) return "breaking";
  if (ageMs < twoHours) return "urgent";
  return "important";
}

// ─── Helpers de fecha ──────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseSeenDate(raw: string | undefined): number | null {
  // GDELT seendate viene como "20240615T123000Z" (YYYYMMDDTHHMMSSZ).
  if (!raw) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw);
  if (!m) {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  const [, y, mo, d2, h, mi, s] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d2), Number(h), Number(mi), Number(s));
  return Number.isFinite(t) ? t : null;
}

// ─── Detección de terremoto ────────────────────────────────────────────────

const EARTHQUAKE_RE = /terremoto|earthquake|seism|temblor|sismo/i;

// ─── GDELT ─────────────────────────────────────────────────────────────────

type GdeltArticle = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  language?: string;
  socialimage?: string;
};

async function fetchGdelt(query: string, maxrecords = 10): Promise<GdeltArticle[]> {
  await limiters.gdelt.acquire();
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("maxrecords", String(maxrecords));
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  const r = await fetchText(url.toString(), { timeoutMs: 10_000 });
  if (!r.ok || !r.text) return [];
  try {
    const data = JSON.parse(r.text) as { articles?: GdeltArticle[] };
    return (data.articles ?? []).filter((a) => a.title && a.url);
  } catch {
    return [];
  }
}

// ─── USGS Earthquakes ──────────────────────────────────────────────────────

type UsgsFeature = {
  properties?: {
    mag?: number;
    place?: string;
    time?: number;
    url?: string;
    title?: string;
    tsunami?: number;
  };
  geometry?: {
    coordinates?: [number, number, number]; // [lng, lat, depth]
  };
};

async function fetchUsgsEarthquakes(): Promise<UsgsFeature[]> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const url = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("starttime", toIsoDate(yesterday));
  url.searchParams.set("endtime", toIsoDate(now));
  url.searchParams.set("minmagnitude", "4.0");
  const r = await fetchText(url.toString(), { timeoutMs: 10_000 });
  if (!r.ok || !r.text) return [];
  try {
    const data = JSON.parse(r.text) as { features?: UsgsFeature[] };
    return (data.features ?? []).filter(
      (f) => f.properties?.title && (f.properties.mag ?? 0) >= 4.0,
    );
  } catch {
    return [];
  }
}

// ─── NewsAPI ───────────────────────────────────────────────────────────────

type NewsApiArticle = {
  title?: string;
  url?: string;
  description?: string;
  publishedAt?: string;
  source?: { name?: string };
};

async function fetchNewsApi(query: string, apiKey: string): Promise<NewsApiArticle[]> {
  if (!apiKey) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("apiKey", apiKey);
  const r = await fetchText(url.toString(), { timeoutMs: 10_000 });
  if (!r.ok || !r.text) return [];
  try {
    const data = JSON.parse(r.text) as { articles?: NewsApiArticle[] };
    return (data.articles ?? []).filter((a) => a.title && a.url);
  } catch {
    return [];
  }
}

// ─── Google Fact Check Tools ───────────────────────────────────────────────

type FactCheckClaimReview = {
  publisher?: { name?: string };
  textualRating?: string;
  reviewRating?: { ratingValue?: string | number; alternateName?: string };
};

type FactCheckClaim = {
  text?: string;
  claimReview?: FactCheckClaimReview[];
};

function verdictFromRating(rating: string | undefined): UrgentNewsFactVerdict {
  if (!rating) return "unverified";
  const r = normalize(rating);
  // Confirmaciones
  if (/\b(true|correct|verdadero|cierto|confirmed|accurate|real|verified)\b/.test(r)) return "confirmed";
  // Negaciones
  if (/\b(false|fake|falso|incorrecto|denied|wrong|pants|misleading|debunked|disputed)\b/.test(r)) return "denied";
  return "unverified";
}

async function fetchFactChecks(query: string, apiKey: string): Promise<UrgentNewsFactCheck[]> {
  if (!apiKey) return [];
  const url = new URL("https://factchecktools.googleapis.com/v1/claims:search");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);
  const r = await fetchText(url.toString(), { timeoutMs: 10_000 });
  if (!r.ok || !r.text) return [];
  let data: { claims?: FactCheckClaim[] };
  try {
    data = JSON.parse(r.text) as { claims?: FactCheckClaim[] };
  } catch {
    return [];
  }
  const out: UrgentNewsFactCheck[] = [];
  for (const claim of data.claims ?? []) {
    const review = claim.claimReview?.[0];
    if (!review) continue;
    const rating =
      review.textualRating ??
      review.reviewRating?.alternateName ??
      (typeof review.reviewRating?.ratingValue === "string" ? review.reviewRating.ratingValue : undefined);
    out.push({
      claim: truncate(claim.text ?? "", 200),
      verdict: verdictFromRating(rating),
      source: review.publisher?.name ?? "Fact Check",
    });
    if (out.length >= 8) break;
  }
  return out;
}

// ─── Helpers de composición ────────────────────────────────────────────────

function buildSourcesFromGdelt(articles: GdeltArticle[]): UrgentNewsSource[] {
  return articles.slice(0, 8).map((a) => ({
    title: a.title ?? "Sin título",
    url: a.url ?? "",
    domain: a.domain ?? domainFromUrl(a.url ?? ""),
  }));
}

function buildSourcesFromNewsApi(articles: NewsApiArticle[]): UrgentNewsSource[] {
  return articles.slice(0, 8).map((a) => ({
    title: a.title ?? "Sin título",
    url: a.url ?? "",
    domain: domainFromUrl(a.url ?? ""),
  }));
}

function buildTimeline(
  gdelt: GdeltArticle[],
  newsApi: NewsApiArticle[],
): UrgentNewsTimelineItem[] {
  type Item = { ts: number; event: string };
  const items: Item[] = [];
  for (const a of gdelt) {
    const ts = parseSeenDate(a.seendate);
    if (ts != null && a.title) items.push({ ts, event: a.title });
  }
  for (const a of newsApi) {
    if (!a.publishedAt || !a.title) continue;
    const ts = Date.parse(a.publishedAt);
    if (Number.isFinite(ts)) items.push({ ts, event: a.title });
  }
  // Orden descendente (más reciente primero) y toma 5.
  items.sort((x, y) => y.ts - x.ts);
  const top = items.slice(0, 5);
  if (top.length === 0) return [];
  return top.map((it, idx) => ({
    time: new Date(it.ts).toISOString(),
    event: truncate(it.event, 160),
    // El primero es "current" (la noticia en curso); el resto "done".
    status: (idx === 0 ? "current" : "done") as "done" | "current" | "pending",
  }));
}

function pickHeadline(
  gdelt: GdeltArticle[],
  newsApi: NewsApiArticle[],
  query: string,
): { headline: string; summary: string; ageMs: number } {
  // Mejor candidato: GDELT más reciente con título sustancial; fallback NewsAPI.
  const candidates: Array<{ ts: number | null; title: string; desc?: string }> = [];
  for (const a of gdelt) {
    const ts = parseSeenDate(a.seendate);
    if (a.title) candidates.push({ ts, title: a.title, desc: undefined });
  }
  for (const a of newsApi) {
    const ts = a.publishedAt ? Date.parse(a.publishedAt) : null;
    if (a.title) candidates.push({ ts, title: a.title, desc: a.description });
  }
  // Ordena por timestamp (recientes primero); sin timestamp al final.
  candidates.sort((x, y) => (y.ts ?? 0) - (x.ts ?? 0));
  const best = candidates[0];
  if (!best) {
    return {
      headline: query ? `Noticias sobre "${query}"` : "Última hora",
      summary: "No encontré titulares recientes en este momento. Intentá de nuevo en unos minutos.",
      ageMs: Number.POSITIVE_INFINITY,
    };
  }
  const ageMs = best.ts != null ? Date.now() - best.ts : Number.POSITIVE_INFINITY;
  const summary = best.desc ? truncate(best.desc, 280) : truncate(best.title, 200);
  return { headline: truncate(best.title, 200), summary, ageMs };
}

function earthquakeLocation(features: UsgsFeature[]): { lat: number; lng: number; label: string } | undefined {
  const f = features[0];
  if (!f?.geometry?.coordinates) return undefined;
  const [lng, lat] = f.geometry.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  const label = f.properties?.place ?? f.properties?.title ?? "Epicentro";
  return { lat, lng, label };
}

function earthquakeHeadline(features: UsgsFeature[]): string | undefined {
  const f = features[0];
  if (!f?.properties) return undefined;
  const mag = f.properties.mag?.toFixed(1) ?? "?";
  const place = f.properties.place ?? "ubicación desconocida";
  return `Sismo M${mag} — ${place}`;
}

// ─── Orquestador principal ─────────────────────────────────────────────────

/**
 * Orquesta GDELT (+ USGS si la query sugiere terremoto + NewsAPI si hay key)
 * y Fact Check Tools (si hay key). Devuelve un `UrgentNewsResult` listo para
 * mapear al UiBlock `news_urgent`. Cachea 5 min por query+region.
 *
 * Cada fuente se ejecuta en paralelo y cae con [] si falla: el agregador
 * nunca rompe por un solo proveedor caído.
 */
export async function fetchUrgentNews(
  query: string,
  region?: string,
): Promise<UrgentNewsResult> {
  const q = (query ?? "").trim();
  if (!q) {
    return {
      headline: "Noticias urgentes",
      summary: "Especificá un tema o región para buscar última hora.",
      severity: "important",
      category: "general",
      timeline: [],
      factChecks: [],
      sources: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const cacheKey = `news_urgent_agg:${normalize(q)}:${normalize(region ?? "")}`;
  return cached<UrgentNewsResult>(cacheKey, ttls.news, async () => {
    const newsApiKey = process.env.NEWSAPI_KEY ?? "";
    const factCheckKey = process.env.FACTCHECK_KEY ?? "";

    const gdeltQuery = region ? `${q} ${region} sourcelang:spa` : `${q} sourcelang:spa`;
    const wantEarthquakes = EARTHQUAKE_RE.test(q) || EARTHQUAKE_RE.test(region ?? "");

    // Lanza en paralelo (cada fuente cae con [] si falla).
    const [gdelt, newsApi, usgs, factChecks] = await Promise.all([
      fetchGdelt(gdeltQuery, 10).catch(() => [] as GdeltArticle[]),
      fetchNewsApi(q, newsApiKey).catch(() => [] as NewsApiArticle[]),
      wantEarthquakes
        ? fetchUsgsEarthquakes().catch(() => [] as UsgsFeature[])
        : Promise.resolve([] as UsgsFeature[]),
      fetchFactChecks(q, factCheckKey).catch(() => [] as UrgentNewsFactCheck[]),
    ]);

    const { headline, summary, ageMs } = pickHeadline(gdelt, newsApi, q);
    const severity = severityFromAge(ageMs);
    const category = detectCategory(q, summary, gdelt.map((a) => a.title ?? "").join(" "));

    const sources: UrgentNewsSource[] = [];
    for (const s of [...buildSourcesFromGdelt(gdelt), ...buildSourcesFromNewsApi(newsApi)]) {
      if (s.url && !sources.some((x) => x.url === s.url)) sources.push(s);
      if (sources.length >= 8) break;
    }

    const timeline = buildTimeline(gdelt, newsApi);

    // Si hay terremoto, inyectamos el titular USGS y la ubicación.
    let finalHeadline = headline;
    let location: { lat: number; lng: number; label: string } | undefined;
    if (wantEarthquakes && usgs.length > 0) {
      const eqHeadline = earthquakeHeadline(usgs);
      if (eqHeadline) finalHeadline = eqHeadline;
      location = earthquakeLocation(usgs);
    }

    return {
      headline: finalHeadline,
      summary,
      severity,
      category,
      timeline,
      factChecks,
      sources,
      location,
      lastUpdated: new Date().toISOString(),
    };
  });
}

// ─── Tool `news_urgent_search` (envoltura ToolHandler) ───────────────────────

/**
 * ToolHandler que orquesta `fetchUrgentNews` (GDELT + USGS + NewsAPI + Fact
 * Check Tools) y devuelve un `UrgentNewsResult` con `type: "news_urgent_search"`
 * listo para mapear al UiBlock `news_urgent`.
 *
 * Diferencia con el `news_urgent` histórico de `trending.ts` (solo GDELT,
 * artículos planos): este wrapper devuelve headline + summary + severity +
 * timeline + factChecks + location, alineado con el `news_urgent` UiBlock.
 */
export const newsUrgentSearch: ToolHandler = {
  definition: defineTool(
    "news_urgent_search",
    "Noticias urgentes enriquecidas: titular, severidad (breaking/urgent/important), " +
      "timeline de eventos, fact-checks (Google Fact Check Tools) y ubicación para desastres. " +
      "Úsala cuando el usuario pregunte 'qué pasó hace nada en Argentina', 'noticias de última " +
      "hora del mundo', 'hubo un terremoto?', 'noticias urgentes de X'. " +
      "Devuelve headline, summary, severity, category, timeline, factChecks, sources, location.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Tema o titular a buscar (ej: 'Argentina', 'terremoto Japón', 'elecciones USA').",
        },
        region: {
          type: "string",
          description: "Región o país opcional para acotar (ej: 'Argentina', 'España', 'mundo').",
        },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee GDELT, USGS, NewsAPI y Google Fact Check Tools."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const region = String(args.region ?? "").trim() || undefined;
    if (!query) {
      return {
        type: "news_urgent_search",
        status: "failed",
        error: "Indicá un tema o región para buscar última hora.",
      };
    }
    try {
      const result = await fetchUrgentNews(query, region);
      return {
        type: "news_urgent_search",
        status: "ok",
        query,
        region: region ?? "",
        ...result,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        type: "news_urgent_search",
        status: "no_data",
        query,
        region: region ?? "",
        note: msg || `No encontré noticias urgentes para "${query}".`,
      };
    }
  },
};
