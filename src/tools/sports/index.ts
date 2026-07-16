/**
 * Bloque Sports — barrel de tools.
 */

import { matchLive, leagueStandings, matchSchedule, teamFollow } from "./football";
import {
  playerStats,
  tournamentBracket,
  sportsNews,
  golfLeaderboard,
  tennisAtpWta,
  f1Results,
} from "./multi";
import { tennisLive } from "./tennis";

export const sportsTools = [
  matchLive,
  leagueStandings,
  matchSchedule,
  teamFollow,
  playerStats,
  tournamentBracket,
  sportsNews,
  golfLeaderboard,
  tennisAtpWta,
  f1Results,
  tennisLive,
];
