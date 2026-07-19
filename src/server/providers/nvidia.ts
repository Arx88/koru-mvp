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
  // 🔴 KORU 3.0 — Retry con backoff para 429 (rate limit).
  // NVIDIA free tier tiene rate limits agresivos. Cuando devuelve 429,
  // esperar 2s y reintentar (hasta 2 veces). Solo después de 3 intentos
  // fallidos, tirar RateLimitError para que callProvider caiga al siguiente.
  const maxRetries = 2;
  const baseDelay = 2000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callNvidiaOnce(config, messages, timeoutMs, toolsEnabled, availableTools, modelOverride);
    } catch (err: any) {
      const isRateLimit = err?.name === "RateLimitError" || /429|rate limit/i.test(err?.message || "");
      if (!isRateLimit || attempt === maxRetries) throw err;
      // Esperar antes de reintentar (backoff exponencial: 2s, 4s)
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("NVIDIA retry exhausted");
}

async function callNvidiaOnce(
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
    // 🔴 KORU 3.0 — thinking: false estaba INTERFIRIENDO con tool_calls nativas.
    // Cuando thinking está desactivado, Nemotron a veces "piensa" en el content
    // en vez de emitir tool_calls. Lo dejamos activado (default del modelo)
    // para que use tool_calls nativas de forma consistente.
    // El reasoning_content (si la API lo emite por separado) no se muestra al usuario.
    // chat_template_kwargs: { thinking: false },  // 🔴 DESACTIVADO - ver KORU 3.0
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
