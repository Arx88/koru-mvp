import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { runKoruBackendTurn, type KoruBackendTurnRequest, type ProviderConfig } from "./src/server/koruBackend";
import { logger } from "./src/server/logger";

function collectOpenRouterKeys(env: Record<string, string>): string[] {
  const keys = [env.OPENROUTER_API_KEY, env.OPENROUTER_FALLBACK_API_KEYS]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function collectOpenRouterModels(env: Record<string, string>): string[] {
  const models = (env.OPENROUTER_FALLBACK_MODELS || "nvidia/nemotron-3-ultra-550b-a55b:free,openai/gpt-oss-120b:free,google/gemma-4-31b-it:free")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(models));
}

function collectBlueSmindsKeys(env: Record<string, string>): string[] {
  const keys = [env.BLUESMINDS_API_KEY, env.BLUESMINDS_FALLBACK_API_KEYS]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function collectBlueSmindsModel(env: Record<string, string>): string {
  return (env.BLUESMINDS_MODEL || "mimo-v2.5").trim();
}

function bodyHasAssistantContent(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = parsed.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim().length > 0 : Boolean(content);
  } catch {
    return raw.trim().length > 0;
  }
}

function providerUrl(baseUrl: string, targetPath: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = targetPath.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

type WebSearchMode = "news" | "shopping" | "research" | "weather" | "traffic" | "market" | "world";

type WebSearchRequest = {
  queries?: string[];
  criteria?: string[];
  mode?: WebSearchMode;
  title?: string;
  body?: string;
};

type WebSource = {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
};

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "fuente externa";
  }
}

function sourceFromRaw(item: Record<string, unknown>): WebSource | null {
  const url = typeof item.url === "string"
    ? item.url
    : typeof item.link === "string"
      ? item.link
      : undefined;
  const title = typeof item.title === "string"
    ? item.title
    : typeof item.name === "string"
      ? item.name
      : undefined;
  if (!url || !title) return null;
  return {
    title,
    url,
    domain: domainFromUrl(url),
    snippet: typeof item.snippet === "string"
      ? item.snippet
      : typeof item.description === "string"
        ? item.description
        : typeof item.content === "string"
          ? item.content
          : undefined,
  };
}

function uniqueWebSources(sources: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 8);
}

function fallbackSearchSources(queries: string[], mode: WebSearchMode): WebSource[] {
  return queries.slice(0, 3).map((query) => ({
    title: mode === "news" ? "Consulta de noticias preparada" : mode === "shopping" ? "Consulta comparativa preparada" : "Consulta web preparada",
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    domain: "google.com",
    snippet: "No es una fuente verificada: abre esta consulta manualmente si no hay conector configurado.",
  }));
}

function comparisonItemsFromSources(sources: WebSource[]) {
  return sources.slice(0, 5).map((source, index) => ({
    title: source.title,
    price: priceFromEvidence(`${source.title} ${source.snippet ?? ""}`),
    vendor: source.domain,
    url: source.url,
    evidence: source.snippet,
    score: Math.max(45, 88 - index * 8),
  }));
}

function priceFromEvidence(text: string): string | undefined {
  return /(?:€|\$)\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:EUR|USD|ARS|€|\$)\b/i.exec(text)?.[0];
}

function newsSummaryItems(sources: WebSource[]) {
  return sources.slice(0, 4).map((source, index) => ({
    label: index === 0 ? "Principal" : "Fuente",
    value: source.title,
    detail: source.domain,
  }));
}

function parseOpenMeteoLocation(query: string): { label: string; latitude: number; longitude: number } | null {
  const normalized = query.toLowerCase();
  const known: Array<{ names: string[]; label: string; latitude: number; longitude: number }> = [
    { names: ["madrid"], label: "Madrid", latitude: 40.4168, longitude: -3.7038 },
    { names: ["barcelona"], label: "Barcelona", latitude: 41.3874, longitude: 2.1686 },
    { names: ["buenos aires"], label: "Buenos Aires", latitude: -34.6037, longitude: -58.3816 },
    { names: ["cordoba argentina", "córdoba argentina"], label: "Cordoba, Argentina", latitude: -31.4201, longitude: -64.1888 },
    { names: ["new york", "nueva york"], label: "New York", latitude: 40.7128, longitude: -74.006 },
    { names: ["miami"], label: "Miami", latitude: 25.7617, longitude: -80.1918 },
    { names: ["san francisco"], label: "San Francisco", latitude: 37.7749, longitude: -122.4194 },
  ];
  return known.find((item) => item.names.some((name) => normalized.includes(name))) ?? null;
}

async function queryOpenMeteo(queries: string[]): Promise<WebSource[]> {
  const location = parseOpenMeteoLocation(queries.join(" "));
  if (!location) return [];
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as {
    current?: { temperature_2m?: number; precipitation?: number; wind_speed_10m?: number };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
  };
  const current = data.current;
  if (!current) return [];
  const max = data.daily?.temperature_2m_max?.[0];
  const min = data.daily?.temperature_2m_min?.[0];
  const rain = data.daily?.precipitation_probability_max?.[0];
  return [{
    title: `Clima actual en ${location.label}`,
    url: "https://open-meteo.com/",
    domain: "open-meteo.com",
    snippet: [
      `${current.temperature_2m ?? "?"} C ahora`,
      max !== undefined && min !== undefined ? `${min}-${max} C hoy` : undefined,
      rain !== undefined ? `${rain}% probabilidad de lluvia` : undefined,
      current.wind_speed_10m !== undefined ? `viento ${current.wind_speed_10m} km/h` : undefined,
    ].filter(Boolean).join(" · "),
  }];
}

async function queryGdelt(queries: string[]): Promise<WebSource[]> {
  const query = queries[0] ?? "";
  if (!query) return [];
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "8");
  url.searchParams.set("sort", "HybridRel");
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { articles?: Array<Record<string, unknown>> };
  return (data.articles ?? []).map((item) => sourceFromRaw({
    title: item.title,
    url: item.url,
    domain: item.domain,
    snippet: item.seendate,
  })).filter(Boolean) as WebSource[];
}

async function querySearXng(env: Record<string, string>, queries: string[]): Promise<WebSource[]> {
  const baseUrl = env.SEARXNG_BASE_URL?.trim();
  if (!baseUrl) return [];
  const sources: WebSource[] = [];
  for (const query of queries.slice(0, 3)) {
    const url = new URL(providerUrl(baseUrl, "/search"));
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "es-ES");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) continue;
    const data = await response.json() as { results?: Array<Record<string, unknown>> };
    sources.push(...((data.results ?? []).map(sourceFromRaw).filter(Boolean) as WebSource[]));
  }
  return sources;
}

async function queryOsrmRoute(queries: string[]): Promise<WebSource[]> {
  const text = queries.join(" ").toLowerCase();
  const madridCenter = "-3.7038,40.4168";
  const madridAirport = "-3.5676,40.4983";
  if (!text.includes("madrid") || !(text.includes("aeropuerto") || text.includes("barajas"))) return [];
  const url = `https://router.project-osrm.org/route/v1/driving/${madridCenter};${madridAirport}?overview=false&alternatives=false&steps=false`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { routes?: Array<{ duration?: number; distance?: number }> };
  const route = data.routes?.[0];
  if (!route) return [];
  return [{
    title: "Ruta estimada Madrid centro - Aeropuerto",
    url: "https://project-osrm.org/",
    domain: "project-osrm.org",
    snippet: `${Math.round((route.duration ?? 0) / 60)} min estimados, ${Math.round((route.distance ?? 0) / 1000)} km. No incluye trafico en vivo.`,
  }];
}

async function queryBrave(env: Record<string, string>, queries: string[]): Promise<WebSource[]> {
  const key = env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return [];
  const sources: WebSource[] = [];
  for (const query of queries.slice(0, 3)) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
    });
    if (!response.ok) continue;
    const data = await response.json() as { web?: { results?: Array<Record<string, unknown>> } };
    sources.push(...(data.web?.results ?? []).map(sourceFromRaw).filter(Boolean) as WebSource[]);
  }
  return sources;
}

async function querySerper(env: Record<string, string>, queries: string[], mode: WebSearchMode): Promise<WebSource[]> {
  const key = env.SERPER_API_KEY?.trim();
  if (!key) return [];
  const sources: WebSource[] = [];
  for (const query of queries.slice(0, 3)) {
    const response = await fetch(`https://google.serper.dev/${mode === "news" ? "news" : "search"}`, {
      method: "POST",
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 6 }),
    });
    if (!response.ok) continue;
    const data = await response.json() as { organic?: Array<Record<string, unknown>>; news?: Array<Record<string, unknown>> };
    sources.push(...((data.news ?? data.organic ?? []).map(sourceFromRaw).filter(Boolean) as WebSource[]));
  }
  return sources;
}

async function queryTavily(env: Record<string, string>, queries: string[]): Promise<WebSource[]> {
  const key = env.TAVILY_API_KEY?.trim();
  if (!key) return [];
  const sources: WebSource[] = [];
  for (const query of queries.slice(0, 2)) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query, max_results: 6, search_depth: "basic" }),
    });
    if (!response.ok) continue;
    const data = await response.json() as { results?: Array<Record<string, unknown>> };
    sources.push(...(data.results ?? []).map(sourceFromRaw).filter(Boolean) as WebSource[]);
  }
  return sources;
}

async function queryNewsApi(env: Record<string, string>, queries: string[]): Promise<WebSource[]> {
  const key = env.NEWS_API_KEY?.trim();
  if (!key) return [];
  const query = queries[0] ?? "";
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=8&language=es`;
  const response = await fetch(url, { headers: { "X-Api-Key": key } });
  if (!response.ok) return [];
  const data = await response.json() as { articles?: Array<Record<string, unknown>> };
  return (data.articles ?? []).map(sourceFromRaw).filter(Boolean) as WebSource[];
}

async function queryGNews(env: Record<string, string>, queries: string[]): Promise<WebSource[]> {
  const key = env.GNEWS_API_KEY?.trim();
  if (!key) return [];
  const query = queries[0] ?? "";
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=es&max=8&apikey=${encodeURIComponent(key)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { articles?: Array<Record<string, unknown>> };
  return (data.articles ?? []).map(sourceFromRaw).filter(Boolean) as WebSource[];
}

function browserNavigationEnabled(env: Record<string, string>): boolean {
  return !["0", "false", "off"].includes((env.KORU_BROWSER_NAVIGATION ?? "on").trim().toLowerCase());
}

function browserQueryFor(query: string, mode: WebSearchMode): string {
  if (mode === "news") return `${query} noticias recientes`;
  if (mode === "world") return `${query} tendencias ultimos 30 dias debate`;
  if (mode === "shopping") return `${query} precio entrega devoluciones`;
  if (mode === "weather") return `${query} clima hoy`;
  if (mode === "traffic") return `${query} trafico ruta tiempo estimado`;
  if (mode === "market") return `${query} precio mercado hoy`;
  return query;
}

function cleanSearchResultUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const decoded = parsed.searchParams.get("uddg") || parsed.searchParams.get("u");
    if (decoded) return decoded;
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

function isUsableBrowserSource(source: WebSource): boolean {
  if (!/^https?:\/\//i.test(source.url)) return false;
  return !/(^|\.)duckduckgo\.com$|(^|\.)bing\.com$|(^|\.)google\.com$/i.test(source.domain);
}

async function extractDuckDuckGoResults(page: {
  goto: (url: string, options: Record<string, unknown>) => Promise<unknown>;
  $$eval: <T>(selector: string, pageFunction: (elements: Element[]) => T) => Promise<T>;
}, query: string): Promise<WebSource[]> {
  await page.goto(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  const raw = await page.$$eval("a.result__a", (anchors) =>
    anchors.slice(0, 8).map((anchor) => {
      const link = anchor as HTMLAnchorElement;
      const container = link.closest(".result");
      const snippet = container?.querySelector(".result__snippet")?.textContent?.trim();
      return {
        title: link.textContent?.trim() ?? "",
        url: link.href,
        snippet,
      };
    }),
  );
  return raw
    .map((item) => {
      const url = cleanSearchResultUrl(item.url);
      return {
        title: item.title,
        url,
        domain: domainFromUrl(url),
        snippet: item.snippet,
      };
    })
    .filter((item) => item.title && isUsableBrowserSource(item));
}

async function extractBingResults(page: {
  goto: (url: string, options: Record<string, unknown>) => Promise<unknown>;
  $$eval: <T>(selector: string, pageFunction: (elements: Element[]) => T) => Promise<T>;
}, query: string): Promise<WebSource[]> {
  await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  const raw = await page.$$eval("li.b_algo", (items) =>
    items.slice(0, 8).map((item) => {
      const link = item.querySelector("h2 a") as HTMLAnchorElement | null;
      const snippet = item.querySelector(".b_caption p")?.textContent?.trim();
      return {
        title: link?.textContent?.trim() ?? "",
        url: link?.href ?? "",
        snippet,
      };
    }),
  );
  return raw
    .map((item) => ({
      title: item.title,
      url: item.url,
      domain: domainFromUrl(item.url),
      snippet: item.snippet,
    }))
    .filter((item) => item.title && isUsableBrowserSource(item));
}

async function enrichSourcesWithBrowserPages(page: {
  goto: (url: string, options: Record<string, unknown>) => Promise<unknown>;
  evaluate: <T, A>(pageFunction: (arg: A) => T, arg: A) => Promise<T>;
}, sources: WebSource[], mode: WebSearchMode): Promise<WebSource[]> {
  const enriched: WebSource[] = [];
  for (const source of sources.slice(0, 5)) {
    try {
      await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 12_000 });
      const detail = await page.evaluate((currentMode) => {
        const meta =
          document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ||
          document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ||
          document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content ||
          "";
        const title =
          document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ||
          document.title ||
          "";
        const body = document.body?.innerText?.replace(/\s+/g, " ").slice(0, 4_000) ?? "";
        const price = currentMode === "shopping"
          ? body.match(/(?:€|\$)\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:EUR|USD|ARS|€|\$)\b/i)?.[0]
          : undefined;
        return {
          title: title.trim(),
          snippet: [price, meta || body.slice(0, 220)].filter(Boolean).join(" · "),
        };
      }, mode);
      enriched.push({
        ...source,
        title: detail.title || source.title,
        snippet: detail.snippet || source.snippet,
      });
    } catch {
      enriched.push(source);
    }
  }
  return enriched;
}

async function queryPlaywrightSearch(env: Record<string, string>, queries: string[], mode: WebSearchMode): Promise<WebSource[]> {
  if (!browserNavigationEnabled(env)) return [];
  let browser: { close: () => Promise<void>; newPage: (options?: Record<string, unknown>) => Promise<{
    setDefaultTimeout: (timeout: number) => void;
    goto: (url: string, options: Record<string, unknown>) => Promise<unknown>;
    $$eval: <T>(selector: string, pageFunction: (elements: Element[]) => T) => Promise<T>;
    evaluate: <T, A>(pageFunction: (arg: A) => T, arg: A) => Promise<T>;
  }> } | undefined;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 KoruLocalBrowser/1.0",
      locale: "es-ES",
    });
    page.setDefaultTimeout(8_000);

    const sources: WebSource[] = [];
    for (const query of queries.slice(0, 2)) {
      const browserQuery = browserQueryFor(query, mode);
      let results: WebSource[] = [];
      try {
        results = await extractDuckDuckGoResults(page, browserQuery);
      } catch {
        results = [];
      }
      if (!results.length) {
        try {
          results = await extractBingResults(page, browserQuery);
        } catch {
          results = [];
        }
      }
      sources.push(...results);
    }

    return uniqueWebSources(await enrichSourcesWithBrowserPages(page, sources, mode));
  } catch {
    return [];
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function koruWebProxy(env: Record<string, string>): Plugin {
  return {
    name: "koru-web-proxy",
    configureServer(server) {
      server.middlewares.use("/koru-web/search", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(body || "{}") as WebSearchRequest;
        const queries = (parsed.queries ?? []).map((query) => query.trim()).filter(Boolean).slice(0, 4);
        const mode = parsed.mode ?? "research";

        if (!queries.length) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: "failed", sources: [], recommendation: "Falta una consulta concreta." }));
          return;
        }

        try {
          const providerResults = uniqueWebSources([
            ...(mode === "weather" ? await queryOpenMeteo(queries) : []),
            ...(mode === "traffic" ? await queryOsrmRoute(queries) : []),
            ...(mode === "news" || mode === "world" || mode === "market" ? await queryGdelt(queries) : []),
            ...(await querySearXng(env, queries)),
            ...(mode === "news" || mode === "world" ? await queryNewsApi(env, queries) : []),
            ...(mode === "news" || mode === "world" ? await queryGNews(env, queries) : []),
            ...(await queryBrave(env, queries)),
            ...(await querySerper(env, queries, mode)),
            ...(await queryTavily(env, queries)),
          ]);
          const browserResults = providerResults.length ? [] : await queryPlaywrightSearch(env, queries, mode);
          const webResults = uniqueWebSources([...providerResults, ...browserResults]);

          const hasConfiguredProvider = Boolean(
            env.BRAVE_SEARCH_API_KEY?.trim() ||
            env.SERPER_API_KEY?.trim() ||
            env.TAVILY_API_KEY?.trim() ||
            env.NEWS_API_KEY?.trim() ||
            env.GNEWS_API_KEY?.trim() ||
            env.SEARXNG_BASE_URL?.trim() ||
            mode === "weather" ||
            mode === "traffic" ||
            mode === "news" ||
            mode === "world" ||
            mode === "market",
          );

          if (!hasConfiguredProvider && !browserNavigationEnabled(env)) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              status: "not_configured",
              verifiedAt: new Date().toISOString(),
              sources: fallbackSearchSources(queries, mode),
              recommendation: "No hay API de busqueda/noticias configurada. No lei la web; deje consultas manuales trazables.",
            }));
            return;
          }

          if (!webResults.length) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              status: "partial",
              verifiedAt: new Date().toISOString(),
              sources: fallbackSearchSources(queries, mode),
              recommendation: browserNavigationEnabled(env)
                ? "Intente navegar con Playwright, pero no consegui evidencia util. Deje busquedas manuales para continuar sin inventar."
                : "Los conectores configurados no devolvieron resultados utiles; deje busquedas manuales para continuar.",
            }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            status: "verified",
            verifiedAt: new Date().toISOString(),
            sources: webResults,
            comparisonItems: mode === "shopping" ? comparisonItemsFromSources(webResults) : undefined,
            summaryItems: mode === "news" || mode === "world" ? newsSummaryItems(webResults) : undefined,
            recommendation: mode === "shopping"
              ? browserResults.length
                ? "Navegue con Playwright, abri resultados reales y compare evidencia visible. Antes de comprar, confirma precio final y entrega en el vendedor."
                : "Compare resultados por evidencia disponible. Antes de comprar, abre el vendedor y confirma precio final y entrega."
              : mode === "news"
                ? browserResults.length
                  ? "Navegue fuentes reales con Playwright, priorice actualidad y separe titulares de accion posible para tu trabajo."
                  : "Priorice fuentes recientes y separo titulares de accion posible para tu trabajo."
                : mode === "world"
                  ? browserResults.length
                    ? "Navegue senales recientes con Playwright y deje fuentes para que decidas si quieres seguir este radar."
                    : "Filtre senales recientes con fuentes abiertas. Si esto te sirve, puedes dejarlo como radar proactivo."
                : mode === "weather"
                  ? "Use Open-Meteo como fuente abierta; si necesitas ropa para reunion, cruzo clima con horario y contexto."
                  : mode === "traffic"
                    ? "Use rutas abiertas. Esto estima traslado, no trafico en vivo; para trafico real conviene conector dedicado o navegador local."
                    : browserResults.length
                      ? "Navegue con Playwright y deje fuentes reales para seguir investigando sin inventar conclusiones."
                      : "Deje fuentes reales para revisar y seguir investigando sin inventar conclusiones.",
          }));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            status: "failed",
            sources: fallbackSearchSources(queries, mode),
            recommendation: error instanceof Error ? error.message : "Fallo la navegacion web.",
          }));
        }
      });
    },
  };
}

function prepareJsonBody(raw: Buffer, patch: Record<string, unknown>, stripForNvidia = false): Buffer {
  const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  const body = {
    ...parsed,
    ...patch,
    stream: false,
  };
  if (stripForNvidia) {
    delete body.plugins;
    delete body.reasoning;
    delete body.response_format;
  }
  return Buffer.from(JSON.stringify(body));
}

function koruAiProxy(env: Record<string, string>): Plugin {
  const openRouterKeys = collectOpenRouterKeys(env);
  const openRouterModels = collectOpenRouterModels(env);
  const nvidiaKey = env.NVIDIA_API_KEY?.trim();
  const nvidiaBaseUrl = env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com";
  const nvidiaModel = env.NVIDIA_MODEL?.trim() || "minimaxai/minimax-m3";

  return {
    name: "koru-ai-proxy",
    configureServer(server) {
      server.middlewares.use("/koru-ai", async (req, res) => {
        if (!nvidiaKey && !openRouterKeys.length) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: { message: "No hay proveedor de IA configurado." } }));
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        const targetPath = req.url?.replace(/^\/?/, "") ?? "";
        let lastStatus = 502;
        let lastBody = JSON.stringify({ error: { message: "Ningun proveedor respondio con contenido usable." } });
        let lastContentType = "application/json";

        if (nvidiaKey) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 55_000);
          try {
            const response = await fetch(providerUrl(nvidiaBaseUrl, targetPath), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${nvidiaKey}`,
                "Content-Type": req.headers["content-type"] ?? "application/json",
                Accept: "application/json",
              },
              body: prepareJsonBody(body, { model: nvidiaModel, top_p: 0.95 }, true),
              signal: controller.signal,
            });
            const responseBody = await response.text();
            lastStatus = response.status;
            lastBody = responseBody;
            lastContentType = response.headers.get("content-type") ?? "application/json";

            if (response.ok && bodyHasAssistantContent(responseBody)) {
              res.statusCode = response.status;
              res.setHeader("Content-Type", lastContentType);
              res.end(responseBody);
              return;
            }
          } catch (error) {
            lastStatus = 504;
            lastBody = JSON.stringify({
              error: {
                message: error instanceof Error ? error.message : "NVIDIA no respondio a tiempo.",
                provider: "nvidia",
                model: nvidiaModel,
              },
            });
            lastContentType = "application/json";
          } finally {
            clearTimeout(timeout);
          }
        }

        for (const model of openRouterModels) {
          for (const key of openRouterKeys) {
            const response = await fetch(providerUrl("https://openrouter.ai/api", targetPath), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": req.headers["content-type"] ?? "application/json",
                "HTTP-Referer": "http://localhost:5173",
                "X-OpenRouter-Title": "Koru MVP",
              },
              body: prepareJsonBody(body, {
                model,
                response_format: { type: "json_object" },
                plugins: [{ id: "response-healing" }],
                reasoning: { exclude: true },
              }),
            });
            const responseBody = await response.text();
            lastStatus = response.status;
            lastBody = responseBody;
            lastContentType = response.headers.get("content-type") ?? "application/json";

            if (response.ok && bodyHasAssistantContent(responseBody)) {
              res.statusCode = response.status;
              res.setHeader("Content-Type", lastContentType);
              res.end(responseBody);
              return;
            }
          }
        }

        res.statusCode = lastStatus;
        res.setHeader("Content-Type", lastContentType);
        res.end(lastBody);
      });
    },
  };
}

function readMiniMaxToken(): string | undefined {
  try {
    const tokenPath = join(dirname(fileURLToPath(import.meta.url)), "minimax-oauth-token.json");
    if (!existsSync(tokenPath)) return undefined;
    const data = JSON.parse(readFileSync(tokenPath, "utf-8")) as { accessToken?: string };
    return data.accessToken;
  } catch {
    return undefined;
  }
}

function koruBackendAgent(env: Record<string, string>): Plugin {
  const config: ProviderConfig = {
    nvidiaApiKey: env.NVIDIA_API_KEY?.trim(),
    nvidiaBaseUrl: env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
    nvidiaModel: env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
    // Fase 4.1: router de modelos NVIDIA. 2 tiers.
    // Trivial (hola, gracias): flash model (~20s, más barato)
    // Todo lo demás: ultra model (~40s, máxima calidad)
    // Nota: se probó nemotron-3-nano-30b-a3b como medium pero no seguía
    // el system prompt (devolvía chain-of-thought) y era más lento que ultra.
    nvidiaFastModel: env.NVIDIA_FAST_MODEL?.trim() || "nvidia/nemotron-3-nano-30b-a3b",
    openRouterKeys: collectOpenRouterKeys(env),
    openRouterModels: collectOpenRouterModels(env),
    minimaxAccessToken: readMiniMaxToken(),
    bluesmindsKeys: collectBlueSmindsKeys(env),
    bluesmindsModel: collectBlueSmindsModel(env),
    ollamaEmbedBaseUrl: env.OLLAMA_EMBED_BASE_URL?.trim() || undefined,
  };

  return {
    name: "koru-backend-agent",
    configureServer(server) {
      server.middlewares.use("/api/koru/models", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET");
          res.end();
          return;
        }
        const predefined: Array<{ id: string; provider: string; label: string }> = [];
        if (config.bluesmindsKeys.length) {
          predefined.push({ id: config.bluesmindsModel, provider: "bluesminds", label: `BlueSminds ${config.bluesmindsModel}` });
        }
        if (config.minimaxAccessToken) {
          predefined.push({ id: "MiniMax-M2.7", provider: "minimax", label: "MiniMax M2.7" });
        }
        if (config.nvidiaApiKey) {
          predefined.push({ id: config.nvidiaModel, provider: "nvidia", label: "NVIDIA Nemotron 3 Ultra" });
        }
        for (const m of config.openRouterModels.slice(0, 3)) {
          predefined.push({ id: m, provider: "openrouter", label: m });
        }
        try {
          const isOllama = config.nvidiaBaseUrl.includes(":11434") || config.nvidiaBaseUrl.includes("ollama");
          if (isOllama) {
            const ollamaUrl = config.nvidiaBaseUrl.replace("/v1", "").replace(/\/$/, "");
            const response = await fetch(ollamaUrl + "/api/tags", { method: "GET" });
            if (response.ok) {
              const data = await response.json();
              const dynamic = (data.models || []).map((m: any) => ({
                id: m.name,
                provider: "ollama",
                label: m.name,
              })).filter((m: any) => m.id);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ models: [...predefined, ...dynamic] }));
              return;
            }
          }
        } catch { /* fallthrough */ }
        const fallback = [
          { id: "koru-qwen-32k:latest", provider: "ollama", label: "Koru Qwen 32k" },
          { id: "qwen3.6:27b", provider: "ollama", label: "Qwen 3.6 27B" },
          { id: "koru-gemma-16k:latest", provider: "ollama", label: "Koru Gemma 16k" },
          { id: "llama3.1:8b", provider: "ollama", label: "Llama 3.1 8B" },
          { id: "deepseek-r1:32b", provider: "ollama", label: "DeepSeek R1 32B" },
        ];
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ models: [...predefined, ...fallback] }));
      });

      // Fase 3.8 — VLM para análisis de imágenes (OCR, descripción, etc.).
      // El cliente sube una imagen (base64), este endpoint la analiza con
      // z-ai-web-dev-sdk VLM y devuelve el texto/análisis.
      server.middlewares.use("/api/koru/vlm", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");

        try {
          const body = JSON.parse(raw || "{}") as { image_base64?: string; prompt?: string };
          if (!body.image_base64) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Falta image_base64" }));
            return;
          }

          const { default: ZAI } = await import("z-ai-web-dev-sdk");
          const zai = await ZAI.create();
          const prompt = body.prompt || "Extraé todo el texto visible en la imagen, preservando estructura. Si no hay texto, describí qué se ve.";
          const response = await zai.chat.completions.createVision({
            messages: [{
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.image_base64}` } },
              ],
            }],
            thinking: { type: "disabled" },
          });
          const text = response.choices?.[0]?.message?.content ?? "";
          logger.info("koru-vlm", "Imagen analizada", { textLength: text.length });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ text }));
        } catch (err: any) {
          logger.error("koru-vlm", "Error analizando imagen", { error: err?.message });
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message ?? "Error de VLM" }));
        }
      });

      // Fase 2.1 — ASR para notas de voz.
      // El cliente graba audio (MediaRecorder) o sube un archivo .wav/.mp3,
      // lo manda como base64, este endpoint lo transcribe con z-ai-web-dev-sdk
      // y devuelve el texto. El cliente lo manda como mensaje normal a /api/koru/turn.
      server.middlewares.use("/api/koru/asr", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");

        try {
          const body = JSON.parse(raw || "{}") as { audio_base64?: string };
          if (!body.audio_base64) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Falta audio_base64" }));
            return;
          }

          // z-ai-web-dev-sdk es server-side only. Import dinámico para no
          // romper el bundle del cliente.
          const { default: ZAI } = await import("z-ai-web-dev-sdk");
          const zai = await ZAI.create();
          const response = await zai.audio.asr.create({
            file_base64: body.audio_base64,
          });
          logger.info("koru-asr", "Audio transcrito", { textLength: response.text?.length ?? 0 });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ text: response.text ?? "" }));
        } catch (err: any) {
          logger.error("koru-asr", "Error transcribiendo audio", { error: err?.message });
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message ?? "Error de ASR" }));
        }
      });

      server.middlewares.use("/api/koru/turn", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");

        try {
          if (!config.nvidiaApiKey && !config.openRouterKeys.length) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "No hay proveedor de IA configurado para Koru." }));
            return;
          }

          const request = JSON.parse(raw || "{}") as KoruBackendTurnRequest & { stream?: boolean; model?: string };
          if (request.model) {
            (request as KoruBackendTurnRequest).model = request.model;
          }
          logger.info("koru-turn", "Request received", { input: request.input, historyLength: request.history.length, model: request.model || config.nvidiaModel });
          if (!request.input?.trim() || !request.state || !Array.isArray(request.history)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Payload incompleto para /api/koru/turn." }));
            return;
          }

          const startMs = Date.now();
          const streamEnabled = request.stream === true;
          if (streamEnabled) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/x-ndjson");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            const chunks: string[] = [];
            const onChunk = (chunk: import("./src/server/koruBackend").KoruBackendTurnResponse) => {
              const line = JSON.stringify(chunk) + "\n";
              chunks.push(line);
              res.write(line);
            };
            const result = await runKoruBackendTurn(request, config, onChunk);
            const line = JSON.stringify(result) + "\n";
            if (!chunks.includes(line)) res.write(line);
            res.end();
          } else {
            const result = await runKoruBackendTurn(request, config);
            const durationMs = Date.now() - startMs;
            // eslint-disable-next-line no-console
            console.log("[KORU TURN]", new Date().toISOString(), "|", request.input.slice(0,40), "| provider:", result.provider, "| model:", result.model ?? "none", "| fallbackReason:", result.fallbackReason ?? "none", "| durationMs:", durationMs, "| replyPreview:", (result.reply ?? "").slice(0,60));
            try {
              const dir = join(process.cwd(), "logs");
              mkdirSync(dir, { recursive: true });
              const line = JSON.stringify({ ts: new Date().toISOString(), input: request.input, provider: result.provider, model: result.model, fallbackReason: result.fallbackReason, reply: result.reply, durationMs }) + "\n";
              appendFileSync(join(dir, "koru-turns.jsonl"), line, "utf8");
            } catch { /* silencioso */ }
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
            logger.info("koru-turn", "Response sent", { replyPreview: (result.reply ?? "").slice(0, 200), provider: result.provider, model: result.model });
          }
        } catch (error) {
          logger.error("koru-turn", "Backend error", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
          if (res.headersSent) {
            res.write(JSON.stringify({
              error: error instanceof Error ? error.message : "Fallo el loop de agente de Koru.",
              reply: "No pude procesar tu mensaje. El modelo no respondió a tiempo.",
              uiBlocks: [],
              suggestedActions: [],
              understanding: { literalRequest: "", userGoal: "error", unstatedNeeds: [], assumptions: [], confidence: 0 },
              memoryCandidates: [], commitments: [], records: [], toolResults: [],
              stateEvents: [{ kind: "done", label: "Error" }],
              mascotState: "tired",
              provider: "nvidia",
              fallbackReason: "server-error",
            }) + "\n");
            res.end();
          } else {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              error: error instanceof Error ? error.message : "Fallo el loop de agente de Koru.",
            }));
          }
        }
      });
    },
  };
}

function koruAuditLogger(): Plugin {
  return {
    name: "koru-audit-logger",
    configureServer(server) {
      server.middlewares.use("/koru-audit/log", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
          const dir = join(process.cwd(), "manual-audits");
          mkdirSync(dir, { recursive: true });
          const line = `${JSON.stringify({ serverReceivedAt: new Date().toISOString(), ...parsed })}\n`;
          const target = join(dir, "koru-current.jsonl");
          if (parsed.type === "audit_reset") writeFileSync(target, line, "utf8");
          else appendFileSync(target, line, "utf8");
          res.statusCode = 204;
          res.end();
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid audit payload" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [koruBackendAgent(env), koruAiProxy(env), koruWebProxy(env), koruAuditLogger(), tailwindcss(), react()],
    build: {
      rollupOptions: {
        input: {
          main: new URL("./index.html", import.meta.url).pathname,
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      cors: true,
      watch: {
        ignored: ["**/manual-audits/**"],
      },
      proxy: {
        "/ollama": {
          target: "http://127.0.0.1:11434",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ollama/, ""),
        },
      },
    },
  };
});
