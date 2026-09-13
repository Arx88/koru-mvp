/**
 * 🔴 MICHI CONSCIENTE — tests de la propuesta de actividades.
 *
 * Lo que se protege acá:
 *  1. La señal es ANGOSTA. El error caro no es dejar de proponer: es proponer
 *     un juego a quien está mal. "estoy aburrido del trabajo" NO es un vacío.
 *  2. Las puertas (cooldown global + "más tarde") viven en código y no en el
 *     prompt — es el mismo error que el post-mortem de heartbeatProactive.ts
 *     documenta (un nudge con disparador siempre-true).
 *  3. Aburrimiento y bajón no reciben la misma propuesta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./store";
import { createSchoolProgress } from "./michiSchool";
import {
  ACTIVITY_OFFER_COOLDOWN_MS,
  ACTIVITY_PAUSE_MS,
  activityOfferGate,
  activityOfferSummary,
  buildActivityInvite,
  detectActivitySignal,
} from "./michiActivities";
import type { KoruState, TicTacMichProgress } from "./types";

const NOW = new Date("2026-09-13T20:00:00.000Z");

function stateWith(overrides: Partial<KoruState> = {}): KoruState {
  return { ...createInitialState(), ...overrides };
}

const ticTacTally: TicTacMichProgress = {
  wins: { you: 0, michi: 3, draw: 0 },
  lastResult: "michi",
  lastPlayedAt: "2026-09-12T18:00:00.000Z",
  difficulty: "clever",
};

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("señal del mensaje", () => {
  it("reconoce el vacío de verdad como aburrimiento", () => {
    for (const text of [
      "me aburro",
      "estoy aburrida",
      "no tengo nada que hacer",
      "no sé qué hacer",
      "qué aburrido el finde",
    ]) {
      expect(detectActivitySignal(text), text).toBe("bored");
    }
  });

  it("reconoce el bajón como bajón (se acompaña, no se entretiene)", () => {
    for (const text of ["estoy triste hoy", "ando bajón", "me siento solo", "tuve un día de mierda"]) {
      expect(detectActivitySignal(text), text).toBe("low");
    }
  });

  it("NO trata como aburrimiento la queja con causa", () => {
    // El falso positivo que importa: acá no hay un vacío que llenar.
    for (const text of [
      "estoy harto del trabajo, no me rinde nada",
      "estoy aburrido del trabajo",
      "me aburrí de este juego",
      "no sé qué hacer con mi vida",
      "estoy quemado, no puedo más",
    ]) {
      expect(detectActivitySignal(text), text).toBe("distress");
    }
  });

  it("no inventa señales donde no las hay", () => {
    for (const text of ["hola", "gracias, después veo", "¿cuál es la capital de Australia?", ""]) {
      expect(detectActivitySignal(text), text).toBe("none");
    }
  });
});

describe("puertas de la propuesta", () => {
  it("abre las dos actividades cuando no hay nada pendiente", () => {
    expect(activityOfferGate(stateWith(), NOW)).toEqual({ allowed: ["school", "ticTac"], blockedBy: null });
  });

  it("cierra todo durante el cooldown posterior a una propuesta", () => {
    const withinCooldown = new Date(NOW.getTime() - ACTIVITY_OFFER_COOLDOWN_MS + 60_000).toISOString();
    const gate = activityOfferGate(stateWith({ michiInvites: { lastOfferedAt: withinCooldown } }), NOW);
    expect(gate.allowed).toEqual([]);
    expect(gate.blockedBy).toBe("cooldown");
  });

  it("reabre cuando el cooldown ya pasó", () => {
    const expired = new Date(NOW.getTime() - ACTIVITY_OFFER_COOLDOWN_MS - 60_000).toISOString();
    expect(activityOfferGate(stateWith({ michiInvites: { lastOfferedAt: expired } }), NOW).allowed).toHaveLength(2);
  });

  it("\"más tarde\" pausa SOLO esa actividad", () => {
    const until = new Date(NOW.getTime() + ACTIVITY_PAUSE_MS).toISOString();
    const gate = activityOfferGate(
      stateWith({ michiInvites: { pausedUntil: { ticTac: until } } }),
      NOW,
    );
    expect(gate.allowed).toEqual(["school"]);
    expect(gate.blockedBy).toBeNull();
  });

  it("con las dos en pausa no queda nada disponible", () => {
    const past = new Date(NOW.getTime() - ACTIVITY_PAUSE_MS * 2).toISOString();
    const future = new Date(NOW.getTime() + ACTIVITY_PAUSE_MS).toISOString();
    const state = stateWith({ michiInvites: { lastOfferedAt: past, pausedUntil: { school: future, ticTac: future } } });
    const gate = activityOfferGate(state, NOW);
    expect(gate.allowed).toEqual([]);
    expect(gate.blockedBy).toBe("paused");
  });
});

describe("invitación", () => {
  it("aburrimiento → Tic Tac, tono juguetón, con el marcador real", () => {
    const invite = buildActivityInvite({
      text: "me aburro",
      state: stateWith({ ticTacMich: ticTacTally }),
      now: NOW,
    });
    expect(invite?.activity).toBe("ticTac");
    expect(invite?.tone).toBe("playful");
    expect(invite?.body).toContain("La última la gané yo");
    expect(invite?.body).toContain("Vas 0 · Michi 3 · 0 empates");
    expect(invite?.ctaLabel).toBe("¡Dale, revancha!");
  });

  it("bajón → SOLO School y tono suave, aunque el Tic Tac esté disponible", () => {
    const invite = buildActivityInvite({ text: "estoy triste hoy", state: stateWith(), now: NOW });
    expect(invite?.activity).toBe("school");
    expect(invite?.tone).toBe("gentle");
    expect(invite?.title).toBe("Algo liviano para la cabeza");
    expect(invite?.body).toContain("Sin apuro");
  });

  it("usa el progreso REAL de School (grado y pregunta)", () => {
    // Aburrimiento con el Tic Tac en pausa: la propuesta cae en School y el
    // texto sale del progreso real, no de un número inventado.
    const state = stateWith({
      michiSchool: { ...createSchoolProgress(), questionIndex: 3, correctInGrade: 3 },
      michiInvites: { pausedUntil: { ticTac: new Date(NOW.getTime() + ACTIVITY_PAUSE_MS).toISOString() } },
    });
    const invite = buildActivityInvite({ text: "me aburro", state, now: NOW });
    expect(invite?.activity).toBe("school");
    expect(invite?.body).toContain("Pregunta 4 de 10");
    expect(invite?.body).toContain("3 correctas");
  });

  it("si el Tic Tac está en pausa, el aburrimiento cae en School", () => {
    const state = stateWith({
      michiInvites: { pausedUntil: { ticTac: new Date(NOW.getTime() + ACTIVITY_PAUSE_MS).toISOString() } },
    });
    expect(buildActivityInvite({ text: "me aburro", state, now: NOW })?.activity).toBe("school");
  });

  it("no propone nada con la puerta cerrada ni con malestar real", () => {
    const cooled = stateWith({ michiInvites: { lastOfferedAt: NOW.toISOString() } });
    expect(buildActivityInvite({ text: "me aburro", state: cooled, now: NOW })).toBeNull();
    expect(buildActivityInvite({ text: "estoy harto del trabajo", state: stateWith(), now: NOW })).toBeNull();
    expect(buildActivityInvite({ text: "¿qué me toca en la escuela?", state: stateWith(), now: NOW })).toBeNull();
  });
});

describe("línea del prompt", () => {
  it("lista lo disponible con sus datos reales", () => {
    const summary = activityOfferSummary(stateWith({ ticTacMich: ticTacTally }), NOW);
    expect(summary).toContain("Michi School");
    expect(summary).toContain("Tic Tac Mich");
    expect(summary).toContain("la última la ganó Michi");
  });

  it("dice \"ninguna\" cuando la puerta está cerrada (el modelo no debe prometer)", () => {
    expect(activityOfferSummary(stateWith({ michiInvites: { lastOfferedAt: NOW.toISOString() } }), NOW)).toContain("ninguna");
    const future = new Date(NOW.getTime() + ACTIVITY_PAUSE_MS).toISOString();
    expect(
      activityOfferSummary(stateWith({ michiInvites: { pausedUntil: { school: future, ticTac: future } } }), NOW),
    ).toContain("ninguna");
  });
});
