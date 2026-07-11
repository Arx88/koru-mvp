import { z } from "zod";
import type { SchemaMatcher } from "./types";

export const MoneySummarySchema = z.object({
  type: z.enum(["money_summary", "expense_summary"]),
  total: z.number().optional(),
  currency: z.string().optional(),
  recommendation: z.string().optional(),
});

export type MoneySummaryData = z.infer<typeof MoneySummarySchema>;

export const MoneyMatcher: SchemaMatcher<MoneySummaryData> = {
  id: "money_summary",
  match(data) {
    const result = MoneySummarySchema.safeParse(data);
    return result.success
      ? { matched: true, confidence: 0.95, data: result.data }
      : { matched: false, confidence: 0 };
  },
};
