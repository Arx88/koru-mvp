import { z } from "zod";
import type { SchemaMatcher } from "./types";

export const ComparisonTableSchema = z.object({
  type: z.enum(["comparison", "shopping"]),
  items: z.array(z.object({ title: z.string() })).min(1),
  recommendation: z.string().optional(),
});

export type ComparisonTableData = z.infer<typeof ComparisonTableSchema>;

export const ComparisonMatcher: SchemaMatcher<ComparisonTableData> = {
  id: "comparison_table",
  match(data) {
    const result = ComparisonTableSchema.safeParse(data);
    return result.success
      ? { matched: true, confidence: 0.9, data: result.data }
      : { matched: false, confidence: 0 };
  },
};
