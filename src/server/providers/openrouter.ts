import type { ProviderConfig, ChatMessage, ProviderResult, ProviderMessage, LlmProvider } from "./types";
import { fetchWithTimeout } from "./fetch";
import { asArray, asRecord, asString } from "../json";
import { ALL_TOOL_DEFINITIONS, hasUsableAssistantMessage } from "../koruBackend";
import { logger } from "../logger";
import { ProviderConfigError, classifyProviderStatus, providerErrorDetail, describeProviderFailures } from "./types";

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
      "X-OpenRouter-Title": "Michi Agent Loop",
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
  if (!response.ok) {
    const detail = providerErrorDetail(data);
    const msg = `OpenRouter ${model} returned ${response.status}${detail ? `: ${detail}` : ""}`;
    if (response.status === 429) {
      const err = new Error(msg);
      err.name = "RateLimitError";
      throw err;
    }
    if (classifyProviderStatus(response.status) !== "transient") {
      throw new ProviderConfigError(`OpenRouter ${model}`, response.status, detail);
    }
    throw new Error(msg);
  }
  if (!hasUsableAssistantMessage(data)) {
    throw new Error(`OpenRouter ${model} devolvió una respuesta sin contenido utilizable.`);
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
  try {
    return await Promise.any(candidates.map((candidate) => callOpenRouterCandidate(candidate.key, candidate.model, messages, timeoutMs, toolsEnabled)));
  } catch (err: any) {
    // `Promise.any` pierde los N rechazos individuales en un AggregateError.
    const causes: unknown[] = Array.isArray(err?.errors) ? err.errors : [err];
    const { message, allRateLimited, configErrors } = describeProviderFailures(causes);
    logger.error("callOpenRouter", `Los ${candidates.length} candidatos de OpenRouter fallaron`, {
      causes: message,
      allRateLimited,
      configErrorCount: configErrors.length,
    });
    if (allRateLimited) {
      const rateErr = new Error(`OpenRouter agotó la cuota en los ${candidates.length} candidatos: ${message}`);
      rateErr.name = "RateLimitError";
      throw rateErr;
    }
    throw new Error(`OpenRouter falló en los ${candidates.length} candidatos — ${message}`);
  }
}

export const openRouterProvider: LlmProvider = {
  call: (config, messages, timeoutMs, toolsEnabled) => callOpenRouter(config, messages, timeoutMs, toolsEnabled),
};
