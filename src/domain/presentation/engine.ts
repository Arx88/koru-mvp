import { matchSchema } from "../schemas/matcher";
import { VISUALIZER_CATALOG } from "./catalog";
import type { UiBlock } from "../types";

export interface PresentationInput {
  hint?: { kind: string; confidence: number; enrichment?: Record<string, unknown> };
  toolResults: Array<{ data?: Record<string, unknown>; summary?: string; sources?: unknown[] }>;
}

export interface PresentationDecision {
  visualizer: string;
  block: UiBlock;
  reason: "schema_match" | "hint_validated" | "fallback_text";
  degraded: boolean;
}

export function decidePresentation(input: PresentationInput): PresentationDecision | null {
  for (const result of input.toolResults) {
    const data = (result.data ?? (result as Record<string, unknown>)) as unknown;
    const schemaMatch = matchSchema(data);
    if (!schemaMatch) continue;

    const visualizer = VISUALIZER_CATALOG[schemaMatch.id];
    if (!visualizer) continue;

    const hintMatches = input.hint?.kind === schemaMatch.id;
    const degraded = !hintMatches;
    const block = visualizer.render(schemaMatch.data, hintMatches ? input.hint?.enrichment : undefined);

    return {
      visualizer: schemaMatch.id,
      block,
      reason: hintMatches ? "hint_validated" : "schema_match",
      degraded,
    };
  }

  return null;
}
