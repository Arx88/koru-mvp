import type { MemoryFact } from "../types";
import { cosineSimilarity } from "./embeddings";

/**
 * Semantic memory search using cosine similarity over stored embeddings.
 * Falls back to an empty result if embeddings are unavailable.
 */
export async function selectRelevantMemoriesSemantic(
  input: string,
  memories: MemoryFact[],
  embedFn: (text: string) => Promise<number[]>,
  maxResults = 5,
): Promise<MemoryFact[]> {
  let queryVector: number[];
  try {
    queryVector = await embedFn(input);
  } catch {
    return [];
  }
  if (!queryVector?.length) return [];
  return memories
    .filter((m) => m.status !== "rejected" && m.embedding?.length)
    .map((m) => ({ memory: m, score: cosineSimilarity(queryVector, m.embedding ?? []) }))
    .filter((item) => item.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.memory);
}
