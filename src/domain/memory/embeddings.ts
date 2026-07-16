import type { MemoryFact, RuntimeSettings } from "../types";
import { createDefaultRuntimeSettings, runFreeLlmEmbedding } from "../freellmapi";

export type EmbedFn = (text: string) => Promise<number[]>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

/**
 * Default runtime settings for the embedding pipeline. Reads from Vite env
 * vars (VITE_FREELLMAPI_*) so the same client config drives chat + embeddings.
 * Cheap to call (env reads + a one-shot console warning); safe to invoke per
 * request.
 */
function defaultRuntime(): RuntimeSettings {
  return createDefaultRuntimeSettings();
}

/**
 * 1. Generates a vector embedding for a text string using runFreeLlmEmbedding.
 * Throws if the embedding provider is unavailable — callers that want
 * best-effort semantics should wrap this in try/catch (see embedMemory /
 * semanticSearch).
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await runFreeLlmEmbedding(defaultRuntime(), text);
  return result.embedding;
}

/**
 * 2. Generates an embedding for a memory and returns an updated copy with
 * `embedding` and `embeddingModel` set. Best-effort: on failure, logs the
 * error and returns the memory unchanged (never throws).
 */
export async function embedMemory(memory: MemoryFact): Promise<MemoryFact> {
  try {
    const result = await runFreeLlmEmbedding(defaultRuntime(), memory.text);
    return {
      ...memory,
      embedding: result.embedding,
      embeddingModel: result.model ?? "freellmapi",
    };
  } catch (error) {
    console.error(
      `[Koru] embedMemory: no se pudo embeber la memoria ${memory.id}:`,
      error instanceof Error ? error.message : error,
    );
    return memory;
  }
}

/**
 * 3. Standard cosine similarity between two vectors. Returns a value in
 * [-1, 1] where 1 = identical, 0 = orthogonal. Supports vectors of different
 * dimensionality by using the shorter length (no NaN).
 */
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
 * 4. Embeds the query, computes cosine similarity against all memories that
 * have embeddings, and returns the top K results sorted by similarity
 * descending. Returns an empty array if the query can't be embedded (logged,
 * not thrown) or if no memories have embeddings.
 */
export async function semanticSearch(
  query: string,
  memories: MemoryFact[],
  topK: number,
): Promise<Array<{ memory: MemoryFact; similarity: number }>> {
  let queryVector: number[];
  try {
    queryVector = await embedText(query);
  } catch (error) {
    console.error(
      "[Koru] semanticSearch: no se pudo embeber el query:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
  if (!queryVector?.length) return [];

  const limit = Math.max(0, topK);
  return memories
    .filter((m) => Array.isArray(m.embedding) && m.embedding.length > 0)
    .map((memory) => ({
      memory,
      similarity: cosineSimilarity(queryVector, memory.embedding ?? []),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * 5. Embeds all memories that don't have embeddings yet. Processes pending
 * memories with a concurrency limit of 3 to avoid FreeLLMAPI rate limits.
 * Memories whose embedding fails are returned unchanged (best-effort via
 * embedMemory). Memories that already have embeddings are passed through.
 */
export async function batchEmbed(memories: MemoryFact[]): Promise<MemoryFact[]> {
  const CONCURRENCY = 3;
  const result: MemoryFact[] = memories.slice();

  const pendingIndexes: number[] = [];
  memories.forEach((memory, index) => {
    if (!Array.isArray(memory.embedding) || memory.embedding.length === 0) {
      pendingIndexes.push(index);
    }
  });
  if (pendingIndexes.length === 0) return result;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < pendingIndexes.length) {
      const current = pendingIndexes[cursor];
      cursor += 1;
      result[current] = await embedMemory(result[current]);
    }
  }

  const workerCount = Math.min(CONCURRENCY, pendingIndexes.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return result;
}

/**
 * 6. Confidence scoring for a memory:
 *   - Base: 0.8 if explicit (has a non-empty rootQuote), 0.5 if inferred.
 *   - Decay: -0.02 per month elapsed since createdAt.
 *   - Refresh: +0.1 if updatedAt is within the last 7 days.
 *   - Clamped to [0.1, 1.0].
 */
export function computeConfidence(memory: MemoryFact): number {
  const base =
    typeof memory.rootQuote === "string" && memory.rootQuote.trim().length > 0 ? 0.8 : 0.5;

  const now = Date.now();

  let monthsElapsed = 0;
  const createdAtMs = Date.parse(memory.createdAt);
  if (!Number.isNaN(createdAtMs)) {
    monthsElapsed = Math.max(0, (now - createdAtMs) / MS_PER_MONTH);
  }

  let confidence = base - 0.02 * monthsElapsed;

  if (typeof memory.updatedAt === "string" && memory.updatedAt.trim().length > 0) {
    const updatedAtMs = Date.parse(memory.updatedAt);
    if (!Number.isNaN(updatedAtMs)) {
      const daysSinceUpdate = Math.max(0, (now - updatedAtMs) / MS_PER_DAY);
      if (daysSinceUpdate < 7) {
        confidence += 0.1;
      }
    }
  }

  return Math.min(1.0, Math.max(0.1, confidence));
}

/**
 * 7. Returns true if a memory should be archived: computed confidence below
 * 0.3 AND age greater than 24 months since createdAt. Returns false if
 * createdAt is unparseable.
 */
export function shouldArchive(memory: MemoryFact): boolean {
  const confidence = computeConfidence(memory);
  const createdAtMs = Date.parse(memory.createdAt);
  if (Number.isNaN(createdAtMs)) return false;
  const monthsElapsed = (Date.now() - createdAtMs) / MS_PER_MONTH;
  return confidence < 0.3 && monthsElapsed > 24;
}

/**
 * Create an embedding function from runtime settings.
 * Throws if no provider is available so callers can fall back to keyword search.
 *
 * Kept for backwards compatibility with existing callers that build their own
 * embed fn. The new pipeline (embedText / embedMemory / semanticSearch) reads
 * runtime settings directly from Vite env vars via defaultRuntime() instead.
 */
export function createEmbedFn(_runtime: RuntimeSettings): EmbedFn {
  // The runtime may configure a local model (Ollama) or a remote provider
  // (HuggingFace FreeLLM). For now we return a stub that throws; callers
  // must handle the absence of embeddings gracefully.
  return async () => {
    throw new Error("No embedding provider configured for this runtime.");
  };
}
