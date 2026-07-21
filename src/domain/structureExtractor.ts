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

// ───────────────────────────────────────────────────────────────────
// COMPARISON EXTRACTOR — same anti-alucinación axioms, product-shaped output
// ───────────────────────────────────────────────────────────────────

/**
 * Un producto extraído para comparación. Cada campo opcional debe estar
 * respaldado por una cita LITERAL de algún source. Si el LLM propone un
 * campo sin respaldo, se descarta SOLO ESE CAMPO (no el producto entero).
 *
 * `score` es determinista: (campos_validados / 5) * 10, capped at 10.
 * 5 = campos esperados del schema ideal: price, rating, specs, pros, cons.
 */
export type ComparisonProduct = {
  name: string;
  price?: {
    value: string;
    quote: string;
    sourceUrl: string;
    sourceDomain: string;
  };
  rating?: {
    value: number;
    quote: string;
    sourceUrl: string;
    sourceDomain: string;
  };
  specs: Array<{
    label: string;
    value: string;
    quote: string;
    sourceUrl: string;
    sourceDomain: string;
  }>;
  pros: Array<{
    text: string;
    quote: string;
    sourceUrl: string;
    sourceDomain: string;
  }>;
  cons: Array<{
    text: string;
    quote: string;
    sourceUrl: string;
    sourceDomain: string;
  }>;
  /** 0-10. (campos_validados / 5) * 10. Determinista, explicable. */
  score: number;
  /** Todas las fuentes que respaldan al menos un campo del producto. */
  sources: Array<{ url: string; domain: string }>;
  /** Mejor cita representativa del producto (para el `evidence` del card). */
  summaryQuote?: string;
};

export type ComparisonExtractionResult = {
  title: string;
  products: ComparisonProduct[];
};

/** Número de campos esperados por producto — fija el denominador del score. */
const COMPARISON_EXPECTED_FIELDS = 5;

function buildComparisonPrompt(userInput: string, sources: AssistantSource[]): { system: string; user: string } {
  const system = [
    "Sos el extractor de comparación de productos de Koru. Tu trabajo: leer contenido web y extraer PRODUCTOS COMPLETOS con sus specs, precio, rating, pros y contras.",
    "",
    "Reglas ABSOLUTAS (no negociables):",
    "1. Solo extraés datos que aparezcan LITERALMENTE en el contenido. Nunca inventás ni completás de memoria.",
    "2. Por cada dato (precio, rating, spec, pro, contra), incluís una `quote`: la frase EXACTA del texto de dónde lo sacaste. Mínimo una oración completa.",
    "3. Si el contenido no contiene un dato concreto, omití ese campo (NO lo inventes). El producto puede quedarse con menos campos.",
    "4. Sacá hasta 4 productos. Si solo hay info de 1 producto, devolvés 1. Si no hay nada, devolvés products: [].",
    "5. `name` es el nombre del producto (ej: 'Samsung Galaxy S24', 'iPhone 15').",
    "6. `price.value` debe contener el precio crudo (ej: '$799', 'USD 859').",
    "7. `rating.value` es un número (ej: 4.5).",
    "8. `specs` es un array de {label, value, quote}. Label ej: 'Pantalla', 'RAM', 'Battery'. Value ej: '120Hz', '8GB', '5000mAh'.",
    "9. `pros` y `cons` son arrays de {text, quote}. Texto corto, ej: 'Mejor pantalla', 'Sin jack de auriculares'.",
    "",
    "Devolvé SOLO JSON válido, sin markdown:",
    '{"title":"Comparativa de ...","products":[{"name":"...","price":{"value":"$...","quote":"frase literal"},"rating":{"value":4.5,"quote":"frase literal"},"specs":[{"label":"Pantalla","value":"120Hz","quote":"frase literal"}],"pros":[{"text":"...","quote":"frase literal"}],"cons":[{"text":"...","quote":"frase literal"}]}]}',
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

type RawCitedField = { value?: unknown; quote?: unknown };
type RawSpec = { label?: unknown; value?: unknown; quote?: unknown };
type RawProCon = { text?: unknown; quote?: unknown };
type RawProduct = {
  name?: unknown;
  price?: RawCitedField;
  rating?: RawCitedField;
  specs?: unknown;
  pros?: unknown;
  cons?: unknown;
};

function validateCitedField<T>(
  raw: RawCitedField | undefined,
  parse: (rawValue: string) => T | null,
  sources: AssistantSource[],
): { value: T; quote: string; sourceUrl: string; sourceDomain: string } | null {
  if (!raw) return null;
  const valueStr = asString(raw.value as unknown);
  const quote = asString(raw.quote as unknown);
  if (!valueStr || !quote) return null;
  const parsed = parse(valueStr);
  if (parsed === null) return null;
  const backing = findBackingSource(quote, sources);
  if (!backing) return null;
  return { value: parsed, quote, sourceUrl: backing.url, sourceDomain: backing.domain };
}

/**
 * Ejecuta el extractor de comparación.
 *
 * @returns ComparisonExtractionResult con products validados campo-por-campo,
 *          o null si no hay sources usables o el LLM no devolvió nada confiable.
 */
export async function extractComparisonData(input: ExtractorInput): Promise<ComparisonExtractionResult | null> {
  const usableSources = input.sources.filter((s) => (s.snippet?.trim() ?? "") || (s.content?.trim() ?? ""));
  if (usableSources.length === 0) return null;

  const { system, user } = buildComparisonPrompt(input.userInput, usableSources);

  let raw: unknown;
  try {
    const result = await input.chatFn(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.1, maxTokens: 1500, responseFormat: { type: "json_object" } },
    );
    raw = parseJsonObjectStrict(stripReasoning(result.content));
  } catch {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const title = asString(obj.title) || "Comparativa";
  const rawProducts = Array.isArray(obj.products) ? (obj.products as RawProduct[]) : [];

  const products: ComparisonProduct[] = [];
  for (const rawProduct of rawProducts.slice(0, 4)) {
    const name = asString(rawProduct.name);
    if (!name || name.length < 2) continue;

    const price = validateCitedField(rawProduct.price, (v) => v, usableSources);
    const rating = validateCitedField(rawProduct.rating, (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    }, usableSources);

    const rawSpecs = Array.isArray(rawProduct.specs) ? (rawProduct.specs as RawSpec[]) : [];
    const specs = rawSpecs
      .map((rs) => {
        const label = asString(rs.label);
        const value = asString(rs.value);
        const quote = asString(rs.quote);
        if (!label || !value || !quote) return null;
        const backing = findBackingSource(quote, usableSources);
        if (!backing) return null;
        return { label, value, quote, sourceUrl: backing.url, sourceDomain: backing.domain };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .slice(0, 5);

    const rawPros = Array.isArray(rawProduct.pros) ? (rawProduct.pros as RawProCon[]) : [];
    const pros = rawPros
      .map((rp) => {
        const text = asString(rp.text);
        const quote = asString(rp.quote);
        if (!text || !quote) return null;
        const backing = findBackingSource(quote, usableSources);
        if (!backing) return null;
        return { text, quote, sourceUrl: backing.url, sourceDomain: backing.domain };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, 3);

    const rawCons = Array.isArray(rawProduct.cons) ? (rawProduct.cons as RawProCon[]) : [];
    const cons = rawCons
      .map((rc) => {
        const text = asString(rc.text);
        const quote = asString(rc.quote);
        if (!text || !quote) return null;
        const backing = findBackingSource(quote, usableSources);
        if (!backing) return null;
        return { text, quote, sourceUrl: backing.url, sourceDomain: backing.domain };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .slice(0, 3);

    // Score determinista: (campos_validados / 5) * 10
    const validatedFields = [
      price ? 1 : 0,
      rating ? 1 : 0,
      specs.length > 0 ? 1 : 0,
      pros.length > 0 ? 1 : 0,
      cons.length > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    const score = Math.round((validatedFields / COMPARISON_EXPECTED_FIELDS) * 10 * 10) / 10;

    // Si NINGÚN campo está respaldado, descartar el producto entero.
    if (validatedFields === 0) continue;

    // Recopilar todas las fuentes que respaldan al producto.
    const sourceMap = new Map<string, { url: string; domain: string }>();
    if (price) sourceMap.set(price.sourceUrl, { url: price.sourceUrl, domain: price.sourceDomain });
    if (rating) sourceMap.set(rating.sourceUrl, { url: rating.sourceUrl, domain: rating.sourceDomain });
    for (const s of specs) sourceMap.set(s.sourceUrl, { url: s.sourceUrl, domain: s.sourceDomain });
    for (const p of pros) sourceMap.set(p.sourceUrl, { url: p.sourceUrl, domain: p.sourceDomain });
    for (const c of cons) sourceMap.set(c.sourceUrl, { url: c.sourceUrl, domain: c.sourceDomain });

    // Mejor cita representativa: la del rating > precio > primer spec > primer pro.
    const summaryQuote = rating?.quote ?? price?.quote ?? specs[0]?.quote ?? pros[0]?.quote ?? cons[0]?.quote;

    products.push({
      name,
      price: price ?? undefined,
      rating: rating ?? undefined,
      specs,
      pros,
      cons,
      score,
      sources: Array.from(sourceMap.values()),
      summaryQuote,
    });
  }

  if (products.length === 0) return null;
  return { title, products };
}
