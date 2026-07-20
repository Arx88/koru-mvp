/**
 * Bloque Shopping — Comparison Deep Search.
 * Scrapping real de múltiples sitios de e-commerce (Amazon, eBay, Best Buy, etc.)
 * Extrae: precio, specs, ratings, reviews, pros/contras.
 * Genera recommendation basada en datos reales.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { searchDuckDuckGo, fetchPageContent } from "../shared/scrapers";
import { fetchText, domainFromUrl, truncate } from "../shared/fetcher";
import type { AssistantSource, UiBlock } from "../../domain/types";

interface ComparisonItem {
  title: string;
  vendor: string;
  url: string;
  price?: string;
  rating?: number;
  reviewCount?: number;
  specs: string[];
  pros: string[];
  cons: string[];
  imageUrl?: string;
  evidence: string;
}

/**
 * Extrae precio de texto HTML o plano.
 * Patrones: $699.99, USD 999, €799, £499, 1.299,00 €
 */
function extractPrice(text: string): string | undefined {
  const patterns = [
    /\$\s*[\d,]+\.?\d*/,                    // $699.99
    /USD\s*[\d,]+\.?\d*/i,                  // USD 999
    /€\s*[\d.,]+/,                           // €799
    /£\s*[\d.,]+/,                           // £499
    /[\d.,]+\s*(?:dólares|euros|pesos)/i,    // 999 dólares
    /[\d]+\.[\d]{3}(?:,[\d]{2})?/,           // 1.299,00
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return undefined;
}

/**
 * Extrae specs técnicas de texto.
 * Patrones: 8GB RAM, 256GB storage, 12MP camera, 5000mAh, 3.2GHz, 6.1 inch
 */
function extractSpecs(text: string): string[] {
  const specPatterns = [
    /\d+\s*GB\s*(?:RAM|storage|SSD|HDD)/gi,
    /\d+\s*TB\s*(?:SSD|HDD|storage)/gi,
    /\d+\s*MP\s*(?:camera|rear|front)?/gi,
    /\d+\s*mAh/gi,
    /\d+\.?\d*\s*GHz/gi,
    /\d+\.?\d*\s*(?:inch|pulgadas)/gi,
    /\d+\s*cores?/gi,
    /\d+K\s*(?:display|screen|resolution)?/gi,
    /\d+p\s*(?:display|resolution)?/gi,
    /5G|4G LTE|Wi-Fi 6|Bluetooth 5\.\d/gi,
    /\d+MP\s*\+\s*\d+MP/gi,
  ];
  const specs = new Set<string>();
  for (const p of specPatterns) {
    const matches = text.matchAll(p);
    for (const m of matches) {
      specs.add(m[0].trim());
    }
  }
  return Array.from(specs).slice(0, 8);
}

/**
 * Extrae rating de estrellas y conteo de reviews.
 */
function extractRating(html: string): { rating?: number; reviewCount?: number } {
  const ratingPatterns = [
    /(\d\.?\d?)\s*(?:out of|de)\s*5\s*(?:stars|estrellas)/i,
    /★\s*(\d\.?\d?)/,
    /(\d\.?\d?)\s*★/,
    /"rating"\s*:\s*(\d\.?\d?)/i,
    /rating["\s:]+(\d\.?\d?)/i,
  ];
  let rating: number | undefined;
  for (const p of ratingPatterns) {
    const m = html.match(p);
    if (m) {
      const val = parseFloat(m[1]);
      if (val >= 0 && val <= 5) {
        rating = val;
        break;
      }
    }
  }
  const reviewPatterns = [
    /(\d[\d,]*)\s*(?:reviews?|opiniones|ratings?|reseñas)/i,
    /(\d[\d,]*)\s*(?:ratings?)/i,
    /"reviewCount"\s*:\s*(\d+)/i,
  ];
  let reviewCount: number | undefined;
  for (const p of reviewPatterns) {
    const m = html.match(p);
    if (m) {
      reviewCount = parseInt(m[1].replace(/,/g, ""));
      break;
    }
  }
  return { rating, reviewCount };
}

/**
 * Extrae imagen de producto del HTML.
 */
function extractImageUrl(html: string): string | undefined {
  const patterns = [
    /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*(?:id="landingImage"|class="[^"]*product[^"]*")/i,
    /<img[^>]+(?:data-src|data-old-hires|src)="(https?:\/\/[^"]+)"[^>]*(?:alt="[^"]*product|class="[^"]*item)/i,
    /"imageURL"\s*:\s*"(https?:\/\/[^"]+)"/i,
    /<img[^>]+src="(https?:\/\/[^"]+)"[^>]+alt="[^"]*"/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && !m[1].includes("icon") && !m[1].includes("logo") && !m[1].includes("sprite")) {
      return m[1];
    }
  }
  return undefined;
}

/**
 * Hace scraping de una página de producto de Amazon/eBay/Best Buy.
 * Extrae: título, precio, specs, rating, imagen.
 */
async function scrapeProductPage(url: string): Promise<ComparisonItem | null> {
  const result = await fetchText(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    timeoutMs: 10_000,
  });
  if (!result.ok || !result.text) return null;

  const html = result.text;
  const domain = domainFromUrl(url);

  // Extraer título
  let title = "";
  const titlePatterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /"title"\s*:\s*"([^"]+)"/i,
    /<span[^>]+id="productTitle"[^>]*>([\s\S]*?)<\/span>/i,
    /<span[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ];
  for (const p of titlePatterns) {
    const m = html.match(p);
    if (m) {
      title = m[1].replace(/<[^>]+>/g, "").trim();
      if (title.length > 5) break;
    }
  }
  if (!title || title.length < 3) return null;
  title = truncate(title, 80);

  // Extraer precio
  const price = extractPrice(html);

  // Extraer rating y reviews
  const { rating, reviewCount } = extractRating(html);

  // Extraer specs
  const specs = extractSpecs(html);

  // Extraer imagen
  const imageUrl = extractImageUrl(html);

  // Generar pros/contras basados en specs y rating
  const pros: string[] = [];
  const cons: string[] = [];
  if (rating && rating >= 4) pros.push(`Buena calificación (${rating}/5)`);
  if (reviewCount && reviewCount > 100) pros.push(`${reviewCount.toLocaleString()} reseñas`);
  if (specs.length > 0) pros.push(`${specs.length} specs detectadas`);
  if (rating && rating < 3.5) cons.push(`Calificación baja (${rating}/5)`);
  if (!price) cons.push("Precio no visible");

  return {
    title,
    vendor: domain,
    url,
    price,
    rating,
    reviewCount,
    specs,
    pros,
    cons,
    imageUrl,
    evidence: truncate(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), 200),
  };
}

export const comparisonDeep: ToolHandler = {
  definition: defineTool(
    "comparison_deep",
    "Compara productos haciendo scraping real de múltiples tiendas (Amazon, eBay, Best Buy, etc.). Extrae precios, specs, ratings y reviews. Genera recommendation basada en datos reales. Úsala cuando el usuario diga 'compara X vs Y', 'qué teléfono compro', 'dónde compro Z más barato'. NUNCA uses web_search para comparar productos — usá esta tool.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto a comparar (ej: 'iPhone 15 vs Samsung S24', 'mejor laptop para diseño')." },
        budget: { type: "string", description: "Presupuesto opcional (ej: 'under 500')." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee precios públicos de tiendas online."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const budget = String(args.budget ?? "").trim();
    if (!query) return { type: "comparison_deep", status: "failed", error: "Indicá qué comparar." };

    // 1. Buscar en múltiples tiendas via DuckDuckGo
    const storeQueries = [
      `${query} site:amazon.com`,
      `${query} site:ebay.com`,
      `${query} site:bestbuy.com`,
      `${query} price review specs`,
    ];

    const allResults = await Promise.all(storeQueries.map(q => searchDuckDuckGo(q, 3)));
    const urls = allResults.flat().slice(0, 8);

    // Filtrar URLs de tiendas reales
    const storeDomains = ["amazon.com", "ebay.com", "bestbuy.com", "walmart.com", "target.com",
      "newegg.com", "bhphotovideo.com", "mediamarkt.es", "fnac.es", "pccomponentes.com",
      "mercadolibre.com", "mercadolibre.com.ar", "mercadolibre.cl", "mercadolibre.com.mx"];
    const productUrls = urls.filter(u => {
      const domain = u.domain.toLowerCase();
      return storeDomains.some(s => domain.includes(s)) || domain.includes("versus.com");
    });

    // Si no encontramos tiendas específicas, usar todos los resultados
    const urlsToScrape = productUrls.length > 0 ? productUrls : urls.slice(0, 5);

    // 2. Scrapear cada página de producto
    const items: ComparisonItem[] = [];
    const scrapePromises = urlsToScrape.slice(0, 5).map(async (source) => {
      try {
        const item = await scrapeProductPage(source.url);
        if (item) {
          items.push(item);
        }
      } catch {
        // Skip si el scrape falla
      }
    });
    await Promise.all(scrapePromises);

    // También usar resultados de DuckDuckGo como fallback (con info básica)
    if (items.length < 2) {
      for (const source of urls.slice(0, 4)) {
        if (items.find(i => i.url === source.url)) continue;
        items.push({
          title: truncate(source.title, 80),
          vendor: source.domain,
          url: source.url,
          price: extractPrice(`${source.title} ${source.snippet ?? ""}`),
          specs: extractSpecs(`${source.title} ${source.snippet ?? ""}`),
          pros: [],
          cons: [],
          evidence: truncate(source.snippet ?? "", 200),
        });
      }
    }

    if (items.length === 0) {
      return {
        type: "comparison_deep",
        status: "failed",
        query,
        error: "No pude encontrar productos para comparar. Probá con un término más específico.",
      };
    }

    // 3. Ordenar por rating (si hay) o por precio (si hay)
    items.sort((a, b) => {
      // Priorizar items con rating
      if (a.rating && b.rating) return b.rating - a.rating;
      if (a.rating) return -1;
      if (b.rating) return 1;
      // Luego por items con precio
      if (a.price && b.price) {
        const pa = parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0;
        const pb = parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0;
      return pa - pb;
      }
      if (a.price) return -1;
      if (b.price) return 1;
      return 0;
    });

    // 4. Generar recommendation basada en datos reales
    let recommendation = "";
    const itemsWithPrices = items.filter(i => i.price);
    const itemsWithRatings = items.filter(i => i.rating);

    if (itemsWithRatings.length > 0) {
      const best = itemsWithRatings[0];
      recommendation = `Basado en ${itemsWithRatings.length} opciones con rating, "${best.title}" de ${best.vendor} es la mejor opción`;
      if (best.rating) recommendation += ` con ${best.rating}/5 estrellas`;
      if (best.reviewCount) recommendation += ` y ${best.reviewCount.toLocaleString()} reseñas`;
      if (best.price) recommendation += `. Precio: ${best.price}`;
      recommendation += ".";
    } else if (itemsWithPrices.length >= 2) {
      const cheapest = itemsWithPrices.reduce((min, i) => {
        const minVal = parseFloat(String(min.price).replace(/[^0-9.]/g, "")) || Infinity;
        const iVal = parseFloat(String(i.price).replace(/[^0-9.]/g, "")) || Infinity;
        return iVal < minVal ? i : min;
      });
      recommendation = `De ${itemsWithPrices.length} opciones con precio visible, la más económica es "${cheapest.title}" en ${cheapest.vendor} (${cheapest.price}).`;
    } else {
      recommendation = `Encontré ${items.length} opciones. Te recomiendo revisar las fuentes para más detalle.`;
    }

    // 5. Generar sources
    const sources: AssistantSource[] = items.map(i => ({
      title: i.title,
      url: i.url,
      domain: i.vendor,
      snippet: i.evidence,
    }));

    // 6. Generar card visual comparison
    const deferredDataCard: Promise<UiBlock> = Promise.resolve({
      type: "comparison",
      title: `Comparativa: ${query}`,
      items: items.map(i => ({
        title: i.title,
        vendor: i.vendor,
        url: i.url,
        price: i.price,
        rating: i.rating,
        reviewCount: i.reviewCount,
        specs: i.specs,
        pros: i.pros,
        cons: i.cons,
        image: i.imageUrl,
        evidence: i.evidence,
      })),
      recommendation,
      sources,
    } as UiBlock);

    return {
      type: "comparison_deep",
      status: "ok",
      query,
      budget,
      items,
      recommendation,
      sources,
      deferredDataCard,
    };
  },
};
