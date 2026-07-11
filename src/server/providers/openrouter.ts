import type { ProviderConfig, ChatMessage, ProviderResult, ProviderMessage, LlmProvider } from "./types";
import { fetchWithTimeout } from "./fetch";
import { asArray, asRecord, asString } from "../json";
import { ALL_TOOL_DEFINITIONS, hasUsableAssistantMessage } from "../koruBackend";

export async function callOpenRouterCandidate(
  key: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": "Koru Agent Loop",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
      temperature: 0.25,
      max_tokens: 8192,
      stream: false,
      response_format: { type: "json_object" },
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    // eslint-disable-next-line no-console
    throw new Error(`OpenRouter ${model} returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "openrouter",
    model: asString(asRecord(data).model) ?? model,
    message: asRecord(choice.message) as ProviderMessage,
  };
}

export async function callOpenRouter(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  const candidates = config.openRouterKeys
    .slice(0, 3)
    .flatMap((key) => config.openRouterModels.slice(0, 3).map((model) => ({ key, model })));
  if (!candidates.length) throw new Error("OpenRouter fallback is not configured.");
  return Promise.any(candidates.map((candidate) => callOpenRouterCandidate(candidate.key, candidate.model, messages, timeoutMs, toolsEnabled)));
}

export const openRouterProvider: LlmProvider = {
  call: (config, messages, timeoutMs, toolsEnabled) => callOpenRouter(config, messages, timeoutMs, toolsEnabled),
};
