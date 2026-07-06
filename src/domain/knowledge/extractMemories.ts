import type { MemoryFact, MemorySensitivity } from "../types";
import { classifyMemoryKind, confidenceFor, includesAny, isPureAction, isSensitive, sentenceCase, splitIdeas } from "./extractUtils";

export type MemoryCandidate = Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">;

export function extractMemoryCandidatesFromText(input: string): MemoryCandidate[] {
  const ideas = splitIdeas(input);
  return ideas
    .filter((idea) => {
      const lower = foldAccents(idea);
      if (lower.length < 12) return false;
      if (isPureAction(idea)) return false;
      if (
        hasTaskCue(idea) &&
        !includesAny(lower, ["siempre", "prefiero", "cliente", "stock", "proveedor", "me preocupa"])
      ) {
        return false;
      }
      return (
        includesAny(lower, [
          "soy",
          "trabajo",
          "tengo",
          "quiero",
          "prefiero",
          "me preocupa",
          "me cuesta",
          "mi rutina",
          "cliente",
          "stock",
          "ana",
          "mama",
          "no quiero",
        ]) || input.length > 120
      );
    })
    .slice(0, 6)
    .map((idea) => {
      const sensitivity: MemorySensitivity = isSensitive(idea) ? "sensitive" : "normal";
      return {
        kind: classifyMemoryKind(idea),
        text: sentenceCase(idea),
        confidence: confidenceFor(idea, sensitivity),
        sensitivity,
        status: "candidate" as const,
        rootQuote: sentenceCase(idea),
        useForSuggestions: sensitivity === "normal",
      };
    });
}

function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function hasTaskCue(text: string): boolean {
  return /\b(tengo que|debo|necesito|prometi|recordar|recordame|recuerdame|acordame|comprar|mandar|enviar|llamar|escribir|preparar|buscar|busca|buscame|investiga|investigar|comparar|compara|comparame|dame|decime|dime)\b/i.test(
    foldAccents(text),
  );
}
