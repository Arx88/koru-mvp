/**
 * Semantic Router — Clasificador de intención por similitud de embeddings.
 *
 * Decide qué quiere el usuario comparando el SIGNIFICADO de su mensaje contra
 * ejemplos modelo de cada categoría. NO usa palabras clave: usa distancia
 * coseno entre vectores de embeddings. "Qué onda el mundial" y "resultados de
 * la copa" clasifican igual porque comparten significado.
 *
 * Es AGNÓSTICO al modelo: recibe una `embedFn` inyectada. Funciona con Ollama
 * local (nomic-embed-text), OpenAI, o cualquier proveedor de embeddings.
 *
 * Es barato: solo embede el mensaje nuevo (~50 tokens). Los ejemplos se embeden
 * una vez y se cachean en memoria. Las comparaciones son multiplicaciones.
 *
 * Es seguro: si la confianza es baja (umbral no superado), devuelve "conversation"
 * → deja que el modelo responda libre. Nunca fuerza una tool equivocada.
 */

// ── Tipos ──────────────────────────────────────────────────────────

/**
 * Función que convierte texto en vector de embeddings. Inyectada para mantener
 * agnosticismo al proveedor (Ollama local, OpenAI, etc.).
 */
export type EmbedFn = (text: string) => Promise<number[]>;

/**
 * Resultado del router: qué quiere el usuario y con qué confianza.
 */
export type RouteResult = {
  /** Categoría de intención detectada. */
  category: RouteCategory;
  /** Tool a ejecutar (si aplica). Undefined si es conversación pura. */
  tool?: RouteTool;
  /** Confianza 0..1. Si < umbral, category cae a "conversation". */
  confidence: number;
  /** Argumentos extraídos del mensaje (query, city, etc.) para la tool. */
  toolArgs?: Record<string, unknown>;
};

export type RouteCategory =
  | "world_info"
  | "personal_query"
  | "shopping"
  | "weather"
  | "planning"
  | "action"
  | "conversation";

export type RouteTool =
  | "web_search"
  | "weather"
  | "shopping_compare"
  | "plan_day"
  | "query_personal_context";

// ── Ejemplos modelo por categoría ──────────────────────────────────
// Pocas frases (5-8) por categoría, elegidas para cubrir las formas comunes
// de pedir esa intención. El router las compara por SIGNIFICADO, no por palabra.
// Se amplían cuando detectemos una clasificación errónea en uso real.

const ROUTE_EXAMPLES: Array<{ category: RouteCategory; tool?: RouteTool; text: string }> = [
  // world_info → web_search: información del mundo exterior que cambia con el tiempo.
  { category: "world_info", tool: "web_search", text: "¿qué pasó hoy en el mundial?" },
  { category: "world_info", tool: "web_search", text: "resultados de la copa" },
  { category: "world_info", tool: "web_search", text: "últimas noticias de tecnología" },
  { category: "world_info", tool: "web_search", text: "¿cómo le fue a Boca?" },
  { category: "world_info", tool: "web_search", text: "¿qué pasó en Argentina hoy?" },
  { category: "world_info", tool: "web_search", text: "precio del dólar hoy" },
  { category: "world_info", tool: "web_search", text: "¿quién ganó el partido?" },
  { category: "world_info", tool: "web_search", text: "che, ¿qué onda lo de ayer?" },
  { category: "world_info", tool: "web_search", text: "buscar refuerzos del Madrid" },
  { category: "world_info", tool: "web_search", text: "fichajes del mercado de pases" },
  { category: "world_info", tool: "web_search", text: "buscá información sobre el tema" },

  // weather → weather: condiciones meteorológicas.
  { category: "weather", tool: "weather", text: "¿qué tiempo hace?" },
  { category: "weather", tool: "weather", text: "¿como esta el clima?" },
  { category: "weather", tool: "weather", text: "¿como esta el tiempo?" },
  { category: "weather", tool: "weather", text: "¿necesito paraguas?" },
  { category: "weather", tool: "weather", text: "¿qué me pongo hoy?" },
  { category: "weather", tool: "weather", text: "¿hace frío afuera?" },
  { category: "weather", tool: "weather", text: "¿hace calor?" },
  { category: "weather", tool: "weather", text: "¿va a llover?" },
  { category: "weather", tool: "weather", text: "¿cómo está el día?" },
  { category: "weather", tool: "weather", text: "¿que temperatura hace?" },
  { category: "weather", tool: "weather", text: "¿como esta el clima en Buenos Aires?" },

  // shopping → shopping_compare: comparativa o recomendación de compra.
  { category: "shopping", tool: "shopping_compare", text: "¿qué auriculares compro?" },
  { category: "shopping", tool: "shopping_compare", text: "necesito una batería externa" },
  { category: "shopping", tool: "shopping_compare", text: "¿dónde compro X más barato?" },
  { category: "shopping", tool: "shopping_compare", text: "¿cuál es mejor, A o B?" },
  { category: "shopping", tool: "shopping_compare", text: "recomendame un celular" },

  // planning → plan_day: organizar el día o priorizar tareas.
  { category: "planning", tool: "plan_day", text: "¿cómo organizo hoy?" },
  { category: "planning", tool: "plan_day", text: "tengo muchas cosas" },
  { category: "planning", tool: "plan_day", text: "¿qué hago primero?" },
  { category: "planning", tool: "plan_day", text: "ayudame a planificar el día" },
  { category: "planning", tool: "plan_day", text: "no me da el tiempo" },

  // personal_query → query_personal_context: datos que Koru ya guardó.
  { category: "personal_query", tool: "query_personal_context", text: "¿cuánto gasté?" },
  { category: "personal_query", tool: "query_personal_context", text: "¿qué tenía para comer?" },
  { category: "personal_query", tool: "query_personal_context", text: "¿qué pendientes tengo?" },
  { category: "personal_query", tool: "query_personal_context", text: "¿recordás lo que te dije?" },
  { category: "personal_query", tool: "query_personal_context", text: "¿qué links guardé?" },

  // conversation: saludos, charla, emociones, agradecimientos. Sin tool.
  { category: "conversation", text: "hola Koru" },
  { category: "conversation", text: "buenos días" },
  { category: "conversation", text: "gracias" },
  { category: "conversation", text: "¿cómo estás?" },
  { category: "conversation", text: "hoy estoy reventada" },
  { category: "conversation", text: "te quiero contar algo" },
  { category: "conversation", text: "qué lindo día" },
  { category: "conversation", text: "me aburro" },

  // action: crear alarma, recordatorio, guardar algo. Sin tool directa
  // (el Composer decide si guardar, crear compromiso, etc.).
  { category: "action", text: "creame una alarma" },
  { category: "action", text: "recordame llamar al médico" },
  { category: "action", text: "guardá esto" },
  { category: "action", text: "anotá un gasto" },
  { category: "action", text: "tengo que comprar leche" },
];

// ── Cache de embeddings de ejemplos ────────────────────────────────
// Los ejemplos se embeden UNA vez al inicializar. Después todas las
// comparaciones usan estos vectores cacheados (gratis).

type EmbeddedExample = {
  category: RouteCategory;
  tool?: RouteTool;
  text: string;
  vector: number[];
};

// ── Matemáticas de similitud ───────────────────────────────────────

/**
 * Producto escalar (dot product) normalizado = similitud coseno.
 * Devuelve 0..1 donde 1 = idéntico, 0 = sin relación.
 * Asume vectores ya normalizados (los modelos de embeddings los entregan así).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ── Umbral de confianza ────────────────────────────────────────────
// Si la similitud coseno más alta no supera esto, caemos a "conversation".
// Lo calibraremos con tests reales. Empezamos conservador.
const CONFIDENCE_THRESHOLD = 0.55;

// ── Clase del Router ───────────────────────────────────────────────

export class SemanticRouter {
  private examples: EmbeddedExample[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(private embedFn: EmbedFn) {}

  /**
   * Embede todos los ejemplos modelo una sola vez. Idempotente.
   * Llamar antes del primer route(). Las llamadas posteriores son no-op.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initialized = true;
  }

  private async _doInitialize(): Promise<void> {
    // Embedir en lotes chicos para no saturar Ollama.
    const batchSize = 5;
    for (let i = 0; i < ROUTE_EXAMPLES.length; i += batchSize) {
      const batch = ROUTE_EXAMPLES.slice(i, i + batchSize);
      const embedded = await Promise.all(
        batch.map(async (ex) => ({
          category: ex.category,
          tool: ex.tool,
          text: ex.text,
          vector: await this.embedFn(ex.text),
        })),
      );
      this.examples.push(...embedded);
    }
  }

  /**
   * Clasifica la intención de un mensaje.
   * Devuelve la categoría más probable con su confianza.
   * Si la confianza es baja, cae a "conversation" (deja al modelo responder libre).
   */
  async route(message: string): Promise<RouteResult> {
    await this.initialize();

    const messageVector = await this.embedFn(message);

    // Comparar contra todos los ejemplos, quedarse con el más parecido.
    let bestSim = -1;
    let bestExample: EmbeddedExample | null = null;
    // Trackear también el mejor por categoría (para desempate / telemetría).
    const bestByCategory = new Map<RouteCategory, number>();
    for (const example of this.examples) {
      const sim = cosineSimilarity(messageVector, example.vector);
      if (sim > bestSim) {
        bestSim = sim;
        bestExample = example;
      }
      const prev = bestByCategory.get(example.category) ?? -1;
      if (sim > prev) bestByCategory.set(example.category, sim);
    }

    // Confianza baja → no forzar tool, dejar conversación.
    if (!bestExample || bestSim < CONFIDENCE_THRESHOLD) {
      return { category: "conversation", confidence: bestSim < 0 ? 0 : bestSim };
    }

    const result: RouteResult = {
      category: bestExample.category,
      tool: bestExample.tool,
      confidence: bestSim,
    };

    // Extracción ligera de argumentos comunes (query, city) por regex simple.
    // No es matching de intención (eso ya lo hizo el router): es extracción de
    // parámetros para la tool elegida. Si no encuentra, la tool usa el mensaje tal cual.
    result.toolArgs = extractToolArgs(message, bestExample.tool);

    return result;
  }
}

// ── Extracción de argumentos para tools ────────────────────────────
// El router ya decidió la intención. Acá solo extraemos parámetros concretos.
// Ej: si la tool es weather, buscamos "en [ciudad]" o "de [ciudad]".

function extractToolArgs(message: string, tool?: RouteTool): Record<string, unknown> | undefined {
  if (!tool) return undefined;
  const clean = message.trim();

  if (tool === "web_search" || tool === "shopping_compare") {
    // Para búsquedas, usamos el mensaje limpio como query. Simple y robusto.
    return { query: clean, mode: tool === "shopping_compare" ? "shopping" : "world" };
  }

  if (tool === "weather") {
    // Buscar "en X", "de X", "para X" como ciudad.
    const cityMatch = clean.match(/\b(?:en|de|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ\s]{2,30}?)(?:\s*$|[.?!,])/);
    if (cityMatch?.[1]) {
      return { city: cityMatch[1].trim() };
    }
    return {};
  }

  if (tool === "plan_day") {
    return { focus: clean };
  }

  if (tool === "query_personal_context") {
    return { topic: "general", query: clean };
  }

  return undefined;
}
