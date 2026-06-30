import { z } from "zod";
import type { SchemaMatcher } from "./types";

export const SportsScoreSchema = z.object({
  type: z.enum(["live_match", "match_timeline"]),
  homeTeam: z.object({ name: z.string(), score: z.number() }).optional(),
  awayTeam: z.object({ name: z.string(), score: z.number() }).optional(),
  league: z.string().optional(),
  time: z.string().optional(),
});

export type SportsScoreData = z.infer<typeof SportsScoreSchema>;

export const SportsMatcher: SchemaMatcher<SportsScoreData> = {
  id: "sports_scores",
  match(data) {
    const result = SportsScoreSchema.safeParse(data);
    return result.success
      ? { matched: true, confidence: 0.9, data: result.data }
      : { matched: false, confidence: 0 };
  },
};
