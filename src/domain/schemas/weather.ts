import { z } from "zod";
import type { SchemaMatcher } from "./types";

export const WeatherSchema = z.object({
  type: z.literal("weather"),
  city: z.string(),
  now: z.string().optional(),
  range: z.string().optional(),
  rain: z.string().optional(),
  wind: z.string().optional(),
  advice: z.string().optional(),
});

export type WeatherData = z.infer<typeof WeatherSchema>;

export const WeatherMatcher: SchemaMatcher<WeatherData> = {
  id: "weather",
  match(data) {
    const result = WeatherSchema.safeParse(data);
    return result.success
      ? { matched: true, confidence: 1, data: result.data }
      : { matched: false, confidence: 0 };
  },
};
