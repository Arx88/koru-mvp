import { describe, it, expect } from "vitest";
import { decidePresentation } from "./engine";

describe("decidePresentation", () => {
  it("picks weather from tool result", () => {
    const decision = decidePresentation({
      toolResults: [{ data: { type: "weather", city: "Madrid", now: "22 C" } }],
    });
    expect(decision?.visualizer).toBe("weather");
    expect(decision?.block.type).toBe("weather");
  });

  it("validates hint when it matches schema", () => {
    const decision = decidePresentation({
      hint: { kind: "weather", confidence: 0.9 },
      toolResults: [{ data: { type: "weather", city: "Madrid" } }],
    });
    expect(decision?.reason).toBe("hint_validated");
  });

  it("returns null when no schema matches", () => {
    const decision = decidePresentation({ toolResults: [{ data: { foo: "bar" } }] });
    expect(decision).toBeNull();
  });
});
