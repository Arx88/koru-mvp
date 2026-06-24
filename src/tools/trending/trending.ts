/**
 * Bloque Trending — Noticias urgentes, trending multi-plataforma, RSS, radar.
 * APIs: GDELT (sin key), Reddit JSON (sin OAuth), scraping YouTube/GitHub,
 * parser RSS local. X/Twitter requiere scraper (tier free oficial eliminado).
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import { fetchJson, fetchText, normalize } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";
import { searchAndEnrich, usableSources } from "../shared/scrapers";

// ─── news_urgent ────────────────────────────────────────────────────────────
type GdeltArticle = { title?: string; url?: string; domain?: string; seendate?: string; language?: string; socialimage?: string };

async function queryGdelt(query: string, maxrecords = 8): Promise<GdeltArticle[]> {
  await limiters.gdelt.acquire();
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(maxrecords));
  url.searchParams.set("sort", "DateDesc");
  const r = await fetchJson<{ articles?: GdeltArticle[] }>(url.toString(), { timeoutMs: 10_000 });
  if (!r.ok) return [];
  return (r.data.articles ?? []).filter((a) => a.title && a.url);
}

export const newsUrgent: ToolHandler = {
  definition: defineTool(
    "news_urgent",
    "Noticias urgentes y de última hora del mundo de agencias fiables. Úsala cuando el usuario pregunte 'qué pasó hoy importante?', 'noticias urgentes', 'última hora'. Ordena por fecha descendente.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        region: { type: "string", description: "Región o país opcional (ej: 'Argentina', 'España', 'mundo')." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee noticias de GDELT."),
  async run(args) {
    const region = String(args.region ?? "mundo").trim();
    const cacheKey = `news_urgent:${region.toLowerCase()}`;
    const articles = await cached<GdeltArticle[]>(cacheKey, ttls.news, () => queryGdelt(`(urgente OR última hora OR breaking) ${region} sourcelang:spa`, 8));
    if (articles.length === 0) {
      // Fallback sin filtro de urgente.
      const fallback = await cached<GdeltArticle[]>(`news_urgent_fb:${region.toLowerCase()}`, ttls.news, () => queryGdelt(`noticias importantes ${region} sourcelang:spa`, 8));
      return { type: "news_urgent", status: "ok", region, articles: fallback, source: "GDELT", note: "Sin noticias marcadas como urgentes; muestro las más recientes." };
    }
    return { type: "news_urgent", status: "ok", region, articles, source: "GDELT" };
  },
};

// ─── news_topic ─────────────────────────────────────────────────────────────
export const newsTopic: ToolHandler = {
  definition: defineTool(
    "news_topic",
    "Noticias filtradas por tema (política, tech, ciencia, deporte, etc.). Úsala cuando el usuario pregunte 'noticias de IA', 'qué pasa en Medio Oriente', 'tech de hoy', 'avances científicos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema a buscar." },
      },
      required: ["topic"],
    },
  ),
  policy: policies.readonly("Lee noticias temáticas de GDELT."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "news_topic", status: "failed", error: "Indicá el tema." };
    const cacheKey = `news_topic:${topic.toLowerCase()}`;
    const articles = await cached<GdeltArticle[]>(cacheKey, ttls.news, () => queryGdelt(`${topic} sourcelang:spa`, 8));
    return { type: "news_topic", status: "ok", topic, articles, source: "GDELT" };
  },
};

// ─── trending_twitter ───────────────────────────────────────────────────────
export const trendingTwitter: ToolHandler = {
  definition: defineTool(
    "trending_twitter",
    "Tendencias actuales de X/Twitter (topics más comentados con volumen). Úsala cuando el usuario diga 'de qué se habla en X?', 'trending global', 'tendencias en Argentina'. NOTA: X eliminó su API gratuita; uso scraper (puede fallar por bloqueos).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        location: { type: "string", description: "País o 'global'. Default worldwide." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Scrapea trends de X."),
  async run(args) {
    const location = String(args.location ?? "worldwide").trim();
    const geoMap: Record<string, string> = {
      worldwide: "worldwide", global: "worldwide",
      us: "united-states", usa: "united-states", unitedstates: "united-states",
      ar: "argentina", argentina: "argentina",
      es: "spain", españa: "spain", spain: "spain",
      mx: "mexico", méxico: "mexico", mexico: "mexico",
      br: "brazil", brasil: "brazil", brazil: "brazil",
      co: "colombia", colombia: "colombia",
      cl: "chile", chile: "chile",
      pe: "peru", perú: "peru", peru: "peru",
      uk: "united-kingdom", gb: "united-kingdom", england: "united-kingdom",
      fr: "france", francia: "france", france: "france",
      de: "germany", alemania: "germany", germany: "germany",
      it: "italy", italia: "italy", italy: "italy",
      ca: "canada", canada: "canada",
      au: "australia", australia: "australia",
      in: "india", india: "india",
      jp: "japan", japón: "japan", japan: "japan",
    };
    const slug = geoMap[location.toLowerCase()] ?? "worldwide";
    const cacheKey = `twitter_trends:${slug}`;
    const trends = await cached<Array<{ title: string; url: string }>>(cacheKey, ttls.trending, async () => {
      const r = await fetchText(`https://trends24.in/${slug}/`, { timeoutMs: 9_000 });
      if (!r.ok) return [];
      const text = r.text;
      const items: Array<{ title: string; url: string }> = [];
      const matches = Array.from(text.matchAll(/href="https:\/\/twitter\.com\/search\?q=([^"]+)" class=trend-link>([^<]+)/g));
      for (const m of matches.slice(0, 15)) {
        const title = m[2].trim();
        if (title) {
          items.push({ title, url: `https://twitter.com/search?q=${m[1]}` });
        }
      }
      return items;
    });
    if (trends.length === 0) {
      return { type: "trending_twitter", status: "ok", location, trends: [], note: "No pude obtener tendencias en este momento. El scraper puede estar bloqueado." };
    }
    return { type: "trending_twitter", status: "ok", location, trends, source: "trends24.in" };
  },
};

// ─── trending_reddit ────────────────────────────────────────────────────────
type RedditPost = { title: string; url: string; permalink: string; ups: number; num_comments: number; subreddit: string; created_utc: number };

export const trendingReddit: ToolHandler = {
  definition: defineTool(
    "trending_reddit",
    "Posts más votados de Reddit (un subreddit o front page). Úsala cuando el usuario diga 'top de r/worldnews', 'qué está furor en r/movies', 'mejor de Reddit hoy'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        subreddit: { type: "string", description: "Subreddit sin r/ (ej: 'worldnews'). Default 'popular'." },
        timeframe: { type: "string", enum: ["hour", "day", "week", "month"], default: "day" },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee JSON público de Reddit."),
  async run(args) {
    const sub = String(args.subreddit ?? "popular").trim().replace(/^r\//, "");
    const timeframe = String(args.timeframe ?? "day");
    const cacheKey = `reddit:${sub}:${timeframe}`;
    const posts = await cached<RedditPost[]>(cacheKey, ttls.trending, async () => {
      await limiters.reddit.acquire();
      // Reddit hoy sirve HTML para UAs no-navegador. old.reddit.com es más permisivo
      // y respeta el .json. Probamos primero old, luego www como fallback.
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";
      let lastErr = "Reddit no disponible";
      for (const host of ["old.reddit.com", "www.reddit.com"]) {
        const r = await fetchJson<{ data?: { children?: Array<{ data?: Record<string, unknown> }> } }>(
          `https://${host}/r/${encodeURIComponent(sub)}/top.json?t=${timeframe}&limit=10`,
          { timeoutMs: 9_000, headers: { "User-Agent": ua, Accept: "application/json" } },
        );
        if (!r.ok) { lastErr = r.error; continue; }
        const children = r.data?.data?.children;
        if (Array.isArray(children)) {
          return children.map((c) => {
            const d = c.data ?? {};
            return {
              title: String(d.title ?? ""),
              url: String(d.url ?? ""),
              permalink: `https://reddit.com${d.permalink ?? ""}`,
              ups: Number(d.ups ?? 0),
              num_comments: Number(d.num_comments ?? 0),
              subreddit: String(d.subreddit ?? sub),
              created_utc: Number(d.created_utc ?? 0),
            };
          }).filter((p) => p.title);
        }
        lastErr = "Reddit devolvió HTML en vez de JSON (API pública inestable).";
      }
      throw new Error(lastErr);
    });
    return { type: "trending_reddit", status: "ok", subreddit: sub, timeframe, posts: posts.slice(0, 10), source: "Reddit" };
  },
};

// ─── trending_youtube ───────────────────────────────────────────────────────
export const trendingYoutube: ToolHandler = {
  definition: defineTool(
    "trending_youtube",
    "Videos en tendencia de YouTube por país. Úsala cuando el usuario diga 'trending YouTube Argentina', 'qué es furor en YouTube España', 'top videos hoy'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        country: { type: "string", description: "Código ISO país (ej: 'AR', 'ES'). Default global." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Scrapea trending de YouTube."),
  async run(args) {
    const country = String(args.country ?? "").trim();
    const cacheKey = `yt_trending:${country.toLowerCase()}`;
    const videos = await cached<Array<{ title: string; url: string; channel?: string }>>(cacheKey, ttls.trending, async () => {
      const url = country ? `https://www.youtube.com/feed/trending?gl=${encodeURIComponent(country)}` : "https://www.youtube.com/feed/trending";
      const r = await fetchText(url, { timeoutMs: 10_000, headers: { Accept: "text/html" } });
      if (!r.ok) return [];
      // YouTube embeds JSON en la página; extraemos títulos+IDs.
      const out: Array<{ title: string; url: string; channel?: string }> = [];
      const matches = Array.from(r.text.matchAll(/"videoId":"([\w-]{11})"[^}]*?"title":\{"runs":\[\{"text":"([^"]+)"/g)).slice(0, 10);
      for (const m of matches) {
        out.push({ url: `https://www.youtube.com/watch?v=${m[1]}`, title: m[2] });
      }
      return out;
    });
    return { type: "trending_youtube", status: "ok", country: country || "global", videos, source: "YouTube" };
  },
};

// ─── trending_github ────────────────────────────────────────────────────────
export const trendingGithub: ToolHandler = {
  definition: defineTool(
    "trending_github",
    "Repos más populares de GitHub del día/semana. Úsala cuando el usuario diga 'trending GitHub de la semana', 'repos que rompen hoy', 'proyectos populares'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        since: { type: "string", enum: ["daily", "weekly", "monthly"], default: "weekly" },
        language: { type: "string", description: "Lenguaje opcional (ej: 'python', 'typescript')." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Scrapea trending de GitHub."),
  async run(args) {
    const since = String(args.since ?? "weekly");
    const language = String(args.language ?? "").trim();
    const cacheKey = `gh_trending:${since}:${language.toLowerCase()}`;
    const repos = await cached<Array<{ name: string; url: string; description?: string; stars?: string }>>(cacheKey, ttls.trending, async () => {
      const url = new URL("https://github.com/trending");
      if (language) url.pathname += `/${encodeURIComponent(language)}`;
      url.searchParams.set("since", since);
      const r = await fetchText(url.toString(), { timeoutMs: 10_000, headers: { Accept: "text/html" } });
      if (!r.ok) return [];
      const out: Array<{ name: string; url: string; description?: string; stars?: string }> = [];
      const matches = Array.from(r.text.matchAll(/<h2 class="h3 lh-condensed">[\s\S]*?<a href="\/([^"]+)"[\s\S]*?<\/a>[\s\S]*?<p class="col-9[^"]*">([\s\S]*?)<\/p>[\s\S]*?(?:<a[^>]*>([\d,]+)\s*stars<\/a>)?/g)).slice(0, 15);
      for (const m of matches) {
        out.push({
          name: m[1],
          url: `https://github.com/${m[1]}`,
          description: m[2]?.trim(),
          stars: m[3],
        });
      }
      return out;
    });
    return { type: "trending_github", status: "ok", since, language: language || "any", repos, source: "GitHub" };
  },
};

// ─── rss_subscribe ──────────────────────────────────────────────────────────
export const rssSubscribe: ToolHandler = {
  definition: defineTool(
    "rss_subscribe",
    "Suscribe a un feed RSS como fuente para tu radar personal. Úsala cuando el usuario diga 'seguí el feed de The Verge', 'sumá El Chiringuito', 'agregá este RSS'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre amigable de la fuente." },
        url: { type: "string", description: "URL del feed RSS." },
      },
      required: ["name", "url"],
    },
  ),
  policy: policies.localWrite("Guarda suscripción RSS como memory."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const url = String(args.url ?? "").trim();
    if (!name || !url) return { type: "rss_subscribe", status: "failed", error: "Indicá nombre y URL del feed." };
    return {
      type: "rss_subscribe",
      status: "ok",
      name,
      url,
      memoryCandidates: [{
        kind: "interest" as const,
        text: `Sigue el RSS: ${name} (${url})`,
        confidence: 0.95,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: name,
        useForSuggestions: true,
      }],
    };
  },
};

// ─── rss_digest ─────────────────────────────────────────────────────────────
export const rssDigest: ToolHandler = {
  definition: defineTool(
    "rss_digest",
    "Lee tus feeds RSS suscritos y resume lo importante del día. Úsala cuando el usuario diga 'resumí mis feeds', 'qué hay de interesante en mis fuentes hoy'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        hours: { type: "number", description: "Ventana de horas. Default 24." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee feeds suscritos."),
  async run(args, ctx: ToolRunContext) {
    const hours = Number(args.hours ?? 24);
    // Buscar feeds en memorias.
    const feeds = (ctx.state.memories ?? [])
      .filter((m) => m.status === "confirmed" && m.text.toLowerCase().includes("rss:"))
      .map((m) => {
        const match = m.text.match(/RSS:\s*([^()]+)\s*\(([^)]+)\)/);
        return match ? { name: match[1].trim(), url: match[2].trim() } : null;
      })
      .filter((f): f is { name: string; url: string } => !!f);

    if (feeds.length === 0) {
      return { type: "rss_digest", status: "ok", hours, items: [], note: "No tenés feeds suscritos. Usá rss_subscribe para agregar." };
    }

    const since = Date.now() - hours * 60 * 60 * 1000;
    const items: Array<{ title: string; link: string; source: string; pubDate?: string }> = [];
    for (const feed of feeds.slice(0, 5)) {
      const r = await fetchText(feed.url, { timeoutMs: 8_000 });
      if (!r.ok) continue;
      // Parser XML simple para <item><title>...<link>...<pubDate>...
      const itemMatches = Array.from(r.text.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>(?:[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>)?/gi)).slice(0, 5);
      for (const m of itemMatches) {
        const pubDate = m[3]?.trim();
        const ts = pubDate ? new Date(pubDate).getTime() : 0;
        if (ts && ts < since) continue;
        items.push({ title: m[1].trim(), link: m[2].trim(), source: feed.name, pubDate });
      }
    }

    return { type: "rss_digest", status: "ok", hours, items: items.slice(0, 15), sources: feeds.map((f) => f.name) };
  },
};

// ─── news_radar_topic ───────────────────────────────────────────────────────
export const newsRadarTopic: ToolHandler = {
  definition: defineTool(
    "news_radar_topic",
    "Configura un radar: monitorea un tema en fuentes múltiples y Koru te avisará cuando aparezca novedad. Úsala cuando el usuario diga 'avisame cuando salga algo sobre el nuevo Zelda', 'radar de IA generativa', 'vigilar tema X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema a vigilar." },
      },
      required: ["topic"],
    },
  ),
  policy: policies.localWrite("Configura radar como memory/nudge."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "news_radar_topic", status: "failed", error: "Indicá el tema." };
    return {
      type: "news_radar_topic",
      status: "ok",
      topic,
      memoryCandidates: [{
        kind: "interest" as const,
        text: `Radar de noticias: vigilar "${topic}"`,
        confidence: 0.9,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: topic,
        useForSuggestions: true,
      }],
      note: `Radar activado para "${topic}". Te avisaré cuando aparezcan novedades relevantes.`,
    };
  },
};

// ─── world_signal ───────────────────────────────────────────────────────────
export const worldSignal: ToolHandler = {
  definition: defineTool(
    "world_signal",
    "Síntesis de qué se habla en el mundo sobre un tema (cross-fuente, sin ruido viral). Úsala cuando el usuario diga 'de qué se habla en el mundo sobre Argentina?', 'el mundo habla de X?', 'radar global de Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema a analizar." },
      },
      required: ["topic"],
    },
  ),
  policy: policies.readonly("Analiza señales globales de GDELT GKG."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "world_signal", status: "failed", error: "Indicá el tema." };
    const cacheKey = `world:${topic.toLowerCase()}`;
    const articles = await cached<GdeltArticle[]>(cacheKey, ttls.news, () => queryGdelt(`${topic} (tono:positivo OR tono:negativo) sourcelang:spa`, 8));
    if (articles.length === 0) {
      const sources = usableSources(await searchAndEnrich(`${topic} cobertura mundial últimas semanas`, 5));
      return { type: "world_signal", status: "ok", topic, articles: [], sources, note: "Datos de cobertura cruzada." };
    }
    return { type: "world_signal", status: "ok", topic, articles, source: "GDELT GKG" };
  },
};
