import { describe, it, expect } from "vitest";
import { localDateISO, shiftDateISO } from "./localDate";
import { logWellbeing, computeStreak } from "./store";
import type { KoruState, HabitLog, WellbeingLog } from "./types";

// 🔴 Tests del lote de auditoría UX 2026-09-09:
//   1. localDateISO: "hoy" LOCAL (el bug UTC movía el día tras ~21:00 LATAM)
//   2. logWellbeing: agua ACUMULATIVA (antes reemplazaba → clavada en 250ml)
//   3. computeStreak: racha con aritmética local
//   4. Validación del nombre en onboarding (regex looksLikeName)

function stateWith(logs: WellbeingLog[]): KoruState {
  return {
    userId: "test-user",
    stage: "seed",
    trustedEnergy: 0,
    totalEnergy: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wellbeingLogs: logs,
    memories: [],
    commitments: [],
    calendarEvents: [],
    records: [],
    entries: [],
    energyEvents: [],
    nudges: [],
    modelCalls: [],
    ephemeralMode: false,
    durableMemoryEnabled: true,
    actionPreparationEnabled: false,
    worldSignalsEnabled: false,
    heartbeat: {
      enabled: true,
      intervalMinutes: 45,
      activeStartHour: 9,
      activeEndHour: 22,
      maxNudgesPerDay: 4,
      dailyNudgeCount: 0,
    },
    habits: [],
    habitLogs: [],
    shoppingLists: [],
    actions: [],
    preferences: {
      theme: "light",
      fontScale: "medium",
      haptics: false,
      sounds: false,
      reducedMotion: false,
      highContrast: false,
    },
  } as unknown as KoruState;
}

describe("localDateISO — día LOCAL (bug UTC)", () => {
  it("devuelve la fecha local, no la UTC", () => {
    // 23:30 local del 9 de septiembre en UTC-3 → UTC ya es 10 de septiembre.
    // Si usara toISOString() devolvería "2026-09-10".
    const local = new Date(2026, 8, 9, 23, 30); // mes 8 = septiembre
    expect(localDateISO(local)).toBe("2026-09-09");
  });

  it("shiftDateISO resta días sin corromper el día (sin toISOString)", () => {
    expect(shiftDateISO("2026-09-09", -1)).toBe("2026-09-08");
    expect(shiftDateISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateISO("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("logWellbeing — agua ACUMULATIVA", () => {
  it("dos taps de +250ml acumulan 500 (antes: reemplazaba → 250)", () => {
    let state = stateWith([]);
    state = logWellbeing(state, "water", 250, "ml");
    state = logWellbeing(state, "water", 250, "ml");
    const today = localDateISO();
    const logs = (state.wellbeingLogs ?? []).filter(l => l.date === today && l.metric === "water");
    expect(logs).toHaveLength(1);
    expect(logs[0].value).toBe(500);
  });

  it("los logs del agente (source != manual) son snapshot, no acumulativos", () => {
    let state = stateWith([]);
    state = logWellbeing(state, "water", 250, "ml");
    state = logWellbeing(state, "water", 1000, "ml", "agent");
    const today = localDateISO();
    const logs = (state.wellbeingLogs ?? []).filter(l => l.date === today && l.metric === "water");
    expect(logs[0].value).toBe(1000);
  });
});

describe("computeStreak — racha con fecha local", () => {
  it("cuenta días consecutivos hacia atrás correctamente", () => {
    const today = localDateISO();
    const yesterday = shiftDateISO(today, -1);
    const twoDaysAgo = shiftDateISO(today, -2);
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: today, count: 1 } as HabitLog,
      { id: "l2", habitId: "h1", date: yesterday, count: 1 } as HabitLog,
      { id: "l3", habitId: "h1", date: twoDaysAgo, count: 1 } as HabitLog,
    ];
    expect(computeStreak("h1", logs)).toBe(3);
  });

  it("racha se corta con un día faltante", () => {
    const today = localDateISO();
    const twoDaysAgo = shiftDateISO(today, -2);
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: today, count: 1 } as HabitLog,
      { id: "l3", habitId: "h1", date: twoDaysAgo, count: 1 } as HabitLog,
    ];
    expect(computeStreak("h1", logs)).toBe(1);
  });
});

describe("onboarding — looksLikeName (regex de validación del nombre)", () => {
  // Misma lógica que TalkOverlay usa al interceptar el nombre.
  const NAME_BLOCKLIST = new Set([
    "dale", "jaja", "jeje", "nada", "ok", "okay", "si", "sí", "no", "nope",
    "hm", "mmm", "vos", "yo", "que", "quien", "como", "callate", "cállate",
  ]);
  const looksLikeName = (clean: string) => {
    const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
    return (
      /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,30}$/.test(clean) &&
      !/\s.{0,30}\b(no|sos|callate|cállate|porque|quiero|decir)\b/i.test(clean) &&
      words.length > 0 &&
      !words.some(w => NAME_BLOCKLIST.has(w))
    );
  };

  it("acepta nombres reales", () => {
    expect(looksLikeName("Martín")).toBe(true);
    expect(looksLikeName("María José")).toBe(true);
    expect(looksLikeName("José Luis")).toBe(true);
  });

  it("rechaza frases que NO son nombres (antes se guardaban verbatim)", () => {
    expect(looksLikeName("no quiero decirte")).toBe(false);
    expect(looksLikeName("dale dale")).toBe(false);
    expect(looksLikeName("jaja no")).toBe(false);
    expect(looksLikeName("123")).toBe(false);
    expect(looksLikeName("callate robot")).toBe(false);
  });
});
