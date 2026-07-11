/**
 * Acceso a Ollama local para embeddings y chat.
 * Reutiliza el patrón del SemanticRouter del motor (buildEmbedFn).
 * NO toca el singleton del router; solo expone funciones de utilidad
 * para tools que necesitan memoria semántica / resúmenes / NER.
 */

const OLLAMA_BASE = "http://127.0.0.1:11434";
const EMBED_MODEL = "nomic-embed-text";
const CHAT_MODEL = "koru-qwen-32k";

export type EmbedFn = (text: string) => Promise<number[]>;

/** Crea una función de embedding contra Ollama local. */
export function makeEmbedFn(baseUrl: string = OLLAMA_BASE, model: string = EMBED_MODEL): EmbedFn {
  return async (text: string): Promise<number[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding || data.embedding.length === 0) throw new Error("Ollama no devolvió embedding");
      return data.embedding;
    } finally {
      clearTimeout(timeout);
    }
  };
}

/** Similitud coseno entre dos vectores. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Llama a un modelo de chat local (Ollama) y devuelve el contenido. */
export async function localChat(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<{ content: string; ok: boolean; error?: string }> {
  const { temperature = 0.2, maxTokens = 800, model = CHAT_MODEL } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        options: { temperature, num_predict: maxTokens },
        stream: false,
      }),
      signal: controller.signal,
    });
    const data = (await res.json()) as { message?: { content?: string }; error?: string };
    if (!res.ok) return { content: "", ok: false, error: data.error ?? `Ollama HTTP ${res.status}` };
    return { content: data.message?.content ?? "", ok: true };
  } catch (err) {
    return { content: "", ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

/** Comprueba si Ollama está disponible (sin fallar si no lo está). */
export async function isOllamaAvailable(baseUrl: string = OLLAMA_BASE): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
