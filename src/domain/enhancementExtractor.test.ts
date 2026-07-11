import { describe, expect, it } from "vitest";
import { extractOpportunities } from "./enhancementExtractor";
import { createInitialState } from "./store";
import type { ExtractorContext } from "./enhancementExtractor";

describe("Koru enhancement extractor", () => {
  const baseState = createInitialState();

  const makeCtx = (overrides: Partial<ExtractorContext> = {}): ExtractorContext => ({
    input: "gasté 18€ en farmacia",
    intent: { domain: "chat", kind: "user_request", confidence: 0.6 },
    uiBlocks: [],
    toolResults: [],
    state: baseState,
    runtime: baseState.runtime,
    ...overrides,
  });

  it("uses external chatFn when provided", async () => {
    const mockChatFn = async () => ({
      content: JSON.stringify({
        opportunities: [
          {
            type: "health_followup",
            confidence: 0.85,
            contextualQuestion: "¿Querés que prepare alarmas para las tomas?",
            risk: "readonly",
            priority: "medium",
            requiresApproval: false,
            rationale: "Gasto en farmacia detectado",
          },
        ],
      }),
    });

    const result = await extractOpportunities(makeCtx(), mockChatFn);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("health_followup");
    expect(result[0].confidence).toBe(0.85);
  });

  it("filters opportunities below confidence 0.65", async () => {
    const mockChatFn = async () => ({
      content: JSON.stringify({
        opportunities: [
          {
            type: "low_confidence",
            confidence: 0.4,
            contextualQuestion: "¿algo?",
            risk: "readonly",
            priority: "medium",
            requiresApproval: false,
          },
        ],
      }),
    });

    const result = await extractOpportunities(makeCtx(), mockChatFn);
    expect(result).toHaveLength(0);
  });

  it("returns empty array on chatFn error", async () => {
    const mockChatFn = async () => {
      throw new Error("LLM down");
    };

    const result = await extractOpportunities(makeCtx(), mockChatFn);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no chatFn and no runtime LLM", async () => {
    const ctx = makeCtx({ runtime: { ...baseState.runtime, openModelEnabled: false, freeLlmApiEnabled: false } });
    const result = await extractOpportunities(ctx);
    expect(result).toHaveLength(0);
  });
});
