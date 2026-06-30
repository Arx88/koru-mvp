import type { ProviderConfig, ChatMessage, ProviderResult, ProviderMessage, LlmProvider } from "./types";
import { fetchWithTimeout } from "./fetch";
import { asArray, asRecord, asString } from "../json";
import { logger, dump } from "../logger";
import { ALL_TOOL_DEFINITIONS, hasUsableAssistantMessage } from "../koruBackend";

export async function callMinimax(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  toolsEnabled = true,
): Promise<ProviderResult> {
  const accessToken = config.minimaxAccessToken;
  if (!accessToken) throw new Error("MiniMax access token not configured");
  logger.info("callMinimax", "Requesting MiniMax", { model: "MiniMax-M2.7", msgCount: messages.length, toolsEnabled });
  const minimaxMessages = messages.map((m) => {
    if (m.role === "tool") {
      let content = m.content ?? "";
      try {
        const data = JSON.parse(content);
        if (data.type === "search" && Array.isArray(data.sources)) {
          const formatted = data.sources
            .map((s: any, i: number) => {
              const text = s.content || s.snippet || "";
              return `${i + 1}. ${s.title} (${s.domain})\n${text}`;
            })
            .filter((s: string) => s.trim().length > 3)
            .join("\n\n");
          content = formatted || `Búsqueda: ${data.title || ""}`;
        } else if (data.type === "weather") {
          content = `Clima - Ciudad: ${data.city || "?"}, Ahora: ${data.now || "?"}, Rango: ${data.range || "?"}, Lluvia: ${data.rain || "?"}, Viento: ${data.wind || "?"}`;
        }
      } catch {
        // mantener contenido original si no es JSON
      }
      return { role: "user" as const, content: `Resultado de herramienta (${m.tool_call_id ?? "unknown"}):\n${content}` };
    }
    if (m.role === "assistant" && m.tool_calls) {
      return {
        role: "assistant" as const,
        content: m.content ?? `Voy a usar herramientas: ${m.tool_calls.map((t) => t.function.name).join(", ")}`,
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });
  const response = await fetchWithTimeout("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: minimaxMessages,
      ...(toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
      temperature: 0.25,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
      reasoning_split: true,
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  const assistantMsg = asRecord(choice.message);
  const content = asString(assistantMsg.content) ?? "";
  const toolCalls = asArray(assistantMsg.tool_calls);
  const reasoningContent = asString(assistantMsg.reasoning_content) ?? "";
  logger.info("callMinimax", `Response HTTP ${response.status}`, { contentPreview: content.slice(0, 500), reasoningPreview: reasoningContent.slice(0, 200), hasTools: toolCalls.length > 0, usage: dump(data.usage, 300) });
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    logger.error("callMinimax", `MiniMax returned ${response.status}`, { body: dump(data, 1000) });
    throw new Error(`MiniMax returned ${response.status}`);
  }
  return {
    provider: "minimax",
    model: asString(asRecord(data).model) ?? "MiniMax-M2.7",
    message: assistantMsg as ProviderMessage,
  };
}

export const minimaxProvider: LlmProvider = {
  call: (config, messages, timeoutMs, toolsEnabled) => callMinimax(config, messages, timeoutMs, toolsEnabled),
};
