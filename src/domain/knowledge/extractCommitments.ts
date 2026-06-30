import { dueAtFromText, recurrenceFromText } from "../time";
import type { Commitment } from "../types";
import { cleanupShoppingTaskTitle, hasShoppingIntent, hasTaskCue } from "../intent";
import { dueHintFromText, sentenceCase, splitIdeas } from "./extractUtils";

export function extractCommitmentsFromText(input: string): Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] {
  const ideas = splitIdeas(input);
  return ideas
    .filter((idea) => hasTaskCue(idea))
    .slice(0, 5)
    .map((idea) => ({
      title: sentenceCase(hasShoppingIntent(idea) ? cleanupShoppingTaskTitle(idea) : idea),
      dueHint: dueHintFromText(idea) ?? "sin fecha",
      dueAt: dueAtFromText(idea),
      recurrence: recurrenceFromText(idea),
      status: "open" as const,
    }));
}
