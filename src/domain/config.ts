/**
 * Fase 3.9 — Constantes centrales de Koru.
 *
 * Antes estas constantes estaban dispersas como "magic numbers" por todo
 * el código (0.55, 0.58, 0.65, 0.75, 0.85, 0.95, 120, 200, 500, 15_000,
 * 115_000, 45_000, 120_000, etc.). Ahora viven acá con nombre y contexto.
 *
 * Calibración:
 * - Los thresholds de confianza se calibraron empiricamente durante
 *   desarrollo. Cambiarlos afecta sensibilidad/precisión del router.
 * - Los timeouts se calibraron contra latencia real de NVIDIA Nemotron,
 *   OpenRouter y APIs públicas gratuitas.
 * - Los límites de array previenen memory leaks en sesiones largas.
 */

// ── Confianza (thresholds) ──────────────────────────────────────────
export const CONFIDENCE = {
  /** Umbral mínimo del Semantic Router para usar una tool (no caer a conversation). */
  ROUTER_MIN: 0.70,
  /** Confianza para memories sensibles (más conservador). */
  MEMORY_SENSITIVE: 0.58,
  /** Confianza para memories normales. */
  MEMORY_NORMAL: 0.65,
  /** Confianza para schemas de noticias (alto porque pattern matching es estricto). */
  SCHEMA_NEWS: 0.85,
  /** Confianza para schemas de dinero (más alto aún, datos financieros). */
  SCHEMA_MONEY: 0.95,
  /** Confianza mínima del enhancement extractor para proponer un +1. */
  ENHANCEMENT_MIN: 0.65,
  /** Confianza mínima del enhancement engine para mostrar al usuario. */
  ENHANCEMENT_SHOW: 0.65,
  /** Confianza floor para memories confirmadas. */
  MEMORY_CONFIRMED: 0.9,
  /** Confianza mínima para que un nudge proactivo se muestre. */
  NUDGE_MIN: 0.5,
  /** Confianza inicial para memories candidate. */
  MEMORY_CANDIDATE: 0.5,
  /** Floor de confianza para cualquier memory (no bajar de esto). */
  MEMORY_FLOOR: 0.3,
  /** Ceiling de confianza para cualquier memory (no subir de esto). */
  MEMORY_CEIL: 0.95,
} as const;

// ── Timeouts (ms) ───────────────────────────────────────────────────
export const TIMEOUTS = {
  /** NVIDIA Nemotron-3-Ultra-550b (modelo grande, necesita más tiempo). */
  NVIDIA_LARGE: 120_000,
  /** NVIDIA estándar. */
  NVIDIA_STANDARD: 45_000,
  /** OpenRouter (modelos gratuitos, menos confiables). */
  OPENROUTER: 115_000,
  /** MiniMax. */
  MINIMAX: 60_000,
  /** BlueSminds. */
  BLUESMINDS: 60_000,
  /** Ollama local. */
  OLLAMA: 90_000,
  /** Fetch a APIs públicas gratuitas (Frankfurter, TheSportsDB, etc.). */
  API_FETCH: 15_000,
  /** Embeddings (Ollama o NVIDIA cloud). */
  EMBEDDING: 10_000,
  /** ASR (transcripción de audio). */
  ASR: 30_000,
  /** VLM (análisis de imágenes). */
  VLM: 30_000,
} as const;

// ── Límites de arrays (memory management) ──────────────────────────
export const LIMITS = {
  /** Máximo de records guardados en state. */
  RECORDS: 500,
  /** Máximo de model calls persistidos. */
  MODEL_CALLS: 120,
  /** Máximo de entries persistidos. */
  ENTRIES: 200,
  /** Máximo de chars para topic extraction en deep research. */
  TOPIC_MAX_LEN: 120,
  /** Mínimo de chars para topic extraction. */
  TOPIC_MIN_LEN: 3,
  /** Umbral de longitud de input para considerar memory candidate. */
  MEMORY_INPUT_MIN: 120,
  /** Máximo de memorias relevantes a inyectar en system prompt. */
  RELEVANT_MEMORIES: 12,
  /** Máximo de memorias candidate a inyectar en system prompt. */
  CANDIDATE_MEMORIES: 8,
  /** Máximo de commitments open a mostrar en system prompt. */
  OPEN_COMMITMENTS: 5,
  /** Máximo de records a mostrar en system prompt. */
  RECENT_RECORDS: 8,
  /** Tamaño del lote para embedir ejemplos del router. */
  ROUTER_BATCH: 5,
  /** Máximo de entradas en caché LRU del router. */
  ROUTER_CACHE: 100,
  /** Ventana de entries recientes para enhancement engine. */
  ENHANCEMENT_WINDOW: 10,
  /** Umbral de entries ignorados para silenciar enhancements. */
  ENHANCEMENT_IGNORE_THRESHOLD: 4,
} as const;

// ── Ventanas temporales ─────────────────────────────────────────────
export const WINDOWS = {
  /** Tiempo entre nudges del mismo tipo (20 horas). */
  NUDGE_COOLDOWN_HOURS: 20,
  /** Intervalo del heartbeat (60 segundos). */
  HEARTBEAT_INTERVAL: 60_000,
  /** Auto-dismiss de errores de micrófono (4 segundos). */
  MIC_ERROR_DISMISS: 4_000,
} as const;
