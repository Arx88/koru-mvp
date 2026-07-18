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

// Ligas ESPN con IDs conocidos para buscar resultados.
// INCLUYE selecciones nacionales (fifa.world, uefa.euro, etc) — sin esto,
// "cómo salió España ayer" no encuentra nada porque España no juega en ligas de clubes.
// OPTIMIZACIÓN: reducir de 15 a 8 ligas para menos fetches paralelos.
// Las selecciones nacionales son las más importantes (fifa.world + uefa.euro).
// Para clubes, solo top 5 ligas + Champions.
const ESPN_LEAGUES = [
  // Selecciones nacionales (prioridad — la mayoría de queries son selecciones)
  { id: "fifa.world", name: "FIFA World Cup / International Friendlies" },
  { id: "uefa.euro", name: "UEFA Euro" },
  { id: "uefa.nations", name: "UEFA Nations League" },
  // Top 5 ligas de clubes
  { id: "eng.1", name: "Premier League" },
  { id: "esp.1", name: "La Liga" },
  { id: "ita.1", name: "Serie A" },
  { id: "ger.1", name: "Bundesliga" },
  { id: "uefa.champions", name: "Champions League" },
];

// Sinónimos de selecciones nacionales → mapeo a nombres ESPN.
// "España" puede aparecer como "Spain" en ESPN. Esto dispara el match.
const NATIONAL_TEAM_SYNONYMS: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: "Spain", aliases: ["españa", "espana", "seleccion espanola", "la roja", "spain"] },
  { canonical: "Argentina", aliases: ["argentina", "la albiceleste", "seleccion argentina"] },
  { canonical: "France", aliases: ["francia", "france", "les bleus", "seleccion francesa"] },
  { canonical: "Brazil", aliases: ["brasil", "brazil", "selecao", "verdeamarela", "seleccion brasilena"] },
  { canonical: "Germany", aliases: ["alemania", "germany", "mannschaft", "seleccion alemana"] },
  { canonical: "Italy", aliases: ["italia", "italy", "azzurri", "seleccion italiana"] },
  { canonical: "England", aliases: ["inglaterra", "england", "three lions", "seleccion inglesa"] },
  { canonical: "Netherlands", aliases: ["paises bajos", "holanda", "netherlands", "dutch", "oranje"] },
  { canonical: "Portugal", aliases: ["portugal", "selecao portuguesa", "seleccion portuguesa"] },
  { canonical: "Belgium", aliases: ["belgica", "belgium", "red devils", "seleccion belga"] },
  { canonical: "Uruguay", aliases: ["uruguay", "charruas", "celeste", "seleccion uruguaya"] },
  { canonical: "Colombia", aliases: ["colombia", "cafeteros", "seleccion colombiana"] },
  { canonical: "Chile", aliases: ["chile", "la roja chilena", "seleccion chilena"] },
  { canonical: "Mexico", aliases: ["mexico", "méxico", "el tri", "seleccion mexicana"] },
  { canonical: "Switzerland", aliases: ["suiza", "switzerland", "swiss", "nati"] },
  { canonical: "Croatia", aliases: ["croacia", "croatia", "vatreni"] },
  { canonical: "Norway", aliases: ["noruega", "norway"] },
];

/**
 * Detecta si el query menciona una selección nacional y devuelve el canonical name.
 * Esto permite que "como salio España" → match exacto con "Spain" en ESPN.
 */
function detectNationalTeam(queryLower: string): string | null {
  for (const team of NATIONAL_TEAM_SYNONYMS) {
    for (const alias of team.aliases) {
      // Match exacto de palabra (para no confundir "España" con "español")
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i");
      if (re.test(queryLower)) return team.canonical;
    }
  }
  return null;
}

/**
 * Calcula fechas a buscar basado en el query del usuario.
 * "ayer" → fecha de ayer.
 * "hoy" / "en vivo" → fecha de hoy.
 * "mañana" → fecha de mañana.
 * Sin indicador → busca hoy + ayer (3 días de ventana) para captar últimos resultados.
 */
function detectDatesToQuery(queryLower: string): string[] {
  const dates: string[] = [];
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

  if (/\bayer\b|\bd'?ayer\b|last match|último partido|ultimo partido/.test(queryLower)) {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    dates.push(fmt(y));
    // También 2 días atrás por si el partido fue de madrugada
    const y2 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    dates.push(fmt(y2));
  } else if (/\bhoy\b|\btoday\b|\ben vivo\b|\blive\b/.test(queryLower)) {
    dates.push(fmt(now));
  } else if (/\bmañana\b|\bmanana\b|\btomorrow\b/.test(queryLower)) {
    const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    dates.push(fmt(t));
  } else {
    // Sin indicador: ventana de 3 días (ayer + hoy + anteayer) para captar último resultado
    dates.push(fmt(now));
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    dates.push(fmt(y));
    const y2 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    dates.push(fmt(y2));
  }
  return [...new Set(dates)];
}

type EspnEvent = {
  id?: string;
  name?: string;
  date?: string;
  status?: { type?: { description?: string; detail?: string; state?: string } };
  competitions?: Array<{
    date?: string;
    venue?: { fullName?: string; address?: { city?: string; country?: string } };
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: {
        displayName?: string;
        shortDisplayName?: string;
        logo?: string;
        color?: string;
        alternateColor?: string;
        abbreviation?: string;
      };
      records?: Array<{ summary?: string }>;
    }>;
    details?: Array<{
      type?: { id?: string; text?: string };
      clock?: { displayValue?: string };
      teamId?: string;
      athlete?: { displayName?: string };
      text?: string;
    }>;
  }>;
};

// 🔴 ESPN /summary — datos ricos: goles con scorer, tarjetas con player,
// sustituciones, alineaciones (formation + roster), 25+ estadísticas.
type EspnSummary = {
  boxscore?: {
    teams?: Array<{
      team?: { displayName?: string };
      statistics?: Array<{ name?: string; label?: string; abbreviation?: string; displayValue?: string }>;
    }>;
  };
  rosters?: Array<{
    team?: { displayName?: string };
    formation?: string;
    roster?: Array<{
      jerseyNumber?: string | number;
      starter?: boolean;
      athlete?: { displayName?: string };
      position?: { abbreviation?: string };
    }>;
  }>;
  keyEvents?: Array<{
    type?: { text?: string };
    clock?: { displayValue?: string };
    team?: { displayName?: string };
    athlete?: { displayName?: string };
    text?: string;
  }>;
  gameInfo?: { venue?: { fullName?: string; address?: { city?: string; country?: string } }; attendance?: number };
};

async function searchEspnScoreboards(query: string): Promise<Array<{ event: EspnEvent; leagueId: string; leagueName: string }>> {
  const queryLower = query.toLowerCase();
  const results: Array<{ event: EspnEvent; leagueId: string; leagueName: string }> = [];
  const datesToQuery = detectDatesToQuery(queryLower);
  const nationalTeam = detectNationalTeam(queryLower);

  // Si detectamos selección nacional, agregamos el canonical name al query
  // para que el filtro por nombre funcione (España → "Spain" en ESPN)
  const matchTerms = [queryLower];
  if (nationalTeam) matchTerms.push(nationalTeam.toLowerCase());

  // Buscar en paralelo en todas las ligas × todas las fechas relevantes
  const promises: Promise<void>[] = [];
  for (const league of ESPN_LEAGUES) {
    for (const date of datesToQuery) {
      promises.push((async () => {
        try {
          const url = `${ESPN_BASE}/${league.id}/scoreboard?dates=${date}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) return;
          const data = await res.json() as { events?: EspnEvent[] };
          const events = data.events ?? [];
          const matching = events.filter(e => {
            const eventName = (e.name ?? "").toLowerCase();
            const comps = e.competitions ?? [];
            const teams = comps.flatMap(c => (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""));
            return matchTerms.some(term =>
              eventName.includes(term) || teams.some(t => t.includes(term))
            );
          });
          for (const m of matching) {
            results.push({ event: m, leagueId: league.id, leagueName: league.name });
          }
        } catch { /* league/date timeout — skip */ }
      })());
    }
  }
  await Promise.all(promises);

  // Dedupe por id (mismo evento puede aparecer en múltiples fechas)
  const seen = new Set<string>();
  const deduped = results.filter(({ event: e }) => {
    const id = e.id ?? `${e.name ?? ""}-${e.date ?? ""}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return deduped;
}

function normalizeEspnEvent(e: EspnEvent, leagueName?: string) {
  const comps = e.competitions ?? [];
  const comp = comps[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find(c => c.homeAway === "home");
  const away = competitors.find(c => c.homeAway === "away");
  const status = e.status?.type?.description ?? e.status?.type?.detail ?? "?";
  const venue = comp?.venue;
  return {
    id: e.id,
    eventId: e.id,
    match: `${home?.team?.displayName ?? "?"} vs ${away?.team?.displayName ?? "?"}`,
    homeTeam: home?.team?.displayName,
    awayTeam: away?.team?.displayName,
    homeShortName: home?.team?.shortDisplayName,
    awayShortName: away?.team?.shortDisplayName,
    homeLogo: home?.team?.logo,
    awayLogo: away?.team?.logo,
    homeColor: home?.team?.color ? `#${home.team.color}` : undefined,
    awayColor: away?.team?.color ? `#${away.team.color}` : undefined,
    homeAbbrev: home?.team?.abbreviation,
    awayAbbrev: away?.team?.abbreviation,
    homeScore: home?.score != null ? Number(home.score) : undefined,
    awayScore: away?.score != null ? Number(away.score) : undefined,
    status,
    state: e.status?.type?.state, // "pre" | "in" | "post"
    date: comp?.date ?? e.date,
    live: /in progress|live|halftime/i.test(status),
    league: leagueName,
    venue: venue?.fullName,
    venueCity: venue?.address?.city,
    venueCountry: venue?.address?.country,
  };
}

// 🔴 ESPN /summary — extrae goles, tarjetas, sustituciones, alineaciones, stats.
// Se llama DESPUÉS de identificar el match en /scoreboard. Si falla, se sigue
// usando solo el scoreboard (compatible hacia atrás).
async function fetchEspnSummary(leagueId: string, eventId: string): Promise<EspnSummary | null> {
  try {
    const url = `${ESPN_BASE}/${leagueId}/summary?event=${eventId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as EspnSummary;
  } catch {
    return null;
  }
}

// 🔴 Extrae goles, tarjetas y sustituciones de keyEvents, agrupados por tipo.
// ESPN pone el texto del evento en `text`, con el nombre del jugador entre paréntesis.
// Ej: "Goal! Spain 1, England 0. Nico Williams (Spain) left footed shot..."
function parseKeyEvents(summary: EspnSummary | null) {
  const events = summary?.keyEvents ?? [];
  const goals: Array<{ minute: string; team?: string; scorer?: string; text?: string }> = [];
  const yellowCards: Array<{ minute: string; team?: string; player?: string }> = [];
  const redCards: Array<{ minute: string; team?: string; player?: string }> = [];
  const substitutions: Array<{ minute: string; team?: string; playerIn?: string; playerOut?: string }> = [];

  for (const ev of events) {
    const minute = ev.clock?.displayValue ?? "";
    const team = ev.team?.displayName;
    const text = ev.text ?? "";
    const athlete = ev.athlete?.displayName;
    const typeText = ev.type?.text ?? "";

    if (typeText === "Goal") {
      // Texto: "Goal! Spain 1, England 0. Nico Williams (Spain) left footed shot..."
      // El scorer suele estar justo después de "Goal! TeamA X, TeamB Y."
      let scorer = athlete;
      if (!scorer) {
        // Buscar patrón "FirstName LastName (Team)" en el texto
        const m = text.match(/(?:Goal!.*?\.\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s*\(/);
        if (m) scorer = m[1];
      }
      goals.push({ minute, team, scorer, text });
    } else if (typeText === "Yellow Card") {
      let player = athlete;
      if (!player) {
        const m = text.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s*\(/);
        if (m) player = m[1];
      }
      yellowCards.push({ minute, team, player });
    } else if (typeText === "Red Card") {
      let player = athlete;
      if (!player) {
        const m = text.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s*\(/);
        if (m) player = m[1];
      }
      redCards.push({ minute, team, player });
    } else if (typeText === "Substitution") {
      // Texto: "Substitution, Spain. Martín Zubimendi replaces Rodri because of an injury."
      const m = text.match(/([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ]+)\s+replaces\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ]+)/);
      substitutions.push({
        minute,
        team,
        playerIn: m?.[1],
        playerOut: m?.[2],
      });
    }
  }

  return { goals, yellowCards, redCards, substitutions };
}

// 🔴 Extrae alineaciones (formation + titulares + suplentes) por equipo.
function parseRosters(summary: EspnSummary | null) {
  const rosters = summary?.rosters ?? [];
  const byTeam: Record<string, { formation?: string; starters: Array<{ number?: string; name: string; position?: string }>; subs: Array<{ number?: string; name: string; position?: string }> }> = {};

  for (const r of rosters) {
    const teamName = r.team?.displayName ?? "?";
    const formation = r.formation;
    const starters: Array<{ number?: string; name: string; position?: string }> = [];
    const subs: Array<{ number?: string; name: string; position?: string }> = [];
    for (const p of r.roster ?? []) {
      const entry = {
        number: p.jerseyNumber != null ? String(p.jerseyNumber) : undefined,
        name: p.athlete?.displayName ?? "?",
        position: p.position?.abbreviation,
      };
      if (p.starter) starters.push(entry);
      else subs.push(entry);
    }
    byTeam[teamName] = { formation, starters, subs };
  }
  return byTeam;
}

// 🔴 Extrae estadísticas detalladas (posesión, tiros, faltas, córners, etc.)
// y las normaliza a pares home/away con valores numéricos.
function parseBoxscore(summary: EspnSummary | null, homeTeam?: string, awayTeam?: string) {
  const teams = summary?.boxscore?.teams ?? [];
  if (teams.length < 2) return [];
  const homeStats = teams.find(t => t.team?.displayName === homeTeam) ?? teams[0];
  const awayStats = teams.find(t => t.team?.displayName === awayTeam) ?? teams[1];
  if (!homeStats?.statistics || !awayStats?.statistics) return [];

  // Map de stats de cada team por nombre
  const homeMap = new Map<string, string>();
  for (const s of homeStats.statistics) {
    if (s.name) homeMap.set(s.name, s.displayValue ?? "");
  }
  const awayMap = new Map<string, string>();
  for (const s of awayStats.statistics) {
    if (s.name) awayMap.set(s.name, s.displayValue ?? "");
  }

  // Stats que nos interesan con su label en español. Para % usamos leftPercent/rightPercent.
  // Para conteos (tiros, faltas, córners) usamos los valores absolutos.
  const STAT_DEFS: Array<{ name: string; label: string; isPercent: boolean }> = [
    { name: "possessionPct", label: "Posesión", isPercent: true },
    { name: "totalShots", label: "Tiros", isPercent: false },
    { name: "shotsOnTarget", label: "Tiros al arco", isPercent: false },
    { name: "foulsCommitted", label: "Faltas", isPercent: false },
    { name: "cornerKicks", label: "Córners", isPercent: false },
    { name: "offsides", label: "Offsides", isPercent: false },
    { name: "saves", label: "Atajadas", isPercent: false },
    { name: "yellowCards", label: "Amarillas", isPercent: false },
    { name: "redCards", label: "Rojas", isPercent: false },
    { name: "accuratePasses", label: "Pases buenos", isPercent: false },
    { name: "totalPasses", label: "Pases totales", isPercent: false },
    { name: "passPct", label: "Precisión pases", isPercent: true },
  ];

  const result: Array<{ label: string; home: number; away: number; isPercent: boolean }> = [];
  for (const def of STAT_DEFS) {
    const hv = homeMap.get(def.name);
    const av = awayMap.get(def.name);
    if (hv == null && av == null) continue;
    const hNum = parseFloat(hv ?? "0") || 0;
    const aNum = parseFloat(av ?? "0") || 0;
    result.push({ label: def.label, home: hNum, away: aNum, isPercent: def.isPercent });
  }
  return result;
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
    "Obtén el marcador en vivo o resultado FINAL de un partido. Úsala SIEMPRE que el usuario pregunte por un resultado deportivo (fútbol): '¿cómo salió España ayer?', '¿cómo le fue a Boca?', '¿va ganando el Madrid?', 'resultado de Barcelona', 'quién ganó Argentina'. Devuelve equipos, marcador, minuto/estado, liga, fecha. Cubre selecciones nacionales (España, Argentina, Francia, etc) y clubes de las principales ligas. NUNCA uses web_search para resultados de partidos — esta tool tiene datos exactos en tiempo real desde ESPN.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Equipo, selección o partido (ej: 'España', 'Argentina', 'Boca River', 'Real Madrid', 'Champions'). Si el usuario menciona 'ayer', 'hoy' o 'mañana', incluí esa palabra." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee resultados deportivos de ESPN y TheSportsDB."),
  async run(args) {
    // Fallback a __userInput si el LLM no pasa query (caso: "Como salió España ayer" sin args)
    const query = String(args.query ?? args.__userInput ?? "").trim();
    if (!query) return { type: "match_live", status: "failed", error: "Indicá el partido." };

    // FIX: usar ESPN como fuente principal (TheSportsDB free no tiene datos recientes)
    // ESPN busca en 11 ligas en paralelo y filtra por nombre de equipo
    const espnResults = await searchEspnScoreboards(query);

    if (espnResults.length > 0) {
      // 🔴 Tomar el primer match y enriquecerlo con /summary (goles, tarjetas, alineaciones, stats)
      const first = espnResults[0];
      const matches = espnResults.slice(0, 5).map(({ event }) => normalizeEspnEvent(event, first.leagueName));

      // Enriquecer el primer match con datos del /summary
      let enriched: { goals?: any[]; yellowCards?: any[]; redCards?: any[]; substitutions?: any[]; lineups?: any; detailedStats?: any[]; venue?: string; venueCity?: string; attendance?: number } = {};
      if (first.event.id) {
        const summary = await fetchEspnSummary(first.leagueId, first.event.id);
        const events = parseKeyEvents(summary);
        const lineups = parseRosters(summary);
        const detailedStats = parseBoxscore(summary, matches[0]?.homeTeam, matches[0]?.awayTeam);
        enriched = {
          goals: events.goals.length > 0 ? events.goals : undefined,
          yellowCards: events.yellowCards.length > 0 ? events.yellowCards : undefined,
          redCards: events.redCards.length > 0 ? events.redCards : undefined,
          substitutions: events.substitutions.length > 0 ? events.substitutions : undefined,
          lineups: Object.keys(lineups).length > 0 ? lineups : undefined,
          detailedStats: detailedStats.length > 0 ? detailedStats : undefined,
          venue: summary?.gameInfo?.venue?.fullName,
          venueCity: summary?.gameInfo?.venue?.address?.city,
          attendance: summary?.gameInfo?.attendance,
        };
        if (enriched.goals || enriched.yellowCards || enriched.lineups || enriched.detailedStats) {
          matches[0] = { ...matches[0], ...enriched };
        }
      }

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
          // 🔴 FIX: status "no_data" (no "ok") cuando no hay partidos reales.
          // El backend usa esto para bloquear alucinaciones del LLM.
          status: "no_data",
          query,
          matches: [],
          text: `No encontré partidos recientes de "${query}" en ESPN ni TheSportsDB. La temporada puede estar en receso. Acá va info general de Wikipedia sobre el equipo.`,
          wikipediaExtract: summary.extract,
          sources: [{ title, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }],
          source: "Wikipedia",
        };
      }
    } catch { /* ignore */ }

    // 🔴 FIX: status "no_data" explícito — NO inventar resultados
    return {
      type: "match_live",
      status: "no_data",
      query,
      matches: [],
      note: `No encontré partidos de "${query}" en este momento. La temporada puede estar en receso.`,
    };
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
    // 🔴 KORU 3.0 — fallback a __userInput cuando el LLM no pasa team
    // (caso: detector de simulated tool call extrae solo el nombre, sin args)
    const team = String(args.team ?? args.__userInput ?? "").trim();
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
          { timeoutMs: 15_000 },
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
