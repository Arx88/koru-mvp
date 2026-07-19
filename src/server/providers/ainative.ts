/**
 * AI Native Studio provider — OpenAI-compatible endpoint.
 *
 * Usado como fallback cuando NVIDIA Nemotron falla (rate limit, server-error,
 * first-call-invalid-json). Modelos:
 *   - kimi-k2.6 (primario): 90% tool calling success, 4.8s latencia, chat cálido
 *   - deepseek-v4-flash (secundario): 70% tool calling, 5.0s latencia, más verboso
 *
 * Endpoint: https://api.ainative.studio/v1/chat/completions
 * Auth: Bearer sk_amu2O_... (AINATIVE_API_KEY env var)
 *
 * Benchmark vs NVIDIA (con system prompt REAL de Koru, 55 tests):
 *   - Kimi tool match: 29% vs NVIDIA 2% (NVIDIA saturado en free tier)
 *   - Kimi latencia: 3.2s vs NVIDIA 9.9s
 *   - Kimi errores: 31 (rate limits) vs NVIDIA 0 (pero 53/55 fallbacks)
 *   - Kimi gana en followup multi-turn: 5/5 tool match vs NVIDIA 1/5
 *
 * Limitación: AI Native Studio es un router con HuggingFace backend. Algunos
 * modelos fallan con 401 de HuggingFace. kimi-k2.6 y deepseek-v4-flash son los
 * más estables.
 */
import type { ToolDefinition } from "../../tools/types";
import type { ProviderConfig, ChatMessage, ProviderResult, ProviderMessage } from "./types";
import { fetchWithTimeout, providerUrl } from "./fetch";
import { asArray, asRecord, asString, cleanText } from "../json";
import { CORE_TOOL_DEFINITIONS } from "../koruBackend";

const AINATIVE_BASE_URL = "https://api.ainative.studio/v1";
const AINATIVE_PRIMARY_MODEL = "kimi-k2.6";
const AINATIVE_SECONDARY_MODEL = "deepseek-v4-flash";

export async function callAINative(
  config: ProviderConfig & { ainativeApiKey?: string },
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
  availableTools?: ToolDefinition[],
): Promise<ProviderResult> {
  const apiKey = config.ainativeApiKey;
  if (!apiKey) {
    throw new Error("AINATIVE_API_KEY not configured");
  }

  // Intentar primero con kimi-k2.6 (mejor tool calling), fallback a deepseek-v4-flash
  const models = [AINATIVE_PRIMARY_MODEL, AINATIVE_SECONDARY_MODEL];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const result = await callAINativeOnce(config, messages, timeoutMs, model, toolsEnabled, availableTools);
      return result;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err).toLowerCase();
      // Si es rate limit o error de autenticación, no reintentar con otro modelo
      if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("forbidden")) {
        throw err;
      }
      // Para otros errores (timeout, 503, etc.), probar el siguiente modelo
      console.warn(`[ainative] ${model} failed: ${err?.message}. Trying next model...`);
    }
  }

  throw lastError ?? new Error("AI Native Studio: all models failed");
}

async function callAINativeOnce(
  config: ProviderConfig & { ainativeApiKey?: string },
  messages: ChatMessage[],
  timeoutMs: number,
  model: string,
  toolsEnabled: boolean,
  availableTools?: ToolDefinition[],
): Promise<ProviderResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${config.ainativeApiKey}`,
  };

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 8192,
    stream: false,
  };

  if (toolsEnabled) {
    body.tools = availableTools ?? CORE_TOOL_DEFINITIONS;
    body.tool_choice = "auto";
  } else {
    // Sin tools = síntesis final → pedir JSON
    body.response_format = { type: "json_object" };
  }

  const response = await fetchWithTimeout(providerUrl(AINATIVE_BASE_URL, "/chat/completions"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, timeoutMs);

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;

  if (!response.ok) {
    const errMsg = String(data?.error || data?.detail || `HTTP ${response.status}`);
    const err = new Error(`AINative ${response.status}: ${errMsg.slice(0, 200)}`);
    // Rate limits: NO re-throw como RateLimitError — dejamos que callProvider
    // caiga al siguiente provider (OpenRouter). Pero si es 401/403, sí re-throw.
    if (response.status === 429 || errMsg.toLowerCase().includes("rate limit")) {
      err.name = "RateLimitError";
    }
    throw err;
  }

  const choices = asArray(data.choices);
  if (choices.length === 0) {
    throw new Error(`AINative: no choices in response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const firstChoice = asRecord(choices[0]);
  const msg = asRecord(firstChoice.message);
  const rawToolCalls = asArray(msg.tool_calls);
  const toolCalls = rawToolCalls.map((tc, index) => {
    const t = asRecord(tc);
    const fn = asRecord(t.function);
    return {
      id: asString(t.id) || `call_${Date.now()}_${index}`,
      type: asString(t.type) || "function",
      function: {
        name: cleanText(fn.name),
        arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
      },
    };
  });

  return {
    provider: "nvidia",  // Reusamos "nvidia" para que el pipeline lo procese igual
    model: asString(data.model) ?? model,
    message: {
      role: asString(msg.role) ?? "assistant",
      content: asString(msg.content),
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    } as ProviderMessage,
  };
}
