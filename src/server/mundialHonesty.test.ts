/**
 * 🔴 REGRESIÓN MUNDIAL (2026-09-12) — bug en vivo reportado por el usuario:
 * "no solo dice que da CARDS cuando no las da sino que responde mintiendo...
 * argentina españa en la final del mundial no tuvo ese resultado".
 *
 * Reproducción en producción ("gano argentina la final del mundial contra españa?"):
 * reply = "No, esa final no existió. España ganó su único Mundial en 2010...
 * Nunca se cruzaron en una final de Copa del Mundo." — MENTIRA: la final
 * Argentina-España del 19/7/2026 EXISTIÓ (España 1-0 Argentina, verificado
 * vía ESPN y prensa).
 *
 * Causas raíz cubiertas por estos tests:
 *  1. match_live devolvía status "ok" con matches=[] + Wikipedia stale →
 *     el LLM sintetizaba libre y NEGABA el evento. Ahora: status "no_data"
 *     → __forceHonestReply en blocksFromToolResults → reply honesto forzado.
 *  2. El reply promete "te dejé la tarjeta" sin que exista ninguna card
 *     (frase copiada de los ejemplos de los prompts de síntesis) →
 *     detector de promesa de tarjeta en normalizeFinalPayload.
 *
 * Tests deterministas: NO llaman a la red (los fixtures replican los
 * resultados reales de match_live post-fix).
 */
import { describe, expect, it } from "vitest";
import { blocksFromToolResults } from "./blocksFromToolResults";
import { normalizeFinalPayload } from "./pipeline/finalizePayload";
import { createInitialState } from "../domain/store";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Resultado real de la final (ESPN, verificado 2026-09-12). */
function finalDelMundialResult() {
  return {
    type: "match_live",
    status: "ok",
    query: "argentina españa final del mundial",
    matches: [{
      id: "401",
      match: "Spain vs Argentina",
      homeTeam: "Spain",
      awayTeam: "Argentina",
      homeScore: 1,
      awayScore: 0,
      status: "Final",
      state: "post",
      league: "FIFA World Cup",
      date: "2026-07-19T23:00:00.000Z",
      homeLogo: "https://a.espncdn.com/i/teamlogos/soccer/500/esp.png",
      awayLogo: "https://a.espncdn.com/i/teamlogos/soccer/500/arg.png",
    }],
    source: "ESPN",
    text: "Spain 1 - 0 Argentina (Final)",
  };
}

/** El NUEVO enriched fallback de match_live: status no_data + contexto. */
function noEncontroPartidoResult() {
  return {
    type: "match_live",
    status: "no_data",
    query: "argentina españa final del mundial",
    matches: [],
    teamInfo: {
      id: "134509",
      name: "Argentina",
      stadium: "Estadio Mâs Monumental",
      league: "FIFA World Cup",
      description: "The Argentina national football team...",
    },
    wikipediaExtract: "Argentina, oficialmente República Argentina...",
    note: "No encontré ese partido en mis fuentes deportivas (ESPN/TheSportsDB). Puede ser de una fecha o competencia fuera de mi cobertura.",
  };
}

function baseState() {
  return createInitialState();
}

// ── 1. match_live no_data → sin card + marca de honestidad ─────────────────

describe("mundial · match_live sin partido (status no_data)", () => {
  it("NO genera card de partido y marca __forceHonestReply para forzar reply honesto", () => {
    const result = noEncontroPartidoResult();
    const blocks = blocksFromToolResults(
      [{ id: "t1", name: "match_live", result }],
      "quien gano la final del mundial argentina españa",
    );

    const matchBlocks = blocks.filter((b: any) => b.type === "live_match" || b.type === "match_timeline");
    expect(matchBlocks.length).toBe(0);
    expect((result as any).__forceHonestReply).toBe(true);
    expect((result as any).__honestReplyText).toContain("No encontré");
  });

  it("el reply del LLM que NIEGA la final es reemplazado por el honesto forzado", () => {
    // Reply real observado en producción (la mentira del usuario).
    const replyMentiroso =
      "No, esa final no existió. España ganó su único Mundial en 2010 contra Países Bajos, y Argentina ganó el suyo en 2022 contra Francia. Nunca se cruzaron en una final de Copa del Mundo.";

    const result = noEncontroPartidoResult();
    // blocksFromToolResults marca __forceHonestReply (como en el turno real)
    blocksFromToolResults([{ id: "t1", name: "match_live", result }], "gano argentina la final?");

    const response = normalizeFinalPayload(
      { reply: replyMentiroso, mascotState: "happy", uiBlocks: [] },
      "gano argentina la final del mundial contra españa?",
      [{ id: "t1", name: "match_live", result }],
      undefined,
      undefined,
      baseState(),
    );

    expect(response.reply).toContain("No encontré");
    expect(response.reply).not.toContain("no existió");
    expect(response.reply).not.toContain("Nunca se cruzaron");
  });
});

// ── 2. Con la final ENCONTRADA → card con el resultado real ────────────────

describe("mundial · match_live con la final encontrada", () => {
  it("genera card live_match con España 1-0 Argentina", () => {
    const result = finalDelMundialResult();
    const blocks = blocksFromToolResults(
      [{ id: "t1", name: "match_live", result }],
      "quien gano la final del mundial argentina españa",
    ) as any[];

    const live = blocks.find((b: any) => b.type === "live_match");
    expect(live).toBeDefined();
    expect(live.homeName).toBe("Spain");
    expect(live.awayName).toBe("Argentina");
    expect(Number(live.homeScore)).toBe(1);
    expect(Number(live.awayScore)).toBe(0);
    // sin marca de honestidad forzada: hay datos reales
    expect((result as any).__forceHonestReply).toBeUndefined();
  });

  it("el reply que promete la tarjeta SE MANTIENE porque la card existe", () => {
    const result = finalDelMundialResult();
    const response = normalizeFinalPayload(
      { reply: "España 1-0 Argentina. Te dejé el detalle en la tarjeta.", mascotState: "happy", uiBlocks: [] },
      "cuanto quedo la final",
      [{ id: "t1", name: "match_live", result }],
      undefined,
      undefined,
      baseState(),
    );

    expect(response.reply).toContain("1-0");
    expect(response.uiBlocks.some((b: any) => b.type === "live_match")).toBe(true);
  });
});

// ── 3. Detector de promesa de tarjeta inexistente ──────────────────────────

describe("mundial · promesa de tarjeta sin card = mentira → se quita", () => {
  it("reply 'Te dejé el detalle en la tarjeta' sin blocks ni tools → promesa eliminada", () => {
    const response = normalizeFinalPayload(
      { reply: "Listo! Te dejé el detalle en la tarjeta.", mascotState: "happy", uiBlocks: [] },
      "dame datos",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).not.toMatch(/en la tarjeta/i);
    expect(response.reply.length).toBeGreaterThan(5);
  });

  it("reply con SOLO la promesa → fallback honesto (no queda vacío)", () => {
    const response = normalizeFinalPayload(
      { reply: "Te dejé el detalle en la tarjeta.", mascotState: "happy", uiBlocks: [] },
      "dame datos",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).not.toMatch(/en la tarjeta/i);
    expect(response.reply).toMatch(/tarjeta|datos|probamos/i);
  });

  it("'tarjeta roja' (fútbol) NO es una promesa de card → no se toca", () => {
    const reply = "Le sacaron una tarjeta roja en el minuto 80 y se quedó con diez.";
    const response = normalizeFinalPayload(
      { reply, mascotState: "happy", uiBlocks: [] },
      "como termino el partido",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).toContain("tarjeta roja");
  });

  it("promesa + dato útil en la misma oración → se quita la promesa, queda el dato", () => {
    const response = normalizeFinalPayload(
      { reply: "Ganó España 1-0. Te dejé el detalle en la tarjeta.", mascotState: "happy", uiBlocks: [] },
      "quien gano",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).toContain("1-0");
    expect(response.reply).not.toMatch(/en la tarjeta/i);
  });
});

// ── 4. Verificación de marcador (FIX MUNDIAL-2) ─────────────────────────────

describe("mundial · reply cita el marcador de OTRO match → corrección determinista", () => {
  it("reply '2-1' cuando la card dice 1-0 → reply corregido con el marcador real", () => {
    // Caso real observado: mezcló el 2-1 de la semifinal (otros resultados)
    // con el gol de la final (1-0).
    const result = {
      type: "match_live",
      status: "ok",
      query: "espana",
      matches: [{
        id: "760517",
        match: "Spain vs Argentina",
        homeTeam: "Spain",
        awayTeam: "Argentina",
        homeScore: 1,
        awayScore: 0,
        status: "Final Score - After Extra Time",
        state: "post",
        league: "FIFA World Cup",
        date: "2026-07-19T23:00:00.000Z",
      }],
      upcoming: [{
        homeTeam: "Spain", awayTeam: "Belgium", homeScore: 2, awayScore: 1,
        status: "Full Time", state: "post", league: "FIFA World Cup", date: "2026-07-10T00:00:00.000Z",
      }],
    };
    const response = normalizeFinalPayload(
      { reply: "España le ganó 2-1 a Argentina con un gol de Ferran Torres en el minuto 106. Te dejé el detalle en la tarjeta.", mascotState: "happy", uiBlocks: [] },
      "como salio españa",
      [{ id: "t1", name: "match_live", result }],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).toMatch(/1\s*-\s*0/);
    expect(response.reply).not.toMatch(/2-1/);
  });

  it("reply con el marcador correcto (1-0) se mantiene intacto", () => {
    const result = finalDelMundialResult();
    normalizeFinalPayload(
      { reply: "x", mascotState: "happy", uiBlocks: [] },
      "cuanto quedo",
      [{ id: "t1", name: "match_live", result }],
      undefined,
      undefined,
      baseState(),
    );
    // El guard no debe disparar: construir reply con marcador correcto
    const response = normalizeFinalPayload(
      { reply: "España le ganó 1-0 a Argentina en la prórroga. Gran final.", mascotState: "happy", uiBlocks: [] },
      "cuanto quedo la final",
      [{ id: "t1", name: "match_live", result }],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).toContain("1-0");
    expect(response.reply).toContain("prórroga");
  });

  it("reply desde la perspectiva del perdedor ('Argentina cayó 0-1') NO se toca", () => {
    const result = finalDelMundialResult();
    const response = normalizeFinalPayload(
      { reply: "Argentina cayó 0-1 ante España en la final.", mascotState: "sad", uiBlocks: [] },
      "como le fue a argentina",
      [{ id: "t1", name: "match_live", result }],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.reply).toContain("0-1");
  });
});
