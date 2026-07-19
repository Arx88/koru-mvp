import type { ToolDefinition } from "../../tools/types";
import { asArray } from "../json";

export type ProviderConfig = {
  nvidiaApiKey?: string;
  nvidiaBaseUrl: string;
  nvidiaModel: string;
  /** Modelo rápido para inputs triviales (saludos, cortesía). */
  nvidiaFastModel?: string;
  /** Modelo mediano para inputs normales (clima, gasto, lista). */
  nvidiaMediumModel?: string;
  openRouterKeys: string[];
  openRouterModels: string[];
  minimaxAccessToken?: string;
  /** URL de Ollama para embeddings del Semantic Router (nomic-embed-text). */
  ollamaEmbedBaseUrl?: string;
  /** AI Native Studio API key — fallback cuando NVIDIA falla.
   *  Modelos: kimi-k2.6 (primario), deepseek-v4-flash (secundario). */
  ainativeApiKey?: string;
};

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
};

export type ProviderToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ProviderMessage = {
  content?: string | null;
  tool_calls?: ProviderToolCall[];
  /** Nemotron Ultra / DeepSeek-R1 / Qwen3 emiten razonamiento interno acá.
   *  Lo capturamos solo para logging/descarte — NUNCA debe llegar al usuario. */
  reasoning_content?: string | null;
};

export type ProviderResult = {
  provider: "nvidia" | "openrouter" | "minimax";
  model?: string;
  message: ProviderMessage;
};

export interface LlmProvider {
  call(
    config: ProviderConfig,
    messages: ChatMessage[],
    timeoutMs: number,
    toolsEnabled: boolean,
    availableTools?: ToolDefinition[],
  ): Promise<ProviderResult>;
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export function isRateLimitError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("free-models-per-day")
  );
}

export function providerResultIsValid(result: ProviderResult): boolean {
  const content = result.message?.content ?? "";
  const trimmed = content.trim();
  const hasTools = asArray(result.message?.tool_calls).length > 0;
  const hasContent = trimmed.length > 0;
  return hasContent || hasTools;
}
