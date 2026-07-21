/**
 * Wrapper del structureExtractor del motor.
 *
 * Las tools que leen la web (restaurantes, productos, deep_research, etc.)
 * usan este wrapper para validar cada dato extraído contra una cita literal
 * de algún source. Reutiliza la lógica anti-alucinación del motor — NO la
 * reescribe.
 *
 * Contrato del ChatFn sigue el de `structureExtractor.ChatFn`:
 *   ({role, content}[], {temperature, maxTokens}) => {content}
 */

import { extractStructuredData, extractComparisonData } from "../../domain/structureExtractor";
import type { AssistantSource, UiBlock } from "../../domain/types";
import type { ChatFn } from "../../domain/structureExtractor";

/**
 * Extrae datos tipados de `sources` y valida cada uno contra cita literal.
 * Descarta cualquier dato que el LLM invente sin respaldo textual.
 *
 * @returns `ExtractionResult` (items validados) o null si no hay sources usables.
 */
export async function validateWithCitations(
  userInput: string,
  sources: AssistantSource[],
  chatFn: ChatFn,
): ReturnType<typeof extractStructuredData> {
  return extractStructuredData({ userInput, sources, chatFn });
}

/**
 * Extrae PRODUCTOS (no items flat) para comparación premium. Cada producto
 * tiene: name, price, specs[], rating, pros[], cons[], score.
 * Valida campo-por-campo: si el LLM propone `rating: 4.9` sin cita respaldada,
 * se descarta SOLO el rating (no el producto entero).
 *
 * @returns `ComparisonExtractionResult` con products validados, o null si
 *          no hay sources usables o el LLM no devuelve nada confiable.
 */
export async function validateComparisonWithCitations(
  userInput: string,
  sources: AssistantSource[],
  chatFn: ChatFn,
): ReturnType<typeof extractComparisonData> {
  return extractComparisonData({ userInput, sources, chatFn });
}

/**
 * Convierte un resultado de extracción validado en un `data_card` UiBlock
 * listo para mostrar al usuario. Si no hay items, devuelve null.
 */
export function extractionToDataCard(
  extracted: Awaited<ReturnType<typeof extractStructuredData>>,
): UiBlock | null {
  if (!extracted || extracted.items.length === 0) return null;
  return {
    type: "data_card",
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
}
