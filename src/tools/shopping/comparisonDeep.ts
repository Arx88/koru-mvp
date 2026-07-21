/**
 * Bloque Shopping — Comparison Deep Search.
 *
 * 🔴 Task 15 — PREMIUM EXTRACTOR.
 *
 * PATRÓN PROFESIONAL:
 * 1. Buscar productos en múltiples tiendas via searchAndEnrich (con fallback DDG)
 * 2. Pasar TODO el contenido por `extractComparisonData` (anti-alucinación por campo)
 * 3. El LLM extrae productos con: name, price, specs[], rating, pros[], cons[]
 * 4. Validador descarta CADA CAMPO no respaldado por cita literal (no el producto entero)
 * 5. Score determinista por producto: (campos_validados / 5) * 10
 * 6. Recommendation real: diferencia de specs + precio, NO plantilla genérica
 *
 * Activación: el LLM decide llamar `comparison_deep` cuando detecta intent de compra
 * (ver systemPrompt.ts). NO hay regex de activación en el backend.
 *
 * Observación del validador (PLAN-15 §2.1): DuckDuckGo puede bloquear Render.
 * Implementado fallback `searchAndEnrichWithFallback` que reintenta SIN `site:`
 * filter si el primer batch devuelve 0 sources.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { searchAndEnrich, searchAndEnrichWithFallback, usableSources } from "../shared/scrapers";
import { validateComparisonWithCitations } from "../shared/extractor";
import type { ComparisonExtractionResult, ComparisonProduct } from "../../domain/structureExtractor";
import type { UiBlock } from "../../domain/types";

/** Normaliza un string de precio a número comparable. */
function priceToNumber(priceStr?: string): number | null {
  if (!priceStr) return null;
  const n = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

/**
 * Genera una recommendation PREMIUM basada en diferencias específicas entre los
 * productos. NO es una plantilla genérica — menciona specs reales y diferencias
 * de precio concretas. Determinista (sin LLM adicional).
 *
 * Ejemplo: "El S24 gana en pantalla (120Hz vs 60Hz). El iPhone 15 es $60 más barato."
 */
function buildPremiumRecommendation(products: ComparisonProduct[]): string {
  if (products.length === 0) return "No pude extraer specs comparables de estas fuentes.";
  if (products.length === 1) {
    const p = products[0];
    const parts: string[] = [`Encontré un producto validado: ${p.name}`];
    if (p.price) parts.push(`a ${p.price.value}`);
    if (p.rating) parts.push(`con rating ${p.rating.value}/5`);
    parts.push(`(${p.score}/10 datos respaldados)`);
    return parts.join(" ") + ". Probá con un término más específico para comparar.";
  }

  // Ordenar por score (mayor primero) y por precio (menor primero).
  const ranked = [...products].sort((a, b) => b.score - a.score);
  const top = ranked[0];

  // Comparativa de specs head-to-head entre top 2.
  const second = ranked[1] ?? ranked[0];

  // Encontrar specs diferenciales: misma label, distinto value.
  const topSpecMap = new Map(top.specs.map((s) => [s.label.toLowerCase(), s.value]));
  const diffSpecs: Array<{ label: string; topValue: string; otherValue: string }> = [];
  for (const spec of second.specs) {
    const topValue = topSpecMap.get(spec.label.toLowerCase());
    if (topValue && topValue !== spec.value) {
      diffSpecs.push({ label: spec.label, topValue, otherValue: spec.value });
    }
  }

  const sentences: string[] = [];

  // Veredicto sobre specs.
  if (diffSpecs.length > 0) {
    const topSpecStr = diffSpecs.slice(0, 2).map((d) => `${d.label}: ${d.topValue} vs ${d.otherValue}`).join(", ");
    sentences.push(`El ${top.name} gana en specs (${topSpecStr})`);
  } else if (top.score > second.score) {
    sentences.push(`El ${top.name} tiene mejor cobertura de datos (${top.score}/10 vs ${second.score}/10)`);
  }

  // Veredicto sobre precio.
  const topPriceNum = priceToNumber(top.price?.value);
  const secondPriceNum = priceToNumber(second.price?.value);
  if (topPriceNum !== null && secondPriceNum !== null && topPriceNum !== secondPriceNum) {
    const diff = Math.abs(topPriceNum - secondPriceNum);
    const cheaper = topPriceNum < secondPriceNum ? top.name : second.name;
    const expensive = topPriceNum < secondPriceNum ? second.name : top.name;
    sentences.push(`El ${cheaper} es $${diff.toFixed(0)} más barato que el ${expensive}`);
  }

  if (sentences.length === 0) {
    // Fallback honesto si no hay specs diferenciales ni precios.
    sentences.push(`Comparativa de ${products.length} productos validados`);
    if (top.rating) sentences.push(`Mejor rating: ${top.name} (${top.rating.value}/5)`);
  }

  return sentences.join(". ") + ".";
}

/** Mapea ComparisonProduct[] a ComparisonItem[] (el shape del UiBlock). */
function mapProductsToItems(products: ComparisonProduct[]) {
  return products.map((p) => ({
    title: p.name,
    price: p.price?.value,
    vendor: p.sources[0]?.domain,
    url: p.sources[0]?.url,
    score: p.score,
    evidence: p.summaryQuote,
    details: [
      ...p.specs.map((s) => ({ label: `${s.label}: ${s.value}`, positive: true })),
      ...p.pros.map((pro) => ({ label: pro.text, positive: true })),
      ...p.cons.map((con) => ({ label: con.text, positive: false })),
    ],
  }));
}

export const comparisonDeep: ToolHandler = {
  definition: defineTool(
    "comparison_deep",
    "Compara productos haciendo scraping real de múltiples tiendas (Amazon, eBay, Best Buy, MercadoLibre). Extrae precios, specs, ratings y reviews VALIDADOS contra cita literal del contenido. Genera recommendation basada en diferencias reales (no plantilla). Úsala cuando el usuario diga 'compara X vs Y', 'qué teléfono compro', 'dónde compro Z más barato', 'ayudame a buscar un X'. NUNCA uses web_search para comparar productos — usá esta tool.",
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
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    const budget = String(args.budget ?? "").trim();
    if (!query) return { type: "comparison_deep", status: "failed", error: "Indicá qué comparar." };

    const storeQueries = [
      `${query} ${budget} precio specs review site:amazon.com OR site:ebay.com OR site:bestbuy.com`,
      `${query} comparison price specifications`,
      `${query} reseñas mejores características pros contras`,
    ];

    // 🔴 Task 15-FIX1: usar searchAndEnrichWithFallback — reintenta sin `site:` filter
    // si DDG bloquea la IP de Render y devuelve 0 sources.
    const allResults = await searchAndEnrichWithFallback(storeQueries, 4);
    const sources = usableSources(allResults).slice(0, 8);

    if (sources.length === 0) {
      const failedCard: Promise<UiBlock> = Promise.resolve({
        type: "comparison",
        title: `Comparativa: ${query}`,
        items: [],
        recommendation: `No pude encontrar productos para comparar con las búsquedas: ${storeQueries.join("; ")}. Probá con un término más específico.`,
        sources: [],
      } as UiBlock);
      return { type: "comparison_deep", status: "failed", query, error: "No pude encontrar productos.", deferredDataCard: failedCard };
    }

    // 🔴 Task 15-FIX1: extractor PREMIUM con schema por-producto (no flat).
    // Valida campo-por-campo: si el LLM propone `rating: 4.9` sin cita, se descarta
    // SOLO el rating (no el producto entero).
    let extractedData: ComparisonExtractionResult | null = null;
    if (ctx.chatFn) {
      try {
        extractedData = await validateComparisonWithCitations(
          `Compará productos para: "${query}". Extraé name, price, specs, rating, pros y cons de cada producto encontrado. Cada campo con cita literal.`,
          sources, ctx.chatFn,
        );
      } catch {
        // sin extracción premium — cae a card honesto con sources sin items enriquecidos
      }
    }

    // Recommendation PREMIUM: menciona diferencias específicas entre productos.
    // V3 FIX: si extractedData es null pero hay sources con snippets que mencionan specs/precios,
    // generar recommendation del contenido real en vez de plantilla genérica.
    let recommendation: string;
    if (extractedData && extractedData.products.length > 0) {
      recommendation = buildPremiumRecommendation(extractedData.products);
    } else {
      // Buscar specs/precios en los snippets reales de los sources
      const allSnippets = sources.map((s: any) => `${s.title} ${s.snippet ?? ""}`).join(" ");
      const priceMatches = allSnippets.match(/\$\d[\d,.]*|\d[\d.,]*\s*(?:dólares|euros|USD|EUR)/gi) || [];
      const specMatches = allSnippets.match(/\d+\s*(?:GB|TB|MP|mAh|GHz|Hz|cores?|K|p)\b/gi) || [];
      if (priceMatches.length > 0 || specMatches.length > 0) {
        const parts: string[] = [];
        if (specMatches.length > 0) parts.push(`Specs detectadas: ${specMatches.slice(0, 4).join(", ")}`);
        if (priceMatches.length > 0) parts.push(`Precios encontrados: ${priceMatches.slice(0, 3).join(", ")}`);
        recommendation = `Encontré ${sources.length} fuentes. ${parts.join(". ")}. Compará las opciones arriba.`;
      } else {
        recommendation = `Encontré ${sources.length} fuentes con información sobre "${query}". Te dejo los links con specs y precios para que compares.`;
      }
    }

    // Mapear products a ComparisonItem[] (shape del UiBlock).
    // V2 FIX: si extractedData es null, usar los sources como items con evidence real
    const items = extractedData && extractedData.products.length > 0
      ? mapProductsToItems(extractedData.products)
      : sources.map((s: any) => ({
          title: s.title || s.domain,
          vendor: s.domain,
          url: s.url,
          evidence: (s.snippet ?? s.content ?? "").slice(0, 200),
          details: [],
        }));

    const deferredDataCard: Promise<UiBlock> = Promise.resolve({
      type: "comparison",
      title: `Comparativa: ${query}`,
      items,
      recommendation,
      sources,
    } as UiBlock);

    return {
      type: "comparison_deep",
      status: "ok",
      query,
      budget,
      extractedData,
      recommendation,
      sources,
      deferredDataCard,
    };
  },
};
