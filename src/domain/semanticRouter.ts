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
  | "research"
  | "sports"
  | "market"
  | "elections"
  | "directions"
  | "travel"
  | "review"
  | "birthday"
  | "conversation";

export type RouteTool =
  | "web_search"
  | "deep_research"
  | "weather"
  | "shopping_compare"
  | "plan_day"
  | "query_personal_context"
  | "restaurant_deep_search"
  | "match_schedule"
  | "match_live"
  | "crypto_price"
  | "stock_quote"
  | "currency_convert"
  | "route_traffic"
  | "travel_itinerary"
  | "save_personal_item";

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
  { category: "world_info", tool: "web_search", text: "cuánto está el bitcoin" },
  { category: "world_info", tool: "web_search", text: "¿quién ganó el partido?" },
  { category: "world_info", tool: "web_search", text: "buscar refuerzos del Madrid" },
  { category: "world_info", tool: "web_search", text: "fichajes del mercado de pases" },
  { category: "world_info", tool: "web_search", text: "noticias urgentes" },

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
  { category: "personal_query", tool: "query_personal_context", text: "cumple de juan" },
  { category: "personal_query", tool: "query_personal_context", text: "cuanto peso" },
  { category: "personal_query", tool: "query_personal_context", text: "mi actividad fisica" },

  // conversation: saludos, charla, emociones, agradecimientos. Sin tool.
  { category: "conversation", text: "hola Koru" },
  { category: "conversation", text: "buenos días" },
  { category: "conversation", text: "gracias" },
  { category: "conversation", text: "¿cómo estás?" },
  { category: "conversation", text: "hoy estoy reventada" },
  { category: "conversation", text: "te quiero contar algo" },
  { category: "conversation", text: "qué lindo día" },
  { category: "conversation", text: "me aburro" },
  { category: "conversation", text: "che, ¿qué onda lo de ayer?" },
  { category: "conversation", text: "contame algo" },
  { category: "conversation", text: "dale, jaja" },
  { category: "conversation", text: "todo bien por ahí?" },

  // conversation: pedidos creativos/generativos. Los responde el modelo
  // directo (imaginacion, no un dato del mundo real) — NO son web_search.
  { category: "conversation", text: "generame una imagen" },
  { category: "conversation", text: "creame un poema" },
  { category: "conversation", text: "escribime una carta" },
  { category: "conversation", text: "contame un chiste" },
  { category: "conversation", text: "inventame un cuento corto" },

  // research → deep_research: el usuario pide un ENTREGABLE de conocimiento
  // (informe, investigación, análisis completo). No es un dato suelto: es el
  // flujo pedido → trabajando → informe entregado. Distinto de world_info
  // (dato puntual de actualidad) y de review (comparativa de producto).
  { category: "research", tool: "deep_research", text: "quiero un informe sobre Age of Empires 2" },
  { category: "research", tool: "deep_research", text: "haceme un informe de River Plate" },
  { category: "research", tool: "deep_research", text: "investigá todo sobre la dieta keto" },
  { category: "research", tool: "deep_research", text: "contame todo sobre la inteligencia artificial" },
  { category: "research", tool: "deep_research", text: "armame un análisis completo del mercado inmobiliario" },
  { category: "research", tool: "deep_research", text: "hacé un reporte sobre energías renovables" },
  { category: "research", tool: "deep_research", text: "quiero saber todo acerca de los agujeros negros" },
  { category: "research", tool: "deep_research", text: "explicame en profundidad cómo funciona bitcoin" },
  { category: "research", tool: "deep_research", text: "investigación profunda sobre el sueño" },
  { category: "research", tool: "deep_research", text: "necesito un dossier de la empresa Tesla" },
  { category: "research", tool: "deep_research", text: "hazme un resumen completo de la segunda guerra mundial" },

  // world_info → restaurant_deep_search: buscar lugar para comer.
  { category: "world_info", tool: "restaurant_deep_search", text: "dónde cenar en Madrid" },
  { category: "world_info", tool: "restaurant_deep_search", text: "mejor parrilla de Palermo" },
  { category: "world_info", tool: "restaurant_deep_search", text: "restaurante sushi en Barcelona" },
  { category: "world_info", tool: "restaurant_deep_search", text: "qué restaurante me recomendás" },
  { category: "world_info", tool: "restaurant_deep_search", text: "donde como paella en Valencia" },
  { category: "world_info", tool: "restaurant_deep_search", text: "restaurantes románticos en París" },

  // action: crear alarma, recordatorio, guardar algo, salud.
  { category: "action", text: "creame una alarma" },
  { category: "action", text: "recordame llamar al médico" },
  { category: "action", text: "recordame tomar pastillas" },
  { category: "action", text: "guardá esto" },
  { category: "action", text: "anotá un gasto" },
  { category: "action", text: "tengo que comprar leche" },
  { category: "action", text: "dame el resumen del dia" },
  { category: "action", text: "exportame el archivo" },
  { category: "action", text: "descargar pdf" },
  { category: "action", text: "guardar documento" },
  { category: "action", text: "enviame el archivo" },

  // sports → match_schedule / match_live
  { category: "sports", tool: "match_schedule", text: "juega Boca hoy" },
  { category: "sports", tool: "match_schedule", text: "¿a qué hora juega Real Madrid?" },
  { category: "sports", tool: "match_schedule", text: "fixture de la champions" },
  { category: "sports", tool: "match_live", text: "resultados de ayer" },
  { category: "sports", tool: "match_live", text: "tabla de la liga" },
  { category: "sports", tool: "match_live", text: "¿cómo va el partido?" },
  { category: "sports", tool: "match_schedule", text: "cuándo juega Argentina" },
  { category: "sports", tool: "match_live", text: "estadísticas del partido" },
  { category: "sports", tool: "match_schedule", text: "próximo partido de River" },
  { category: "sports", tool: "match_live", text: "resultado en vivo" },

  // market → crypto_price / stock_quote / currency_convert
  { category: "market", tool: "crypto_price", text: "precio del bitcoin" },
  { category: "market", tool: "crypto_price", text: "cómo está el ethereum" },
  { category: "market", tool: "stock_quote", text: "cotización de Apple" },
  { category: "market", tool: "stock_quote", text: "cierre del S&P 500" },
  { category: "market", tool: "currency_convert", text: "precio del dólar" },
  { category: "market", tool: "currency_convert", text: "cuánto vale el oro" },
  { category: "market", tool: "stock_quote", text: "cómo cerró Tesla" },
  { category: "market", tool: "crypto_price", text: "cotización de criptomonedas" },
  { category: "market", tool: "currency_convert", text: "tipo de cambio euro dólar" },

  // elections → web_search
  { category: "elections", tool: "web_search", text: "resultados de las elecciones" },
  { category: "elections", tool: "web_search", text: "escrutinio" },
  { category: "elections", tool: "web_search", text: "a quién le conviene votar" },
  { category: "elections", tool: "web_search", text: "qué dicen las encuestas" },
  { category: "elections", tool: "web_search", text: "candidatos 2025" },
  { category: "elections", tool: "web_search", text: "quién va ganando" },
  { category: "elections", tool: "web_search", text: "porcentaje de votos" },
  { category: "elections", tool: "web_search", text: "ballotage" },
  { category: "elections", tool: "web_search", text: "mesa electoral" },

  // directions → route_traffic
  { category: "directions", tool: "route_traffic", text: "cómo llego a Palermo" },
  { category: "directions", tool: "route_traffic", text: "tráfico en la autopista" },
  { category: "directions", tool: "route_traffic", text: "cuánto tardo hasta el centro" },
  { category: "directions", tool: "route_traffic", text: "ruta más rápida" },
  { category: "directions", tool: "route_traffic", text: "cómo ir al aeropuerto" },
  { category: "directions", tool: "route_traffic", text: "mejor ruta en auto" },
  { category: "directions", tool: "route_traffic", text: "comparar transporte" },
  { category: "directions", tool: "route_traffic", text: "cuánto demora el bondi" },

  // travel → travel_itinerary
  { category: "travel", tool: "travel_itinerary", text: "quiero viajar a Madrid" },
  { category: "travel", tool: "travel_itinerary", text: "vuelos a Barcelona" },
  { category: "travel", tool: "travel_itinerary", text: "hoteles en París" },
  { category: "travel", tool: "travel_itinerary", text: "qué visitar en Roma" },
  { category: "travel", tool: "travel_itinerary", text: "armame un itinerario" },

  // review → shopping_compare / web_search
  { category: "review", tool: "shopping_compare", text: "review de auriculares" },
  { category: "review", tool: "shopping_compare", text: "mejor cafetera 2025" },
  { category: "review", tool: "web_search", text: "opiniones del iPhone 16" },
  { category: "review", tool: "shopping_compare", text: "comparativa de notebooks" },
  { category: "review", tool: "web_search", text: "qué dicen las reseñas" },
  { category: "review", tool: "shopping_compare", text: "review de cafeteras" },
  { category: "review", tool: "shopping_compare", text: "análisis de auriculares Sony" },
  { category: "review", tool: "web_search", text: "puntuación de productos" },
  { category: "review", tool: "web_search", text: "veredicto final" },

  // birthday → save_personal_item
  { category: "birthday", tool: "save_personal_item", text: "cumpleaños de Ana" },
  { category: "birthday", tool: "save_personal_item", text: "regalo para mi hermano" },
  { category: "birthday", tool: "save_personal_item", text: "cuándo es el cumple de Juan" },
  { category: "birthday", tool: "save_personal_item", text: "fecha de nacimiento de María" },
  { category: "birthday", tool: "save_personal_item", text: "aniversario de bodas" },
  { category: "birthday", tool: "save_personal_item", text: "recordatorio de cumpleaños" },
  { category: "birthday", tool: "save_personal_item", text: "calendario de cumpleaños" },
  { category: "birthday", tool: "save_personal_item", text: "próximo cumpleaños" },
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
// Fase 4.9: cosineSimilarity movida a domain/vector.ts. Import + re-export.
import { cosineSimilarity } from "./vector";
export { cosineSimilarity };

// ── Umbral de confianza ────────────────────────────────────────────
// Si la similitud coseno más alta no supera esto, caemos a "conversation".
// Subido de 0.55 → 0.70 porque con 0.55 disparaba tools (sobre todo
// web_search) para mensajes ambiguos que en realidad eran charla. Falso
// negativo (cae a conversation) es barato: el modelo responde libre.
// Falso positivo (dispara tool sola) es caro: "buscando en la web" por
// cualquier cosa. Se ajustará con tests reales.
const CONFIDENCE_THRESHOLD = 0.7;

// Margen mínimo entre la mejor categoría y la segunda mejor. Si dos
// categorías están casi empatadas, el mensaje es ambiguo entre dos
// intenciones distintas (o es charla genérica que roza varias) — no forzamos
// una tool con esa incertidumbre.
const MIN_CATEGORY_MARGIN = 0.03;

// ── Clase del Router ───────────────────────────────────────────────

export class SemanticRouter {
  private examples: EmbeddedExample[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private embedFn: EmbedFn;
  // Fase 2.5: caché LRU simple para embeddings de mensajes del usuario.
  // Evita re-embedir el mismo mensaje (ej: "hola", "gracias") en cada turno.
  // Tamaño máximo 100 entradas (suficiente para conversación típica).
  private messageCache = new Map<string, number[]>();
  private static readonly CACHE_MAX = 100;

  constructor(embedFn: EmbedFn) {
    this.embedFn = embedFn;
  }

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
   * Embede un mensaje del usuario con caché LRU.
   * Si el mismo mensaje se pide de nuevo, devuelve el vector cacheado.
   */
  private async embedMessage(text: string): Promise<number[]> {
    const cached = this.messageCache.get(text);
    if (cached) {
      // Mover al final (LRU: más reciente)
      this.messageCache.delete(text);
      this.messageCache.set(text, cached);
      return cached;
    }
    const vector = await this.embedFn(text);
    // Si la caché está llena, eliminar la entrada más vieja (primera insertada)
    if (this.messageCache.size >= SemanticRouter.CACHE_MAX) {
      const firstKey = this.messageCache.keys().next().value;
      if (firstKey) this.messageCache.delete(firstKey);
    }
    this.messageCache.set(text, vector);
    return vector;
  }

  /**
   * Clasifica la intención de un mensaje.
   * Devuelve la categoría más probable con su confianza.
   * Si la confianza es baja, cae a "conversation" (deja al modelo responder libre).
   */
  async route(message: string): Promise<RouteResult> {
    await this.initialize();

    const messageVector = await this.embedMessage(message);

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

    // Ambigüedad entre categorías → tampoco forzar. Comparamos la mejor
    // similitud de la categoría ganadora contra la mejor de la segunda
    // categoría más cercana (no contra el segundo ejemplo, que podría ser
    // de la misma categoría y no dice nada sobre ambigüedad real).
    if (bestExample.category !== "conversation") {
      const sortedCategories = [...bestByCategory.entries()].sort((a, b) => b[1] - a[1]);
      const secondBestSim = sortedCategories[1]?.[1] ?? -1;
      if (bestSim - secondBestSim < MIN_CATEGORY_MARGIN) {
        return { category: "conversation", confidence: bestSim };
      }
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

  if (tool === "deep_research") {
    // Extraer el TEMA sacando el envoltorio del pedido ("quiero un informe
    // sobre", "investigá", "contame todo de", ...). Si no matchea, va el
    // mensaje entero: el pipeline lo refina igual al generar sub-búsquedas.
    const topicMatch = clean.match(
      /(?:informe|reporte|dossier|an[aá]lisis|investigaci[oó]n|resumen)\s+(?:completo\s+|profundo\s+|detallado\s+)?(?:sobre|de|del|acerca de)\s+(.{3,120})/i,
    ) ?? clean.match(
      /(?:investig[aá](?:me)?|contame todo (?:sobre|de)|quiero saber todo (?:sobre|de|acerca de)|explicame en profundidad)\s+(.{3,120})/i,
    );
    const topic = (topicMatch?.[1] ?? clean).trim().replace(/[.?!]+$/, "");
    return { topic, query: clean };
  }

  if (tool === "weather") {
    // Buscar "en X", "de X", "para X" como ciudad.
    const cityMatch = clean.match(/\b(?:en|de|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ\s]{2,30}?)(?:\s*$|[.?!,])/);
    if (cityMatch?.[1]) {
      return { city: cityMatch[1].trim() };
    }
    return {};
  }

  if (tool === "restaurant_deep_search") {
    return { query: clean };
  }

  if (tool === "plan_day") {
    return { focus: clean };
  }

  if (tool === "query_personal_context") {
    return { topic: "general", query: clean };
  }

  if (tool === "match_schedule" || tool === "match_live") {
    return { query: clean };
  }
  if (tool === "crypto_price") {
    return { coin: clean };
  }
  if (tool === "stock_quote") {
    return { symbol: clean };
  }
  if (tool === "currency_convert") {
    return { amount: 1, from: "USD", to: "ARS" };
  }
  if (tool === "route_traffic") {
    return { query: clean };
  }
  if (tool === "travel_itinerary") {
    return { destination: clean };
  }

  return undefined;
}
