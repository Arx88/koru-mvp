/**
 * Bloque Sports — NBA/tenis/golf/F1 y noticias deportivas.
 * APIs: ESPN unofficial (sin key), Ergast (F1 sin key), RSS.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// ─── player_stats ───────────────────────────────────────────────────────────
export const playerStats: ToolHandler = {
  definition: defineTool(
    "player_stats",
    "Obtén estadísticas de un deportista (goles, edad, equipo, títulos). Úsala cuando el usuario pregunte 'cuántos goles tiene Mbappé', 'edad de LeBron', 'estadísticas de Messi'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del deportista." },
        sport: { type: "string", enum: ["football", "basketball", "tennis", "golf", "f1"], default: "football" },
      },
      required: ["name"],
    },
  ),
  policy: policies.readonly("Lee stats deportivas públicas."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "player_stats", status: "failed", error: "Indicá el nombre." };
    // Delegamos a web_search del motor para búsqueda multi-fuente con anti-alucinación.
    return {
      type: "player_stats",
      status: "delegate",
      delegateTo: "web_search",
      query: `${name} estadísticas equipo edad goles 2025`,
      mode: "research",
      note: "Se enruta a web_search del motor para datos verificados multi-fuente.",
    };
  },
};

// ─── tournament_bracket ─────────────────────────────────────────────────────
export const tournamentBracket: ToolHandler = {
  definition: defineTool(
    "tournament_bracket",
    "Muestra la llave/eliminatoria de un torneo (Champions, Wimbledon, World Cup). Úsala cuando el usuario pregunte 'llave de la Champions', 'cuadro de Roland Garros'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tournament: { type: "string", description: "Torneo (ej: 'Champions League', 'Wimbledon', 'World Cup')." },
        sport: { type: "string", enum: ["soccer", "tennis", "basketball"], default: "soccer" },
      },
      required: ["tournament"],
    },
  ),
  policy: policies.readonly("Lee llave de torneo pública."),
  async run(args) {
    const tournament = String(args.tournament ?? "").trim();
    if (!tournament) return { type: "tournament_bracket", status: "failed", error: "Indicá el torneo." };
    return {
      type: "tournament_bracket",
      status: "delegate",
      delegateTo: "web_search",
      query: `${tournament} llave bracket cuadro 2025 resultado`,
      mode: "research",
      note: "Se enruta a web_search para datos verificados.",
    };
  },
};

// ─── sports_news ────────────────────────────────────────────────────────────
export const sportsNews: ToolHandler = {
  definition: defineTool(
    "sports_news",
    "Noticias deportivas filtradas por deporte o equipo. Úsala cuando el usuario pregunte 'noticias del Barça', 'qué pasó en la F1', 'titulares de tenis'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema/equipo/deporte (ej: 'Barcelona', 'F1', 'tenis')." },
      },
      required: ["topic"],
    },
  ),
  policy: policies.readonly("Lee noticias deportivas."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "sports_news", status: "failed", error: "Indicá tema." };
    return {
      type: "sports_news",
      status: "delegate",
      delegateTo: "web_search",
      query: `${topic} noticias deportivas recientes`,
      mode: "news",
      note: "Se enruta a web_search con modo news.",
    };
  },
};

// ─── golf_leaderboard ───────────────────────────────────────────────────────
export const golfLeaderboard: ToolHandler = {
  definition: defineTool(
    "golf_leaderboard",
    "Tabla de posiciones de un torneo de golf en vivo con score par/under. Úsala cuando el usuario pregunte 'cómo va el Masters', 'posición de Tiger hoy', 'leaderboard del PGA'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tournament: { type: "string", description: "Torneo (ej: 'Masters', 'PGA Championship', 'Open Championship')." },
      },
      required: ["tournament"],
    },
  ),
  policy: policies.readonly("Lee leaderboard de golf."),
  async run(args) {
    const tournament = String(args.tournament ?? "").trim();
    if (!tournament) return { type: "golf_leaderboard", status: "failed", error: "Indicá el torneo." };

    const cacheKey = `golf:${tournament.toLowerCase()}`;
    const data = await cached<{ leaders?: Array<{ name?: string; score?: string; thru?: string }> }>(cacheKey, ttls.sportsLive, async () => {
      await limiters.gdelt.acquire();
      // ESPN golf leaderboard endpoint (no oficial, formato JSON).
      const r = await fetchJson<{ leaders?: Array<{ name?: string; score?: string; thru?: string }> }>(
        `${ESPN_BASE}/golf/pga/scoreboard`,
        { timeoutMs: 8_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });

    const leaders = (data.leaders ?? []).slice(0, 10).map((l) => ({
      player: l.name,
      score: l.score,
      thru: l.thru,
    }));

    if (leaders.length === 0) {
      return { type: "golf_leaderboard", status: "ok", tournament, leaders: [], note: "No hay torneo en vivo ahora mismo." };
    }
    return { type: "golf_leaderboard", status: "ok", tournament, leaders, source: "ESPN", sourceUrl: "https://www.espn.com/golf/leaderboard" };
  },
};

// ─── tennis_atp_wta ─────────────────────────────────────────────────────────
export const tennisAtpWta: ToolHandler = {
  definition: defineTool(
    "tennis_atp_wta",
    "Ranking ATP/WTA actual y resultados de la semana. Úsala cuando el usuario pregunte 'top 10 ATP', 'ranking WTA', 'quién ganó Alcaraz-Sinner'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tour: { type: "string", enum: ["atp", "wta"], default: "atp" },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee ranking de tenis."),
  async run(args) {
    const tour = String(args.tour ?? "atp").toLowerCase();
    // ESPN no expone ranking limpio sin scraping; delegamos a web_search.
    return {
      type: "tennis_atp_wta",
      status: "delegate",
      delegateTo: "web_search",
      query: `ranking ${tour.toUpperCase()} top 10 2025`,
      mode: "research",
      tour,
      note: "Se enruta a web_search para ranking verificado.",
    };
  },
};

// ─── f1_results ─────────────────────────────────────────────────────────────
export const f1Results: ToolHandler = {
  definition: defineTool(
    "f1_results",
    "Resultado o clasificación de la última carrera de F1 (ganador, podio, pole). Úsala cuando el usuario pregunte 'resultado de Mónaco', 'pole de Verstappen', 'cómo terminó la carrera'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        season: { type: "string", default: "2025" },
        round: { type: "string", description: "Número de carrera. Default última." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee resultados F1."),
  async run(args) {
    const season = String(args.season ?? "2025");
    const cacheKey = `f1:${season}:last`;
    const data = await cached<{ MRData?: { RaceTable?: { Races?: Array<Record<string, unknown>> } } }>(cacheKey, ttls.sportsStandings, async () => {
      const r = await fetchJson<{ MRData?: { RaceTable?: { Races?: Array<Record<string, unknown>> } } }>(
        `https://ergast.com/api/f1/current/last/results.json`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });

    const races = data.MRData?.RaceTable?.Races ?? [];
    if (races.length === 0) {
      return { type: "f1_results", status: "ok", season, results: [], note: "Sin datos de F1." };
    }
    const race = races[0] as { raceName?: string; date?: string; Results?: Array<Record<string, unknown>> };
    const results = (race.Results ?? []).slice(0, 10).map((r) => ({
      position: Number(r.position ?? 0),
      driver: `${(r.Driver as { givenName?: string })?.givenName ?? ""} ${(r.Driver as { familyName?: string })?.familyName ?? ""}`.trim(),
      constructor: (r.Constructor as { name?: string })?.name,
      time: (r.Time as { time?: string })?.time,
      grid: Number(r.grid ?? 0),
      points: Number(r.points ?? 0),
    }));

    return {
      type: "f1_results",
      status: "ok",
      season,
      raceName: race.raceName,
      date: race.date,
      results,
      source: "Ergast API",
      sourceUrl: "https://ergast.com/motor-racing/",
    };
  },
};
