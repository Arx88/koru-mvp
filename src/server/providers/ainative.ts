import type { ToolDefinition } from "../../tools/types";
import type { ProviderConfig, ChatMessage, ProviderResult, ProviderMessage } from "./types";
import { fetchWithTimeout, providerUrl } from "./fetch";
import { asArray, asRecord, asString, cleanText } from "../json";
import { CORE_TOOL_DEFINITIONS } from "../koruBackend";

const AINATIVE_BASE_URL = "https://api.ainative.studio/v1";

export async function callAINative(
  config: ProviderConfig & { ainativeApiKey?: string },
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
  availableTools?: ToolDefinition[],
): Promise<ProviderResult> {
  const apiKey = config.ainativeApiKey;
  if (!apiKey) throw new Error("AINATIVE_API_KEY not configured");
  const models = ["kimi-k2.6", "deepseek-v4-flash"];
  let lastError: Error | null = null;
  for (const model of models) {
    try {
      return await callAINativeOnce(config, messages, timeoutMs, model, toolsEnabled, availableTools);
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("forbidden")) throw err;
      console.warn(`[ainative] ${model} failed: ${err?.message}. Trying next...`);
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
  const body: Record<string, unknown> = { model, messages, temperature: 0.7, max_tokens: 8192, stream: false };
  if (toolsEnabled) { body.tools = availableTools ?? CORE_TOOL_DEFINITIONS; body.tool_choice = "auto"; }
  else { body.response_format = { type: "json_object" }; }
  const response = await fetchWithTimeout(providerUrl(AINATIVE_BASE_URL, "/chat/completions"), {
    method: "POST", headers, body: JSON.stringify(body),
  }, timeoutMs);
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const errMsg = String(data?.error || data?.detail || `HTTP ${response.status}`);
    const err = new Error(`AINative ${response.status}: ${errMsg.slice(0, 200)}`);
    if (response.status === 429 || errMsg.toLowerCase().includes("rate limit")) err.name = "RateLimitError";
    throw err;
  }
  const choices = asArray(data.choices);
  if (choices.length === 0) throw new Error(`AINative: no choices`);
  const firstChoice = asRecord(choices[0]);
  const msg = asRecord(firstChoice.message);
  const rawToolCalls = asArray(msg.tool_calls);
  const toolCalls = rawToolCalls.map((tc, index) => {
    const t = asRecord(tc);
    const fn = asRecord(t.function);
    return { id: asString(t.id) || `call_${Date.now()}_${index}`, type: asString(t.type) || "function",
      function: { name: cleanText(fn.name), arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}) } };
  });
  return { provider: "nvidia", model: asString(data.model) ?? model,
    message: { role: asString(msg.role) ?? "assistant", content: asString(msg.content), tool_calls: toolCalls.length > 0 ? toolCalls : undefined } as ProviderMessage };
}
