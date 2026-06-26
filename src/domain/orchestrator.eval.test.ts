import { describe, expect, it, vi } from "vitest";
import { orchestrateTurn, uiBlocksToActionProposals } from "./orchestrator";
import { createInitialState } from "./store";
import type { KoruState, LifeRecord } from "./types";

vi.mock("./freellmapi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./freellmapi")>();
  return {
    ...actual,
    runOpenModelChat: () => Promise.reject(new Error("mocked")),
    runFreeLlmChat: () => Promise.reject(new Error("mocked")),
  };
});

vi.mock("./web", () => ({
  runWebNavigation: vi.fn(async (payload: { webMode?: string }) => {
    if (payload.webMode === "weather") {
      return {
        status: "failed",
        sources: [],
        recommendation: "No pude consultar la web en este intento.",
      };
    }
    return {
      status: "verified",
      sources: [{ title: "Fuente", url: "https://example.com", domain: "example.com" }],
      recommendation: "Resultado verificado.",
    };
  }),
}));

function stateWithLocation(): KoruState {
  const now = new Date().toISOString();
  return {
    ...createInitialState(),
    memories: [{
      id: "mem_location",
      kind: "profile",
      text: "Vivo en Madrid.",
      confidence: 0.95,
      sensitivity: "normal",
      status: "confirmed",
      createdAt: now,
      confirmedAt: now,
      sourceEntryId: "test",
      useForSuggestions: true,
    }],
  };
}

describe("Koru orchestrator architecture eval", () => {
  it("routes a weather paraphrase without requiring the word clima", async () => {
    const turn = await orchestrateTurn({
      input: "Llevo campera hoy?",
      state: stateWithLocation(),
      provider: "local",
      activeMemories: [],
    });

    expect(turn.intent.kind).toBe("weather");
    expect(turn.executedToolCalls.some((call) => call.tool === "weather")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "weather")).toBe(true);
  });

  it("keeps alarms semantic and never renders them as shopping", async () => {
    const turn = await orchestrateTurn({
      input: "Poneme una alarma a las 8",
      state: createInitialState(),
      provider: "local",
      activeMemories: [],
    });
    const actions = uiBlocksToActionProposals(turn.uiBlocks, turn.intent);

    expect(turn.pendingToolCalls.some((call) => call.tool === "alarm")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "alarm")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "shopping_list")).toBe(false);
    expect(actions[0]?.kind).toBe("alarm");
    expect(actions[0]?.approvalRequired).toBe(true);
  });

  it("routes normal reminders through the registry instead of a shopping card", async () => {
    const turn = await orchestrateTurn({
      input: "Recordame tomar el medicamento mañana por la mañana",
      state: createInitialState(),
      provider: "local",
      activeMemories: [],
    });
    const actions = uiBlocksToActionProposals(turn.uiBlocks, turn.intent);

    expect(turn.intent.kind).toBe("reminder");
    expect(turn.pendingToolCalls.some((call) => call.tool === "calendar_reminder")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "reminder")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "shopping_list")).toBe(false);
    expect(actions[0]?.kind).toBe("reminder");
    expect(actions[0]?.approvalRequired).toBe(true);
  });

  it("routes money summaries through the readonly registry tool", async () => {
    const now = new Date().toISOString();
    const state: KoruState = {
      ...createInitialState(),
      records: [{
        id: "expense_1",
        domain: "money",
        kind: "expense",
        title: "supermercado",
        amount: 12,
        currency: "EUR",
        createdAt: now,
        sourceEntryId: "test",
      } satisfies LifeRecord],
    };
    const turn = await orchestrateTurn({
      input: "Cuanto gaste esta semana?",
      state,
      provider: "local",
      activeMemories: [],
    });
    const actions = uiBlocksToActionProposals(turn.uiBlocks, turn.intent);

    expect(turn.intent.kind).toBe("money_summary");
    expect(turn.executedToolCalls.some((call) => call.tool === "money_summary")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "money_summary")).toBe(true);
    expect(actions[0]?.kind).toBe("money_summary");
    expect(actions[0]?.approvalRequired).toBe(false);
  });

  it("keeps shopping comparisons pending approval before opening stores", async () => {
    const turn = await orchestrateTurn({
      input: "Comparame cafeteras con entrega mañana",
      state: createInitialState(),
      provider: "local",
      activeMemories: [],
    });
    const actions = uiBlocksToActionProposals(turn.uiBlocks, turn.intent);

    expect(turn.pendingToolCalls.some((call) => call.tool === "shopping_compare")).toBe(true);
    expect(turn.executedToolCalls.some((call) => call.tool === "shopping_compare")).toBe(false);
    expect(actions[0]?.kind).toBe("web_research");
    expect(actions[0]?.approvalRequired).toBe(true);
    expect(actions[0]?.payload.webMode).toBe("shopping");
  });

  it("degrades failed readonly tools without fake sources", async () => {
    const turn = await orchestrateTurn({
      input: "Que clima hace en Madrid?",
      state: createInitialState(),
      provider: "local",
      activeMemories: [],
    });
    const weather = turn.uiBlocks.find((block) => block.type === "weather");

    expect(weather?.type).toBe("weather");
    expect(weather?.sourceStatus).toBe("failed");
    expect(weather?.sources ?? []).toHaveLength(0);
    expect(weather?.advice?.toLowerCase()).toContain("no pude");
  });

  it("does not let a pending weather slot swallow a later alarm intent", async () => {
    const state = createInitialState();
    const turn = await orchestrateTurn({
      input: "Poneme una alarma a las 8",
      state,
      provider: "local",
      activeMemories: [],
      history: [
        { role: "user", content: "Que clima hace?" },
        { role: "assistant", content: "En que ciudad?" },
      ],
    });

    expect(turn.intent.kind).toBe("alarm");
    expect(turn.pendingToolCalls.some((call) => call.tool === "alarm")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "alarm")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "weather")).toBe(false);
  });

  it("reuses the recent weather city for outfit follow-up", async () => {
    const turn = await orchestrateTurn({
      input: "Llevo campera hoy?",
      state: createInitialState(),
      provider: "local",
      activeMemories: [],
      history: [
        { role: "user", content: "Que clima hace en Madrid?" },
        { role: "assistant", content: "No pude consultar la web en este intento. Clima en Madrid." },
      ],
    });

    expect(turn.intent.kind).toBe("weather");
    expect(turn.executedToolCalls.some((call) => call.tool === "weather" && call.args.city === "Madrid")).toBe(true);
    expect(turn.uiBlocks.some((block) => block.type === "clarifying_question")).toBe(false);
  });
});
