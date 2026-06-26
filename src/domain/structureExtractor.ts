/**
 * Structure Extractor — Convierte texto libre de la web en datos tipados, SIN alucinación.
 *
 * Principios (axiomas A1, A2, A6 del documento de arquitectura):
 *   A1. Agnóstico al modelo: el extractor recibe una `chatFn` inyectada. No sabe ni le
 *       importa qué proveedor hay detrás. Funciona con cualquier modelo.
 *   A2. El dato es la fuente de verdad: NINGÚN item llega a la salida sin estar
 *       respaldado por una cita LITERAL en el contenido de algún source. Si el LLM
 *       propone algo que no está en el texto, el validador lo rechaza.
 *   A6. Sin palabras clave: el LLM decide qué extraer según la INTENCIÓN del usuario,
 *       no según vocabulario. Mismo código para deportes, finanzas, clima, recetas.
 *
 * Flujo:
 *   1. LLM extractor: recibe input + contents de sources. Devuelve items con `quote`.
 *   2. Validador determinista: por cada item, ¿la `quote` aparece en algún content?
 *      SÍ → aceptar. NO → rechazar (alucinación filtrada).
 *   3. Salida: items validados con cita trazable, o null si no hay nada confiable.
 */

import { parseJsonObjectStrict } from "./schemas";
import type { AssistantSource } from "./types";

// ── Tipos ──────────────────────────────────────────────────────────

export type ChatFn = (
  messages: { role: "system" | "user"; content: string }[],
  options: { temperature: number; maxTokens: number; responseFormat?: { type: "json_object" } },
) => Promise<{ content: string }>;

/**
 * Un dato extraído y VALIDADO. La `quote` es la evidencia literal en el source.
 * Si un item no tiene quote respaldada, no debería llegar aquí nunca.
 */
export type ExtractedItem = {
  /** Etiqueta corta del dato: "Dólar oficial", "Argentina vs Austria", "Precio", etc. */
  label: string;
  /** El valor concreto: "$1.432,05", "3-0", "10°C", "4.8/5". */
  value: string;
  /** Detalle opcional: contexto adicional legible. */
  detail?: string;
  /** Cita LITERAL del source que respalda este item. Requisito de validez. */
  quote: string;
  /** De qué source salió (url). */
  sourceUrl: string;
  sourceDomain: string;
};

export type ExtractionResult = {
  /** Título descriptivo del conjunto de datos, ej: "Cotización del dólar", "Resultados del Mundial". */
  title: string;
  items: ExtractedItem[];
};

export type ExtractorInput = {
  /** Lo que pidió el usuario (para que el extractor sepa qué buscar). */
  userInput: string;
  /** Sources recuperados por la tool de búsqueda. Usa snippet + content. */
  sources: AssistantSource[];
  /** Función de chat inyectada (agnóstica al proveedor). */
  chatFn: ChatFn;
};

// ── Normalización para matching robusto de citas ───────────────────

/**
 * Normaliza texto para comparar citas contra contents.
 * - Pasa a minúsculas
 * - Quita acentos
 * - Colapsa espacios y puntuación repetida
 * - Elimina caracteres de control
 *
 * Esto permite que la cita del LLM ("España goleó 3-0") matchee contenido real
 * ("España goleó 3-0.") aunque haya diferencias menores de puntuación/espacios.
 * NO es matching de palabras clave: es matching de FRASES LITERALES normalizadas.
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'`«»""'']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Longitud mínima de una cita para que se considere respaldo válido.
 * Citas muy cortas (ej: "3-0") pueden aparecer por azar en texto no relacionado.
 * Exigimos frases con sustancia: al menos 25 chars normalizados.
 */
const MIN_QUOTE_LENGTH = 25;

/**
 * Comprueba si una cita está respaldada por el contenido real de un source.
 * Devuelve el source que la respalda, o null si nadie la contiene.
 *
 * Reglas:
 *   - La cita normalizada debe aparecer como substring en algún content normalizado.
 *   - Toleramos diferencias de PUNTUACIÓN DE BORDE (un punto/coma al final de la cita
 *     que en el source continúa con más texto). Para eso probamos la cita tal cual y,
 *     si no calza, también una versión recortada por sus tokens significativos.
 *   - Matcheamos la FRASE COMPLETA, no palabras sueltas. Esto filtra alucinaciones:
 *     una cita alucinada ("Boca perdió 0-1") jamás aparece como substring, mientras
 *     que una cita real ("...cotización de $1.432,05 para la compra") sí.
 */
export function findBackingSource(quote: string, sources: AssistantSource[]): AssistantSource | null {
  const normalizedQuote = normalizeForMatch(quote);
  if (normalizedQuote.length < MIN_QUOTE_LENGTH) return null;

  for (const source of sources) {
    const haystack = normalizeForMatch(`${source.title} ${source.snippet ?? ""} ${source.content ?? ""}`);
    // Match exacto (caso ideal).
    if (haystack.includes(normalizedQuote)) return source;
    // Tolerancia a puntuación de borde: recortar la cita quitando tokens finales
    // no significantes (puntos, comas) y volver a probar. Esto evita falsos negativos
    // cuando el LLM cierra la cita con un punto que en el source abre más texto.
    const trimmedQuote = normalizedQuote.replace(/[.,;:¡!¿?]+$/g, "").trim();
    if (trimmedQuote.length >= MIN_QUOTE_LENGTH && haystack.includes(trimmedQuote)) {
      return source;
    }
  }
  return null;
}

// ── Prompt del extractor LLM ───────────────────────────────────────

function buildExtractorPrompt(userInput: string, sources: AssistantSource[]): { system: string; user: string } {
  const system = [
    "Sos el extractor de datos de Koru. Tu trabajo: leer contenido web y extraer DATOS CONCRETOS que respondan al pedido del usuario.",
    "",
    "Reglas ABSOLUTAS (no negociables):",
    "1. Solo extraés datos que aparezcan LITERALMENTE en el contenido. Nunca inventás ni completás de memoria.",
    "2. Por cada dato, incluís una `quote`: la frase EXACTA del texto de dónde lo sacaste. Mínimo una oración completa.",
    "3. Si el contenido no contiene el dato concreto que el usuario pide, devolvés items: [] (array vacío). Honestidad total.",
    "4. No interpretais ni resumis en el value. El value es el dato crudo tal cual aparece.",
    "5. No agregues items redundantes. Si dos fuentes dicen lo mismo, ponés uno.",
    "",
    "Formato de cada item:",
    "  - label: nombre corto del dato (ej: 'Dólar oficial', 'Argentina 3-0 Arabia', 'Mínima mañana').",
    "  - value: el valor concreto tal cual aparece (ej: '$1.432,05', '3-0', '7°C').",
    "  - detail: contexto breve opcional (ej: 'precio de compra', 'finalizado').",
    "  - quote: la frase LITERAL del contenido que respalda el dato. Debe contener el value.",
    "",
    "Devolvé SOLO JSON válido, sin markdown:",
    '{"title":"descripción corta del conjunto","items":[{"label":"...","value":"...","detail":"...","quote":"frase literal del contenido"}]}',
  ].join("\n");

  const sourcesBlock = sources
    .map((s, i) => {
      const parts = [`[FUENTE ${i + 1}] ${s.domain}`];
      if (s.title) parts.push(`Título: ${s.title}`);
      if (s.snippet) parts.push(`Resumen: ${s.snippet}`);
      if (s.content) parts.push(`Contenido: ${s.content.slice(0, 1000)}`);
      return parts.join("\n");
    })
    .join("\n\n");

  const user = [
    `Pedido del usuario: "${userInput}"`,
    "",
    "Contenido recuperado de la web:",
    sourcesBlock || "(sin contenido)",
  ].join("\n");

  return { system, user };
}

// ── Normalización de la salida del LLM ─────────────────────────────

type RawItem = {
  label?: unknown;
  value?: unknown;
  detail?: unknown;
  quote?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Quita los bloques de razonamiento (Chain-of-Thought) que algunos modelos emiten
 * antes del JSON final: `<think>...</think>`, `<reasoning>...</reasoning>`,
 * `<reflection>...</reflection>`.
 *
 * Esto es AGNÓSTICO al modelo: modelos de razonamiento de distintas familias
 * (MiniMax-M, DeepSeek-R1, Qwen3, GPT-oss, Magistral, etc.) usan estos tags.
 * No es un parche para un proveedor; es manejo estándar de salida con CoT.
 *
 * Si no hay bloque de razonamiento, devuelve el texto tal cual.
 */
function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, "")
    .trim();
}

function normalizeRawItem(raw: RawItem): { label: string; value: string; detail: string; quote: string } | null {
  const label = asString(raw.label);
  const value = asString(raw.value);
  const quote = asString(raw.quote);
  const detail = asString(raw.detail);
  if (!label || !value || !quote) return null;
  // La quote debe contener el value (o serlo cercano). Si no, el item no se respalda a sí mismo.
  if (!normalizeForMatch(quote).includes(normalizeForMatch(value).slice(0, 20)) && value.length > 3) {
    // Permitimos items donde el value es una derivación visual (ej: value "$1.432,05" de quote "cotización de $1.432,05 para la compra")
    // Verificamos que al menos parte del value aparezca en la quote.
    const valueToken = value.replace(/[^\d.,$€£¥₡\w]/g, "");
    if (valueToken.length > 2 && !normalizeForMatch(quote).includes(normalizeForMatch(valueToken))) {
      return null;
    }
  }
  return { label, value, detail, quote };
}

// ── API pública ────────────────────────────────────────────────────

/**
 * Ejecuta el extractor validado.
 *
 * @returns ExtractionResult con items respaldados por citas literales, o null si
 *          no hay nada confiable (LLM caído, sin sources, o todos los items rechazados).
 *          Null significa "caer a texto plano" — nunca rompe la UX.
 */
export async function extractStructuredData(input: ExtractorInput): Promise<ExtractionResult | null> {
  // Sin sources no hay nada que extraer.
  const usableSources = input.sources.filter((s) => (s.snippet?.trim() ?? "") || (s.content?.trim() ?? ""));
  if (usableSources.length === 0) return null;

  const { system, user } = buildExtractorPrompt(input.userInput, usableSources);

  let raw: unknown;
  try {
    const result = await input.chatFn(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.1, maxTokens: 900, responseFormat: { type: "json_object" } },
    );
    raw = parseJsonObjectStrict(stripReasoning(result.content));
  } catch {
    // Si el LLM falla o devuelve JSON inválido, no hay extracción. Cae a texto plano.
    return null;
}

  const obj = raw as Record<string, unknown>;
  const title = asString(obj.title) || "Datos encontrados";
  const rawItems = Array.isArray(obj.items) ? (obj.items as RawItem[]) : [];

  // ── VALIDACIÓN DETERMINISTA (el corazón anti-alucinación) ──
  // Cada item se respalda contra un source real. Los no respaldados se descartan.
  const validatedItems: ExtractedItem[] = [];
  for (const rawItem of rawItems) {
    const normalized = normalizeRawItem(rawItem);
    if (!normalized) continue;
    const backing = findBackingSource(normalized.quote, usableSources);
    if (!backing) continue; // alucinación filtrada: la cita no está en ningún source
    validatedItems.push({
      label: normalized.label,
      value: normalized.value,
      detail: normalized.detail || undefined,
      quote: normalized.quote,
      sourceUrl: backing.url,
      sourceDomain: backing.domain,
    });
  }

  if (validatedItems.length === 0) return null;
  return { title, items: validatedItems.slice(0, 8) };
}
