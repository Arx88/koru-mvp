/**
 * Rate limiter por API. Garantiza que respetamos los límites documentados
 * de cada proveedor (especialmente Nominatim: 1 req/seg estricto).
 *
 * Implementación: ventana deslizante con promesas encoladas.
 */

type Limiter = {
  /** Adquiere un slot. Resuelve cuando hay cupo. */
  acquire(): Promise<void>;
};

export function rateLimiter(maxPerSec: number): Limiter {
  if (maxPerSec <= 0) return { acquire: async () => undefined };
  const intervalMs = 1000 / maxPerSec;
  const queue: Array<() => void> = [];
  let lastEmit = 0;
  let pumping = false;

  async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length > 0) {
        const elapsed = Date.now() - lastEmit;
        const wait = elapsed < intervalMs ? intervalMs - elapsed : 0;
        if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
        lastEmit = Date.now();
        const resolve = queue.shift();
        resolve?.();
      }
    } finally {
      pumping = false;
    }
  }

  return {
    acquire() {
      return new Promise<void>((resolve) => {
        queue.push(resolve);
        void pump();
      });
    },
  };
}

/** Instancias preconfiguradas por API conocida (límites verificados junio 2026). */
export const limiters = {
  /** Open-Meteo: 600/min ≈ 10/s. Conservamos 8/s para dejar margen. */
  openMeteo: rateLimiter(8),
  /** Nominatim: ESTRICTO 1 req/s. Política oficial OSM. */
  nominatim: rateLimiter(1),
  /** Overpass: ~2 req/s en instancias públicas. */
  overpass: rateLimiter(2),
  /** OSRM: no documentado, conservador 2/s con cache pesado. */
  osrm: rateLimiter(2),
  /** GDELT: "generoso", conservador 2/s. */
  gdelt: rateLimiter(2),
  /** Wikipedia: User-Agent obligatorio, ~3/s razonable. */
  wikipedia: rateLimiter(3),
  /** Frankfurter: sin límite duro, 2/s cortés. */
  frankfurter: rateLimiter(2),
  /** DuckDuckGo HTML scraping: 1/s para evitar bloqueos. */
  duckduckgo: rateLimiter(1),
  /** Reddit JSON: ~60/min = 1/s con User-Agent. */
  reddit: rateLimiter(1),
  /** CoinGecko demo: 30/min = 0.5/s. */
  coingecko: rateLimiter(0.5),
  /** Open Food Facts: fair use, 2/s. */
  openFoodFacts: rateLimiter(2),
  /** Numbers API: 1/s cortés. */
  numbersApi: rateLimiter(1),
  /** Stooq CSV: 1/s cortés. */
  stooq: rateLimiter(1),
} as const;
