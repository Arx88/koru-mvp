import { describe, expect, it } from "vitest";
import { addCalendarEvents, applyHeartbeatNudges, completeCommitment, createInitialState } from "./store";
import { buildHeartbeatNudges } from "./heartbeat";
import type { Commitment } from "./types";

describe("Koru heartbeat", () => {
  it("turns open commitments and nearby calendar events into limited nudges", () => {
    const base = createInitialState();
    const commitment: Commitment = {
      id: "commit_1",
      title: "Mandar presupuesto",
      dueHint: "hoy",
      status: "open",
      createdAt: "2026-06-16T08:00:00.000Z",
      sourceEntryId: "entry_1",
    };
    const withCalendar = addCalendarEvents(
      { ...base, commitments: [commitment] },
      [
        {
          title: "Reunion con Ana",
          startsAt: "2026-06-16T13:00:00.000Z",
          source: "manual",
          sourceRef: "meeting",
        },
      ],
    );

    const nudges = buildHeartbeatNudges(withCalendar, new Date("2026-06-16T10:00:00.000Z"));

    expect(nudges).toHaveLength(2);
    expect(nudges.map((nudge) => nudge.source)).toEqual(["commitment", "calendar"]);
  });

  it("respects daily nudge caps", () => {
    const state = {
      ...createInitialState(),
      heartbeat: {
        ...createInitialState().heartbeat,
        dailyNudgeDate: "2026-06-16",
        dailyNudgeCount: 3,
        maxNudgesPerDay: 3,
      },
    };

    const nudges = buildHeartbeatNudges(state, new Date("2026-06-16T10:00:00.000Z"));
    const next = applyHeartbeatNudges(state, nudges, new Date("2026-06-16T10:00:00.000Z"));

    expect(nudges).toHaveLength(0);
    expect(next.nudges).toHaveLength(0);
  });

  it("uses absolute dueAt for reminders instead of stale text hints", () => {
    // Determinístico: el compromiso se construye con dueAt absoluto (lo que
    // produce el pipeline actual) — sin depender de LLM ni submitReflection
    // (deprecated: el ingreso ahora vive en runBackendAgentTurn).
    const state = {
      ...createInitialState(),
      commitments: [
        {
          id: "commit_med",
          title: "Tomar el medicamento",
          dueHint: "mañana a las 8",
          dueAt: "2026-06-17T08:00:00.000Z",
          status: "open" as const,
          createdAt: "2026-06-16T08:00:00.000Z",
          sourceEntryId: "entry_1",
        },
      ],
    };

    const early = buildHeartbeatNudges(state, new Date("2026-06-16T10:00:00.000Z"));
    const due = buildHeartbeatNudges(state, new Date("2026-06-17T08:00:00.000Z"));

    expect(early).toHaveLength(0);
    expect(due.some((nudge) => nudge.sourceId === "commit_med")).toBe(true);
  });

  it("rolls recurring commitments forward when completed", () => {
    // Determinístico: compromiso recurrente diario con dueAt absoluto.
    const dueAt = "2026-06-16T08:00:00.000Z";
    const state = {
      ...createInitialState(),
      commitments: [
        {
          id: "commit_sertralina",
          title: "Tomar sertralina",
          dueHint: "todos los días a las 8",
          dueAt,
          recurrence: "daily" as const,
          status: "open" as const,
          createdAt: "2026-06-15T08:00:00.000Z",
          sourceEntryId: "entry_1",
        },
      ],
    };

    const completed = completeCommitment(state, "commit_sertralina");
    const rolled = completed.commitments.find((item) => item.id === "commit_sertralina");

    expect(rolled?.status).toBe("open");
    expect(rolled?.dueAt).toBeTruthy();
    expect(new Date(rolled!.dueAt!).getTime()).toBeGreaterThan(new Date(dueAt).getTime());
    expect(rolled?.remindedAt).toBeUndefined();
  });
});
