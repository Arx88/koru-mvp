import type { RuntimeSettings } from "../types";

export type EmbedFn = (text: string) => Promise<number[]>;

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    aNorm += a[index] * a[index];
    bNorm += b[index] * b[index];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

/**
 * Create an embedding function from runtime settings.
 * Throws if no provider is available so callers can fall back to keyword search.
 */
export function createEmbedFn(_runtime: RuntimeSettings): EmbedFn {
  // The runtime may configure a local model (Ollama) or a remote provider
  // (HuggingFace FreeLLM). For now we return a stub that throws; callers
  // must handle the absence of embeddings gracefully.
  return async () => {
    throw new Error("No embedding provider configured for this runtime.");
  };
}
