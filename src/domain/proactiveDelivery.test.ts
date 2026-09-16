import { describe, expect, it } from "vitest";
import { canDeliverProactive, reserveProactiveDelivery, remainingProactiveCapacity } from "./proactiveDelivery";
import { createInitialState } from "./store";

const DAY = 24 * 60 * 60 * 1000;

describe("proactive delivery", () => {
  it("shows the same event only once across reopenings", () => {
    const first = reserveProactiveDelivery(null, "weather:rain", 1_000_000);
    const second = reserveProactiveDelivery(JSON.stringify(first.shown), "weather:rain", 1_000_001);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });

  it("holds a cooldown after any shown event and counts only today's deliveries", () => {
    const now = new Date(2026, 8, 14, 12).getTime();
    const shown = JSON.stringify([{ key: "weather:rain", shownAt: now - 5 * 60 * 1000 }]);
    expect(reserveProactiveDelivery(shown, "sport:result", now).allowed).toBe(false);
    const yesterday = JSON.stringify([{ key: "weather:rain", shownAt: now - DAY }]);
    expect(reserveProactiveDelivery(yesterday, "sport:result", now, 2).allowed).toBe(true);
    const full = JSON.stringify([
      { key: "a", shownAt: now - 2 * 60 * 60 * 1000 },
      { key: "b", shownAt: now - 60 * 60 * 1000 },
    ]);
    expect(reserveProactiveDelivery(full, "sport:result", now, 2).allowed).toBe(false);
    expect(reserveProactiveDelivery(full, "sport:result", now, 3).allowed).toBe(true);
    expect(reserveProactiveDelivery(full, "a", now + 7 * DAY, 2).allowed).toBe(true);
  });

  it("ignores corrupted or legacy shapes without crashing", () => {
    expect(reserveProactiveDelivery("{broken", "k", Date.now()).allowed).toBe(true);
    expect(reserveProactiveDelivery(JSON.stringify({ key: "k" }), "k", Date.now()).allowed).toBe(true);
    expect(reserveProactiveDelivery(JSON.stringify(["plain"]), "k", Date.now()).allowed).toBe(true);
  });

  it("gates delivery on enabled settings, quiet hours and active hours", () => {
    const state = createInitialState();
    state.heartbeat = { ...state.heartbeat, enabled: true, activeStartHour: 0, activeEndHour: 0 };
    state.worldSignalsEnabled = true;
    expect(canDeliverProactive(state, new Date(2026, 8, 14, 12))).toBe(true);
    expect(canDeliverProactive({ ...state, heartbeat: { ...state.heartbeat, enabled: false } }, new Date(2026, 8, 14, 12))).toBe(false);
    expect(canDeliverProactive({ ...state, voicePreference: { ...state.voicePreference, proactivity: 0 } }, new Date(2026, 8, 14, 12))).toBe(false);
    expect(canDeliverProactive({ ...state, worldSignalsEnabled: false }, new Date(2026, 8, 14, 12))).toBe(false);
    expect(canDeliverProactive({ ...state, preferences: { ...state.preferences, dndStartHour: 9, dndEndHour: 17 } }, new Date(2026, 8, 14, 12))).toBe(false);
    expect(canDeliverProactive({ ...state, preferences: { ...state.preferences, dndStartHour: 9, dndEndHour: 17 } }, new Date(2026, 8, 14, 18))).toBe(true);
    expect(canDeliverProactive({ ...state, preferences: { ...state.preferences, dndStartHour: 22, dndEndHour: 7 } }, new Date(2026, 8, 14, 23))).toBe(false);
    expect(canDeliverProactive({ ...state, preferences: { ...state.preferences, dndStartHour: 22, dndEndHour: 7 } }, new Date(2026, 8, 14, 3))).toBe(false);
    expect(canDeliverProactive({ ...state, preferences: { ...state.preferences, dndStartHour: 22, dndEndHour: 7 } }, new Date(2026, 8, 14, 8))).toBe(true);
    expect(canDeliverProactive({ ...state, heartbeat: { ...state.heartbeat, activeStartHour: 8, activeEndHour: 20 } }, new Date(2026, 8, 14, 21))).toBe(false);
    expect(canDeliverProactive({ ...state, heartbeat: { ...state.heartbeat, maxNudgesPerDay: 2, dailyNudgeDate: "2026-09-14", dailyNudgeCount: 2 } }, new Date(2026, 8, 14, 12))).toBe(false);
    expect(remainingProactiveCapacity({ ...state, heartbeat: { ...state.heartbeat, maxNudgesPerDay: 3, dailyNudgeDate: "2026-09-14", dailyNudgeCount: 1 } }, new Date(2026, 8, 14, 12))).toBe(2);
  });
});
