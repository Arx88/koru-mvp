import type { ToolDefinition } from "../../tools/types";
import { asArray, asRecord, asString } from "../json";

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

/**
 * Por qué falló un status HTTP, desde el punto de vista de "¿sirve reintentar?".
 *
 *  - `auth`      → 401/403. La credencial es inválida o no tiene permiso.
 *  - `model`     → 404/410. El modelo no existe o fue retirado por el proveedor.
 *  - `transient` → 429 y 5xx. Saturación o error pasajero: acá SÍ ayuda reintentar
 *                  o rotar de proveedor.
 *  - `request`   → 400/422 y demás. El pedido está mal armado.
 *
 * Antes, TODO lo que no fuera 429 salía como `Error` genérico, así que 403 y 410
 * (que no se arreglan esperando) se trataban igual que un timeout: "falló, paso
 * al siguiente" y sin causa legible en el log ni en la respuesta.
 */
export type ProviderErrorKind = "auth" | "model" | "transient" | "request";

export function classifyProviderStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404 || status === 410) return "model";
  if (status === 429 || status >= 500) return "transient";
  return "request";
}

/**
 * Error de configuración del proveedor: reintentar, esperar o rotar de proveedor
 * NO lo arregla. Existe para que la causa se distinga de un tropiezo transitorio
 * y llegue legible hasta el usuario.
 */
export class ProviderConfigError extends Error {
  readonly status: number;
  readonly kind: "auth" | "model" | "request";

  constructor(provider: string, status: number, detail?: string) {
    const classified = classifyProviderStatus(status);
    const kind = classified === "transient" ? "request" : classified;
    super(`${provider} rechazó la configuración con HTTP ${status} (${kind})${detail ? `: ${detail}` : ""}`);
    this.name = "ProviderConfigError";
    this.status = status;
    this.kind = kind;
  }
}

export function isProviderConfigError(error: unknown): error is ProviderConfigError {
  if (error instanceof ProviderConfigError) return true;
  return error instanceof Error && error.name === "ProviderConfigError";
}

/**
 * Saca el mensaje legible que devolvió la API. NVIDIA, OpenRouter y BlueSminds
 * usan formas distintas (`error.message`, `error.detail`, `detail`, `message`),
 * así que probamos todas antes de rendirnos con el status pelado.
 */
export function providerErrorDetail(data: unknown): string | undefined {
  const body = asRecord(data);
  const nested = asRecord(body.error);
  const candidates = [nested.message, nested.detail, body.message, body.detail, body.error];
  for (const candidate of candidates) {
    const text = asString(candidate);
    if (text) return text;
  }
  return undefined;
}

/**
 * Resume por qué falló cada candidato cuando `Promise.any` los rechaza a todos.
 * Sin esto, Node tira `AggregateError: All promises were rejected` y las N causas
 * reales (403 de la key, 410 del modelo, 429 de cuota) se pierden. Ese literal
 * llegó a mostrarse como respuesta del asistente, y por eso estaba en la
 * blacklist de `providerResultIsValid`: se parchó el síntoma, no la causa.
 */
export function describeProviderFailures(errors: unknown[]): {
  message: string;
  allRateLimited: boolean;
  configErrors: ProviderConfigError[];
} {
  const parts = errors.map((error) => {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  });
  return {
    message: parts.length ? parts.join(" | ") : "sin causas reportadas",
    allRateLimited: errors.length > 0 && errors.every((error) => isRateLimitError(error)),
    configErrors: errors.filter(isProviderConfigError),
  };
}

export function providerResultIsValid(result: ProviderResult): boolean {
  const content = result.message?.content ?? "";
  const trimmed = content.trim();
  const hasTools = asArray(result.message?.tool_calls).length > 0;
  const hasContent = trimmed.length > 0;
  if (!hasContent && !hasTools) return false;
  // Un texto de error no es una respuesta: si el modelo lo devolvió como
  // contenido, hay que forzar el fallback en vez de mostrárselo al usuario.
  // Misma lista que la copia de koruBackend.ts para que no divergan.
  const lowerContent = trimmed.toLowerCase();
  const errorIndicators = [
    "all promises were rejected",
    "no pude procesar",
    "el modelo no respondió a tiempo",
    "openrouter fallback is not configured",
    "service unavailable",
    "internal server error",
  ];
  if (errorIndicators.some((indicator) => lowerContent.includes(indicator))) return false;
  return true;
}
