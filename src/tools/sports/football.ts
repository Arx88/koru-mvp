/**
 * Bloque Sports — Fútbol multi-liga.
 * API: TheSportsDB (key pública gratuita "3"). 1.200+ competencias.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";

const TSDB_KEY = "3"; // Key pública gratuita de TheSportsDB.
const TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`;
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Ligas ESPN con IDs conocidos para buscar resultados
const ESPN_LEAGUES = [
  { id: "arg.1", name: "Argentine Primera División" },
  { id: "eng.1", name: "Premier League" },
  { id: "esp.1", name: "La Liga" },
  { id: "ita.1", name: "Serie A" },
  { id: "ger.1", name: "Bundesliga" },
  { id: "fra.1", name: "Ligue 1" },
  { id: "uefa.champions", name: "Champions League" },
  { id: "uefa.europa", name: "Europa League" },
  { id: "bra.1", name: "Brasileirão" },
  { id: "mex.1", name: "Liga MX" },
  { id: "usa.1", name: "MLS" },
];

type EspnEvent = {
  name?: string;
  date?: string;
  status?: { type?: { description?: string; detail?: string } };
  competitions?: Array<{
    date?: string;
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: { displayName?: string; shortDisplayName?: string; logo?: string };
    }>;
  }>;
};

async function searchEspnScoreboards(query: string): Promise<EspnEvent[]> {
  const queryLower = query.toLowerCase();
  const results: EspnEvent[] = [];
  // Buscar en paralelo en todas las ligas
  const promises = ESPN_LEAGUES.map(async (league) => {
    try {
      const res = await fetch(`${ESPN_BASE}/${league.id}/scoreboard`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json() as { events?: EspnEvent[] };
      const events = data.events ?? [];
      // Filtrar por query (nombre del equipo en el evento)
      const matching = events.filter(e => {
        const eventName = (e.name ?? "").toLowerCase();
        const comps = e.competitions ?? [];
        const teams = comps.flatMap(c => (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""));
        return eventName.includes(queryLower) || teams.some(t => t.includes(queryLower));
      });
      results.push(...matching);
    } catch { /* league timeout — skip */ }
  });
  await Promise.all(promises);
  return results;
}

function normalizeEspnEvent(e: EspnEvent) {
  const comps = e.competitions ?? [];
  const comp = comps[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find(c => c.homeAway === "home");
  const away = competitors.find(c => c.homeAway === "away");
  const status = e.status?.type?.description ?? e.status?.type?.detail ?? "?";
  return {
    id: `${home?.team?.displayName ?? "?"}-${away?.team?.displayName ?? "?"}-${comp?.date ?? ""}`,
    match: `${home?.team?.displayName ?? "?"} vs ${away?.team?.displayName ?? "?"}`,
    homeTeam: home?.team?.displayName,
    awayTeam: away?.team?.displayName,
    homeScore: home?.score != null ? Number(home.score) : undefined,
    awayScore: away?.score != null ? Number(away.score) : undefined,
    status,
    date: comp?.date ?? e.date,
    live: /in progress|live|halftime/i.test(status),
  };
}

type TsdbEvent = {
  idEvent?: string;
  strEvent?: string;
  strLeague?: string;
  dateEvent?: string;
  strTime?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strTimestamp?: string;
  strStatus?: string;
  strSport?: string;
};

function normalizeEvent(e: TsdbEvent) {
  const homeScore = e.intHomeScore != null && e.intHomeScore !== "" ? Number(e.intHomeScore) : undefined;
  const awayScore = e.intAwayScore != null && e.intAwayScore !== "" ? Number(e.intAwayScore) : undefined;
  const live = homeScore !== undefined && awayScore !== undefined && /progress|q[1-5]|ht|1h|2h|live|in play/i.test(e.strStatus ?? "");
  return {
    id: e.idEvent,
    match: `${e.strHomeTeam ?? "?"} vs ${e.strAwayTeam ?? "?"}`,
    homeTeam: e.strHomeTeam,
    awayTeam: e.strAwayTeam,
    homeScore,
    awayScore,
    status: e.strStatus ?? (live ? "en juego" : homeScore !== undefined ? "finalizado" : "programado"),
    league: e.strLeague,
    sport: e.strSport,
    date: e.dateEvent,
    time: e.strTime,
    live,
  };
}

// ─── match_live ─────────────────────────────────────────────────────────────
export const matchLive: ToolHandler = {
  definition: defineTool(
    "match_live",
    "Obtén el marcador en vivo o resultado de un partido. Úsala cuando el usuario pregunte '¿cómo va Boca-River?', '¿va ganando el Madrid?', 'resultado de Barcelona', 'a qué hora juega Argentina'. Devuelve equipos, marcador, minuto/estado, liga.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Equipos, liga o partido (ej: 'Boca River', 'Real Madrid', 'Argentina', 'Champions')." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee resultados deportivos de ESPN y TheSportsDB."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "match_live", status: "failed", error: "Indicá el partido." };

    // FIX: usar ESPN como fuente principal (TheSportsDB free no tiene datos recientes)
    // ESPN busca en 11 ligas en paralelo y filtra por nombre de equipo
    const espnEvents = await searchEspnScoreboards(query);

    if (espnEvents.length > 0) {
      const matches = espnEvents.slice(0, 5).map(normalizeEspnEvent);
      return {
        type: "match_live",
        status: "ok",
        query,
        matches,
        source: "ESPN",
        sourceUrl: "https://www.espn.com/soccer/",
        text: matches.map(m => `${m.homeTeam} ${m.homeScore ?? "?"} - ${m.awayScore ?? "?"} ${m.awayTeam} (${m.status})`).join("; "),
      };
    }

    // Fallback: TheSportsDB
    const cacheKey = `match_live:${query.toLowerCase()}`;
    const events = await cached<TsdbEvent[]>(cacheKey, ttls.sportsLive, async () => {
      const result = await fetchJson<{ events?: TsdbEvent[] }>(
        `${TSDB_BASE}/searchevents.php?e=${encodeURIComponent(query)}`,
        { timeoutMs: 9_000 },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data!.events ?? [];
    });

    if (events.length > 0) {
      return {
        type: "match_live",
        status: "ok",
        query,
        matches: events.slice(0, 5).map(normalizeEvent),
        source: "TheSportsDB",
        sourceUrl: "https://www.thesportsdb.com/",
      };
    }

    // Último fallback: buscar noticias del equipo en ESPN + Wikipedia
    try {
      const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${query} football team`)}&format=json&origin=*&srlimit=1`, { signal: AbortSignal.timeout(9000) });
      const wikiData = await wikiRes.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
      const results = wikiData.query?.search ?? [];
      if (results.length > 0) {
        const title = results[0].title;
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(9000) });
        const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
        return {
          type: "match_live",
          status: "ok",
          query,
          matches: [],
          text: summary.extract ?? `Encontré información sobre ${title} pero no hay partidos recientes en las fuentes.`,
          sources: [{ title, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }],
          source: "Wikipedia",
        };
      }
    } catch { /* ignore */ }

    return { type: "match_live", status: "ok", query, matches: [], note: `No encontré partidos de "${query}" en este momento. La temporada puede estar en receso.` };
  },
};

// ─── league_standings ───────────────────────────────────────────────────────
export const leagueStandings: ToolHandler = {
  definition: defineTool(
    "league_standings",
    "Muestra la tabla de posiciones de una liga o campeonato. Úsala cuando el usuario pregunte 'tabla de la Liga', 'posiciones de la Premier', ' standings NBA Este'. Devuelve equipos ordenados con PJ, PTS, GF, GC.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        league: { type: "string", description: "Liga (ej: 'Spanish La Liga', 'English Premier League', 'NBA')." },
        season: { type: "string", description: "Temporada (ej: '2025-2026'). Default actual." },
      },
      required: ["league"],
    },
  ),
  policy: policies.readonly("Lee tabla de posiciones pública."),
  async run(args) {
    const league = String(args.league ?? "").trim();
    if (!league) return { type: "league_standings", status: "failed", error: "Indicá la liga." };

    // Buscar liga por nombre.
    const cacheKey = `league_search:${league.toLowerCase()}`;
    const leagues = await cached<Array<{ idLeague?: string; strLeague?: string }>>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<{ leagues?: Array<{ idLeague?: string; strLeague?: string }> }>(
        `${TSDB_BASE}/search_all_leagues.php?l=${encodeURIComponent(league)}`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data!.leagues ?? [];
    });

    if (leagues.length === 0) {
      return { type: "league_standings", status: "ok", league, standings: [], note: `No encontré la liga "${league}".` };
    }

    const leagueId = leagues[0].idLeague;
    const season = String(args.season ?? "2025-2026");
    const standingsKey = `standings:${leagueId}:${season}`;
    const table = await cached<Array<{ strTeam?: string; intRank?: string; intPlayed?: string; intPoints?: string; intGoalsFor?: string; intGoalsAgainst?: string; strForm?: string }>>(standingsKey, ttls.sportsStandings, async () => {
      const r = await fetchJson<{ table?: Array<Record<string, unknown>> }>(
        `${TSDB_BASE}/lookuptable.php?l=${leagueId}&s=${encodeURIComponent(season)}`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return (r.data!.table ?? []) as never;
    });

    if (table.length === 0) {
      return { type: "league_standings", status: "ok", league: leagues[0].strLeague, season, standings: [], note: "Sin tabla para esa temporada." };
    }

    return {
      type: "league_standings",
      status: "ok",
      league: leagues[0].strLeague,
      season,
      standings: table.slice(0, 20).map((row) => ({
        rank: Number(row.intRank ?? 0),
        team: row.strTeam,
        played: Number(row.intPlayed ?? 0),
        points: Number(row.intPoints ?? 0),
        goalsFor: Number(row.intGoalsFor ?? 0),
        goalsAgainst: Number(row.intGoalsAgainst ?? 0),
        form: row.strForm,
      })),
      source: "TheSportsDB",
    };
  },
};

// ─── match_schedule ─────────────────────────────────────────────────────────
export const matchSchedule: ToolHandler = {
  definition: defineTool(
    "match_schedule",
    "Lista los próximos partidos (fixture) de un equipo o liga con fecha, rival y hora. Úsala cuando el usuario pregunte 'próximos partidos de Boca', 'cuándo juega Messi', 'fixture de la Champions'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        team: { type: "string", description: "Equipo (ej: 'Boca Juniors', 'Real Madrid')." },
        league: { type: "string", description: "Liga (alternativa a team)." },
        next: { type: "number", description: "Cantidad de próximos partidos. Default 5." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee fixture deportivo público."),
  async run(args) {
    const team = String(args.team ?? "").trim();
    const league = String(args.league ?? "").trim();
    const next = Number(args.next ?? 5);
    if (!team && !league) return { type: "match_schedule", status: "failed", error: "Indicá equipo o liga." };

    let events: TsdbEvent[] = [];
    if (team) {
      const cacheKey = `team_next:${team.toLowerCase()}`;
      events = await cached<TsdbEvent[]>(cacheKey, ttls.sportsStandings, async () => {
        const r = await fetchJson<{ events?: TsdbEvent[] }>(
          `${TSDB_BASE}/searchevents.php?e=${encodeURIComponent(team)}`,
          { timeoutMs: 9_000 },
        );
        if (!r.ok) throw new Error(r.error);
        return r.data!.events ?? [];
      });
    }
    if (events.length === 0 && league) {
      const cacheKey = `league_search:${league.toLowerCase()}`;
      const leagues = await cached<Array<{ idLeague?: string; strLeague?: string }>>(cacheKey, ttls.reference, async () => {
        const r = await fetchJson<{ leagues?: Array<{ idLeague?: string; strLeague?: string }> }>(
          `${TSDB_BASE}/search_all_leagues.php?l=${encodeURIComponent(league)}`,
          { timeoutMs: 9_000 },
        );
        if (!r.ok) throw new Error(r.error);
        return r.data!.leagues ?? [];
      });
      const leagueId = leagues[0]?.idLeague;
      if (leagueId) {
        const nextKey = `league_next:${leagueId}`;
        events = await cached<TsdbEvent[]>(nextKey, ttls.sportsStandings, async () => {
          const r = await fetchJson<{ events?: TsdbEvent[] }>(
            `${TSDB_BASE}/eventsnextleague.php?id=${leagueId}`,
            { timeoutMs: 9_000 },
          );
          if (!r.ok) throw new Error(r.error);
          return r.data!.events ?? [];
        });
      }
    }

    const now = Date.now();
    const upcoming = events
      .filter((e) => e.strTimestamp && new Date(e.strTimestamp).getTime() >= now - 3 * 60 * 60 * 1000)
      .sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1)
      .slice(0, next);

    if (upcoming.length === 0) {
      // Fallback: traer próximos partidos de ligas populares.
      const popularLeagues = [
        { id: "4328", name: "English Premier League" },
        { id: "4335", name: "Spanish La Liga" },
        { id: "4332", name: "Italian Serie A" },
        { id: "4331", name: "German Bundesliga" },
        { id: "4406", name: "Argentine Primera División" },
        { id: "4480", name: "UEFA Champions League" },
      ];
      const all: TsdbEvent[] = [];
      for (const pop of popularLeagues) {
        const r = await fetchJson<{ events?: TsdbEvent[] }>(
          `${TSDB_BASE}/eventsnextleague.php?id=${pop.id}`,
          { timeoutMs: 8_000 },
        );
        if (r.ok && r.data?.events) {
          const evs = r.data!.events
            .filter((e) => e.strTimestamp && new Date(e.strTimestamp).getTime() >= now - 3 * 60 * 60 * 1000)
            .sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1)
            .slice(0, 3);
          all.push(...evs);
        }
      }
      const fallbackUpcoming = all
        .sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1)
        .slice(0, next);
      if (fallbackUpcoming.length === 0) {
        return { type: "match_schedule", status: "ok", team: team || league, matches: [], note: "No encontré próximos partidos." };
      }
      return {
        type: "match_schedule",
        status: "ok",
        team: team || league,
        matches: fallbackUpcoming.map(normalizeEvent),
        source: "TheSportsDB (liga popular)",
        note: `Próximos partidos de ligas destacadas.`,
      };
    }

    return {
      type: "match_schedule",
      status: "ok",
      team: team || league,
      matches: upcoming.map(normalizeEvent),
      source: "TheSportsDB",
    };
  },
};

// ─── team_follow ────────────────────────────────────────────────────────────
export const teamFollow: ToolHandler = {
  definition: defineTool(
    "team_follow",
    "Guarda un equipo como favorito para que Koru te avise cuando juegue o termine el partido. Úsala cuando el usuario diga 'seguí a Boca', 'ségal a Real Madrid', 'avisame cuando juegue Nadal'. Crea una memory tipo 'interest'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        team: { type: "string", description: "Equipo o deportista a seguir (ej: 'Boca Juniors', 'Nadal')." },
        sport: { type: "string", description: "Deporte (ej: 'fútbol', 'tenis')." },
      },
      required: ["team"],
    },
  ),
  policy: policies.localWrite("Guarda equipo favorito como memory."),
  async run(args) {
    const team = String(args.team ?? "").trim();
    const sport = String(args.sport ?? "fútbol").trim();
    if (!team) return { type: "team_follow", status: "failed", error: "Indicá el equipo." };
    return {
      type: "team_follow",
      status: "ok",
      team,
      sport,
      memoryCandidates: [{
        kind: "interest" as const,
        text: `Sigue a ${team} (${sport})`,
        confidence: 0.95,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: team,
        useForSuggestions: true,
      }],
    };
  },
};
