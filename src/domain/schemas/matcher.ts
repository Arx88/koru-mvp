import { WeatherMatcher } from "./weather";
import { SportsMatcher } from "./sports";
import { MoneyMatcher } from "./money";
import { NewsMatcher } from "./news";
import { ComparisonMatcher } from "./comparison";
import type { SchemaId, SchemaMatcher } from "./types";

const MATCHERS: SchemaMatcher<unknown>[] = [
  WeatherMatcher,
  SportsMatcher,
  MoneyMatcher,
  NewsMatcher,
  ComparisonMatcher,
];

export function matchSchema(data: unknown): { id: SchemaId; confidence: number; data: unknown } | null {
  const results = MATCHERS
    .map((m) => ({ ...m.match(data), id: m.id }))
    .filter((r) => r.matched)
    .sort((a, b) => b.confidence - a.confidence);
  return results[0] ? { id: results[0].id, confidence: results[0].confidence, data: results[0].data } : null;
}
