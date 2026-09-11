/**
 * Bloque Sports — Fútbol multi-liga.
 * API: TheSportsDB (key pública gratuita "3"). 1.200+ competencias.
 */

import { defineTool, policies, type ToolRunContext, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";

/**
 * 🔴 FIX TZ — Hora de kickoff en la tz del USUARIO, no la del server.
 * El server corre en UTC (Render): un partido de Boca a las 21:30 AR
 * (2026-09-12T00:30Z) se mostraba como "00:30" — 2,5h off para Madrid.
 * getTimezoneOffset() del cliente: Madrid UTC+2 → -120 (local = UTC − offset).
 * Sin tzOffsetMin (tests/dev): mantiene el comportamiento legacy (hora del server).
 */
export function formatKickoffUserTz(
  date: string | Date | undefined | null,
  tzOffsetMin?: number,
  opts?: { withDate?: boolean },
): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  const hasTz = typeof tzOffsetMin === "number" && Number.isFinite(tzOffsetMin);
  const target = hasTz ? new Date(d.getTime() - tzOffsetMin * 60_000) : d;
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  if (hasTz) timeOpts.timeZone = "UTC"; // leemos la epoch desplazada tal cual
  const time = target.toLocaleTimeString("es-AR", timeOpts);
  if (opts?.withDate) {
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" };
    if (hasTz) dateOpts.timeZone = "UTC";
    return `${target.toLocaleDateString("es-AR", dateOpts)} ${time}`;
  }
  return time;
}

const TSDB_KEY = "3"; // Key pública gratuita de TheSportsDB.
const TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`;
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Ligas ESPN con IDs conocidos para buscar resultados.
// INCLUYE selecciones nacionales (fifa.world, uefa.euro, etc) — sin esto,
// "cómo salió España ayer" no encuentra nada porque España no juega en ligas de clubes.
// OPTIMIZACIÓN: reducir de 15 a 8 ligas para menos fetches paralelos.
// Las selecciones nacionales son las más importantes (fifa.world + uefa.euro).
// Para clubes, solo top 5 ligas + Champions.
const ESPN_LEAGUES: Array<{ id: string; name: string; aliases?: string[] }> = [
  // ── Copas internacionales ──
  { id: "uefa.champions", name: "UEFA Champions League", aliases: ["champions", "champions league", "copa de europa", "ucl", "orejona"] },
  { id: "uefa.europa", name: "UEFA Europa League", aliases: ["europa league", "copa uefa", "uel"] },
  // ── Selecciones nacionales (la mayoría de queries de selecciones) ──
  { id: "fifa.world", name: "FIFA World Cup / International Friendlies", aliases: ["mundial", "world cup", "amistoso", "amistosos", "eliminatorias"] },
  { id: "uefa.euro", name: "UEFA Euro", aliases: ["eurocopa"] },
  { id: "uefa.nations", name: "UEFA Nations League", aliases: ["nations league", "liga de naciones"] },
  // ── Conmebol ──
  { id: "conmebol.libertadores", name: "Copa Libertadores", aliases: ["libertadores", "copa libertadores"] },
  { id: "conmebol.sudamericana", name: "Copa Sudamericana", aliases: ["sudamericana", "copa sudamericana"] },
  // ── Argentina ──
  { id: "arg.1", name: "Argentine Primera División", aliases: ["liga argentina", "primera division argentina", "futbol argentino", "torneo argentino"] },
  { id: "arg.copa", name: "Copa Argentina", aliases: ["copa argentina"] },
  // ── Brasil ──
  { id: "bra.1", name: "Brasileirão Série A", aliases: ["brasileirao", "liga brasileira"] },
  // ── Top 5 ligas europeas ──
  { id: "eng.1", name: "Premier League", aliases: ["premier", "premier league", "liga inglesa"] },
  { id: "esp.1", name: "La Liga", aliases: ["la liga", "laliga", "liga espanola", "liga de espana"] },
  { id: "ita.1", name: "Serie A", aliases: ["serie a", "liga italiana", "calcio"] },
  { id: "ger.1", name: "Bundesliga", aliases: ["bundesliga", "liga alemana"] },
  { id: "fra.1", name: "Ligue 1", aliases: ["ligue 1", "liga francesa"] },
  // ── Copas domésticas ──
  { id: "esp.copa_del_rey", name: "Copa del Rey", aliases: ["copa del rey", "copa de espana"] },
  { id: "eng.fa", name: "FA Cup", aliases: ["fa cup", "copa inglesa"] },
  { id: "eng.league_cup", name: "English League Cup", aliases: ["carabao", "league cup", "carabao cup"] },
  { id: "ita.coppa_italia", name: "Coppa Italia", aliases: ["coppa italia", "copa italia"] },
  { id: "ger.dfb_pokal", name: "DFB Pokal", aliases: ["dfb pokal", "copa alemana"] },
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

// 🔴 KORU 3.0 — Sinónimos de CLUBES sudamericanos populares.
// ESPN los registra con nombres en inglés o abreviados. Esto permite
// que "cuando juega Boca" → match con "Boca Juniors" en ESPN arg.1.
const CLUB_SYNONYMS: Array<{ canonical: string; aliases: string[] }> = [
  // ── Clubes europeos top (ESPN displayName como canonical) ──
  // 🔴 FIX "no trae escudos": antes SOLO había clubes sudamericanos →
  // "cómo salió el partido de barcelona" con query crudo nunca matcheaba.
  { canonical: "Barcelona", aliases: ["barcelona", "barça", "barca", "barsa", "fc barcelona", "azulgrana"] },
  { canonical: "Real Madrid", aliases: ["real madrid", "madrid", "merengues", "blancos"] },
  { canonical: "Atlético Madrid", aliases: ["atletico madrid", "atletico de madrid", "atleti", "colchoneros"] },
  { canonical: "Athletic Bilbao", aliases: ["athletic bilbao", "athletic club", "bilbao", "leones"] },
  { canonical: "Sevilla", aliases: ["sevilla", "sevillistas"] },
  { canonical: "Real Betis", aliases: ["betis", "real betis", "verdiblancos"] },
  { canonical: "Valencia", aliases: ["valencia", "valencianistas"] },
  { canonical: "Villarreal", aliases: ["villarreal", "submarino amarillo"] },
  { canonical: "Arsenal", aliases: ["arsenal", "gunners"] },
  { canonical: "Chelsea", aliases: ["chelsea", "blues de londres"] },
  { canonical: "Liverpool", aliases: ["liverpool", "anfield", "reds de liverpool"] },
  { canonical: "Manchester City", aliases: ["manchester city", "man city", "cityzens", "citizens"] },
  { canonical: "Manchester United", aliases: ["manchester united", "man united", "man utd", "diablos rojos"] },
  { canonical: "Tottenham Hotspur", aliases: ["tottenham", "spurs", "tottenham hotspur"] },
  { canonical: "Newcastle United", aliases: ["newcastle", "newcastle united", "magpies"] },
  { canonical: "Bayern Munich", aliases: ["bayern", "bayern munich", "bayern munchen", "bayern münchen"] },
  { canonical: "Borussia Dortmund", aliases: ["dortmund", "borussia dortmund", "bvb"] },
  { canonical: "RB Leipzig", aliases: ["leipzig", "rb leipzig"] },
  { canonical: "Bayer Leverkusen", aliases: ["leverkusen", "bayer leverkusen"] },
  { canonical: "Internazionale", aliases: ["inter", "internazionale", "inter milan", "inter de milan", "nerazzurri"] },
  { canonical: "AC Milan", aliases: ["milan", "ac milan", "rossoneri"] },
  { canonical: "Juventus", aliases: ["juventus", "juve", "vecchia signora"] },
  { canonical: "Napoli", aliases: ["napoli", "partenopei"] },
  { canonical: "AS Roma", aliases: ["roma", "as roma", "giallorossi"] },
  { canonical: "Lazio", aliases: ["lazio", "biancocelesti"] },
  { canonical: "Paris Saint-Germain", aliases: ["psg", "paris saint germain", "paris saint-germain", "paris"] },
  { canonical: "Marseille", aliases: ["marsella", "marseille"] },
  { canonical: "Lyon", aliases: ["lyon"] },
  { canonical: "Ajax", aliases: ["ajax", "amsterdam"] },
  { canonical: "PSV Eindhoven", aliases: ["psv", "psv eindhoven"] },
  { canonical: "Benfica", aliases: ["benfica"] },
  { canonical: "FC Porto", aliases: ["porto", "fc porto"] },
  { canonical: "Sporting CP", aliases: ["sporting", "sporting cp", "sporting de lisboa"] },
  // ── Clubes sudamericanos ──
  { canonical: "Boca Juniors", aliases: ["boca", "boca juniors", "xeneizes", "azul y oro"] },
  { canonical: "River Plate", aliases: ["river", "river plate", "millonarios", "gallinas"] },
  { canonical: "Racing Club", aliases: ["racing", "racing club", "la academia"] },
  { canonical: "Independiente", aliases: ["independiente", "el rojo", "rey de copas"] },
  { canonical: "San Lorenzo", aliases: ["san lorenzo", "cuervos", "cyclone"] },
  { canonical: "Estudiantes", aliases: ["estudiantes", "estudiantes de la plata", "pincharrata"] },
  { canonical: "Rosario Central", aliases: ["rosario central", "canalla"] },
  { canonical: "Newell's Old Boys", aliases: ["newells", "newell's", "leprosos"] },
  { canonical: "Flamengo", aliases: ["flamengo", "mengao"] },
  { canonical: "Palmeiras", aliases: ["palmeiras", "verdao"] },
  { canonical: "Corinthians", aliases: ["corinthians", "timao"] },
  { canonical: "São Paulo", aliases: ["sao paulo", "são paulo", "tricolor paulista"] },
  { canonical: "Santos", aliases: ["santos", "peixe"] },
  { canonical: "Atlético Mineiro", aliases: ["atletico mineiro", "galo"] },
  { canonical: "Grêmio", aliases: ["gremio", "grêmio", "tricolor gaucho"] },
  { canonical: "Internacional", aliases: ["internacional", "colorados"] },
];

/**
 * Detecta si el query menciona un club sudamericano y devuelve el canonical name.
 */
function detectClub(queryLower: string): string | null {
  for (const club of CLUB_SYNONYMS) {
    for (const alias of club.aliases) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i");
      if (re.test(queryLower)) return club.canonical;
    }
  }
  return null;
}

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

/**
 * 🔴 FIX COPAS — detecta si el query menciona una LIGA/COPA (no un equipo):
 * "cómo salió la copa del rey" / "partido de la champions" / "libertadores".
 * Antes estos queries caían al filtro por equipo → 0 resultados → siempre
 * terminaban en la card de PRÓXIMO partido.
 */
function detectLeague(queryLower: string): { id: string; name: string } | null {
  for (const league of ESPN_LEAGUES) {
    for (const alias of league.aliases ?? []) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(queryLower)) return { id: league.id, name: league.name };
    }
  }
  return null;
}

/**
 * 🔴 FIX QUERY CRUDO — extrae palabras clave del query cuando el LLM pasa el
 * input completo ("cómo salió el partido de barcelona" en vez de "barcelona").
 * Filtra stopwords y devuelve tokens ≥4 chars para matchear contra equipos.
 */
const QUERY_STOPWORDS = new Set([
  "como", "salió", "salio", "salieron", "partido", "partidos", "equipo", "futbol",
  "fútbol", "cuando", "juega", "juegan", "jugar", "ayer", "anoche", "mañana",
  "manana", "hoy", "anteayer", "resultado", "resultados", "ganó", "gano",
  "perdió", "perdio", "empató", "empato", "ganaron", "dime", "decime", "quiero",
  "saber", "último", "ultimo", "próximo", "proximo", "proximos", "donde",
  "mira", "mirá", "ver", "puede", "podes", "podés", "sobre", "info", "dato",
  "datos", "dame", "traeme", "busca", "buscame",
]);

function contentTokens(queryLower: string): string[] {
  return queryLower
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos para tokenizar
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length >= 4 && !QUERY_STOPWORDS.has(t));
}

/** Estado del evento ESPN: "pre" (por jugar) | "in" (en vivo) | "post" (terminado). */
function espnEventState(e: EspnEvent): "pre" | "in" | "post" {
  return (e.status?.type?.state as "pre" | "in" | "post") ?? "pre";
}

/**
 * 🔴 FIX VENTANA DE FECHAS + RANGOS — antes: 3 días por día (9 ligas × 3
 * fetches) y los partidos de mitad de semana (Real Madrid juega martes, se
 * pregunta el viernes) quedaban FUERA → no_data → card de próximo partido.
 * Ahora: UN fetch por liga con rango `dates=START-END` (ESPN lo soporta),
 * ventana de 12 días atrás + 14 adelante, cacheado 60s anti rate-limit.
 */
async function searchEspnScoreboards(
  query: string,
  opts: { fromDays?: number; toDays?: number } = {},
): Promise<Array<{ event: EspnEvent; leagueId: string; leagueName: string }>> {
  const fromDays = opts.fromDays ?? 12;
  const toDays = opts.toDays ?? 14;
  const queryLower = query.toLowerCase();
  const results: Array<{ event: EspnEvent; leagueId: string; leagueName: string }> = [];

  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const range = `${fmt(new Date(now.getTime() - fromDays * 86_400_000))}-${fmt(new Date(now.getTime() + toDays * 86_400_000))}`;

  const nationalTeam = detectNationalTeam(queryLower);
  const club = detectClub(queryLower);
  const leagueHit = detectLeague(queryLower);
  // 🔴 Canonical detectado → matcheo PRECISO por nombre de equipo. Sin
  // canonical → fallback por tokens (equipos fuera del diccionario).
  const hasCanonical = !!(nationalTeam || club);

  // Términos de matcheo: canonical detectado + query completo + tokens del query
  const matchTerms: string[] = [queryLower];
  if (nationalTeam) matchTerms.push(nationalTeam.toLowerCase());
  if (club) matchTerms.push(club.toLowerCase());
  const tokens = contentTokens(queryLower);

  // ¿El query ES una liga/copa? → traer TODOS los eventos de esa liga
  // ("cómo salió la copa del rey de ayer" → eventos de esp.copa_del_rey).
  const leagueMode = !!leagueHit && !club && !nationalTeam;

  const fetchLeague = async (league: { id: string; name: string }): Promise<void> => {
    try {
      const cacheKey = `espn:sb:${league.id}:${range}`;
      const data = await cached<{ events?: EspnEvent[] }>(cacheKey, 60 * 1000, async () => {
        const res = await fetch(`${ESPN_BASE}/${league.id}/scoreboard?dates=${range}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return {};
        return await res.json() as { events?: EspnEvent[] };
      });
      const events = (data?.events ?? []).filter(Boolean);
      for (const e of events) {
        const isLeagueEvents = leagueHit?.id === league.id;
        if (leagueMode && isLeagueEvents) {
          // Query de copa/liga → todos los eventos de esa liga
          results.push({ event: e, leagueId: league.id, leagueName: league.name });
          continue;
        }
        const eventName = (e.name ?? "").toLowerCase();
        const comps = e.competitions ?? [];
        const teams = comps.flatMap(c => (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""));
        const termMatch = matchTerms.some(term =>
          term.length >= 3 && (eventName.includes(term) || teams.some(t => t.includes(term)))
        );
        // 🔴 Fallback por tokens SOLO sin canonical: si el query dice "real
        // madrid", el canonical ya matchea preciso; los tokens sueltos
        // ("madrid") traerían partidos de Atlético Madrid por error.
        const tokenMatch = !termMatch && !hasCanonical && teams.some(t =>
          tokens.some(tok => t.length >= 4 && (t.includes(tok) || tok.includes(t)))
        );
        if (termMatch || tokenMatch) {
          results.push({ event: e, leagueId: league.id, leagueName: league.name });
        }
      }
    } catch { /* league timeout — skip */ }
  };

  await Promise.all(ESPN_LEAGUES.map(fetchLeague));

  // Dedupe por id (mismo evento puede aparecer en múltiples ligas/fechas)
  const seen = new Set<string>();
  const deduped = results.filter(({ event: e }) => {
    const id = e.id ?? `${e.name ?? ""}-${e.date ?? ""}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // 🔴 ORDEN DETERMINISTA — antes dependía del orden de completitud de las
  // promesas: "Barcelona" podía devolver un partido viejo en vez del último.
  // Prioridad: terminados/en vivo primero (más reciente primero), luego futuros.
  const eventDate = (e: EspnEvent) => new Date(e.date ?? e.competitions?.[0]?.date ?? 0).getTime() || 0;
  const stateOf = (e: EspnEvent) => espnEventState(e);
  deduped.sort((a, b) => {
    const sa = stateOf(a.event), sb = stateOf(b.event);
    const aDone = sa !== "pre", bDone = sb !== "pre";
    if (aDone !== bDone) return aDone ? -1 : 1; // jugados/en vivo primero
    return eventDate(b.event) - eventDate(a.event); // más reciente primero
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
  async run(args, ctx?: ToolRunContext) {
    // Fallback a __userInput si el LLM no pasa query (caso: "Como salió España ayer" sin args)
    const query = String(args.query ?? args.__userInput ?? "").trim();
    if (!query) return { type: "match_live", status: "failed", error: "Indicá el partido." };

    // FIX: usar ESPN como fuente principal. 🔴 FIX VENTANA: rango de 12 días
    // atrás + 14 adelante en UN fetch por liga — captura partidos de mitad de
    // semana (Real Madrid martes, pregunta el viernes) que antes quedaban fuera.
    const espnResults = await searchEspnScoreboards(query);

    // 🔴 Clasificación: jugados/en vivo para el resultado; futuros como `upcoming`
    // (sección "Próximos partidos" de la card, sin fixture aparte).
    const playedOrLive = espnResults.filter(r => espnEventState(r.event) !== "pre");
    const espnUpcoming = espnResults.filter(r => espnEventState(r.event) === "pre");

    if (playedOrLive.length > 0) {
      // 🔴 Tomar el partido más reciente jugado y enriquecerlo con /summary
      const first = playedOrLive[0];
      const playedMatches = playedOrLive.slice(0, 5).map(({ event }) => normalizeEspnEvent(event, first.leagueName));
      // Próximos del MISMO equipo (para la sección "Próximos partidos")
      const teamLower = (detectClub(query.toLowerCase()) ?? detectNationalTeam(query.toLowerCase()) ?? query).toLowerCase();
      const upcomingSameTeam = espnUpcoming
        .filter(r => {
          const comps = r.event.competitions ?? [];
          const teams = comps.flatMap(c => (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""));
          return teams.some(t => t.includes(teamLower) || teamLower.includes(t));
        })
        .slice(0, 4)
        .map(({ event }) => normalizeEspnEvent(event));

      // 🔴 Enriquecer con contexto del equipo (estadio, wiki) → interior más rico
      const teamContextPromise = fetchTeamContext(teamLower);
      const summaryPromise = first.event.id ? fetchEspnSummary(first.leagueId, first.event.id) : Promise.resolve(null);
      const [summary, teamContext] = await Promise.all([summaryPromise, teamContextPromise]);

      const matches = playedMatches;
      // Enriquecer el primer match con datos del /summary
      let enriched: { goals?: any[]; yellowCards?: any[]; redCards?: any[]; substitutions?: any[]; lineups?: any; detailedStats?: any[]; venue?: string; venueCity?: string; attendance?: number } = {};
      if (summary) {
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
        upcoming: upcomingSameTeam.length > 0 ? upcomingSameTeam : undefined,
        teamInfo: teamContext.teamInfo ?? undefined,
        wikipediaExtract: teamContext.wikipediaExtract ?? undefined,
        sources: teamContext.wikiSource ? [teamContext.wikiSource] : undefined,
        source: "ESPN",
        sourceUrl: "https://www.espn.com/soccer/",
        text: matches.map(m => `${m.homeTeam} ${m.homeScore ?? "?"} - ${m.awayScore ?? "?"} ${m.awayTeam} (${m.status})`).join("; "),
      };
    }

    // 🔴 Solo hay partidos FUTUROS ("cuando juega X" llegó a match_live):
    // devolver próximo + contexto, para que blocks arme la fixture enriquecida.
    if (espnUpcoming.length > 0) {
      const first = espnUpcoming[0];
      const upcomingMatches = espnUpcoming.slice(0, 5).map(({ event }) => normalizeEspnEvent(event, first.leagueName));
      const teamLower = (detectClub(query.toLowerCase()) ?? detectNationalTeam(query.toLowerCase()) ?? query).toLowerCase();
      const teamContext = await fetchTeamContext(teamLower);
      return {
        type: "match_live",
        status: "ok",
        query,
        matches: upcomingMatches,
        teamInfo: teamContext.teamInfo ?? undefined,
        wikipediaExtract: teamContext.wikipediaExtract ?? undefined,
        sources: teamContext.wikiSource ? [teamContext.wikiSource] : undefined,
        source: "ESPN",
        sourceUrl: "https://www.espn.com/soccer/",
        text: upcomingMatches.map(m => `${m.homeTeam} vs ${m.awayTeam} (${m.status})`).join("; "),
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

    // 🔴 KORU 3.0 — Fallback enriquecido: cuando no hay partidos, traer:
    // 1. Próximo partido del equipo (TheSportsDB eventsnextteam)
    // 2. Info de Wikipedia sobre el equipo
    // 3. Noticias recientes (GDELT)
    // Esto da valor al usuario aunque no haya partido jugado.
    // (fetchTeamContext comparte el lookup de equipo + Wikipedia con match_schedule.)
    const { teamInfo, wikipediaExtract: wikiExtract, wikiSource } = await fetchTeamContext(query);

    // Si encontramos el team, buscar próximo partido
    let nextMatch: TsdbEvent | null = null;
    if (teamInfo?.id) {
      try {
        const nextRes = await fetchJson<{ events?: TsdbEvent[] }>(
          `${TSDB_BASE}/eventsnextteam.php?id=${teamInfo.id}`,
          { timeoutMs: 8_000 },
        );
        if (nextRes.ok && nextRes.data?.events && nextRes.data.events.length > 0) {
          nextMatch = nextRes.data.events[0];
        }
      } catch { /* ignore */ }
    }

    // Si tenemos datos adicionales, devolver status "ok" con info útil
    if (teamInfo || nextMatch || wikiExtract) {
      const infoSections: string[] = [];
      if (teamInfo?.stadium) infoSections.push(`Estadio: ${teamInfo.stadium}`);
      if (teamInfo?.location) infoSections.push(`Ubicación: ${teamInfo.location}`);
      if (teamInfo?.league) infoSections.push(`Liga: ${teamInfo.league}`);
      if (nextMatch) {
        const kickoffLabel = formatKickoffUserTz(nextMatch.strTimestamp, ctx?.tzOffsetMin, { withDate: true });
        infoSections.push(`Próximo partido: ${nextMatch.strEvent} ${kickoffLabel ? `(${kickoffLabel})` : ""}`);
      }

      return {
        type: "match_live",
        status: "ok",
        query,
        matches: nextMatch ? [normalizeEvent(nextMatch)] : [],
        text: `No hay partidos recientes de "${query}". Pero te dejo info útil del equipo${infoSections.length > 0 ? ": " + infoSections.join(" · ") : "."}`,
        teamInfo,
        nextMatch: nextMatch ? normalizeEvent(nextMatch) : undefined,
        wikipediaExtract: wikiExtract,
        sources: wikiSource ? [wikiSource] : undefined,
        source: teamInfo ? "TheSportsDB + Wikipedia" : "Wikipedia",
        note: `No hay partidos recientes. Te mostramos info del equipo y próximo fixture.`,
      };
    }

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

// ─── fetchTeamContext ───────────────────────────────────────────────────────
// 🔴 FIX CARD FIXTURE — contexto de equipo compartido (TheSportsDB searchteams
// + extracto de Wikipedia). Lo usan tanto el fallback de match_live como el
// path principal de match_schedule (que antes llegaba sin teamInfo/nextMatch
// y la card de fixture quedaba vacía por dentro).
async function fetchTeamContext(teamQuery: string): Promise<{
  teamInfo: { id: string; name: string; stadium?: string; location?: string; league?: string; description?: string } | null;
  wikipediaExtract: string | null;
  wikiSource: { title: string; url: string; domain: string; snippet: string } | null;
}> {
  let teamInfo: { id: string; name: string; stadium?: string; location?: string; league?: string; description?: string } | null = null;
  try {
    const searchRes = await fetchJson<{ teams?: Array<{ idTeam?: string; strTeam?: string; strStadium?: string; strLocation?: string; strLeague?: string; strDescriptionES?: string; strDescriptionEN?: string }> }>(
      `${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(teamQuery)}`,
      { timeoutMs: 8_000 },
    );
    if (searchRes.ok && searchRes.data?.teams && searchRes.data.teams.length > 0) {
      const t = searchRes.data.teams[0];
      teamInfo = {
        id: t.idTeam ?? "",
        name: t.strTeam ?? teamQuery,
        stadium: t.strStadium,
        location: t.strLocation,
        league: t.strLeague,
        description: t.strDescriptionES || t.strDescriptionEN,
      };
    }
  } catch { /* ignore */ }

  let wikipediaExtract: string | null = null;
  let wikiSource: { title: string; url: string; domain: string; snippet: string } | null = null;
  try {
    // 🔴 FIX WIKI — buscar con el nombre LIMPIO del equipo (strTeam de TSDB)
    // en vez de `${teamQuery} football team`: "real madrid football team"
    // devolvía "Real Madrid Castilla" (la filial) como primer resultado.
    const wikiQuery = teamInfo?.name ?? teamQuery;
    const wikiRes = await fetch(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wikiQuery)}&format=json&origin=*&srlimit=3`, {
      signal: AbortSignal.timeout(9000),
      // 🔴 FIX 403 — Wikipedia bloquea el UA default de Node (403 Forbidden).
      // La API pide un UA descriptivo con contacto.
      headers: { "User-Agent": "MichiApp/1.0 (+https://koru-mvp.onrender.com; sports assistant)" },
    });
    const wikiData = await wikiRes.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
    const results = wikiData.query?.search ?? [];
    // Preferir el resultado cuyo título empiece con el nombre del equipo (evita
    // filiales/duplicados: "Real Madrid CF" > "Real Madrid Castilla").
    const clean = wikiQuery.toLowerCase().trim();
    const best = results.find(r => r.title.toLowerCase().startsWith(clean.slice(0, 12))) ?? results[0];
    if (best) {
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(best.title)}`, {
        signal: AbortSignal.timeout(9000),
        headers: { "User-Agent": "MichiApp/1.0 (+https://koru-mvp.onrender.com; sports assistant)" },
      });
      const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
      wikipediaExtract = summary.extract ?? null;
      wikiSource = {
        title: best.title,
        url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(best.title)}`,
        domain: "es.wikipedia.org",
        snippet: best.snippet?.replace(/<[^>]+>/g, "") ?? "",
      };
    }
  } catch { /* ignore */ }

  return { teamInfo, wikipediaExtract, wikiSource };
}

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
  async run(args, runCtx?: ToolRunContext) {
    // 🔴 KORU 3.0 — fallback a __userInput cuando el LLM no pasa team
    // (caso: detector de simulated tool call extrae solo el nombre, sin args)
    const team = String(args.team ?? args.__userInput ?? "").trim();
    const league = String(args.league ?? "").trim();
    const next = Number(args.next ?? 5);
    if (!team && !league) return { type: "match_schedule", status: "failed", error: "Indicá equipo o liga." };

    // 🔴 KORU 3.0 — ESPN PRIMARIO para fixture. 🔴 FIX RANGOS: UN fetch por liga
    // con dates=START-END (antes: 7 fetches por día por liga = 63 requests →
    // rate-limit 429 de ESPN) + detección de COPAS ("copa del rey", "libertadores")
    // + sinónimos de clubes europeos + fallback por tokens para query crudo.
    const espnResults = await searchEspnScoreboards(team || league);
    const now = new Date();

    // Filtrar solo partidos futuros
    const upcomingEspn = espnResults
      .map(({ event, leagueName }) => normalizeEspnEvent(event, leagueName))
      .filter(m => {
        const d = m.date ? new Date(m.date) : null;
        return d && d.getTime() >= now.getTime() - 3 * 60 * 60 * 1000;
      })
      .sort((a, b) => (a.date ?? "") > (b.date ?? "") ? 1 : -1)
      .slice(0, next);

    if (upcomingEspn.length > 0) {
      // 🔴 FIX CARD FIXTURE — el path ESPN devolvía SOLO matches: la card de
      // fixture quedaba sin nextMatch (interior sin partido protagonista) y
      // sin teamInfo (interior sin estadio/liga). Enriquecemos en paralelo
      // con el mismo contexto de equipo que usa el fallback (searchteams +
      // Wikipedia). Si falla, seguimos devolviendo los matches (compatible).
      const first = upcomingEspn[0];
      const ctx = await fetchTeamContext(team || league);
      // 🔴 FIX TZ — hora de kickoff en la tz del USUARIO (antes: hora del server
      // = UTC en Render → “00:30” para un partido 21:30 AR / 02:30 Madrid).
      const kickoff = formatKickoffUserTz(first.date as string, runCtx?.tzOffsetMin);
      // 🔴 FIX ESCUDOS — nextMatch ahora lleva logos/abreviaturas/colores REALES
      // de ESPN: la card de fixture renderiza el escudo en vez de iniciales.
      return {
        type: "match_schedule",
        status: "ok",
        team: team || league,
        matches: upcomingEspn,
        nextMatch: {
          homeTeam: first.homeTeam,
          awayTeam: first.awayTeam,
          date: first.date,
          time: kickoff,
          league: first.league,
          homeLogo: first.homeLogo,
          awayLogo: first.awayLogo,
          homeAbbrev: first.homeAbbrev,
          awayAbbrev: first.awayAbbrev,
          homeColor: first.homeColor,
          awayColor: first.awayColor,
        },
        teamInfo: ctx.teamInfo ?? undefined,
        wikipediaExtract: ctx.wikipediaExtract ?? undefined,
        sources: ctx.wikiSource ? [ctx.wikiSource] : undefined,
        source: ctx.teamInfo ? "ESPN + TheSportsDB + Wikipedia" : "ESPN",
        sourceUrl: "https://www.espn.com/soccer/",
      };
    }

    // Fallback: TheSportsDB
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

    const nowMs = now.getTime();
    const upcoming = events
      .filter((e) => e.strTimestamp && new Date(e.strTimestamp).getTime() >= nowMs - 3 * 60 * 60 * 1000)
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
            .filter((e) => e.strTimestamp && new Date(e.strTimestamp).getTime() >= nowMs - 3 * 60 * 60 * 1000)
            .sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1)
            .slice(0, 3);
          all.push(...evs);
        }
      }
      const fallbackUpcoming = all
        .sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1)
        .slice(0, next);

      // 🔴 KORU 3.0 — Verificar si los partidos del fallback incluyen al equipo
      const teamLower = (team || league).toLowerCase();
      const matchesIncludeTeam = fallbackUpcoming.some(e => {
        const home = (e.strHomeTeam ?? "").toLowerCase();
        const away = (e.strAwayTeam ?? "").toLowerCase();
        return home.includes(teamLower) || away.includes(teamLower) ||
               teamLower.includes(home) || teamLower.includes(away);
      });

      // Si hay partidos Y incluyen al equipo, devolverlos
      if (fallbackUpcoming.length > 0 && matchesIncludeTeam) {
        return {
          type: "match_schedule",
          status: "ok",
          team: team || league,
          matches: fallbackUpcoming.map(normalizeEvent),
          source: "TheSportsDB (liga popular)",
          note: `Próximos partidos de ligas destacadas.`,
        };
      }

      // 🔴 KORU 3.0 — Fallback enriquecido: traer info del equipo + Wikipedia
      // cuando no hay partidos del equipo o los partidos no lo incluyen
      let teamInfo: { id: string; name: string; stadium?: string; location?: string; league?: string; description?: string } | null = null;
      try {
        const searchRes = await fetchJson<{ teams?: Array<{ idTeam?: string; strTeam?: string; strStadium?: string; strLocation?: string; strLeague?: string; strDescriptionES?: string; strDescriptionEN?: string }> }>(
          `${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(team || league)}`,
          { timeoutMs: 8_000 },
        );
        if (searchRes.ok && searchRes.data?.teams && searchRes.data.teams.length > 0) {
          const t = searchRes.data.teams[0];
          teamInfo = {
            id: t.idTeam ?? "",
            name: t.strTeam ?? (team || league),
            stadium: t.strStadium,
            location: t.strLocation,
            league: t.strLeague,
            description: t.strDescriptionES || t.strDescriptionEN,
          };
        }
      } catch { /* ignore */ }

      let wikiExtract: string | null = null;
      let wikiSource: { title: string; url: string; domain: string; snippet: string } | null = null;
      try {
        const wikiRes = await fetch(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${team || league} football team`)}&format=json&origin=*&srlimit=1`, {
          signal: AbortSignal.timeout(9000),
          headers: { "User-Agent": "MichiApp/1.0 (+https://koru-mvp.onrender.com; sports assistant)" },
        });
        const wikiData = await wikiRes.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
        const results = wikiData.query?.search ?? [];
        if (results.length > 0) {
          const title = results[0].title;
          const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
            signal: AbortSignal.timeout(9000),
            headers: { "User-Agent": "MichiApp/1.0 (+https://koru-mvp.onrender.com; sports assistant)" },
          });
          const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
          wikiExtract = summary.extract ?? null;
          wikiSource = {
            title,
            url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            domain: "es.wikipedia.org",
            snippet: results[0].snippet?.replace(/<[^>]+>/g, "") ?? "",
          };
        }
      } catch { /* ignore */ }

      if (teamInfo || wikiExtract) {
        return {
          type: "match_schedule",
          status: "ok",
          team: team || league,
          matches: [],
          teamInfo: teamInfo ?? undefined,
          wikipediaExtract: wikiExtract ?? undefined,
          sources: wikiSource ? [wikiSource] : undefined,
          source: teamInfo ? "TheSportsDB + Wikipedia" : "Wikipedia",
          note: `No hay próximos partidos de "${team || league}" programados. Te mostramos info del equipo.`,
        };
      }
      return { type: "match_schedule", status: "ok", team: team || league, matches: [], note: "No encontré próximos partidos." };
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
