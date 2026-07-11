import { describe, expect, it } from "vitest";
import {
  generateEnhancements,
  opportunityToCandidate,
  rankEnhancements,
  filterEnhancements,
  scoreCandidate,
} from "./enhancementEngine";
import type { RawOpportunity } from "./enhancementExtractor";
import type { KoruState } from "./types";
import { createInitialState } from "./store";

describe("Koru enhancement engine", () => {
  const baseState = createInitialState();

  const makeOpp = (overrides: Partial<RawOpportunity> = {}): RawOpportunity => ({
    risk: "readonly",
    confidence: 0.8,
    type: "health_followup",
    contextualQuestion: "¿Querés que prepare alarmas para las tomas?",
    requiresApproval: false,
    rationale: "Test rationale",
    ...overrides,
  });

  describe("opportunityToCandidate", () => {
    it("asks when requiresApproval is true", () => {
      const opp = makeOpp({ requiresApproval: true, risk: "local_write" });
      const c = opportunityToCandidate(opp, 0);
      expect(c.action.mode).toBe("ask");
    });

    it("suggests when readonly has no uiBlock", () => {
      const opp = makeOpp({ risk: "readonly", requiresApproval: false });
      const c = opportunityToCandidate(opp, 0);
      expect(c.action.mode).toBe("suggest");
    });

    it("auto when readonly has uiBlock", () => {
      const opp = makeOpp({
        risk: "readonly",
        metadata: { uiBlock: { type: "alarm", note: "test" } },
        requiresApproval: false,
      });
      const c = opportunityToCandidate(opp, 0);
      expect(c.action.mode).toBe("auto");
    });

    it("defers when no contextualQuestion", () => {
      const opp = makeOpp({ contextualQuestion: "" });
      const c = opportunityToCandidate(opp, 0);
      expect(c.action.mode).toBe("defer");
    });
  });

  describe("scoreCandidate", () => {
    it("keeps high-confidence readonly", () => {
      const opp = makeOpp({ risk: "readonly", confidence: 0.75 });
      const c = opportunityToCandidate(opp, 0);
      expect(scoreCandidate(c, baseState)).toBeGreaterThan(1.5);
    });

    it("lowers score for destructive risk", () => {
      const opp = makeOpp({ risk: "destructive", confidence: 0.9, contextualQuestion: "¿Querés que prepare algo?" });
      const c = opportunityToCandidate(opp, 0);
      expect(scoreCandidate(c, baseState)).toBeLessThan(1.5);
    });

    it("boosts accepted learning preference", () => {
      const state: KoruState = {
        ...baseState,
        learningPreferences: [
          { type: "health_followup", acceptedCount: 4, rejectedCount: 0, lastInteractionAt: "2026-06-16T08:00:00.000Z" },
        ],
      };
      const opp = makeOpp({ type: "health_followup", confidence: 0.75, risk: "readonly" });
      const c = opportunityToCandidate(opp, 0);
      const plain = createInitialState();
      expect(scoreCandidate(c, state)).toBeGreaterThan(scoreCandidate(c, plain));
    });
  });

  describe("generateEnhancements", () => {
    it("returns at most 2 candidates", () => {
      const opps: RawOpportunity[] = [
        makeOpp({ confidence: 0.8, contextualQuestion: "¿Querés que prepare algo?" }),
        makeOpp({ confidence: 0.75, contextualQuestion: "¿Querés que prepare algo?" }),
        makeOpp({ confidence: 0.9, contextualQuestion: "¿Querés que prepare algo?" }),
      ];
      const selected = generateEnhancements(opps, baseState);
      expect(selected.length).toBeLessThanOrEqual(2);
    });

    it("prefers the highest confidence", () => {
      const opps: RawOpportunity[] = [
        makeOpp({ confidence: 0.7, contextualQuestion: "¿Querés que prepare algo?" }),
        makeOpp({ confidence: 0.95, contextualQuestion: "¿Querés que prepare algo?" }),
      ];
      const selected = generateEnhancements(opps, baseState);
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.some((c) => c.confidence === 0.95)).toBe(true);
    });

    it("does not duplicate types", () => {
      const opps: RawOpportunity[] = [
        makeOpp({ type: "health_followup", confidence: 0.95, contextualQuestion: "¿Querés que prepare algo?" }),
        makeOpp({ type: "health_followup", confidence: 0.8, contextualQuestion: "¿Querés que prepare algo?" }),
      ];
      const selected = generateEnhancements(opps, baseState);
      expect(selected.length).toBe(1);
    });
  });

  describe("rankEnhancements", () => {
    it("ranks by score descending", () => {
      const opps: RawOpportunity[] = [
        makeOpp({ confidence: 0.6, contextualQuestion: "¿Querés que prepare algo?" }),
        makeOpp({ confidence: 0.95, contextualQuestion: "¿Querés que prepare algo?" }),
      ];
      const candidates = opps.map((o, i) => opportunityToCandidate(o, i));
      const ranked = rankEnhancements(candidates, baseState);
      expect(ranked[0].confidence).toBe(0.95);
      expect(ranked[1].confidence).toBe(0.6);
    });
  });

  describe("filterEnhancements", () => {
    it("limits to one visible", () => {
      const opps: RawOpportunity[] = [
        makeOpp({ confidence: 0.9, contextualQuestion: "¿Querés que prepare algo?" }),
        makeOpp({ confidence: 0.85, contextualQuestion: "¿Querés que prepare algo?" }),
      ];
      const candidates = opps.map((o, i) => opportunityToCandidate(o, i));
      const filtered = filterEnhancements(candidates, baseState, 1);
      expect(filtered.length).toBe(1);
    });
  });
});
