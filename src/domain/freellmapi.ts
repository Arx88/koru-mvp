import type { BrainProvider, RuntimeSettings } from "./types";

export type BrainProviderStatus = {
  mode: "local" | "freellmapi-ready" | "open-model-ready";
  label: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionResult = {
  content: string;
  model?: string;
  routedVia?: string | null;
};

type ResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: Record<string, unknown>;
    };

export type EmbeddingResult = {
  embedding: number[];
  model?: string;
  provider?: string;
};

export class FreeLlmApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FreeLlmApiError";
    this.status = status;
  }
}

function envString(key: string): string {
  const value = import.meta.env[key] as string | undefined;
  return value?.trim() ?? "";
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function createDefaultRuntimeSettings(): RuntimeSettings {
  const baseUrl = envString("VITE_FREELLMAPI_BASE_URL") || "http://127.0.0.1:3001";
  const apiKey = envString("VITE_FREELLMAPI_API_KEY");
  const openModelBaseUrl = envString("VITE_OPEN_MODEL_BASE_URL") || "/ollama/v1";
  const openModelApiKey = envString("VITE_OPEN_MODEL_API_KEY") || "ollama";
  return {
    freeLlmApiBaseUrl: baseUrl,
    freeLlmApiKey: apiKey,
    freeLlmApiModel: envString("VITE_FREELLMAPI_MODEL") || "auto",
    freeLlmApiEnabled: Boolean(apiKey),
    embeddingsEnabled: Boolean(apiKey),
    openModelBaseUrl,
    openModelApiKey,
    openModelModel: envString("VITE_OPEN_MODEL_MODEL") || "llama3.1",
    openModelEnabled: Boolean(envString("VITE_OPEN_MODEL_ENABLED")),
  };
}

export function resolveProviderStatus(runtime?: RuntimeSettings): BrainProviderStatus {
  const settings = runtime ?? createDefaultRuntimeSettings();
  if (settings.openModelEnabled && settings.openModelBaseUrl.trim() && settings.openModelModel.trim()) {
    return {
      mode: "open-model-ready",
      label: `Modelo abierto listo (${settings.openModelModel}).`,
    };
  }
  if (!settings.freeLlmApiEnabled || !settings.freeLlmApiKey.trim()) {
    return {
      mode: "local",
      label: "Modo local heuristico activo. Conecta Ollama o FreeLLMAPI para razonar mejor.",
    };
  }
  return {
    mode: "freellmapi-ready",
    label: `FreeLLMAPI listo (${settings.freeLlmApiModel || "auto"}).`,
  };
}

async function postJson<T>(url: string, apiKey: string, body: unknown, timeoutMs: number): Promise<{ data: T; response: Response }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!response.ok) {
      throw new FreeLlmApiError(data.error?.message ?? `FreeLLMAPI respondió ${response.status}`, response.status);
    }
    return { data, response };
  } catch (error) {
    if (error instanceof FreeLlmApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FreeLlmApiError("FreeLLMAPI tardó demasiado en responder.");
    }
    throw new FreeLlmApiError(error instanceof Error ? error.message : "No pude contactar FreeLLMAPI.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function isOpenRouter(baseUrl: string): boolean {
  return /(^|\/)openrouter(?:\/|$)|openrouter\.ai/i.test(baseUrl);
}

export async function runFreeLlmChat(
  runtime: RuntimeSettings,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<ChatCompletionResult> {
  if (!runtime.freeLlmApiEnabled || !runtime.freeLlmApiKey.trim()) {
    throw new FreeLlmApiError("FreeLLMAPI no está configurado.");
  }
  const baseUrl = normalizeBaseUrl(runtime.freeLlmApiBaseUrl);
  const { data, response } = await postJson<{
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  }>(
    `${baseUrl}/v1/chat/completions`,
    runtime.freeLlmApiKey,
    {
      model: runtime.freeLlmApiModel || "auto",
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 1200,
    },
    24_000,
  );
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new FreeLlmApiError("FreeLLMAPI devolvió una respuesta vacía.");
  return {
    content,
    model: data.model,
    routedVia: response.headers.get("x-routed-via"),
  };
}

export async function runOpenModelChat(
  runtime: RuntimeSettings,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; responseFormat?: ResponseFormat },
): Promise<ChatCompletionResult> {
  if (!runtime.openModelEnabled || !runtime.openModelBaseUrl.trim() || !runtime.openModelModel.trim()) {
    throw new FreeLlmApiError("El modelo abierto no esta configurado.");
  }
  const baseUrl = normalizeBaseUrl(runtime.openModelBaseUrl);
  const openRouter = isOpenRouter(baseUrl);
  const body: Record<string, unknown> = {
    model: runtime.openModelModel,
    messages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 1200,
  };
  if (options?.responseFormat || openRouter) {
    body.response_format = options?.responseFormat ?? { type: "json_object" };
  }
  if (openRouter) {
    body.plugins = [{ id: "response-healing" }];
    body.reasoning = { exclude: true };
  }
  const { data } = await postJson<{
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  }>(
    `${baseUrl}/chat/completions`,
    runtime.openModelApiKey.trim() || "ollama",
    body,
    openRouter ? 18_000 : 45_000,
  );
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new FreeLlmApiError("El modelo abierto devolvio una respuesta vacia.");
  return {
    content,
    model: data.model ?? runtime.openModelModel,
  };
}

export async function runFreeLlmEmbedding(runtime: RuntimeSettings, input: string): Promise<EmbeddingResult> {
  if (!runtime.freeLlmApiEnabled || !runtime.embeddingsEnabled || !runtime.freeLlmApiKey.trim()) {
    throw new FreeLlmApiError("Embeddings de FreeLLMAPI no están configurados.");
  }
  const baseUrl = normalizeBaseUrl(runtime.freeLlmApiBaseUrl);
  const { data } = await postJson<{
    model?: string;
    provider?: string;
    data?: Array<{ embedding?: number[] }>;
  }>(
    `${baseUrl}/v1/embeddings`,
    runtime.freeLlmApiKey,
    {
      model: "auto",
      input,
    },
    18_000,
  );
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) throw new FreeLlmApiError("FreeLLMAPI no devolvió embedding.");
  return { embedding, model: data.model, provider: data.provider };
}

export async function testFreeLlmConnection(runtime: RuntimeSettings): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: "Responde solo con OK." },
    { role: "user", content: "ping" },
  ];
  const result =
    runtime.openModelEnabled && runtime.openModelBaseUrl.trim()
      ? await runOpenModelChat(runtime, messages, { temperature: 0, maxTokens: 12 })
      : await runFreeLlmChat({ ...runtime, freeLlmApiEnabled: true }, messages, { temperature: 0, maxTokens: 12 });
  return result.model ?? result.routedVia ?? result.content;
}

export function preferredBrainProvider(runtime: RuntimeSettings): BrainProvider {
  if (runtime.openModelEnabled && runtime.openModelBaseUrl.trim() && runtime.openModelModel.trim()) {
    return "open-model";
  }
  if (runtime.freeLlmApiEnabled && runtime.freeLlmApiKey.trim()) {
    return "freellmapi";
  }
  return "local";
}
