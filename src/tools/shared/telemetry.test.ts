/**
 * Tests de la telemetría por corrida. Lo crítico acá es el AISLAMIENTO: el server
 * atiende turnos concurrentes, así que la telemetría de un turno no puede ver la
 * de otro (por eso AsyncLocalStorage y no una variable de módulo).
 */
import { describe, expect, it } from "vitest";
import {
  REQUEST_CEILING,
  countRequest,
  noteSource,
  requestBudgetLeft,
  runWithTelemetry,
  telemetry,
  withTelemetry,
} from "./telemetry";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("runWithTelemetry — resumen adjunto al resultado", () => {
  it("adjunta fuentes intentadas, requests y hits de caché", async () => {
    const out: any = await runWithTelemetry(async () => {
      noteSource("espn:search", "ok", 'query="Boca"', 12);
      noteSource("espn:team-schedule", "cache", "arg.1/5");
      countRequest(2);
      return { type: "match_schedule", status: "ok" };
    });

    expect(out.status).toBe("ok"); // el payload original queda intacto
    expect(out.telemetry.requests).toBe(2);
    expect(out.telemetry.cacheHits).toBe(1);
    expect(out.telemetry.sourcesTried).toEqual([
      { source: "espn:search", status: "ok", detail: 'query="Boca"', ms: 12, hits: 1 },
      { source: "espn:team-schedule", status: "cache", detail: "arg.1/5", ms: undefined, hits: 1 },
    ]);
  });

  it("sin actividad NO ensucia el payload con un resumen vacío", async () => {
    const out: any = await runWithTelemetry(async () => ({ type: "x", status: "ok" }));
    expect(out.telemetry).toBeUndefined();
  });

  it("aglutina repeticiones (el barrido toca la misma fuente muchas veces)", async () => {
    const out: any = await runWithTelemetry(async () => {
      for (let i = 0; i < 5; i++) noteSource("espn:scoreboard", "failed", "1/20 ligas ok", 10);
      return {};
    });
    expect(out.telemetry.sourcesTried.length).toBe(1);
    expect(out.telemetry.sourcesTried[0]).toMatchObject({ source: "espn:scoreboard", status: "failed", hits: 5, ms: 50 });
  });

  it("no mezcla la telemetría de dos corridas concurrentes", async () => {
    const [slow, fast] = (await Promise.all([
      runWithTelemetry(async () => {
        await sleep(30); // la lenta anota DESPUÉS de que la rápida terminó
        noteSource("fuente:lenta", "ok");
        countRequest(2);
        return { id: "lenta" };
      }),
      runWithTelemetry(async () => {
        noteSource("fuente:rapida", "ok");
        countRequest(1);
        return { id: "rapida" };
      }),
    ])) as any[];

    expect(slow.telemetry.sourcesTried.map((s: any) => s.source)).toEqual(["fuente:lenta"]);
    expect(slow.telemetry.requests).toBe(2);
    expect(fast.telemetry.sourcesTried.map((s: any) => s.source)).toEqual(["fuente:rapida"]);
    expect(fast.telemetry.requests).toBe(1);
  });
});

describe("techo de requests", () => {
  it("requestBudgetLeft baja con cada request y nunca queda negativo", async () => {
    await runWithTelemetry(async () => {
      expect(requestBudgetLeft()).toBe(REQUEST_CEILING);
      countRequest(REQUEST_CEILING - 1);
      expect(requestBudgetLeft()).toBe(1);
      countRequest(5);
      expect(requestBudgetLeft()).toBe(0);
      return {};
    });
  });

  it("fuera de una corrida no hay techo (y las anotaciones son no-op)", () => {
    expect(telemetry()).toBeUndefined();
    expect(requestBudgetLeft()).toBe(Number.POSITIVE_INFINITY);
    expect(() => {
      noteSource("x", "ok");
      countRequest(3);
    }).not.toThrow();
  });
});

describe("withTelemetry — envoltorio de ToolHandler", () => {
  const handler = {
    definition: { type: "function", function: { name: "demo", description: "", parameters: {} } },
    policy: { risk: "readonly", requiresApproval: false, autoRun: true, reason: "" },
    run: async () => {
      countRequest(1);
      noteSource("demo:fuente", "ok");
      return { type: "demo", status: "ok" };
    },
  } as any;

  it("mide la corrida y conserva el resto del handler", async () => {
    const wrapped = withTelemetry(handler);
    const out: any = await wrapped.run({}, {} as any);
    expect(out.telemetry.requests).toBe(1);
    expect(wrapped.definition.function.name).toBe("demo");
    expect(wrapped.policy.risk).toBe("readonly");
  });

  it("propaga el error sin perder la telemetría de lo ya intentado", async () => {
    const failing = withTelemetry({
      ...handler,
      run: async () => {
        noteSource("demo:falla", "failed", "boom");
        throw new Error("boom");
      },
    } as any);
    await expect(failing.run({}, {} as any)).rejects.toThrow("boom");
  });
});
