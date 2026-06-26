import { describe, expect, it } from "vitest";
import { addCalendarEvents, applyHeartbeatNudges, completeCommitment, createInitialState, submitReflection } from "./store";
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

  it("uses absolute dueAt for reminders instead of stale text hints", async () => {
    const state = (
      await submitReflection(createInitialState(), "Recordame tomar el medicamento mañana a las 8.")
    ).state;
    const commitment = state.commitments.find((item) => /medicamento/i.test(item.title));

    expect(commitment?.dueAt).toBeTruthy();

    const early = buildHeartbeatNudges(state, new Date("2026-06-16T10:00:00.000Z"));
    const due = buildHeartbeatNudges(state, new Date(commitment!.dueAt!));

    expect(early).toHaveLength(0);
    expect(due.some((nudge) => nudge.sourceId === commitment!.id)).toBe(true);
  });

  it("rolls recurring commitments forward when completed", async () => {
    const state = (
      await submitReflection(createInitialState(), "Recordame tomar sertralina todos los dias a las 8.")
    ).state;
    const commitment = state.commitments.find((item) => /sertralina/i.test(item.title));

    expect(commitment?.recurrence).toBe("daily");
    expect(commitment?.dueAt).toBeTruthy();

    const completed = completeCommitment(state, commitment!.id);
    const rolled = completed.commitments.find((item) => item.id === commitment!.id);

    expect(rolled?.status).toBe("open");
    expect(new Date(rolled!.dueAt!).getTime()).toBeGreaterThan(new Date(commitment!.dueAt!).getTime());
  });
});
