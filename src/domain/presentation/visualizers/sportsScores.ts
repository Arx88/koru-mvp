import type { Visualizer } from "../types";
import type { SportsScoreData } from "../../schemas/sports";

export const SportsScoresVisualizer: Visualizer = {
  id: "sports_scores",
  render(data) {
    const s = data as SportsScoreData;
    return {
      type: "live_match",
      league: s.league,
      time: s.time,
      homeTeam: s.homeTeam ? { name: s.homeTeam.name, abbrev: s.homeTeam.name.slice(0, 3).toUpperCase(), score: s.homeTeam.score } : undefined,
      awayTeam: s.awayTeam ? { name: s.awayTeam.name, abbrev: s.awayTeam.name.slice(0, 3).toUpperCase(), score: s.awayTeam.score } : undefined,
    };
  },
};
