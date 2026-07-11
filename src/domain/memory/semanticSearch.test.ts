import { describe, it, expect } from "vitest";
import { selectRelevantMemoriesSemantic } from "./semanticSearch";
import type { MemoryFact } from "../types";

describe("selectRelevantMemoriesSemantic", () => {
  it("returns memories above the threshold", async () => {
    const memories: MemoryFact[] = [
      { id: "1", text: "tengo insomnio", status: "confirmed", embedding: [1, 0, 0] } as MemoryFact,
      { id: "2", text: "me gusta el té", status: "confirmed", embedding: [0, 1, 0] } as MemoryFact,
    ];
    const result = await selectRelevantMemoriesSemantic("no puedo dormir", memories, async () => [0.95, 0.1, 0]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty when embedFn throws", async () => {
    const result = await selectRelevantMemoriesSemantic("hola", [], async () => {
      throw new Error("no provider");
    });
    expect(result).toHaveLength(0);
  });
});
