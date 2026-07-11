import { describe, it, expect } from "vitest";
import { extractMemoryCandidatesFromText } from "./extractMemories";

describe("extractMemoryCandidatesFromText", () => {
  it("extracts durable preference memories", () => {
    const memories = extractMemoryCandidatesFromText("prefiero no tener reuniones por la mañana");
    expect(memories.length).toBeGreaterThan(0);
  });

  it("does not extract pure actions as memories", () => {
    const memories = extractMemoryCandidatesFromText("tengo que comprar leche");
    expect(memories).toHaveLength(0);
  });

  it("assigns confidence to candidates", () => {
    const memories = extractMemoryCandidatesFromText(
      "siempre me preocupa mucho la ansiedad antes de las reuniones importantes",
    );
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].confidence).toBeGreaterThan(0);
  });
});
