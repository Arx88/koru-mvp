/**
 * Bloque Sports — Tenis en vivo (SofaScore no oficial + ESPN fallback).
 *
 * SofaScore expone endpoints JSON no oficiales que incluyen partidos de tenis
 * ATP/WTA/Challenger con marcador en vivo, sets, tiebreaks y stats
 * (aces, double faults, 1st serve %, break points, return games won).
 *
 * Si SofaScore falla o no encuentra al jugador, caemos al scoreboard público
 * de ESPN tennis que cubre los torneos principales del circuito ATP/WTA.
 *
 * La función `fetchTennisLive` es la que usa el tool `tennis_live` y devuelve
 * un `TennisMatchResult` listo para mapear a un UiBlock `tennis_match`.
 *
 * Cache:
 *   - partidos en vivo     → 10 s  (frescura máxima)
 *   - partidos finalizados → 24 h  (no cambian)
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, getCached, setCached, ttls } from "../shared/cache";
import type { AssistantSource } from "../../domain/types";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

/** Resultado normalizado de un partido de tenis. 1:1 con el UiBlock `tennis_match`. */
export type TennisMatchResult = {
  players?: {
    home: { name: string; country?: string; seed?: number; rank?: number; logo?: string };
    away: { name: string; country?: string; seed?: number; rank?: number; logo?: string };
  };
  tournament?: { name: string; round: string; surface: string; category: string };
  sets?: Array<{
    homeGames: number;
    awayGames: number;
    winner?: "home" | "away";
    tiebreak?: { homePts: number; awayPts: number };
  }>;
  currentSet?: { gamesHome: number; gamesAway: number; server: "home" | "away" };
  currentPoint?: string;
  stats?: {
    aces: { h: number; a: number };
    doubleFaults: { h: number; a: number };
    firstServePct: { h: number; a: number };
    breakPointsWon: { h: number; a: number };
    breakPointsFaced: { h: number; a: number };
    returnGamesWon: { h: number; a: number };
  };
  elapsedMs?: number;
  status?: "scheduled" | "live" | "finished";
  sources?: AssistantSource[];
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const SOFA_BASE = "https://www.sofascore.com/api/v1";
const ESPN_TENNIS_BASE = "https://site.api.espn.com/apis/site/v2/sports/tennis";

// Tours ESPN soportados (ATP y WTA son los principales; Challenger/Especiales varían).
const ESPN_TOURS = ["atp", "wta"] as const;

const TTL_LIVE = 10_000; // 10 s — partidos en vivo.
const TTL_FINISHED = 24 * 60 * 60 * 1000; // 24 h — finalizados.

// ─── Tipos internos SofaScore ─────────────────────────────────────────────────

type SofaTeamHit = {
  id?: number;
  name?: string;
  sport?: { name?: string };
};

type SofaMatchTeam = {
  name?: string;
  country?: { name?: string };
};

type SofaPeriod = {
  type?: string; // "SET" | "GAME" | "TIEBREAK"
  homeScore?: number;
  awayScore?: number;
  winnerCode?: number; // 1 = home, 2 = away
};

type SofaEvent = {
  id?: number;
  status?: { code?: number; description?: string; type?: string };
  startTimestamp?: number;
  homeTeam?: SofaMatchTeam;
  awayTeam?: SofaMatchTeam;
  tournament?: {
    name?: string;
    uniqueTournament?: { name?: string; category?: { name?: string } };
    round?: { name?: string };
  };
  surface?: string;
  homeScore?: { current?: number; display?: number; periodScores?: number[] };
  awayScore?: { current?: number; display?: number; periodScores?: number[] };
  periods?: SofaPeriod[];
};

type SofaSearchResponse = { teams?: SofaTeamHit[]; players?: SofaTeamHit[] };
type SofaLastEventsResponse = { events?: SofaEvent[] };
type SofaEventResponse = { event?: SofaEvent; statistics?: SofaStatMap[] };

type SofaStatMap = {
  period?: string; // "ALL"
  groups?: Array<{
    groupName?: string;
    statisticsItems?: Array<{ name?: string; home?: string; away?: string }>;
  }>;
};

// ─── Helpers SofaScore ────────────────────────────────────────────────────────

/** Busca el team/player id en SofaScore para el query (ej: "Alcaraz"). */
async function searchSofaTeamId(
  query: string,
): Promise<{ id: number; name: string } | null> {
  const url = `${SOFA_BASE}/team/search?q=${encodeURIComponent(query)}`;
  const r = await fetchJson<SofaSearchResponse>(url, {
    timeoutMs: 9_000,
    headers: { Accept: "application/json" },
  });
  if (!r.ok || !r.data) return null;
  const candidates = [...(r.data.teams ?? []), ...(r.data.players ?? [])];
  if (candidates.length === 0) return null;
  // Preferimos hits etiquetados como tennis; si no, el primero.
  const tennisFirst = candidates.find((c) => {
    const sport = (c.sport?.name ?? "").toLowerCase();
    return sport === "tennis" || sport === "tennis player";
  });
  const hit = tennisFirst ?? candidates[0];
  if (hit.id == null || !hit.name) return null;
  return { id: hit.id, name: hit.name };
}

/** Trae los últimos eventos del team/player (0 = sin paginación). */
async function fetchSofaLastEvents(teamId: number): Promise<SofaEvent[]> {
  const url = `${SOFA_BASE}/team/${teamId}/events/last/0`;
  const r = await fetchJson<SofaLastEventsResponse>(url, { timeoutMs: 9_000 });
  if (!r.ok || !r.data) return [];
  return r.data.events ?? [];
}

/** Trae el detalle + stats de un evento (aces, break points, 1st serve %, etc.). */
async function fetchSofaEventDetail(
  eventId: number,
): Promise<{ event?: SofaEvent; statistics?: SofaStatMap[] }> {
  const url = `${SOFA_BASE}/event/${eventId}`;
  const r = await fetchJson<SofaEventResponse>(url, { timeoutMs: 9_000 });
  if (!r.ok || !r.data) return {};
  return { event: r.data.event, statistics: r.data.statistics };
}

function statusFromSofa(
  code: number | undefined,
  type: string | undefined,
): TennisMatchResult["status"] {
  if (type === "finished") return "finished";
  if (type === "inprogress") return "live";
  if (type === "notstarted") return "scheduled";
  if (code != null) {
    if (code >= 60 && code < 100) return "live";
    if (code === 100) return "finished";
    if (code === 0) return "scheduled";
  }
  return "live";
}

function buildSet(
  hg: number,
  ag: number,
  winnerCode?: number,
): {
  homeGames: number;
  awayGames: number;
  winner?: "home" | "away";
  tiebreak?: { homePts: number; awayPts: number };
} {
  const winner =
    winnerCode === 1 ? "home" : winnerCode === 2 ? "away" : hg > ag ? "home" : ag > hg ? "away" : undefined;
  // Tiebreak heuristic: ambos llegaron a 6 y se decidió por 7-6.
  const tiebreak =
    hg >= 6 && ag >= 6 && Math.abs(hg - ag) === 1
      ? { homePts: hg, awayPts: ag }
      : undefined;
  return { homeGames: hg, awayGames: ag, winner, tiebreak };
}

function parseSofaSets(event: SofaEvent): TennisMatchResult["sets"] {
  const periods = (event.periods ?? []).filter(
    (p) => (p.type ?? "").toUpperCase() === "SET",
  );
  if (periods.length > 0) {
    return periods.slice(0, 5).map((p) =>
      buildSet(p.homeScore ?? 0, p.awayScore ?? 0, p.winnerCode),
    );
  }
  // Fallback a periodScores (algunas respuestas solo traen arrays paralelos).
  const homePeriods = event.homeScore?.periodScores ?? [];
  const awayPeriods = event.awayScore?.periodScores ?? [];
  if (homePeriods.length === 0) return undefined;
  const maxLen = Math.max(homePeriods.length, awayPeriods.length);
  const out: NonNullable<TennisMatchResult["sets"]> = [];
  for (let i = 0; i < maxLen && i < 5; i++) {
    out.push(buildSet(homePeriods[i] ?? 0, awayPeriods[i] ?? 0));
  }
  return out;
}

function parseSofaCurrentSet(
  event: SofaEvent,
): TennisMatchResult["currentSet"] | undefined {
  const sets = event.periods ?? [];
  // El set "en progreso" es el último SET sin winnerCode.
  const inProgress = sets.find(
    (p) => (p.type ?? "").toUpperCase() === "SET" && p.winnerCode == null,
  );
  if (!inProgress) return undefined;
  // Server detection no viene en /event; dejamos "home" como default.
  // (SofaScore expone servidor actual solo en el WebSocket en vivo.)
  return {
    gamesHome: inProgress.homeScore ?? 0,
    gamesAway: inProgress.awayScore ?? 0,
    server: "home",
  };
}

function parseSofaStats(
  statistics: SofaStatMap[] | undefined,
): TennisMatchResult["stats"] | undefined {
  if (!statistics || statistics.length === 0) return undefined;
  const all = statistics.find((s) => (s.period ?? "ALL") === "ALL") ?? statistics[0];
  const items: Record<string, { h: string; a: string }> = {};
  for (const grp of all.groups ?? []) {
    for (const it of grp.statisticsItems ?? []) {
      if (it.name) items[it.name.toLowerCase()] = { h: it.home ?? "0", a: it.away ?? "0" };
    }
  }
  const num = (v: string) => {
    const n = parseFloat(v.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const find = (keys: string[]) => {
    for (const k of keys) if (items[k]) return items[k];
    return { h: "0", a: "0" };
  };
  const aces = find(["aces", "ace"]);
  const dfs = find(["double faults", "doublefaults", "df", "double faults (df)"]);
  const firstServe = find([
    "1st serve",
    "first serve",
    "1st serves in %",
    "1st serve %",
    "1st serves won",
  ]);
  const bpWon = find([
    "break points converted",
    "break points won",
    "bp converted",
    "breakpoints converted",
  ]);
  const bpFaced = find(["break points faced", "bp faced", "break points against"]);
  const rgWon = find(["return games won", "rg won", "return games"]);
  return {
    aces: { h: num(aces.h), a: num(aces.a) },
    doubleFaults: { h: num(dfs.h), a: num(dfs.a) },
    firstServePct: { h: num(firstServe.h), a: num(firstServe.a) },
    breakPointsWon: { h: num(bpWon.h), a: num(bpWon.a) },
    breakPointsFaced: { h: num(bpFaced.h), a: num(bpFaced.a) },
    returnGamesWon: { h: num(rgWon.h), a: num(rgWon.a) },
  };
}

function normalizeSofaEvent(
  event: SofaEvent,
  statistics?: SofaStatMap[],
  sources?: AssistantSource[],
): TennisMatchResult {
  const homeName = event.homeTeam?.name ?? "Local";
  const awayName = event.awayTeam?.name ?? "Visitante";
  const status = statusFromSofa(event.status?.code, event.status?.type);
  const sets = parseSofaSets(event);
  const elapsedMs = event.startTimestamp
    ? Math.max(0, Date.now() - event.startTimestamp * 1000)
    : undefined;
  return {
    players: {
      home: { name: homeName, country: event.homeTeam?.country?.name },
      away: { name: awayName, country: event.awayTeam?.country?.name },
    },
    tournament: {
      name:
        event.tournament?.uniqueTournament?.name ??
        event.tournament?.name ??
        "Torneo de tenis",
      round: event.tournament?.round?.name ?? "—",
      surface: event.surface ?? "—",
      category: event.tournament?.uniqueTournament?.category?.name ?? "ATP/WTA",
    },
    sets,
    currentSet: status === "live" ? parseSofaCurrentSet(event) : undefined,
    stats: parseSofaStats(statistics),
    elapsedMs,
    status,
    sources,
  };
}

async function fetchFromSofaScore(
  query: string,
): Promise<TennisMatchResult | null> {
  const team = await searchSofaTeamId(query);
  if (!team) return null;
  const events = await fetchSofaLastEvents(team.id);
  if (events.length === 0) return null;
  // Preferimos un partido en vivo; si no, el último finalizado.
  const live = events.find((e) =>
    statusFromSofa(e.status?.code, e.status?.type) === "live",
  );
  const chosen = live ?? events[0];
  if (!chosen.id) return null;
  const { event, statistics } = await fetchSofaEventDetail(chosen.id);
  const finalEvent = event ?? chosen;
  return normalizeSofaEvent(finalEvent, statistics, [
    {
      title: `${finalEvent.homeTeam?.name ?? "?"} vs ${finalEvent.awayTeam?.name ?? "?"}`,
      url: `https://www.sofascore.com/event/${finalEvent.id ?? ""}`,
      domain: "sofascore.com",
    },
  ]);
}

// ─── Helpers ESPN (fallback) ──────────────────────────────────────────────────

type EspnTennisCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: {
    displayName?: string;
    abbreviation?: string;
    flag?: { href?: string };
  };
};

type EspnTennisEvent = {
  id?: string;
  status?: { type?: { state?: string; completed?: boolean; description?: string } };
  date?: string;
  competitions?: Array<{
    competitors?: EspnTennisCompetitor[];
    notes?: Array<{ type?: { name?: string } }>;
  }>;
  tournament?: { description?: string };
  type?: { name?: string };
};

type EspnTennisScoreboard = {
  events?: EspnTennisEvent[];
};

function statusFromEspn(state: string | undefined): TennisMatchResult["status"] {
  if (state === "in") return "live";
  if (state === "post") return "finished";
  if (state === "pre") return "scheduled";
  return "live";
}

function normalizeEspnTennisEvent(
  e: EspnTennisEvent,
): TennisMatchResult | null {
  const comps = e.competitions ?? [];
  const comp = comps[0];
  const competitors = comp?.competitors ?? [];
  if (competitors.length < 2) return null;
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  if (!home || !away) return null;

  const status = statusFromEspn(e.status?.type?.state);
  // ESPN tennis scoreboard es escueto: el score suele venir como "6 4 3"
  // (games por set separados por espacio). No siempre es confiable pero al menos
  // da los games por set para reconstruir el score.
  const homeSetsRaw = (home.score ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => Number(s));
  const awaySetsRaw = (away.score ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => Number(s));
  const sets: NonNullable<TennisMatchResult["sets"]> = [];
  const maxLen = Math.max(homeSetsRaw.length, awaySetsRaw.length);
  for (let i = 0; i < maxLen && i < 5; i++) {
    const hg = homeSetsRaw[i] ?? 0;
    const ag = awaySetsRaw[i] ?? 0;
    const winner = home.winner && i === maxLen - 1 ? "home" : away.winner && i === maxLen - 1 ? "away" : hg > ag ? "home" : ag > hg ? "away" : undefined;
    const tiebreak =
      hg >= 6 && ag >= 6 && Math.abs(hg - ag) === 1
        ? { homePts: hg, awayPts: ag }
        : undefined;
    sets.push({ homeGames: hg, awayGames: ag, winner, tiebreak });
  }
  const tournamentName = e.tournament?.description ?? "Torneo de tenis";
  const round = comp?.notes?.[0]?.type?.name ?? "—";
  return {
    players: {
      home: { name: home.team?.displayName ?? "Local" },
      away: { name: away.team?.displayName ?? "Visitante" },
    },
    tournament: {
      name: tournamentName,
      round,
      surface: "—",
      category: e.type?.name ?? "ATP/WTA",
    },
    sets: sets.length > 0 ? sets : undefined,
    status,
    sources: [
      {
        title: `${home.team?.displayName ?? "?"} vs ${away.team?.displayName ?? "?"}`,
        url: "https://www.espn.com/tennis/",
        domain: "espn.com",
      },
    ],
  };
}

async function fetchFromEspn(
  query: string,
): Promise<TennisMatchResult | null> {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  let best: TennisMatchResult | null = null;
  for (const tour of ESPN_TOURS) {
    try {
      const data = await cached<EspnTennisScoreboard>(
        `tennis_espn_scoreboard:${tour}`,
        ttls.sportsLive,
        async () => {
          const r = await fetchJson<EspnTennisScoreboard>(
            `${ESPN_TENNIS_BASE}/${tour}/scoreboard`,
            { timeoutMs: 12_000 },
          );
          if (!r.ok || !r.data) throw new Error(r.error);
          return r.data;
        },
      );
      const events = data.events ?? [];
      const matches: Array<{ r: TennisMatchResult }> = [];
      for (const e of events) {
        const r = normalizeEspnTennisEvent(e);
        if (r) matches.push({ r });
      }
      if (matches.length === 0) continue;
      const matchesQuery = matches.filter(({ r }) =>
        tokens.some(
          (token) =>
            (r.players?.home.name ?? "").toLowerCase().includes(token) ||
            (r.players?.away.name ?? "").toLowerCase().includes(token),
        ),
      );
      const pool = matchesQuery.length > 0 ? matchesQuery : matches;
      // Preferimos un match en vivo.
      const live = pool.find(({ r }) => r.status === "live") ?? pool[0];
      if (live) {
        best = live.r;
        break;
      }
    } catch {
      // siguiente tour
    }
  }
  return best;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Busca un partido de tenis en vivo (o el último finalizado) para el query dado.
 * Estrategia: SofaScore primero (más rico: stats, sets, tiebreaks), fallback ESPN.
 *
 * Cache:
 *   - Si el partido está en vivo → 10 s (frescura máxima).
 *   - Si está finalizado         → 24 h (no cambia).
 *
 * Lanza `Error("No se encontró partido de tenis en vivo")` si ningún endpoint
 * encuentra al jugador o torneo.
 */
export async function fetchTennisLive(
  playerQuery: string,
): Promise<TennisMatchResult> {
  const query = playerQuery.trim();
  if (!query) throw new Error("No se encontró partido de tenis en vivo");

  const cacheKey = `tennis_live:${query.toLowerCase()}`;

  // Si ya hay un resultado finalizado cacheado con TTL largo, lo devolvemos directo.
  const existing = getCached<TennisMatchResult>(cacheKey);
  if (existing) return existing;

  // Si no, ejecutamos con TTL corto (caso vivo); luego, si resultó ser "finished",
  // lo re-cacheamos con TTL largo.
  const result = await cached<TennisMatchResult>(cacheKey, TTL_LIVE, async () => {
    // 1) SofaScore (no oficial).
    try {
      const sofa = await fetchFromSofaScore(query);
      if (sofa) return sofa;
    } catch (err) {
      console.warn(
        "[Koru] fetchTennisLive SofaScore failed:",
        err instanceof Error ? err.message : err,
      );
    }
    // 2) Fallback ESPN tennis scoreboard.
    try {
      const espn = await fetchFromEspn(query);
      if (espn) return espn;
    } catch (err) {
      console.warn(
        "[Koru] fetchTennisLive ESPN fallback failed:",
        err instanceof Error ? err.message : err,
      );
    }
    // 3) No hay partido.
    throw new Error("No se encontró partido de tenis en vivo");
  });

  // Si el partido está finalizado, lo guardamos con TTL largo para no volver a llamar.
  if (result.status === "finished") {
    setCached(cacheKey, result, TTL_FINISHED);
  }
  return result;
}

// ─── Tool `tennis_live` (envoltura ToolHandler) ───────────────────────────────

export const tennisLive: ToolHandler = {
  definition: defineTool(
    "tennis_live",
    "Obtén el marcador en vivo o resultado de un partido de tenis (ATP/WTA/Challenger). " +
      "Úsala SIEMPRE que el usuario pregunte por un partido de tenis: " +
      "'¿cómo va Alcaraz?', 'resultado de Sinner', 'marcador de Nadal', 'va ganando Swiatek'. " +
      "Devuelve jugadores, sets, games actuales, stats (aces, break points, 1er saque %).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        player: {
          type: "string",
          description: "Jugador/a o partido (ej: 'Alcaraz', 'Sinner', 'Nadal', 'Swiatek').",
        },
      },
      required: ["player"],
    },
  ),
  policy: policies.readonly("Lee marcador de tenis desde SofaScore y ESPN."),
  async run(args) {
    const player = String(args.player ?? args.__userInput ?? "").trim();
    if (!player) {
      return {
        type: "tennis_live",
        status: "failed",
        error: "Indicá el jugador o partido de tenis.",
      };
    }
    try {
      const result = await fetchTennisLive(player);
      return { type: "tennis_live", status: "ok", player, ...result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        type: "tennis_live",
        status: "no_data",
        player,
        note: msg.includes("No se encontró")
          ? msg
          : `No encontré un partido de tenis para "${player}".`,
      };
    }
  },
};
