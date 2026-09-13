/**
 * 🔴 MICHI CONSCIENTE — el puente entre las pantallas y Michi.
 *
 * Qué se protege acá:
 *  1. El resultado de Tic Tac Mich entra al estado (antes moría en localStorage)
 *     y no se cuenta dos veces.
 *  2. El estado persistido se normaliza: basura en disco no rompe el progreso.
 *  3. Michi LEE ese estado: stateSummary y systemPrompt llevan los datos reales
 *     de Michi School y Tic Tac Mich.
 */
import { describe, expect, it } from "vitest";
import { createInitialState, recordTicTacMatch } from "./store";
import { createSchoolProgress } from "./michiSchool";
import { normalizeTicTacProgress } from "./ticTacMich";
import { stateSummary } from "../server/koruBackend";
import { systemPrompt } from "../server/systemPrompt";
import type { KoruState } from "./types";

const PLAYED_AT = "2026-09-13T18:00:00.000Z";

function stateWith(overrides: Partial<KoruState> = {}): KoruState {
  return { ...createInitialState(), ...overrides };
}

describe("el resultado de la partida viaja al estado", () => {
  it("suma la partida y recuerda cómo terminó", () => {
    const next = recordTicTacMatch(stateWith(), "michi", "clever", PLAYED_AT);
    expect(next.ticTacMich?.wins).toEqual({ you: 0, michi: 1, draw: 0 });
    expect(next.ticTacMich?.lastResult).toBe("michi");
    expect(next.ticTacMich?.lastPlayedAt).toBe(PLAYED_AT);
  });

  it("no cuenta dos veces el mismo instante (StrictMode / doble render)", () => {
    const once = recordTicTacMatch(stateWith(), "you", "clever", PLAYED_AT);
    const twice = recordTicTacMatch(once, "you", "clever", PLAYED_AT);
    expect(twice).toBe(once);
    expect(twice.ticTacMich?.wins.you).toBe(1);
  });

  it("descarta basura persistida en vez de romper el progreso", () => {
    const progress = normalizeTicTacProgress({
      wins: { you: -4, michi: Number.NaN, draw: 2 },
      lastResult: "empató" as never,
      difficulty: "imposible" as never,
    });
    expect(progress.wins).toEqual({ you: 0, michi: 0, draw: 2 });
    expect(progress.lastResult).toBeUndefined();
    expect(progress.difficulty).toBe("clever");
  });
});

describe("Michi se entera de sus juegos", () => {
  const state = stateWith({
    michiSchool: { ...createSchoolProgress(), questionIndex: 3, correctInGrade: 3 },
    ticTacMich: {
      wins: { you: 0, michi: 3, draw: 0 },
      lastResult: "michi",
      lastPlayedAt: PLAYED_AT,
      difficulty: "clever",
    },
  });

  it("el resumen de estado lleva School y Tic Tac con datos reales", () => {
    const summary = stateSummary(state);
    expect(summary).toContain("Michi School (grado, pregunta actual, aciertos): grado 1, pregunta 4 de 10");
    expect(summary).toContain("Tic Tac Mich (partidas jugadas y último resultado)");
    expect(summary).toContain("la última la ganó Michi");
  });

  it("el prompt dice qué puede ofrecer el Michi y qué no", () => {
    const allowed = systemPrompt(new Date().toISOString(), state, []);
    expect(allowed).toContain("INVITACIONES DISPONIBLES AHORA: Michi School");
    expect(allowed).toContain("Tic Tac Mich");
    // Las reglas duras que impiden el spam y la promesa vacía.
    expect(allowed).toContain("MALESTAR REAL");
    expect(allowed).toContain("NO ofrezcas NI PROMETAS");

    const blocked = systemPrompt(
      new Date().toISOString(),
      { ...state, michiInvites: { lastOfferedAt: new Date().toISOString() } },
      [],
    );
    expect(blocked).toContain("INVITACIONES DISPONIBLES AHORA: ninguna");
  });
});
