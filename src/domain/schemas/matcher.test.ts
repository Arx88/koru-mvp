import { describe, it, expect } from "vitest";
import { matchSchema } from "./matcher";

describe("matchSchema", () => {
  it("matches weather", () => {
    const result = matchSchema({ type: "weather", city: "Madrid", now: "22 C" });
    expect(result?.id).toBe("weather");
  });

  it("matches money summary", () => {
    const result = matchSchema({ type: "money_summary", total: 120, currency: "EUR" });
    expect(result?.id).toBe("money_summary");
  });

  it("returns null for unknown data", () => {
    const result = matchSchema({ foo: "bar" });
    expect(result).toBeNull();
  });
});
