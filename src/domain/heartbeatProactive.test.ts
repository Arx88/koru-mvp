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
});
