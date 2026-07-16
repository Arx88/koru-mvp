/**
 * RSS feed reader — sin API key.
 *
 * Parsea feeds RSS/Atom XML con DOMParser (disponible en browser y en Node
 * con jsdom). Devuelve items normalizados: title, link, pubDate.
 *
 * Fuentes por defecto:
 *   - BBC World:        http://feeds.bbci.co.uk/news/world/rss.xml
 *   - Reuters World:    https://www.reuters.com/world/rss
 *   - ElDiario:         https://www.eldiario.es/rss/
 *
 * Usado por newsUrgent.ts cuando NEWSAPI_KEY no está configurado, como
 * fuente adicional para no quedarse sin titulares.
 */

import { fetchText } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";

export type RssItem = {
  title: string;
  link: string;
  pubDate: string;
};

export type RssFeed = {
  url: string;
  title?: string;
  items: RssItem[];
};

/** Fuentes RSS por defecto para noticias mundiales. */
export const DEFAULT_RSS_SOURCES: string[] = [
  "http://feeds.bbci.co.uk/news/world/rss.xml",
  "https://www.reuters.com/world/rss",
  "https://www.eldiario.es/rss/",
];

/**
 * Obtiene el primer texto de un elemento XML, si existe.
 */
function getText(parent: Element | Document, tag: string): string | undefined {
  const el = parent.querySelector(tag);
  const txt = el?.textContent?.trim();
  return txt || undefined;
}

/**
 * Parsea un XML de RSS/Atom a items normalizados.
 *
 * Soporta:
 *   - RSS 2.0: <item><title><link><pubDate>
 *   - Atom:    <entry><title><link href=""><updated>/<published>
 */
export function parseRssXml(xml: string, feedUrl?: string): RssFeed {
  const items: RssItem[] = [];
  let feedTitle: string | undefined;
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    // Error de parseo.
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return { url: feedUrl ?? "", items: [] };
    }
    feedTitle = getText(doc, "channel > title") || getText(doc, "feed > title");

    // RSS 2.0 items.
    const rssItems = Array.from(doc.querySelectorAll("item"));
    for (const it of rssItems) {
      const title = it.querySelector("title")?.textContent?.trim();
      const link = it.querySelector("link")?.textContent?.trim();
      const pubDate =
        it.querySelector("pubDate")?.textContent?.trim() ||
        it.querySelector("published")?.textContent?.trim() ||
        it.querySelector("date")?.textContent?.trim() ||
        "";
      if (title && link) {
        items.push({ title, link, pubDate });
      }
    }
    if (items.length > 0) {
      return { url: feedUrl ?? "", title: feedTitle, items };
    }

    // Atom entries (fallback).
    const entries = Array.from(doc.querySelectorAll("entry"));
    for (const e of entries) {
      const title = e.querySelector("title")?.textContent?.trim();
      // Atom link es <link href="..." />, no texto.
      const linkEl = e.querySelector("link");
      const link =
        linkEl?.getAttribute("href") || linkEl?.textContent?.trim() || "";
      const pubDate =
        e.querySelector("updated")?.textContent?.trim() ||
        e.querySelector("published")?.textContent?.trim() ||
        "";
      if (title && link) {
        items.push({ title, link, pubDate });
      }
    }
  } catch {
    // Sin DOMParser disponible o XML inválido.
  }
  return { url: feedUrl ?? "", title: feedTitle, items };
}

/**
 * Trae y parsea un feed RSS. Cachea 5 min por URL.
 *
 * @param url URL del feed RSS/Atom.
 * @returns RssFeed con items normalizados. Si falla, items vacíos.
 */
export async function fetchRSS(url: string): Promise<RssItem[]> {
  if (!url) return [];
  const cacheKey = `rss:feed:${url}`;
  return cached<RssItem[]>(cacheKey, ttls.news, async () => {
    const res = await fetchText(url, { timeoutMs: 10_000 });
    if (!res.ok || !res.text) return [];
    const feed = parseRssXml(res.text, url);
    return feed.items;
  });
}

/**
 * Trae múltiples feeds RSS en paralelo y combina los items.
 *
 * @param urls Lista de URLs de feeds. Default: DEFAULT_RSS_SOURCES.
 * @returns Items combinados, sin duplicados por URL, ordenados por pubDate desc.
 */
export async function fetchMultipleRSS(
  urls: string[] = DEFAULT_RSS_SOURCES,
): Promise<RssItem[]> {
  const feeds = await Promise.all(urls.map((u) => fetchRSS(u).catch(() => [])));
  const seen = new Set<string>();
  const combined: RssItem[] = [];
  for (const items of feeds) {
    for (const it of items) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      combined.push(it);
    }
  }
  // Ordenar por pubDate desc (las sin fecha al final).
  combined.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : NaN;
    const tb = b.pubDate ? Date.parse(b.pubDate) : NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
    if (Number.isFinite(ta)) return -1;
    if (Number.isFinite(tb)) return 1;
    return 0;
  });
  return combined;
}
