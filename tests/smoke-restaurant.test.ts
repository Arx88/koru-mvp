import { describe, it, expect } from "vitest";
import { runKoruBackendTurn } from "../src/server/koruBackend";
import { createInitialState } from "../src/domain/store";

describe("smoke restaurant", () => {
  it("should respond to restaurant query", async () => {
    const state = createInitialState();
    state.userName = "Alex";
    const result = await runKoruBackendTurn({ input: "¿dónde cenar en Madrid?", history: [], state });
    console.log("=== SMOKE RESULTS ===");
    console.log("reply:", (result.reply ?? "").slice(0, 300));
    console.log("provider:", result.provider);
    console.log("model:", result.model);
    console.log("fallback:", result.fallbackReason);
    console.log("uiBlocks:", JSON.stringify(result.uiBlocks?.map((b) => b.type)));
    console.log("toolResults:", JSON.stringify(result.toolResults?.map((t) => t.type)));
    expect(result.reply).toBeTruthy();
  });
}, { timeout: 120_000 });
