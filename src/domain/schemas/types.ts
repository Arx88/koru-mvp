export type SchemaId = "weather" | "sports_scores" | "money_summary" | "news_list" | "comparison_table" | "generic_list";

export interface SchemaMatcher<T = unknown> {
  id: SchemaId;
  match(data: unknown): { matched: boolean; confidence: number; data?: T };
}
