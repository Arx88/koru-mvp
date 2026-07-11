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
  policy: policies.readonly("Busca stats en Wikipedia."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "player_stats", status: "failed", error: "Indicá el nombre." };
    // Fase 3.2: usar Wikipedia API directamente.
    try {
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} deportista`)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9000) });
      const data = await res.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
      const results = data.query?.search ?? [];
      if (results.length === 0) return { type: "player_stats", status: "ok", name, note: `No encontré stats de ${name}.` };
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9000) });
      const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
      return {
        type: "player_stats", status: "ok", name,
        text: summary.extract ?? `Encontré información sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }],
      };
    } catch (err) {
      console.warn("[Koru] player_stats Wikipedia failed:", err instanceof Error ? err.message : err);
      return { type: "player_stats", status: "failed", error: `No pude buscar stats de ${name}.` };
    }
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
  policy: policies.readonly("Busca llave de torneo en Wikipedia."),
  async run(args) {
    const tournament = String(args.tournament ?? "").trim();
    if (!tournament) return { type: "tournament_bracket", status: "failed", error: "Indicá el torneo." };
    try {
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${tournament} torneo 2025`)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9000) });
      const data = await res.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
      const results = data.query?.search ?? [];
      if (results.length === 0) return { type: "tournament_bracket", status: "ok", tournament, note: `No encontré la llave de ${tournament}.` };
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9000) });
      const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
      return {
        type: "tournament_bracket", status: "ok", tournament,
        text: summary.extract ?? `Encontré información sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }],
      };
    } catch (err) {
      console.warn("[Koru] tournament_bracket Wikipedia failed:", err instanceof Error ? err.message : err);
      return { type: "tournament_bracket", status: "failed", error: `No pude buscar la llave de ${tournament}.` };
    }
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
  policy: policies.readonly("Lee noticias deportivas de GDELT."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "sports_news", status: "failed", error: "Indicá tema." };
    // Fase 3.2: usar GDELT API directamente en lugar de delegar.
    try {
      const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      url.searchParams.set("query", `${topic} sport`);
      url.searchParams.set("mode", "ArtList");
      url.searchParams.set("maxrecords", "10");
      url.searchParams.set("sort", "DateDesc");
      url.searchParams.set("format", "json");
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(9000) });
      const data = await res.json() as { articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }> };
      const articles = (data.articles ?? []).slice(0, 5).map(a => ({ title: a.title ?? "Sin título", url: a.url ?? "", domain: a.domain ?? "", snippet: a.seendate ?? "" }));
      if (articles.length === 0) return { type: "sports_news", status: "ok", topic, note: `No encontré noticias deportivas sobre ${topic}.` };
      return { type: "sports_news", status: "ok", topic, articles, source: "GDELT" };
    } catch (err) {
      console.warn("[Koru] sports_news GDELT failed:", err instanceof Error ? err.message : err);
      return { type: "sports_news", status: "failed", error: `No pude buscar noticias de ${topic}.` };
    }
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
