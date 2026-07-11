import { describe, it, expect } from "vitest";
import { createProvider, providerResultIsValid, isRateLimitError, RateLimitError } from "./index";
import type { ProviderResult } from "./types";

describe("providers", () => {
  it("creates named providers", () => {
    const config = {
      nvidiaApiKey: "x",
      nvidiaBaseUrl: "http://localhost:11434",
      nvidiaModel: "llama3",
      openRouterKeys: ["x"],
      openRouterModels: ["qwen"],
    };
    expect(createProvider("nvidia", config).call).toBeDefined();
    expect(createProvider("openrouter", config).call).toBeDefined();
  });

  it("validates provider results", () => {
    const valid: ProviderResult = { provider: "nvidia", message: { content: "Hola" } };
    expect(providerResultIsValid(valid)).toBe(true);
    const empty: ProviderResult = { provider: "nvidia", message: {} };
    expect(providerResultIsValid(empty)).toBe(false);
  });

  it("detects rate limit errors", () => {
    expect(isRateLimitError(new Error("429 too many requests"))).toBe(true);
    expect(isRateLimitError(new Error("connection refused"))).toBe(false);
  });

  it("RateLimitError has correct name", () => {
    const err = new RateLimitError("slow down");
    expect(err.name).toBe("RateLimitError");
  });
});
