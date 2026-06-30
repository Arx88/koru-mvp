import { z } from "zod";
import type { SchemaMatcher } from "./types";

export const NewsListSchema = z.object({
  type: z.enum(["search", "news_list"]),
  mode: z.enum(["news", "world", "research"]).optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).min(1),
  title: z.string().optional(),
});

export type NewsListData = z.infer<typeof NewsListSchema>;

export const NewsMatcher: SchemaMatcher<NewsListData> = {
  id: "news_list",
  match(data) {
    const result = NewsListSchema.safeParse(data);
    return result.success
      ? { matched: true, confidence: 0.85, data: result.data }
      : { matched: false, confidence: 0 };
  },
};
