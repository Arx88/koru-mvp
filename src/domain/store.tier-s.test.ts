import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  createPlan,
  togglePlanStep,
  createChecklist,
  toggleChecklistItem,
  createHabit,
  logHabit,
  computeStreak,
  createShoppingList,
  toggleShoppingItem,
  snoozeCommitment,
  forgetMemory,
} from "./store";
import type { Commitment, HabitLog, MemoryFact } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve la fecha ISO (YYYY-MM-DD) de hoy desplazada `days` días. */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeMemory(id: string): MemoryFact {
  return {
    id,
    kind: "preference",
    text: `Memoria ${id}`,
    confidence: 0.7,
    sensitivity: "normal",
    status: "confirmed",
    createdAt: new Date().toISOString(),
    sourceEntryId: "entry_test",
  };
}

function makeCommitment(id: string): Commitment {
  return {
    id,
    title: `Compromiso ${id}`,
    dueHint: "pronto",
    status: "open",
    createdAt: new Date().toISOString(),
    sourceEntryId: "entry_test",
    dueAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN
// ─────────────────────────────────────────────────────────────────────────────

describe("store.tier-s — createPlan", () => {
  it("crea un plan con 3 pasos y status='active'", () => {
    const initial = createInitialState("user_plan");
    const next = createPlan(initial, "Plan de prueba", [
      { title: "Paso 1" },
      { title: "Paso 2" },
      { title: "Paso 3" },
    ]);

    expect(next.plans).toBeDefined();
    expect(next.plans).toHaveLength(1);

    const plan = next.plans![0];
    expect(plan.title).toBe("Plan de prueba");
    expect(plan.status).toBe("active");
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => s.title)).toEqual(["Paso 1", "Paso 2", "Paso 3"]);
    // Cada paso trae id único y order secuencial.
    expect(plan.steps[0].order).toBe(0);
    expect(plan.steps[1].order).toBe(1);
    expect(plan.steps[2].order).toBe(2);
    expect(plan.steps.every((s) => typeof s.id === "string" && s.id.length > 0)).toBe(true);
    expect(plan.steps.every((s) => s.done === false)).toBe(true);
  });
});

describe("store.tier-s — togglePlanStep", () => {
  it("toggle una vez → done=true y doneAt set; toggle otra vez → done=false", () => {
    const initial = createInitialState("user_toggle");
    const withPlan = createPlan(initial, "Plan", [
      { title: "Paso 1" },
      { title: "Paso 2" },
    ]);
    const plan = withPlan.plans![0];
    const stepId = plan.steps[0].id;

    const afterFirst = togglePlanStep(withPlan, plan.id, stepId);
    const step1 = afterFirst.plans![0].steps[0];
    expect(step1.done).toBe(true);
    expect(step1.doneAt).toBeTruthy();
    expect(typeof step1.doneAt).toBe("string");

    const afterSecond = togglePlanStep(afterFirst, plan.id, stepId);
    const step1Again = afterSecond.plans![0].steps[0];
    expect(step1Again.done).toBe(false);
    expect(step1Again.doneAt).toBeUndefined();
  });

  it("marca el plan como 'completed' cuando todos los pasos están done", () => {
    const initial = createInitialState("user_complete");
    const withPlan = createPlan(initial, "Plan", [
      { title: "Paso 1" },
      { title: "Paso 2" },
      { title: "Paso 3" },
    ]);
    const plan = withPlan.plans![0];

    let state = withPlan;
    for (const step of plan.steps) {
      state = togglePlanStep(state, plan.id, step.id);
    }

    const finalPlan = state.plans![0];
    expect(finalPlan.status).toBe("completed");
    expect(finalPlan.steps.every((s) => s.done)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

describe("store.tier-s — createChecklist", () => {
  it("crea con 3 ítems asignando ids únicos y order secuencial", () => {
    const initial = createInitialState("user_checklist");
    const next = createChecklist(initial, "Compra semanal", [
      { label: "Leche", urgency: "normal" },
      { label: "Pan", urgency: "urgent" },
      { label: "Huevos", urgency: "normal" },
    ]);

    expect(next.checklists).toHaveLength(1);
    const checklist = next.checklists![0];
    expect(checklist.title).toBe("Compra semanal");
    expect(checklist.items).toHaveLength(3);

    // ids únicos
    const ids = checklist.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);

    // order secuencial 0..n-1
    expect(checklist.items.map((i) => i.order)).toEqual([0, 1, 2]);

    // labels preservados
    expect(checklist.items.map((i) => i.label)).toEqual(["Leche", "Pan", "Huevos"]);
  });
});

describe("store.tier-s — toggleChecklistItem", () => {
  it("toggle un ítem → doneAt queda seteado", () => {
    const initial = createInitialState("user_checklist_toggle");
    const withChecklist = createChecklist(initial, "Lista", [
      { label: "A", urgency: "normal" },
      { label: "B", urgency: "normal" },
    ]);
    const checklist = withChecklist.checklists![0];
    const itemId = checklist.items[0].id;

    expect(checklist.items[0].doneAt).toBeUndefined();

    const after = toggleChecklistItem(withChecklist, checklist.id, itemId);
    const item = after.checklists![0].items[0];
    expect(item.doneAt).toBeTruthy();
    expect(typeof item.doneAt).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HABIT
// ─────────────────────────────────────────────────────────────────────────────

describe("store.tier-s — createHabit", () => {
  it("crea un hábito diario con active=true", () => {
    const initial = createInitialState("user_habit");
    const next = createHabit(
      initial,
      "Meditar",
      "meditation",
      "daily",
      10,
      "min",
      "08:00",
    );

    expect(next.habits).toHaveLength(1);
    const habit = next.habits![0];
    expect(habit.label).toBe("Meditar");
    expect(habit.cadence).toBe("daily");
    expect(habit.active).toBe(true);
    expect(habit.target).toBe(10);
    expect(habit.unit).toBe("min");
    expect(habit.anchorTime).toBe("08:00");
  });
});

describe("store.tier-s — logHabit", () => {
  it("loguea hoy y reemplaza (no duplica) al volver a loguear", () => {
    const initial = createInitialState("user_log");
    const withHabit = createHabit(initial, "Meditar", "meditation", "daily", 10, "min");
    const habitId = withHabit.habits![0].id;

    const afterFirst = logHabit(withHabit, habitId, 10);
    expect(afterFirst.habitLogs).toHaveLength(1);
    expect(afterFirst.habitLogs![0].habitId).toBe(habitId);
    expect(afterFirst.habitLogs![0].value).toBe(10);

    const afterSecond = logHabit(afterFirst, habitId, 25);
    // Idempotente: sigue habiendo un solo log para hoy, ahora con el nuevo value.
    const todayLogs = afterSecond.habitLogs!.filter(
      (l) => l.habitId === habitId && l.date === new Date().toISOString().slice(0, 10),
    );
    expect(todayLogs).toHaveLength(1);
    expect(todayLogs[0].value).toBe(25);
  });
});

describe("store.tier-s — computeStreak", () => {
  it("con 3 días consecutivos de logs → streak=3", () => {
    const habitId = "habit_streak_3";
    const logs: HabitLog[] = [
      { id: "l1", habitId, date: dateOffset(0), value: 10, completedAt: "x" },
      { id: "l2", habitId, date: dateOffset(-1), value: 10, completedAt: "x" },
      { id: "l3", habitId, date: dateOffset(-2), value: 10, completedAt: "x" },
    ];
    expect(computeStreak(habitId, logs)).toBe(3);
  });

  it("con un hueco (sin log hoy) → streak=0", () => {
    const habitId = "habit_streak_gap";
    const logs: HabitLog[] = [
      { id: "l1", habitId, date: dateOffset(-1), value: 10, completedAt: "x" },
      { id: "l2", habitId, date: dateOffset(-2), value: 10, completedAt: "x" },
      { id: "l3", habitId, date: dateOffset(-3), value: 10, completedAt: "x" },
    ];
    expect(computeStreak(habitId, logs)).toBe(0);
  });

  it("sin logs → streak=0", () => {
    expect(computeStreak("habit_no_logs", [])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOPPING
// ─────────────────────────────────────────────────────────────────────────────

describe("store.tier-s — createShoppingList", () => {
  it("crea con 3 ítems con checked=false", () => {
    const initial = createInitialState("user_shop");
    const next = createShoppingList(initial, "Lista del súper", [
      { name: "Manzanas", qty: "1kg", price: 2.5 },
      { name: "Pan", qty: "1", price: 1.0 },
      { name: "Café", qty: "1", price: 5.0 },
    ]);

    expect(next.shoppingLists).toHaveLength(1);
    const list = next.shoppingLists![0];
    expect(list.title).toBe("Lista del súper");
    expect(list.items).toHaveLength(3);
    expect(list.items.every((it) => it.checked === false)).toBe(true);
    expect(list.items.map((it) => it.order)).toEqual([0, 1, 2]);
    expect(list.items.map((it) => it.name)).toEqual(["Manzanas", "Pan", "Café"]);
  });
});

describe("store.tier-s — toggleShoppingItem", () => {
  it("toggle un ítem → checked=true, checkedAt seteado, totalSpent actualizado", () => {
    const initial = createInitialState("user_shop_toggle");
    const withList = createShoppingList(initial, "Lista", [
      { name: "Manzanas", qty: "1kg", price: 2.5 },
      { name: "Pan", qty: "1", price: 1.0 },
      { name: "Café", qty: "1", price: 5.0 },
    ]);
    const list = withList.shoppingLists![0];
    const itemId = list.items[0].id;

    const after = toggleShoppingItem(withList, list.id, itemId);
    const updatedList = after.shoppingLists![0];
    const item = updatedList.items[0];

    expect(item.checked).toBe(true);
    expect(item.checkedAt).toBeTruthy();
    expect(typeof item.checkedAt).toBe("string");

    // totalSpent = suma de precios de los ítems checked.
    expect(updatedList.totalSpent).toBeCloseTo(2.5, 5);
  });

  it("toggle múltiples ítems acumula totalSpent correctamente", () => {
    const initial = createInitialState("user_shop_multi");
    const withList = createShoppingList(initial, "Lista", [
      { name: "A", price: 2.0 },
      { name: "B", price: 3.0 },
      { name: "C", price: 4.0 },
    ]);
    const list = withList.shoppingLists![0];

    let state = toggleShoppingItem(withList, list.id, list.items[0].id);
    state = toggleShoppingItem(state, list.id, list.items[2].id);

    const updated = state.shoppingLists![0];
    expect(updated.totalSpent).toBeCloseTo(6.0, 5);
    expect(updated.status).toBe("active"); // no todos checked → sigue active
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SNOOZE COMMITMENT
// ─────────────────────────────────────────────────────────────────────────────

describe("store.tier-s — snoozeCommitment", () => {
  it("pospone 10 min → dueAt queda a ~10 min en el futuro", () => {
    const initial = createInitialState("user_snooze");
    const commitment = makeCommitment("commit_snooze");
    const state = { ...initial, commitments: [commitment] };

    const before = Date.now();
    const after = snoozeCommitment(state, commitment.id, 10);
    const afterTime = Date.now();

    const snoozed = after.commitments.find((c) => c.id === commitment.id);
    expect(snoozed).toBeDefined();
    expect(snoozed!.dueAt).toBeTruthy();

    const dueAtMs = Date.parse(snoozed!.dueAt!);
    // El nuevo dueAt debe estar a ~10 min en el futuro (entre 9.5 y 10.5 min).
    const minExpected = before + 9.5 * 60 * 1000;
    const maxExpected = afterTime + 10.5 * 60 * 1000;
    expect(dueAtMs).toBeGreaterThanOrEqual(minExpected);
    expect(dueAtMs).toBeLessThanOrEqual(maxExpected);

    // dueHint se actualiza para reflejar el snooze.
    expect(snoozed!.dueHint).toContain("10");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORGET MEMORY
// ─────────────────────────────────────────────────────────────────────────────

describe("store.tier-s — forgetMemory", () => {
  it("olvida una memoria → la elimina del estado", () => {
    const initial = createInitialState("user_forget");
    const m1 = makeMemory("mem_1");
    const m2 = makeMemory("mem_2");
    const m3 = makeMemory("mem_3");
    const state = { ...initial, memories: [m1, m2, m3] };

    const after = forgetMemory(state, "mem_2");

    expect(after.memories).toHaveLength(2);
    expect(after.memories.find((m) => m.id === "mem_2")).toBeUndefined();
    expect(after.memories.map((m) => m.id).sort()).toEqual(["mem_1", "mem_3"]);
  });

  it("olvida una memoria inexistente no rompe el estado", () => {
    const initial = createInitialState("user_forget_empty");
    const m1 = makeMemory("mem_1");
    const state = { ...initial, memories: [m1] };

    const after = forgetMemory(state, "no_existe");
    expect(after.memories).toHaveLength(1);
    expect(after.memories[0].id).toBe("mem_1");
  });
});
