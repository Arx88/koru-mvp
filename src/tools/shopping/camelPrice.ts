/**
 * CamelCamelCamel price history — HTML scraping, no API key.
 *
 * CamelCamelCamel publica el histórico de precios de cualquier producto de
 * Amazon por ASIN. Sin API oficial, pero el HTML público contiene los
 * valores lowest/highest/current en data attributes y nodos con clases
 * predecibles.
 *
 * Endpoint:
 *   https://camelcamelcamel.com/product/{ASIN}
 *
 * Este módulo hace best-effort parsing. Si la estructura HTML cambia o el
 * scrapeo es bloqueado, devuelve null sin romper el caller.
 */

import { fetchText } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";

export type CamelPriceHistory = {
  lowest: number;
  highest: number;
  current: number;
};

type RawNumbers = {
  lowest?: number;
  highest?: number;
  current?: number;
};

/**
 * Extrae el primer número (con decimales opcionales) de un string.
 * Tolerante a $ / € / USD / comas de miles.
 */
function extractPrice(s: string): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/[,](?=\d{3}\b)/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return undefined;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Heurística de parseo: busca pares etiqueta→valor en el HTML. CamelCamelCamel
 * históricamente usa:
 *   - <div class="lowest">…</div>
 *   - <div class="highest">…</div>
 *   - Node con texto "Current price:" seguido de precio
 *   - data attributes en nodos script/json
 *
 * Hacemos múltiples estrategias y combinamos.
 */
function parseCamelHtml(html: string): RawNumbers {
  const out: RawNumbers = {};

  // Estrategia 1: data attributes en JSON embebido (camel usa JS para el chart).
  // Buscamos bloques con "lowest_price", "highest_price", "current_price".
  const lowMatch =
    html.match(/"lowest_price"\s*:\s*(\d+(?:\.\d+)?)/) ||
    html.match(/lowest[_-]?price['"]?\s*[:=]\s*['"]?\$?(\d+(?:\.\d+)?)/i);
  if (lowMatch) {
    const n = parseFloat(lowMatch[1]);
    if (Number.isFinite(n)) out.lowest = n;
  }
  const highMatch =
    html.match(/"highest_price"\s*:\s*(\d+(?:\.\d+)?)/) ||
    html.match(/highest[_-]?price['"]?\s*[:=]\s*['"]?\$?(\d+(?:\.\d+)?)/i);
  if (highMatch) {
    const n = parseFloat(highMatch[1]);
    if (Number.isFinite(n)) out.highest = n;
  }
  const curMatch =
    html.match(/"current_price"\s*:\s*(\d+(?:\.\d+)?)/) ||
    html.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/) ||
    html.match(/current[_-]?price['"]?\s*[:=]\s*['"]?\$?(\d+(?:\.\d+)?)/i);
  if (curMatch) {
    const n = parseFloat(curMatch[1]);
    if (Number.isFinite(n)) out.current = n;
  }

  // Estrategia 2: nodos con clase .lowest / .highest y texto con $ o número.
  if (out.lowest == null) {
    const m = html.match(/class="[^"]*\blowest\b[^"]*"[^>]*>\s*([^<]+)/i);
    if (m) out.lowest = extractPrice(m[1]);
  }
  if (out.highest == null) {
    const m = html.match(/class="[^"]*\bhighest\b[^"]*"[^>]*>\s*([^<]+)/i);
    if (m) out.highest = extractPrice(m[1]);
  }
  if (out.current == null) {
    // Camel usa "Current price:" como texto seguido de un precio.
    const m = html.match(/current\s+price[^0-9$€]{0,40}(\$|€|USD)?\s*(\d+(?:[.,]\d+)?)/i);
    if (m) out.current = extractPrice(m[2]);
  }

  // Estrategia 3: tabla de resumen con "Lowest", "Highest", "Current" como
  // celdas y precio en la celda siguiente.
  if (out.lowest == null || out.highest == null || out.current == null) {
    const labels: Array<{ key: "lowest" | "highest" | "current"; re: RegExp }> = [
      { key: "lowest", re: /\blowest\b\s*(?:price)?[^0-9$€]{0,40}(\$|€|USD)?\s*(\d+(?:[.,]\d+)?)/i },
      { key: "highest", re: /\bhighest\b\s*(?:price)?[^0-9$€]{0,40}(\$|€|USD)?\s*(\d+(?:[.,]\d+)?)/i },
      { key: "current", re: /\bcurrent\b\s*(?:price)?[^0-9$€]{0,40}(\$|€|USD)?\s*(\d+(?:[.,]\d+)?)/i },
    ];
    for (const { key, re } of labels) {
      if (out[key] != null) continue;
      const m = html.match(re);
      if (m) out[key] = extractPrice(m[2]);
    }
  }

  return out;
}

/**
 * Trae el histórico de precios (lowest/highest/current) de un producto Amazon
 * por ASIN desde CamelCamelCamel.
 *
 * @param asin ASIN de Amazon (10 chars alfanuméricos).
 * @returns CamelPriceHistory o null si no se pudo parsear.
 */
export async function fetchPriceHistoryCamel(
  asin: string,
): Promise<CamelPriceHistory | null> {
  const clean = (asin ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(clean)) return null;

  const cacheKey = `camel:price:${clean}`;
  return cached<CamelPriceHistory | null>(cacheKey, ttls.reference, async () => {
    const url = `https://camelcamelcamel.com/product/${clean}`;
    const res = await fetchText(url, { timeoutMs: 12_000 });
    if (!res.ok || !res.text) return null;
    const raw = parseCamelHtml(res.text);
    if (
      raw.lowest == null &&
      raw.highest == null &&
      raw.current == null
    ) {
      return null;
    }
    // Si falta alguno, inferimos desde los otros.
    const values = [raw.lowest, raw.highest, raw.current].filter(
      (v): v is number => v != null,
    );
    const fallback = values.length > 0 ? values[0] : 0;
    return {
      lowest: raw.lowest ?? fallback,
      highest: raw.highest ?? fallback,
      current: raw.current ?? fallback,
    };
  });
}
