/**
 * Bloque Shopping — Comparison Deep Search.
 *
 * PATRÓN PROFESIONAL (igual que restaurant_deep_search):
 * 1. Buscar productos en múltiples tiendas via searchAndEnrich (DuckDuckGo + scrape)
 * 2. Pasar TODO el contenido por structureExtractor (anti-alucinación)
 * 3. El LLM extrae datos CON citas literales del contenido real
 * 4. El validador rechaza cualquier dato sin respaldo textual
 * 5. Solo datos validados llegan a la card
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { searchAndEnrich, usableSources } from "../shared/scrapers";
import { validateWithCitations, extractionToDataCard } from "../shared/extractor";
import type { ExtractionResult } from "../../domain/structureExtractor";
import type { UiBlock } from "../../domain/types";

export const comparisonDeep: ToolHandler = {
  definition: defineTool(
    "comparison_deep",
    "Compara productos haciendo scraping real de múltiples tiendas (Amazon, eBay, Best Buy, MercadoLibre). Extrae precios, specs, ratings y reviews VALIDADOS contra cita literal del contenido. Genera recommendation basada en datos reales. Úsala cuando el usuario diga 'compara X vs Y', 'qué teléfono compro', 'dónde compro Z más barato'. NUNCA uses web_search para comparar productos — usá esta tool.",
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

    const allResults = await Promise.all(storeQueries.map(q => searchAndEnrich(q, 4)));
    const sources = usableSources(allResults.flat()).slice(0, 8);

    if (sources.length === 0) {
      return { type: "comparison_deep", status: "failed", query, error: "No pude encontrar productos para comparar." };
    }

    let extractedData: ExtractionResult | null = null;
    if (ctx.chatFn) {
      try {
        extractedData = await validateWithCitations(
          `Compará productos para: "${query}". Extraé precio, specs, rating y pros/contras de cada producto encontrado.`,
          sources, ctx.chatFn,
        );
      } catch { /* sin extracción */ }
    }

    let dataCard: UiBlock | null = null;
    if (extractedData) dataCard = extractionToDataCard(extractedData);

    let recommendation = "";
    if (extractedData && extractedData.items.length > 0) {
      const priceItems = extractedData.items.filter((it: any) => /[$€£]\s*\d|USD\s*\d|\d+\s*(?:dólares|euros)/i.test(it.value));
      if (priceItems.length >= 2) {
        const cheapest = priceItems.reduce((min: any, it: any) => {
          const minVal = parseFloat(String(min.value).replace(/[^0-9.]/g, "")) || Infinity;
          const iVal = parseFloat(String(it.value).replace(/[^0-9.]/g, "")) || Infinity;
          return iVal < minVal ? it : min;
        });
        recommendation = `Basado en ${priceItems.length} precios validados, la opción más económica es "${cheapest.label}" (${cheapest.value}) según ${cheapest.sourceDomain}.`;
      } else {
        recommendation = `Encontré ${extractedData.items.length} datos validados de ${sources.length} fuentes. Cada dato respaldado por cita literal.`;
      }
    } else {
      recommendation = `Encontré ${sources.length} fuentes. Revisá los links para más detalle.`;
    }

    const deferredDataCard: Promise<UiBlock> = Promise.resolve({
      type: "comparison",
      title: `Comparativa: ${query}`,
      items: extractedData?.items.map((it: any) => ({
        title: it.label, vendor: it.sourceDomain, url: it.sourceUrl,
        price: /[$€£]\s*\d|USD\s*\d|\d+\s*(?:dólares|euros)/i.test(it.value) ? it.value : undefined,
        evidence: it.quote,
      })) ?? [],
      recommendation,
      sources,
    } as UiBlock);

    return { type: "comparison_deep", status: "ok", query, budget, extractedData, dataCard, recommendation, sources, deferredDataCard };
  },
};
