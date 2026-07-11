import type { ProviderConfig, LlmProvider } from "./types";
import { minimaxProvider } from "./minimax";
import { nvidiaProvider } from "./nvidia";
import { openRouterProvider } from "./openrouter";

export type { ProviderConfig, ChatMessage, ProviderResult, LlmProvider } from "./types";
export { RateLimitError, isRateLimitError, providerResultIsValid } from "./types";
export { fetchWithTimeout, providerUrl } from "./fetch";
export { callMinimax, minimaxProvider } from "./minimax";
export { callNvidia, nvidiaProvider } from "./nvidia";
export { callOpenRouter, callOpenRouterCandidate, openRouterProvider } from "./openrouter";
export { isOllamaUrl, inferProviderFromModel } from "./ollama";

export function createProvider(name: "minimax" | "nvidia" | "openrouter", _config: ProviderConfig): LlmProvider {
  switch (name) {
    case "minimax":
      return minimaxProvider;
    case "nvidia":
      return nvidiaProvider;
    case "openrouter":
      return openRouterProvider;
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
