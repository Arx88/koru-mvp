/**
 * Scrapers web reutilizables. Encapsulan las llamadas a buscadores públicos
 * sin API key. Las tools de food/productos/trending usan estos helpers
 * y luego pasan los resultados por `extractor.ts` (anti-alucinación).
 *
 * NOTA: este código corre en el dev-server de Vite (Node), no en el navegador.
 */

import type { AssistantSource } from "../../domain/types";
import { fetchText, domainFromUrl, normalize, truncate } from "./fetcher";
import { limiters } from "./rateLimiter";

/** Limpia HTML a texto plano. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca en DuckDuckGo HTML (sin key) y devuelve hasta `max` fuentes. */
export async function searchDuckDuckGo(query: string, max = 6): Promise<AssistantSource[]> {
  await limiters.duckduckgo.acquire();
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const result = await fetchText(url, {
    headers: { Accept: "text/html" },
    timeoutMs: 12_000,
  });
  if (!result.ok) return [];
  const sources: AssistantSource[] = [];
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultRe.exec(result.text)) && sources.length < max) {
    let linkUrl = match[1];
    try {
      const parsed = new URL(linkUrl, "https://duckduckgo.com");
      linkUrl = parsed.searchParams.get("uddg") ?? parsed.href;
    } catch {
      // mantener url cruda
    }
    if (!/^https?:\/\//i.test(linkUrl)) continue;
    const domain = domainFromUrl(linkUrl);
    if (/duckduckgo\.com|google\.com|bing\.com/i.test(domain)) continue;
    sources.push({
      title: htmlToText(match[2]),
      url: linkUrl,
      domain,
      snippet: truncate(htmlToText(match[3]), 280),
    });
  }
  return sources;
}

/** Lee el contenido principal de una URL (article/main/párrafos largos). */
export async function fetchPageContent(url: string, maxChars = 1500): Promise<string> {
  const result = await fetchText(url, {
    headers: { Accept: "text/html" },
    timeoutMs: 9_000,
  });
  if (!result.ok) return "";
  const html = result.text;
  // Intentar article, luego main, luego párrafos largos.
  let body = html;
  const article = html!.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) {
    body = article[1];
  } else {
    const main = html!.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (main) body = main[1];
  }
  if (body === html) {
    const paragraphs = Array.from(html!.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => m[1].replace(/<[^>]+>/g, " ").trim())
      .filter((t) => t.length > 60);
    if (paragraphs.length) body = paragraphs.slice(0, 6).join(" ");
  }
  return truncate(htmlToText(body), maxChars);
}

/** Filtra fuentes no usables (buscadores, sin https, vacías). */
export function usableSources(sources: AssistantSource[]): AssistantSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (!s.url || !/^https?:\/\//i.test(s.url)) return false;
    if (/duckduckgo\.com|google\.com|bing\.com/i.test(s.domain)) return false;
    if (!s.title || s.title.length < 3) return false;
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

/** Búsqueda compuesta: DuckDuckGo + scrapeo del contenido de los top resultados. */
export async function searchAndEnrich(query: string, max = 5): Promise<AssistantSource[]> {
  const base = await searchDuckDuckGo(query, max);
  const enriched = await Promise.all(
    base.slice(0, 3).map(async (source) => {
      const content = await fetchPageContent(source.url, 1500).catch(() => "");
      return content ? { ...source, content } : source;
    }),
  );
  return usableSources(enriched);
}

/** Comprueba si un texto menciona la query (para filtrar resultados irrelevantes). */
export function mentions(text: string, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return true;
  const haystack = normalize(text);
  return tokens.some((t) => haystack.includes(t));
}
