import type { Visualizer } from "./types";
import { WeatherVisualizer } from "./visualizers/weather";
import { SportsScoresVisualizer } from "./visualizers/sportsScores";
import { MoneySummaryVisualizer } from "./visualizers/moneySummary";
import { NewsListVisualizer } from "./visualizers/newsList";
import { ComparisonTableVisualizer } from "./visualizers/comparisonTable";
import { GenericListVisualizer } from "./visualizers/genericList";

export const VISUALIZER_CATALOG: Record<string, Visualizer> = {
  weather: WeatherVisualizer,
  sports_scores: SportsScoresVisualizer,
  money_summary: MoneySummaryVisualizer,
  news_list: NewsListVisualizer,
  comparison_table: ComparisonTableVisualizer,
  generic_list: GenericListVisualizer,
};
