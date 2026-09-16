/**
 * Cache TTL en memoria. Para tools con APIs rate-limited.
 *
 * Es volátil por proceso (suficiente para un dev-server que vive largo rato).
 * Para persistencia entre reinicios se podría extender a IndexedDB, pero para
 * uso personal el cache en memoria ya elimina el 95% de la presión.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

/** Devuelve el valor cacheado si existe y no expiró, si no undefined. */
export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/** Guarda un valor con TTL en milisegundos. */
export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Ejecuta `fn` si la key no está cacheada y guarda el resultado. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  setCached(key, value, ttlMs);
  return value;
}

/**
 * Cache con TTL diferenciado para ACIERTO y FALLO.
 *
 * `fn` devuelve `null` para señalar un fallo de fuente (HTTP no-ok, respuesta
 * ilegible, búsqueda sin resultados): ese `null` se cachea `failTtlMs` (corto),
 * así el turno siguiente no vuelve a golpear una API caída, pero tampoco queda
 * envenenado cuando la fuente se recupera. Los aciertos —incluido el "no hay
 * resultados" legítimo, que el caller representa con `[]`— se cachean `ttlMs`.
 */
export async function cachedSoft<T>(
  key: string,
  ttlMs: number,
  failTtlMs: number,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const hit = getCached<T | null>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  setCached(key, value, value === null ? failTtlMs : ttlMs);
  return value;
}

/** Limpia entradas expiradas (llamar periódicamente). */
export function pruneCache(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

/** TTLs por dominio (verificado: frescura razonable por tipo de dato). */
export const ttls = {
  /** Clima actual: 10 min. */
  weatherNow: 10 * 60 * 1000,
  /** Pronóstico: 30 min. */
  weatherForecast: 30 * 60 * 1000,
  /** Resultados deportivos en vivo: 30 s. */
  sportsLive: 30 * 1000,
  /**
   * Fallos de fuente: 60 s. No es "frescura", es NO volver a martillar una API
   * que acaba de responder 429/400 en el turno siguiente (ver `cachedSoft`).
   */
  negative: 60 * 1000,
  /** Tabla de posiciones: 5 min. */
  sportsStandings: 5 * 60 * 1000,
  /** Divisas: 1 h. */
  currency: 60 * 60 * 1000,
  /** Cripto: 60 s. */
  crypto: 60 * 1000,
  /** Noticias: 5 min. */
  news: 5 * 60 * 1000,
  /** Trending: 5 min. */
  trending: 5 * 60 * 1000,
  /** Wikipedia/info estática: 24 h. */
  reference: 24 * 60 * 60 * 1000,
  /** Geocoding: 7 días (las ciudades no se mueven). */
  geocode: 7 * 24 * 60 * 60 * 1000,
} as const;

// Limpieza periódica cada 5 minutos.
setInterval(pruneCache, 5 * 60 * 1000).unref?.();
