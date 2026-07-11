/**
 * Ollama helpers used by the provider fallback logic.
 *
 * Ollama itself is handled by the NVIDIA provider: an Ollama base URL is
 * detected and routed to Ollama's OpenAI-compatible `/api/chat` endpoint.
 */
export function isOllamaUrl(baseUrl: string): boolean {
  return baseUrl.includes(":11434") || baseUrl.includes("ollama");
}

export function inferProviderFromModel(model: string | undefined): "minimax" | "nvidia" | "openrouter" | undefined {
  if (!model) return undefined;
  if (model === "MiniMax-M2.7") return "minimax";
  if (model.startsWith("hf.co/")) return "nvidia"; // HuggingFace models served by Ollama
  if (!model.includes("/")) return "nvidia"; // Ollama tags without namespace, e.g. qwen3.6:27b, llama3.1:8b
  if (model.startsWith("nvidia/") && !model.includes(":")) return "nvidia"; // NVIDIA API models
  if (model.includes("/") && model.includes(":")) return "openrouter"; // OpenRouter free models (e.g. openai/gpt-oss-120b:free)
  return undefined;
}
