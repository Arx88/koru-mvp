import { describe, expect, it } from "vitest";
import { buildProactiveNudges } from "./heartbeatProactive";
import type { KoruState } from "./types";
import { createInitialState } from "./store";

describe("heartbeatProactive", () => {
  const baseState = createInitialState();

  it("never includes low-priority nudges", () => {
    const nudges = buildProactiveNudges(baseState, new Date("2026-06-16T08:00:00.000Z"));
    expect(nudges.every((n) => n.priority !== "low")).toBe(true);
  });

  it("detects wake hour from memory", () => {
    const state: KoruState = {
      ...baseState,
      memories: [
        {
          id: "mem_wake",
          text: "me levanto a las 8",
          kind: "routine",
          status: "confirmed",
          createdAt: "2026-06-15T08:00:00.000Z",
          confidence: 1,
          sensitivity: "normal",
          sourceEntryId: "entry_1",
        },
      ],
    };
    const nudges = buildProactiveNudges(state, new Date("2026-06-16T08:15:00.000Z"));
    expect(nudges.some((n) => n.sourceId === "weather-wakeup")).toBe(true);
  });

  it("deduplicates by sourceId", () => {
    const state: KoruState = {
      ...baseState,
      nudges: [
        ...baseState.nudges,
        {
          id: "nudge_1",
          title: "Buen día",
          body: "Clima",
          reason: "test",
          priority: "medium",
          source: "heartbeat",
          sourceId: "weather-wakeup",
          createdAt: "2026-06-16T07:00:00.000Z",
        },
      ],
    };
    const nudges = buildProactiveNudges(state, new Date("2026-06-16T08:15:00.000Z"));
    expect(nudges.some((n) => n.sourceId === "weather-wakeup")).toBe(false);
  });

  // 🔴 FIX SPAM (2026-09-12): el nudge "¿Una pausa?" se spameaba porque leía
  // energyAwarded < 10 como "usuario con poca energía" — pero energyAwarded es
  // la energía que Michi OTORGA por interactuar (chat normal sin cards = 8),
  // así que la condición estaba SIEMPRE en true. Regresión: un chat fluido
  // normal en plena ventana de tarde (15:00) NO genera nudge de pausa.
  it("un chat normal (energía otorgada 6-18) jamás dispara el nudge de pausa", () => {
    const chatNormal: KoruState = {
      ...baseState,
      entries: Array.from({ length: 5 }, (_, i) => ({
        id: `entry_${i}`,
        text: "charlando tranquilo con michi",
        createdAt: `2026-06-16T1${i}:10:00.000Z`,
        summary: "charla normal",
        transcriptSource: "typed" as const,
        energyAwarded: 8, // chat sin cards/tools → típico 6-9
      })),
    };
    const nudges = buildProactiveNudges(chatNormal, new Date("2026-06-16T15:00:00.000Z"));
    expect(nudges.some((n) => n.sourceId === "energy-pause")).toBe(false);
    expect(nudges.some((n) => n.title === "¿Una pausa?")).toBe(false);
  });
});
