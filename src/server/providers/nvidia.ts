import type { ToolDefinition } from "../../tools/types";
import type { ProviderConfig, ChatMessage, ProviderResult, ProviderMessage, LlmProvider } from "./types";
import { fetchWithTimeout, providerUrl } from "./fetch";
import { asArray, asRecord, asString, cleanText } from "../json";
import { ALL_TOOL_DEFINITIONS, CORE_TOOL_DEFINITIONS, hasUsableAssistantMessage } from "../koruBackend";
import { isOllamaUrl } from "./ollama";

export async function callNvidia(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
  availableTools?: ToolDefinition[],
  modelOverride?: string,
): Promise<ProviderResult> {
  const useModel = modelOverride ?? config.nvidiaModel;
  const isOllama = isOllamaUrl(config.nvidiaBaseUrl);
  if (isOllama) {
    const body: Record<string, unknown> = {
      model: useModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content ?? "" })),
      ...(toolsEnabled ? {} : { format: "json" }),
      options: { temperature: 0.0, top_p: 0.95, num_predict: 8192 },
      stream: false,
    };
    if (toolsEnabled) {
      body.tools = availableTools ?? CORE_TOOL_DEFINITIONS;
    }
    const response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, timeoutMs);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.message) {
      throw new Error(`Ollama returned ${response.status}`);
    }
    const msg = asRecord(data.message);
    const rawToolCalls = asArray(msg.tool_calls);
    const toolCalls = rawToolCalls.map((tc, index) => {
      const t = asRecord(tc);
      const fn = asRecord(t.function);
      return {
        id: asString(t.id) || `call_${Date.now()}_${index}`,
        type: asString(t.type) || "function",
        function: {
          name: cleanText(fn.name),
          arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments),
        },
      };
    });
    return {
      provider: "nvidia",
      model: asString(data.model) ?? config.nvidiaModel,
      message: {
        role: asString(msg.role) ?? "assistant",
        content: asString(msg.content),
        tool_calls: toolCalls,
      } as ProviderMessage,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.nvidiaApiKey && config.nvidiaApiKey !== "dummy") {
    headers.Authorization = `Bearer ${config.nvidiaApiKey}`;
  }
  const body: Record<string, unknown> = {
    model: useModel,
    messages,
    ...(toolsEnabled ? { tools: availableTools ?? CORE_TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
    // Fase 4.2: JSON mode strict. Cuando no hay tools (síntesis final),
    // pedir response_format json_object para que Nemotron devuelva JSON válido.
    // Esto elimina el fallback first-call-invalid-json.
    ...(!toolsEnabled ? { response_format: { type: "json_object" } } : {}),
    temperature: 0.25,
    top_p: 0.95,
    max_tokens: 8192,
    stream: false,
    // 🔴 FIX P0: Nemotron Ultra tiene modo "thinking" activado por defecto que
    // emite CoT en `content` (texto en inglés tipo "The user is asking...").
    // Desactivamos explícitamente el thinking para que `content` contenga SOLO
    // la respuesta final al usuario. El campo `reasoning_content` (si la API
    // lo emite por separado) se captura en ProviderMessage para logging pero
    // nunca se muestra al usuario.
    chat_template_kwargs: { thinking: false },
  };
  const response = await fetchWithTimeout(providerUrl(config.nvidiaBaseUrl, "/v1/chat/completions"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    // 🔴 KORU 3.0 — Si es 429 (rate limit), tirar RateLimitError para que
    // callProvider caiga al siguiente provider (OpenRouter, BlueSminds, etc).
    // Antes tiraba Error genérico y callProvider no detectaba que era rate limit.
    const msg = `NVIDIA returned ${response.status}`;
    if (response.status === 429) {
      const err = new Error(msg);
      err.name = "RateLimitError";
      throw err;
    }
    throw new Error(msg);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "nvidia",
    model: asString(asRecord(data).model) ?? config.nvidiaModel,
    message: asRecord(choice.message) as ProviderMessage,
  };
}

export const nvidiaProvider: LlmProvider = {
  call: (config, messages, timeoutMs, toolsEnabled, availableTools) =>
    callNvidia(config, messages, timeoutMs, toolsEnabled, availableTools),
};
