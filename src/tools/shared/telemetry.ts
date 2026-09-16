/**
 * Telemetría de una corrida de tool: qué fuentes intentó, con qué resultado y
 * cuántas requests externas gastó.
 *
 * Por qué existe (2026-09-16). `matchSchedule` tiene OCHO caminos de fallback
 * (calendario por equipo → scoreboard por ligas → TheSportsDB por evento → por
 * equipo → por liga → ligas populares → info de equipo + Wikipedia → "no
 * encontré"), y cada uno con un catch que se traga el error sin dejar rastro.
 * Cuando un turno sale mal no hay forma de saber qué camino corrió ni qué costó:
 * depurar eso terminó siendo una tarde de probes temporales. Con esto el resultado
 * de la tool lleva `telemetry.sourcesTried` y `telemetry.requests`, y la respuesta
 * se explica sola.
 *
 * `AsyncLocalStorage` y no una variable de módulo: el server atiende turnos
 * concurrentes y una global mezclaría la telemetría de dos usuarios.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { ToolHandler } from "../types";

export type SourceStatus = "ok" | "empty" | "failed" | "cache";

export type SourceAttempt = {
  /** Identificador de la fuente: "espn:search", "tsdb:eventsnext"… */
  source: string;
  status: SourceStatus;
  /** Contexto corto y legible: `query="Talleres" → arg.1/19`. */
  detail?: string;
  /** Tiempo acumulado en esa fuente (ms). */
  ms?: number;
  /** Cuántas veces se tocó con el mismo estado (el barrido repite fuentes). */
  hits: number;
};

export type TelemetrySummary = {
  /** Requests HTTP REALES (los hits de caché no cuentan). */
  requests: number;
  cacheHits: number;
  sourcesTried: SourceAttempt[];
};

type RunTelemetry = TelemetrySummary & {
  note(attempt: Omit<SourceAttempt, "hits">): void;
  countRequest(n?: number): void;
};

/**
 * Techo de requests externas por corrida. El barrido del scoreboard puede tocar
 * 20 ligas × días: sin techo, un bug de presupuesto se convierte en cientos de
 * requests y en un 429. Al agotarse, el barrido corta y el resultado sale con lo
 * que haya — degradación explícita (ver `sourcesTried`) y no silenciosa.
 */
export const REQUEST_CEILING = 120;

const storage = new AsyncLocalStorage<RunTelemetry>();

/** La corrida en curso, o `undefined` si se está fuera de una tool medida. */
export function telemetry(): RunTelemetry | undefined {
  return storage.getStore();
}

/** Cuenta requests REALES: llamar sólo cuando se va a la red, no en hit de caché. */
export function countRequest(n = 1): void {
  telemetry()?.countRequest(n);
}

/** Requests que quedan del techo de la corrida (Infinity fuera de una corrida). */
export function requestBudgetLeft(): number {
  const run = telemetry();
  return run ? Math.max(0, REQUEST_CEILING - run.requests) : Number.POSITIVE_INFINITY;
}

/** Deja asentado el paso por una fuente. No-op si no hay corrida medida. */
export function noteSource(source: string, status: SourceStatus, detail?: string, ms?: number): void {
  telemetry()?.note({ source, status, detail, ms });
}

/**
 * Corre `fn` dentro de una corrida medida y le adjunta el resumen al resultado
 * (campo `telemetry`), así el resultado de la tool dice por dónde pasó.
 */
export async function runWithTelemetry<T extends object>(fn: () => Promise<T>): Promise<T> {
  return storage.run(createRun(), async () => withSummary(await fn()));
}

/**
 * Envuelve un ToolHandler para medir su corrida. Se aplica en la definición de la
 * tool (no en el barrel) para que también quede medida cuando un test la importa
 * y la llama directamente.
 */
export function withTelemetry(handler: ToolHandler): ToolHandler {
  const innerRun = handler.run.bind(handler);
  return {
    ...handler,
    run: (args, ctx) => runWithTelemetry(() => innerRun(args, ctx)),
  };
}

function createRun(): RunTelemetry {
  const run: RunTelemetry = {
    requests: 0,
    cacheHits: 0,
    sourcesTried: [],
    countRequest(n = 1) {
      run.requests += n;
    },
    note({ source, status, detail, ms }) {
      if (status === "cache") run.cacheHits += 1;
      // Aglutina repeticiones (misma fuente, mismo estado, mismo detalle): el
      // barrido toca la misma fuente muchas veces y no queremos 80 entradas.
      const prev = run.sourcesTried.find(a => a.source === source && a.status === status && a.detail === detail);
      if (prev) {
        prev.hits += 1;
        if (ms != null) prev.ms = (prev.ms ?? 0) + ms;
        return;
      }
      run.sourcesTried.push({ source, status, detail, ms, hits: 1 });
    },
  };
  return run;
}

function withSummary<T extends object>(result: T): T {
  const run = storage.getStore();
  if (!run || (run.requests === 0 && run.sourcesTried.length === 0)) return result;
  const summary: TelemetrySummary = {
    requests: run.requests,
    cacheHits: run.cacheHits,
    sourcesTried: run.sourcesTried,
  };
  // Copia, no mutación: el payload puede ser un literal devuelto por algún camino.
  return { ...result, telemetry: summary };
}
