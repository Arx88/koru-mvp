/**
 * P0 anti-alucinación (observado en vivo 2026-09-14): la tool de clima falló
 * (wttr.in caído, sourceStatus:"failed") y el reply IGUAL decía "27° y
 * despejado" — dato fabricado por el LLM. El reply debe ser fact-checkeado
 * contra los toolResults: si TODAS las tools del turno fallaron, no hay dato
 * que citar → el reply no puede contener cifras ni condiciones del dato pedido.
 */
import { describe, expect, it } from "vitest";
import { normalizeFinalPayload } from "./finalizePayload";

const failedWeatherExec = {
  id: "t1",
  name: "weather",
  result: {
    type: "weather",
    status: "failed",
    error: "wttr.in: HTTP 000 in 12s",
    city: "Madrid",
    sources: [],
  },
};

describe("Fidelidad del reply contra toolResults fallidos", () => {
  it("no cita datos fabricados cuando TODAS las tools del turno fallaron", () => {
    const payload = normalizeFinalPayload(
      {
        reply: "En Madrid ahora están 27° y despejado, ideal para salir.",
        mascotState: "happy",
      },
      "qué tiempo hace en madrid",
      [failedWeatherExec as any],
    );

    expect(payload.reply).not.toMatch(/27/);
    expect(payload.reply).not.toMatch(/despejado/i);
    // El reply honesto reconoce el fallo de fuente.
    expect(payload.reply).toMatch(/fuentes|fall|verificar/i);
  });

  it("NO toca el reply cuando alguna tool tuvo éxito (solo fallas totales)", () => {
    const okExec = {
      id: "t2",
      name: "currency_convert",
      result: { type: "data_card", status: "verified", converted: 92, rate: 0.92 },
    };
    const payload = normalizeFinalPayload(
      { reply: "100 USD son 92 EUR al tipo de hoy.", mascotState: "happy" },
      "cuanto son 100 dolares en euros",
      [okExec as any, failedWeatherExec as any],
    );
    expect(payload.reply).toContain("92");
  });
});
