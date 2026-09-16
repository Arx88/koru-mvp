/**
 * Bloque Sports — Fútbol multi-liga.
 * API: TheSportsDB (key pública gratuita "3"). 1.200+ competencias.
 */

import { defineTool, policies, type ToolRunContext, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, getCached, setCached, ttls } from "../shared/cache";
import {
  ESPN_LEAGUES,
  ESPN_SITE_BASE,
  NATIONAL_LEAGUE_IDS,
  fetchEspnTeamSchedule,
  resolveEspnTeam,
  type ResolvedEspnTeam,
} from "./espn";

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
// Catálogo de ligas, resolvedor de equipos y calendario por equipo: viven en
// ./espn para que todas las tools deportivas compartan UNA fuente de verdad.
const ESPN_BASE = ESPN_SITE_BASE;

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
 * Detecta los clubes mencionados en el query y devuelve sus canonical names,
 * ordenados por APARICIÓN en el texto (no por orden del diccionario: el orden
 * importa para armar consultas "local vs visitante").
 *
 * 🔴 FIX 2026-09-15 — el texto del usuario suele venir sin espacios entre
 * nombres propios ("Como salio independiente con sanlorenzo"): además del match
 * por palabra, se compara la versión SIN espacios, así "san lorenzo" matchea
 * "sanlorenzo". Sin esto, TheSportsDB recibía la frase cruda y devolvía null.
 */
function detectClubs(queryLower: string, limit = 2): string[] {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, "");
  const squashedQuery = squash(queryLower);
  const hits: Array<{ canonical: string; index: number }> = [];

  for (const club of CLUB_SYNONYMS) {
    let best = -1;
    for (const alias of club.aliases) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const m = re.exec(queryLower);
      if (m) best = best < 0 ? m.index : Math.min(best, m.index);
      // Alias multi-palabra también sin espacios ("san lorenzo" ~ "sanlorenzo")
      if (alias.includes(" ")) {
        const flat = squash(alias);
        const idx = flat ? squashedQuery.indexOf(flat) : -1;
        if (idx >= 0) best = best < 0 ? idx : Math.min(best, idx);
      }
    }
    if (best >= 0) hits.push({ canonical: club.canonical, index: best });
  }

  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of hits) {
    if (seen.has(hit.canonical)) continue;
    seen.add(hit.canonical);
    out.push(hit.canonical);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 🔴 FIX CONSULTA TSDB (2026-09-15) — TheSportsDB `searchevents.php` exige el
 * formato "Equipo vs Equipo": con la frase cruda del usuario
 * ("Como salio independiente con sanlorenzo") devuelve `{"event":null}`,
 * mientras que "Independiente vs San Lorenzo" devuelve el partido.
 * Candidatos en orden de probabilidad; la frase cruda va última por
 * compatibilidad con queries que ya venían en formato correcto.
 */
export function tsdbQueryCandidates(rawQuery: string): string[] {
  const q = String(rawQuery ?? "").trim();
  if (!q) return [];
  const clubs = detectClubs(q.toLowerCase());
  const out: string[] = [];
  if (clubs.length >= 2) {
    out.push(`${clubs[0]} vs ${clubs[1]}`);
    out.push(`${clubs[1]} vs ${clubs[0]}`);
  } else if (clubs.length === 1) {
    // Un solo club: TSDB espera el par, pero el nombre canónico cubre
    // consultas del tipo "cuando juega Boca".
    out.push(clubs[0]);
  }
  out.push(q);
  return [...new Set(out)];
}

/**
 * 🔴 FIX NOMBRE DE EQUIPO SUCIO (2026-09-16) — el router llega a pasar la frase
 * ENTERA como equipo: para "cuándo juega Boca" la tool recibió
 * team="cuándo juega Boca". Con eso ESPN no resuelve ningún equipo, TheSportsDB
 * busca la frase y la Wikipedia devuelve cualquier cosa (Riquelme en lugar del
 * club) → la card de fixture quedaba vacía con la info de otra persona.
 *
 * Devuelve el club/selección REAL si aparece en el texto (diccionario propio) y,
 * si no, limpia las palabras de la pregunta para quedarse con el nombre
 * ("próximos partidos de Real Madrid" → "Real Madrid").
 */
export function cleanTeamQuery(raw: string): string {
  const text = String(raw ?? "").replace(/[¿?¡!]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const club = detectClub(lower) ?? detectNationalTeam(lower);
  if (club) return club;
  const LEAD = /^(cu[aá]ndo|a\s+qu[eé]\s+hora|qu[eé]\s+hora|qu[eé]\s+d[ií]a|cu[aá]l|pr[oó]xim\w*|fixture|calendario|agenda|partidos?|juega|juegan|jugar|hay|es|el|la|los|las|de|del|vs)\s+/i;
  let out = text;
  for (let prev = ""; out !== prev; ) {
    prev = out;
    out = out.replace(LEAD, "").trim();
  }
  return out || text;
}

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
  season?: { displayName?: string };
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
        /** 🔴 El calendario POR EQUIPO (`/schedule?fixture=true`) no manda
         *  `logo` singular: trae `logos[]`. Sin esto el fixture salía sin escudo. */
        logos?: Array<{ href?: string }>;
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
 *
 * 🔴 FIX MUNDIAL (2026-09-12) — dos bugs encadenados con selecciones nacionales:
 * 1) VENTANA CORTA: una selección puede no jugar por meses (post-Mundial,
 * ventanas de amistosos). "quién ganó la final del Mundial" a 55 días de la
 * final (19/7/2026) caía FUERA de los 12 días → 0 resultados → el LLM
 * alucinaba ("esa final no existió").
 * 2) CAP DE 100 EVENTOS DE ESPN: NO se puede simplemente ensanchar la ventana —
 * `dates=` con >100 eventos devuelve los MÁS VIEJOS y CORTA los más nuevos
 * (verificado: rango 11/6→19/7 completo = 100 eventos hasta el 12/7, SIN la
 * final). Solución: back-fill por CHUNKS de ~30 días, del más reciente hacia
 * atrás, CORTANDO al primer chunk con match del equipo (el usuario quiere el
 * último partido jugado, no todo el historial).
 * Las selecciones juegan en ≤3 ligas ESPN → solo se fetchean esas (más rápido
 * que las 19 ligas de clubes).
 */
async function searchEspnScoreboards(
  query: string,
  opts: { fromDays?: number; toDays?: number; pairText?: string; resolvedTeam?: ResolvedEspnTeam | null } = {},
): Promise<{ events: Array<{ event: EspnEvent; leagueId: string; leagueName: string }>; okLeagues: number; failedLeagues: number }> {
  const fromDays = opts.fromDays ?? 12;
  const toDays = opts.toDays ?? 14;
  const queryLower = query.toLowerCase();    // 🔴 FIX PAR PERDIDO (2026-09-16): el texto para detectar "el partido entre
    // estos dos clubes" puede ser el del USUARIO (más rico) aunque el `query` de la
    // tool venga recortado a un solo club. Ver matchLive.
  const results: Array<{ event: EspnEvent; leagueId: string; leagueName: string }> = [];

  const now = new Date();
  const DAY_MS = 86_400_000;
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

  const nationalTeam = detectNationalTeam(queryLower);
  const club = detectClub(queryLower);
  const leagueHit = detectLeague(queryLower);
  // 🔴 FIX MUNDIAL: intención de selección (equipo nacional o liga de
  // selecciones como el Mundial) → solo ligas de selecciones + back-fill.
  const nationalIntent = !!nationalTeam || (!!leagueHit && NATIONAL_LEAGUE_IDS.has(leagueHit.id));
  // 🔴 FIX COBERTURA (2026-09-16) — el resolver de ESPN aporta el nombre CANÓNICO
  // de clubes que no están en el diccionario propio (Talleres, Instituto…). Sin
  // esto, esos clubes dependían del matcheo por tokens, que es impreciso.
  const resolvedCanonical = opts.resolvedTeam && opts.resolvedTeam.score >= 4 ? opts.resolvedTeam.teamName : null;
  // 🔴 Canonical detectado → matcheo PRECISO por nombre de equipo. Sin
  // canonical → fallback por tokens (equipos fuera del diccionario).
  const hasCanonical = !!(nationalTeam || club || resolvedCanonical);

  // Términos de matcheo: canonical detectado + query completo + tokens del query
  const matchTerms: string[] = [queryLower];
  if (nationalTeam) matchTerms.push(nationalTeam.toLowerCase());
  if (club) matchTerms.push(club.toLowerCase());
  if (resolvedCanonical) matchTerms.push(resolvedCanonical.toLowerCase());
  const tokens = contentTokens(queryLower);

  // ¿El query ES una liga/copa? → traer TODOS los eventos de esa liga
  // ("cómo salió la copa del rey de ayer" → eventos de esp.copa_del_rey).
  const leagueMode = !!leagueHit && !club && !nationalTeam;

  // 🔴 FIX FUENTE CAÍDA (2026-09-15) — ESPN RECHAZA rangos de forma caprichosa
  // y verificada: `dates=20260901-20260929` → HTTP 200 (45 eventos), pero
  // `dates=20260903-20260929` (la ventana que usa esta tool) → HTTP 400
  // {"code":400,"message":"Failed to get events endpoint."}. El barrido mostró
  // que la aceptación no depende de la duración: 0901-0929 (200) y 0901-0927
  // (400) — es una lotería interna de ESPN.
  // Antes: `if (!res.ok) return {}` → el 400 se leía como "sin partidos" y el
  // turno terminaba diciéndole al usuario que el partido no existe.
  // Ahora: (a) el fallo se distingue de "sin eventos"; (b) si el rango falla se
  // barre día por día (los días sueltos SÍ responden) con presupuesto compartido
  // entre ligas para no martillar la API.
  // Presupuesto compartido entre ligas para el barrido día por día. 80 alcanza
  // para que cada una de las ~20 ligas mire los últimos 4 días (que es donde
  // está el partido que el usuario pregunta) sin martillar la API.
  const DAY_SWEEP_BUDGET = 80;
  const sweepBudget = { left: DAY_SWEEP_BUDGET };
  let okLeagues = 0;
  let failedLeagues = 0;
  // Consulta de DOS clubes ("cómo salió independiente con sanlorenzo"): el
  // partido está en el PASADO, así que el barrido no gasta presupuesto en días
  // futuros (y los homónimos de otros países los filtra el filtro de par exacto
  // del final: "Independiente Santa Fe" ya no puede colarse).
  const pairQuery = detectClubs((opts.pairText ?? query).toLowerCase()).length >= 2;

  const fetchRange = async (
    league: { id: string; name: string },
    startDate: Date,
    endDate: Date,
  ): Promise<{ events: EspnEvent[]; failed: boolean }> => {
    // 🔴 FIX DÍA SUELTO (2026-09-15): `dates=20260913-20260913` (rango con el
    // mismo día en ambos extremos) → HTTP 400; `dates=20260913` → HTTP 200.
    const startStamp = fmt(startDate);
    const endStamp = fmt(endDate);
    const range = startStamp === endStamp ? startStamp : `${startStamp}-${endStamp}`;
    const cacheKey = `espn:sb:${league.id}:${range}`;
    try {
      const data = await cached<{ events?: EspnEvent[] } | null>(cacheKey, 60 * 1000, async () => {
        const res = await fetch(`${ESPN_BASE}/${league.id}/scoreboard?dates=${range}`, {
          signal: AbortSignal.timeout(8000),
        });
        // null = la fuente falló (HTTP 400/500) ≠ {} = la liga no tiene eventos
        if (!res.ok) return null;
        return await res.json() as { events?: EspnEvent[] };
      });
      if (!data) return { events: [], failed: true };
      return { events: (data.events ?? []).filter(Boolean), failed: false };
    } catch {
      return { events: [], failed: true };
    }
  };

  /**
   * Eventos de una ventana. Camino feliz: UN fetch por rango. Si ESPN lo rechaza
   * (400) o la request revienta, barre día por día — priorizando los días más
   * cercanos a hoy (pasado antes que futuro, que es lo que pregunta el usuario
   * con "cómo salió"). `failed` significa que NINGÚN día respondió: eso es
   * "fuente caída", no "sin partidos".
   */
  const fetchWindow = async (
    league: { id: string; name: string },
    startDate: Date,
    endDate: Date,
  ): Promise<{ events: EspnEvent[]; failed: boolean }> => {
    const wide = await fetchRange(league, startDate, endDate);
    if (!wide.failed) return wide;

    let days: Date[] = [];
    for (let t = startDate.getTime(); t <= endDate.getTime(); t += DAY_MS) days.push(new Date(t));
    // Dos clubes = resultado de un partido ya jugado → solo días pasados.
    if (pairQuery) days = days.filter(d => d.getTime() <= now.getTime() + 12 * 60 * 60 * 1000);
    days.sort((a, b) => {
      const da = Math.abs(a.getTime() - now.getTime());
      const db = Math.abs(b.getTime() - now.getTime());
      if (da !== db) return da - db; // lo más cercano a hoy primero
      return a.getTime() < b.getTime() ? -1 : 1; // empate → el pasado manda
    });

    const out: EspnEvent[] = [];
    let anyOk = false;
    for (const day of days) {
      if (sweepBudget.left <= 0) break;
      sweepBudget.left--;
      const r = await fetchRange(league, day, day);
      if (r.failed) continue;
      anyOk = true;
      out.push(...r.events);
      // Corte temprano: ya hay un partido JUGADO del equipo consultado en esta
      // liga. Se deja de gastar presupuesto y se lo reserva para las demás.
      if (r.events.some(e => espnEventState(e) !== "pre" && matchesQuery(e, league.id))) break;
    }
    return { events: out, failed: !anyOk };
  };

  const matchesQuery = (e: EspnEvent, leagueId: string): boolean => {
    if (leagueMode && leagueHit?.id === leagueId) {
      // Query de copa/liga → todos los eventos de esa liga
      return true;
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
    return termMatch || tokenMatch;
  };

  const fetchLeague = async (league: { id: string; name: string }): Promise<void> => {
    let anyOk = false;
    let anyFailed = false;
    try {
      if (!nationalIntent) {
        // Comportamiento clásico de clubes: UNA ventana (pasado → futuro).
        // (fetchWindow barre día por día si ESPN rechaza el rango completo.)
        const wide = await fetchWindow(
          league,
          new Date(now.getTime() - fromDays * DAY_MS),
          new Date(now.getTime() + toDays * DAY_MS),
        );
        anyOk = !wide.failed;
        anyFailed = wide.failed;
        for (const e of wide.events) {
          if (matchesQuery(e, league.id)) {
            results.push({ event: e, leagueId: league.id, leagueName: league.name });
          }
        }
        return;
      }

      // 🔴 FIX MUNDIAL: back-fill por chunks para selecciones. Chunk A =
      // ventana estándar (incluye futuro); B..E = ~30 días hacia atrás.
      // Corta al PRIMER chunk con match: el más reciente es el que importa.
      const CHUNKS: Array<[number, number]> = [
        [fromDays, -toDays], // A: [12d atrás, 14d adelante]
        [42, 12], [72, 42], [102, 72], [132, 102],
      ];
      for (const [startBack, endBack] of CHUNKS) {
        const chunk = await fetchWindow(
          league,
          new Date(now.getTime() - startBack * DAY_MS),
          new Date(now.getTime() - endBack * DAY_MS),
        );
        if (chunk.failed) anyFailed = true; else anyOk = true;
        let found = 0;
        for (const e of chunk.events) {
          if (matchesQuery(e, league.id)) {
            results.push({ event: e, leagueId: league.id, leagueName: league.name });
            found++;
          }
        }
        if (found > 0) break; // último partido del equipo encontrado → suficiente
      }
    } catch {
      anyFailed = true;
    } finally {
      // Contabilidad por LIGA (no por fetch): sirve para distinguir "ninguna
      // fuente respondió" de "respondieron y no hay partidos".
      if (anyOk) okLeagues++;
      else if (anyFailed) failedLeagues++;
    }
  };

  // 🔴 FIX CONSULTA DE COPA/LIGA (2026-09-15) — "cómo salió la champions"
  // fetcheaba las 20 ligas y el presupuesto del barrido se repartía entre todas:
  // si ESPN rechazaba el rango, la liga pedida quedaba sin días barridos → no_data.
  // Si el query ES una copa/liga, alcanza con esa competencia (y sobra presupuesto).
  const leagueOnly = leagueMode && leagueHit ? ESPN_LEAGUES.filter(l => l.id === leagueHit.id) : [];
  const leaguesToFetch = nationalIntent
    ? ESPN_LEAGUES.filter(l => NATIONAL_LEAGUE_IDS.has(l.id))
    : leagueOnly.length > 0
      ? leagueOnly
      : ESPN_LEAGUES;

  await Promise.all(leaguesToFetch.map(fetchLeague));

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

  // 🔴 FIX PARTIDO EQUIVOCADO (2026-09-15) — con "independiente con sanlorenzo"
  // el matcheo por substring devolvía "Independiente Santa Fe" (Colombia) y
  // "Independiente Rivadavia" (Mendoza) en vez del clásico de Avellaneda.
  // Dos filtros de precisión, en orden; si ninguno aplica se devuelve todo el set
  // (para no romper consultas vagas tipo "cómo salió el rojo"):
  //   1) si la consulta nombra DOS clubes, el usuario quiere el partido entre
  //      ellos → quedarse con los eventos que contienen a los dos;
  //   2) si hay eventos con el nombre de equipo EXACTO del canónico, descartar
  //      los que solo matchean por parecido.
  const clubsInQuery = detectClubs((opts.pairText ?? query).toLowerCase());
  if (clubsInQuery.length >= 2) {
    // Solo el partido ENTRE esos dos clubes responde la pregunta. Si no está,
    // se devuelve vacío a propósito: mejor "no tengo el dato" que mostrarle al
    // usuario el partido de un homónimo (era el reclamo del bug reportado).
    const pair = deduped.filter(({ event }) => {
      const teams = eventTeamNames(event);
      return clubsInQuery.every(c => teams.some(t => t.includes(c.toLowerCase())));
    });
    return { events: pair, okLeagues, failedLeagues };
  }
  const canonicalTeam = club ?? nationalTeam;
  if (canonicalTeam) {
    const target = canonicalTeam.toLowerCase();
    const exact = deduped.filter(({ event }) => eventTeamNames(event).some(t => t === target));
    if (exact.length > 0) return { events: exact, okLeagues, failedLeagues };
  }

  return { events: deduped, okLeagues, failedLeagues };
}

/**
 * 🔴 FIX RESULTADO DE EQUIPO (2026-09-15) — `eventslast.php` de TheSportsDB:
 * los últimos partidos JUGADOS del equipo, con marcador. Fuente que sí responde
 * cuando ESPN rechaza el rango (HTTP 400) y solo devuelve fixtures.
 * (Verificado: Boca → "Boca Juniors 3-1 Central Córdoba, FT, 2026-09-12".)
 */
async function fetchTsdbLastEvents(teamId: string, limit = 5): Promise<TsdbEvent[]> {
  if (!teamId) return [];
  try {
    const cacheKey = `tsdb:last:${teamId}`;
    const hit = getCached<TsdbEvent[]>(cacheKey);
    if (hit) return hit;
    const r = await fetchJson<{ results?: TsdbEvent[] }>(
      `${TSDB_BASE}/eventslast.php?id=${encodeURIComponent(teamId)}`,
      { timeoutMs: 9_000 },
    );
    // Solo se cachean aciertos: un 429 cacheado dejaría al equipo sin
    // resultados (y envenenaría el turno siguiente).
    if (!r.ok) return [];
    const raw = r.data?.results ?? [];
    const sorted = [...raw].sort((a, b) =>
      String(b.strTimestamp ?? b.dateEvent ?? "").localeCompare(String(a.strTimestamp ?? a.dateEvent ?? "")),
    ).slice(0, limit);
    setCached(cacheKey, sorted, ttls.sportsLive);
    return sorted;
  } catch {
    return [];
  }
}

/** Nombres de equipo (displayName) de un evento ESPN, en minúsculas. */
function eventTeamNames(e: EspnEvent): string[] {
  return (e.competitions ?? []).flatMap(c =>
    (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""),
  ).filter(Boolean);
}

function normalizeEspnEvent(e: EspnEvent, leagueName?: string) {
  const comps = e.competitions ?? [];
  const comp = comps[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find(c => c.homeAway === "home");
  const away = competitors.find(c => c.homeAway === "away");
  // 🔴 FIX EVENTOS SIN STATUS (2026-09-16) — los eventos del calendario por
  // equipo no traen `status`: sin este fallback la card de fixture recibía "?" y
  // se dibujaba como si el partido ya hubiera terminado.
  const stateRaw = e.status?.type?.state;
  const status = e.status?.type?.description ?? e.status?.type?.detail
    ?? (stateRaw === "post" ? "Finalizado" : stateRaw === "in" ? "En vivo" : "Programado");
  const venue = comp?.venue;
  return {
    id: e.id,
    eventId: e.id,
    match: `${home?.team?.displayName ?? "?"} vs ${away?.team?.displayName ?? "?"}`,
    homeTeam: home?.team?.displayName,
    awayTeam: away?.team?.displayName,
    homeShortName: home?.team?.shortDisplayName,
    awayShortName: away?.team?.shortDisplayName,
    // El calendario por equipo trae `logos[]` (no `logo`): sin el fallback el
    // fixture salía sin escudo.
    homeLogo: home?.team?.logo ?? home?.team?.logos?.[0]?.href,
    awayLogo: away?.team?.logo ?? away?.team?.logos?.[0]?.href,
    homeColor: home?.team?.color ? `#${home.team.color}` : undefined,
    awayColor: away?.team?.color ? `#${away.team.color}` : undefined,
    homeAbbrev: home?.team?.abbreviation,
    awayAbbrev: away?.team?.abbreviation,
    homeScore: home?.score != null ? Number(home.score) : undefined,
    awayScore: away?.score != null ? Number(away.score) : undefined,
    status,
    // "pre" | "in" | "post" — default "pre" (sin status = partido por jugar)
    state: stateRaw ?? "pre",
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
/**
 * 🔴 FIX FIXTURE POR EQUIPO (2026-09-16) — por qué existe este camino:
 * ESPN RECHAZA los rangos de fechas con HTTP 400 de forma caprichosa
 * (`dates=20260916-20261016` → 400, pero cada día suelto → 200). El barrido día
 * por día reparte su presupuesto entre ~20 ligas, así que un partido a 4+ días
 * vista quedaba FUERA y "cuándo juega Boca" terminaba sin card, aunque ESPN
 * tuviera el partido (Boca en San Lorenzo, 20/09).
 *
 * Este camino no depende de rangos: resuelve el equipo (liga + id) y pide su
 * CALENDARIO completo. DOS requests y ya está el fixture de la temporada (para
 * selecciones también: el calendario es por competencia, ver ./espn).
 *
 * La resolución del club vive en ./espn (compartida con match_live): ahí están
 * los supuestos verificados de la búsqueda de ESPN y el filtro `sport=soccer`
 * que impide que un homónimo de otro deporte se cuele.
 */
async function fetchEspnTeamFixture(
  teamQuery: string,
  limit = 5,
  resolvedTeam?: ResolvedEspnTeam | null,
): Promise<{ events: Array<{ event: EspnEvent; leagueId: string; leagueName: string }>; teamName?: string; teamId?: string; leagueId?: string; resolved?: ResolvedEspnTeam } | null> {
  const q = String(teamQuery ?? "").trim();
  if (!q) return null;
  try {
    // `resolvedTeam` ya viene resuelto por el caller (y está cacheado): se evita
    // una segunda vuelta por la búsqueda de entidades.
    const resolved = resolvedTeam !== undefined ? resolvedTeam : await resolveEspnTeam(q);
    if (!resolved) return null;
    // OJO: vale también para SELECCIONES. ESPN expone el id de la selección por
    // competencia ("Spain" = 164 en uefa.nations, 17640 en fifa.wworldq.uefa) y su
    // calendario trae los partidos de ESA competencia; cuando queda vacío, el
    // scoreboard (más abajo en matchSchedule) sigue siendo el fallback.
    const schedule = await fetchEspnTeamSchedule<EspnEvent>(resolved.leagueId, resolved.teamId);
    if (!schedule) return null;

    const nowMs = Date.now();
    const upcoming = schedule
      .filter(e => {
        const t = new Date(e.date ?? e.competitions?.[0]?.date ?? "").getTime();
        return Number.isFinite(t) && t >= nowMs - 3 * 60 * 60 * 1000;
      })
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      .slice(0, limit);

    const leagueName = resolved.leagueName ?? resolved.leagueId;
    return {
      events: upcoming.map(event => ({ event, leagueId: resolved.leagueId, leagueName })),
      teamName: resolved.teamName,
      teamId: resolved.teamId,
      leagueId: resolved.leagueId,
      resolved,
    };
  } catch {
    return null;
  }
}

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
  strLeagueBadge?: string;
  dateEvent?: string;
  strTime?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  // 🔴 FIX ESCUDOS (2026-09-15): TSDB trae los badges reales de cada equipo
  // (verificado en eventslast.php: r2.thesportsdb.com/.../team/badge/...png).
  // Sin esto, los resultados que resuelve TSDB salían sin escudo.
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  strVenue?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strTimestamp?: string;
  strStatus?: string;
  strSport?: string;
};

/**
 * 🔴 FIX PRÓXIMOS PARTIDOS (2026-09-15) — el endpoint correcto es
 * `eventsnext.php?id=` (verificado HTTP 200 → {"events":[...]}); el que usaba
 * el código, `eventsnextteam.php?id=`, devuelve **404** → nunca había próximo
 * partido desde TheSportsDB.
 */
/**
 * 🔴 `searchevents.php` POR TEXTO — un solo lugar para los tres detalles que
 * estaban mal repartidos por el archivo:
 *  (a) la respuesta viene en la clave `event` (SINGULAR): leer `.events` daba []
 *      siempre (dejaba sin fixture y sin resultado al fallback de TheSportsDB);
 *  (b) la búsqueda es por texto en TODOS los deportes: "Boca Juniors" traía su
 *      partido de básquet contra NBA G League United, que por ser futuro quedaba
 *      primero y se mostraba como el próximo partido del club;
 *  (c) los fallos de la key pública (429) NO se cachean, para no dejar al equipo
 *      sin datos durante todo el TTL.
 * Devuelve los partidos de fútbol, más reciente primero, y `failed` para poder
 * distinguir "la fuente no respondió" de "la fuente dice que no hay partidos".
 */
async function fetchTsdbSearchEvents(text: string): Promise<{ events: TsdbEvent[]; failed: boolean }> {
  const q = String(text ?? "").trim();
  if (!q) return { events: [], failed: false };
  const cacheKey = `tsdb:search:${q.toLowerCase()}`;
  const hit = getCached<TsdbEvent[]>(cacheKey);
  if (hit) return { events: hit, failed: false };
  try {
    const r = await fetchJson<{ event?: TsdbEvent[]; events?: TsdbEvent[] }>(
      `${TSDB_BASE}/searchevents.php?e=${encodeURIComponent(q)}`,
      { timeoutMs: 9_000 },
    );
    if (!r.ok) return { events: [], failed: true };
    const all = r.data?.event ?? r.data?.events ?? [];
    const soccer = all.filter(e => !e.strSport || /soccer/i.test(String(e.strSport)));
    const sorted = [...soccer].sort((a, b) =>
      String(b.strTimestamp ?? b.dateEvent ?? "").localeCompare(String(a.strTimestamp ?? a.dateEvent ?? "")),
    );
    setCached(cacheKey, sorted, ttls.sportsLive);
    return { events: sorted, failed: false };
  } catch {
    return { events: [], failed: true };
  }
}

/**
 * 🔴 Escudos + fecha/hora de los partidos de TheSportsDB. TSDB solo da badges y
 * `strTime`/`strTimestamp`; sin esto la card de fixture quedaba sin escudo y con
 * la hora del server (o vacía).
 */
function normalizeTsdbUpcoming(events: TsdbEvent[], tzOffsetMin?: number) {
  return events.map(e => ({
    ...normalizeEvent(e),
    time: formatKickoffUserTz(e.strTimestamp ?? e.dateEvent, tzOffsetMin) ?? e.strTime,
  }));
}

async function fetchTsdbNextEvents(teamId: string, limit = 4): Promise<TsdbEvent[]> {
  if (!teamId) return [];
  try {
    const cacheKey = `tsdb:next:${teamId}`;
    const hit = getCached<TsdbEvent[]>(cacheKey);
    if (hit) return hit;
    const r = await fetchJson<{ events?: TsdbEvent[] }>(
      `${TSDB_BASE}/eventsnext.php?id=${encodeURIComponent(teamId)}`,
      { timeoutMs: 9_000 },
    );
    if (!r.ok) return [];
    const next = [...(r.data?.events ?? [])].sort((a, b) =>
      String(a.strTimestamp ?? a.dateEvent ?? "").localeCompare(String(b.strTimestamp ?? b.dateEvent ?? "")),
    ).slice(0, limit);
    setCached(cacheKey, next, ttls.sportsLive);
    return next;
  } catch {
    return [];
  }
}

function normalizeEvent(e: TsdbEvent) {
  const homeScore = e.intHomeScore != null && e.intHomeScore !== "" ? Number(e.intHomeScore) : undefined;
  const awayScore = e.intAwayScore != null && e.intAwayScore !== "" ? Number(e.intAwayScore) : undefined;
  const live = homeScore !== undefined && awayScore !== undefined && /progress|q[1-5]|ht|1h|2h|live|in play/i.test(e.strStatus ?? "");
  return {
    id: e.idEvent,
    match: `${e.strHomeTeam ?? "?"} vs ${e.strAwayTeam ?? "?"}`,
    homeTeam: e.strHomeTeam,
    awayTeam: e.strAwayTeam,
    homeLogo: e.strHomeTeamBadge || undefined,
    awayLogo: e.strAwayTeamBadge || undefined,
    leagueBadge: e.strLeagueBadge || undefined,
    venue: e.strVenue || undefined,
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

    // 🔴 FIX PAR PERDIDO (2026-09-16) — el router/LLM suele REDUCIR la consulta a
    // un solo club: para "como salió independiente con san lorenzo" llamó a la
    // tool con query="independiente". Sin los dos clubes, el filtro de par no
    // corría y el matcheo por substring devolvía el partido de un homónimo
    // ("Vasco da Gama vs Independiente Santa Fe"). El texto REAL del usuario
    // viaja siempre en `args.__userInput`, así que se usa ESE para detectar el
    // par cuando nombra más clubes que el query de la tool (y solo en ese caso:
    // si el LLM pasó un query más específico, manda el query).
    const userText = String(args.__userInput ?? "").trim();
    const pairText = userText && detectClubs(userText.toLowerCase()).length > detectClubs(query.toLowerCase()).length
      ? userText
      : query;

    // 🔴 FIX COBERTURA (2026-09-16) — un solo club: resolverlo contra ESPN da el
    // nombre CANÓNICO y su liga, que es lo que hace preciso el matcheo del
    // scoreboard para clubes que NO están en el diccionario propio (los que antes
    // dependían del matcheo por tokens). Con dos clubes manda el par: el partido es
    // el que los enfrenta, no el de cada uno por separado.
    const singleClub = detectClubs(pairText.toLowerCase()).length < 2;
    const resolvedTeam = singleClub
      ? await resolveEspnTeam(detectClub(pairText.toLowerCase()) ?? detectNationalTeam(pairText.toLowerCase()) ?? query)
      : null;
    // Nombre canónico para "los próximos del MISMO equipo" y para el contexto de
    // equipo/Wikipedia: con un alias ("barca") la wiki devolvía cualquier cosa.
    const teamLower = String(
      resolvedTeam?.teamName ?? detectClub(query.toLowerCase()) ?? detectNationalTeam(query.toLowerCase()) ?? query,
    ).toLowerCase();

    // FIX: usar ESPN como fuente principal. 🔴 FIX VENTANA: rango de 12 días
    // atrás + 14 adelante en UN fetch por liga — captura partidos de mitad de
    // semana (Real Madrid martes, pregunta el viernes) que antes quedaban fuera.
    const espn = await searchEspnScoreboards(query, { pairText, resolvedTeam });
    const espnResults = espn.events;

    // 🔴 Clasificación: jugados/en vivo para el resultado; futuros como `upcoming`
    // (sección "Próximos partidos" de la card, sin fixture aparte).
    const playedOrLive = espnResults.filter(r => espnEventState(r.event) !== "pre");
    const espnUpcoming = espnResults.filter(r => espnEventState(r.event) === "pre");

    if (playedOrLive.length > 0) {
      // 🔴 Tomar el partido más reciente jugado y enriquecerlo con /summary
      const first = playedOrLive[0];
      const playedMatches = playedOrLive.slice(0, 5).map(({ event }) => normalizeEspnEvent(event, first.leagueName));
      // Próximos del MISMO equipo (para la sección "Próximos partidos"):
      // `teamLower` es el nombre canónico resuelto más arriba.
      let upcomingSameTeam = espnUpcoming
        .filter(r => {
          const comps = r.event.competitions ?? [];
          const teams = comps.flatMap(c => (c.competitors ?? []).map(comp => comp.team?.displayName?.toLowerCase() ?? ""));
          return teams.some(t => t.includes(teamLower) || teamLower.includes(t));
        })
        .slice(0, 4)
        .map(({ event }) => normalizeEspnEvent(event));
      // 🔴 FIX PRÓXIMOS DEL RESULTADO (2026-09-16) — misma limitación que el
      // fixture: si ESPN rechazó los rangos, `espnUpcoming` queda vacío y la card
      // de resultado salía SIN la sección "Próximos partidos". El calendario del
      // equipo (2 requests) los trae igual.
      if (upcomingSameTeam.length === 0) {
        const teamFixture = await fetchEspnTeamFixture(teamLower, 4, resolvedTeam);
        if (teamFixture) {
          upcomingSameTeam = teamFixture.events.map(({ event, leagueName }) => normalizeEspnEvent(event, leagueName));
        }
      }

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

    // 🔴 FIX RESULTADO DE EQUIPO (2026-09-15) — "cómo salió boca" llegaba acá
    // (ESPN solo devolvía partidos FUTUROS) y el turno terminaba con la card de
    // FIXTURE en vez del resultado. Si el usuario pide un RESULTADO y TheSportsDB
    // tiene los últimos partidos jugados del equipo, esos son la respuesta.
    // No aplica a consultas de dos clubes: ahí manda el par exacto (más abajo).
    const queryClubs = detectClubs(pairText.toLowerCase());
    // OJO con los acentos: `\b` en JS es ASCII, así que `\bsali[oó]\b` NUNCA
    // matchea "salió" (la ó no es carácter de palabra → no hay borde después).
    // Se normaliza el texto (sin acentos) antes de evaluar.
    const resultIntentText = String(args.__userInput ?? query)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const asksForResult = /\b(salio|resultado|resultados|gano|perdio|empato|empate|marcador|como le fue|que resultado|ayer|anoche|anteayer)\b/i.test(
      resultIntentText,
    );
    if (asksForResult && queryClubs.length < 2) {
      const teamForLast = queryClubs[0] ?? detectNationalTeam(query.toLowerCase()) ?? query;
      const ctxForLast = await fetchTeamContext(teamForLast);
      const lastPlayed = ctxForLast.teamInfo?.id ? await fetchTsdbLastEvents(ctxForLast.teamInfo.id) : [];
      if (lastPlayed.length > 0) {
        const playedMatches = lastPlayed.map(normalizeEvent);
        // Próximos del mismo equipo: la card de resultado muestra la sección
        // "Próximos partidos" (antes solo la traía el path de ESPN).
        const nextUp = ctxForLast.teamInfo?.id ? await fetchTsdbNextEvents(ctxForLast.teamInfo.id) : [];
        return {
          type: "match_live",
          status: "ok",
          query,
          matches: playedMatches,
          upcoming: nextUp.length > 0 ? nextUp.map(normalizeEvent) : undefined,
          source: "TheSportsDB",
          sourceUrl: "https://www.thesportsdb.com/",
          teamInfo: ctxForLast.teamInfo ?? undefined,
          wikipediaExtract: ctxForLast.wikipediaExtract ?? undefined,
          sources: ctxForLast.wikiSource ? [ctxForLast.wikiSource] : undefined,
          text: playedMatches.map(m => `${m.homeTeam} ${m.homeScore ?? "?"} - ${m.awayScore ?? "?"} ${m.awayTeam} (${m.status})`).join("; "),
        };
      }
    }

    // 🔴 Solo hay partidos FUTUROS ("cuando juega X" llegó a match_live):
    // devolver próximo + contexto, para que blocks arme la fixture enriquecida.
    if (espnUpcoming.length > 0) {
      const first = espnUpcoming[0];
      const upcomingMatches = espnUpcoming.slice(0, 5).map(({ event }) => normalizeEspnEvent(event, first.leagueName));
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
    // 🔴 FIX FUENTE SECUNDARIA (2026-09-15) — dos bugs que la dejaban inservible:
    // (a) `searchevents.php` devuelve la clave `event` (SINGULAR); el código leía
    //     `.events` → SIEMPRE [] (por eso el fallback caía a Wikipedia con
    //     source "Wikipedia" en vez de dar el partido).
    // (b) la consulta era la frase CRUDA del usuario: ese endpoint exige
    //     "Equipo vs Equipo" (frase cruda → {"event":null}).
    // Además: un error de red se distinguía mal (throw) — ahora se contabiliza
    // para poder decir honestamente "no pude consultar" en vez de "no hay partido".
    // (Los detalles de clave/deporte/caché viven en fetchTsdbSearchEvents, que
    //  comparten match_live y match_schedule.)
    let tsdbFailed = 0;
    let tsdbAnswered = false;
    for (const tsdbQuery of tsdbQueryCandidates(pairText)) {
      const res = await fetchTsdbSearchEvents(tsdbQuery);
      if (res.failed) tsdbFailed++;
      else tsdbAnswered = true;
      if (res.events.length > 0) {
        return {
          type: "match_live",
          status: "ok",
          query,
          matches: res.events.slice(0, 5).map(normalizeEvent),
          source: "TheSportsDB",
          sourceUrl: "https://www.thesportsdb.com/",
        };
      }
    }

    // 🔴 FIX FUENTES CAÍDAS (2026-09-15) — si NINGUNA fuente respondió (ESPN
    // rechazando el rango en todas las ligas y TheSportsDB caído), el problema no
    // es "no hay partido": es que no se pudo consultar. Devolver "unavailable"
    // hace que el chat diga la verdad ("probá de nuevo en unos minutos") y, sobre
    // todo, que NO dispare el fallback a web_search — que antes terminaba en una
    // card de búsqueda genérica sin relación con la pregunta.
    if (espn.okLeagues === 0 && espn.failedLeagues > 0 && tsdbFailed > 0 && !tsdbAnswered) {
      return {
        type: "match_live",
        status: "unavailable",
        query,
        matches: [],
        source: "ESPN + TheSportsDB",
        note: "Ahora mismo no puedo consultar los resultados deportivos: las fuentes (ESPN y TheSportsDB) no están respondiendo. Probá de nuevo en unos minutos.",
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
          // 🔴 FIX 2026-09-15: `eventsnextteam.php` da 404; el endpoint real es `eventsnext.php`.
        `${TSDB_BASE}/eventsnext.php?id=${teamInfo.id}`,
          { timeoutMs: 8_000 },
        );
        if (nextRes.ok && nextRes.data?.events && nextRes.data.events.length > 0) {
          nextMatch = nextRes.data.events[0];
        }
      } catch { /* ignore */ }
    }

    // 🔴 FIX MUNDIAL (2026-09-12): este branch devuelveía status "ok" con
    // matches=[] + Wikipedia del equipo → el LLM sintetizaba libre y NEGABA
    // eventos reales ("esa final no existió, nunca se cruzaron en una final
    // de Copa del Mundo") mezclando wiki stale con su conocimiento paramétrico.
    // status "no_data" activa: (a) __forceHonestReply en blocksFromToolResults,
    // (b) el fallback a web_search de los 3 paths (router/léxico/nativo).
    // Se mantiene teamInfo/wiki/nextMatch adjuntos para contexto si hace falta.
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
        status: "no_data",
        query,
        matches: nextMatch ? [normalizeEvent(nextMatch)] : [],
        text: `No encontré ese partido en mis fuentes (ESPN/TheSportsDB). Puede ser de una fecha anterior a mi ventana de búsqueda o de una competencia que no cubro todavía.`,
        teamInfo,
        nextMatch: nextMatch ? normalizeEvent(nextMatch) : undefined,
        wikipediaExtract: wikiExtract,
        sources: wikiSource ? [wikiSource] : undefined,
        source: teamInfo ? "TheSportsDB + Wikipedia" : "Wikipedia",
        note: `No encontré ese partido en mis fuentes deportivas (ESPN/TheSportsDB). Puede ser de una fecha o competencia fuera de mi cobertura.`,
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
  type TsdbTeam = { idTeam?: string; strTeam?: string; strStadium?: string; strLocation?: string; strLeague?: string; strDescriptionES?: string; strDescriptionEN?: string; strSport?: string };
  try {
    // 🔴 CACHE TSDB (2026-09-15) — la key pública ("3") tiene límite de ~30
    // requests por minuto: al pasarlo responde HTTP 429 y todos los equipos
    // quedaban sin contexto. El lookup de equipo es dato casi estático → 24 h.
    // IMPORTANTE: solo se cachean ACIERTOS. Si se cacheara el 429, el equipo
    // quedaría "sin contexto" por un día entero.
    const teamCacheKey = `tsdb:team:${teamQuery.toLowerCase()}`;
    let teams = getCached<TsdbTeam[]>(teamCacheKey);
    if (!teams) {
      const searchRes = await fetchJson<{ teams?: TsdbTeam[] }>(
        `${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(teamQuery)}`,
        { timeoutMs: 8_000 },
      );
      if (searchRes.ok) {
        teams = searchRes.data?.teams ?? [];
        setCached(teamCacheKey, teams, ttls.reference);
      }
    }
    if (teams && teams.length > 0) {
      // 🔴 FIX OTRO DEPORTE (2026-09-16) — searchteams.php también devuelve
      // equipos homónimos de otros deportes (el "Boca Juniors" de básquet, por
      // ejemplo). Como match_live es una tool de fútbol, se prefiere el club de
      // soccer; si no hay ninguno se mantiene el primer resultado (no romper
      // consultas de otros deportes).
      const soccer = teams.filter(t => !t.strSport || /soccer/i.test(String(t.strSport)));
      const t = soccer[0] ?? teams[0];
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

/**
 * Arma el payload de fixture (match_schedule "ok") a partir de partidos YA
 * normalizados: `nextMatch` (el partido protagonista del interior), contexto de
 * equipo + Wikipedia, y la hora de kickoff en la tz del USUARIO. Lo comparten el
 * camino de ESPN (scoreboard o calendario por equipo) y el de TheSportsDB, así
 * la card sale igual por cualquiera de las fuentes.
 */
async function buildFixturePayload(
  upcomingMatches: any[],
  teamLabel: string,
  runCtx?: ToolRunContext,
  source = "ESPN",
  ctxIn?: { teamInfo: { id: string; name: string; stadium?: string; location?: string; league?: string; description?: string } | null; wikipediaExtract: string | null; wikiSource: { title: string; url: string; domain: string; snippet: string } | null },
) {
  const first = upcomingMatches[0];
  const ctx = ctxIn ?? await fetchTeamContext(teamLabel || first?.homeTeam || "");
  // 🔴 FIX TZ — hora de kickoff en la tz del USUARIO (antes: hora del server
  // = UTC en Render → “00:30” para un partido 21:30 AR / 02:30 Madrid).
  const kickoff = formatKickoffUserTz(first?.date, runCtx?.tzOffsetMin);
  return {
    type: "match_schedule",
    status: "ok",
    team: teamLabel,
    matches: upcomingMatches,
    nextMatch: {
      homeTeam: first?.homeTeam,
      awayTeam: first?.awayTeam,
      date: first?.date,
      time: kickoff ?? first?.time,
      league: first?.league,
      homeLogo: first?.homeLogo,
      awayLogo: first?.awayLogo,
      homeAbbrev: first?.homeAbbrev,
      awayAbbrev: first?.awayAbbrev,
      homeColor: first?.homeColor,
      awayColor: first?.awayColor,
    },
    teamInfo: ctx.teamInfo ?? undefined,
    wikipediaExtract: ctx.wikipediaExtract ?? undefined,
    sources: ctx.wikiSource ? [ctx.wikiSource] : undefined,
    source: ctx.teamInfo ? `${source} + Wikipedia` : source,
    sourceUrl: source === "ESPN" ? "https://www.espn.com/soccer/" : "https://www.thesportsdb.com/",
  };
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
    // 🔴 FIX NOMBRE DE EQUIPO SUCIO (2026-09-16) — ver cleanTeamQuery: el router
    // puede pasar la frase entera ("cuándo juega Boca") o vacío (cae a
    // __userInput, que también es la frase).
    const team = cleanTeamQuery(String(args.team ?? args.__userInput ?? ""));
    const league = String(args.league ?? "").trim();
    const next = Number(args.next ?? 5);
    if (!team && !league) return { type: "match_schedule", status: "failed", error: "Indicá equipo o liga." };

    // 🔴 FIX FIXTURE VACÍO (2026-09-16) — PRIMERO el calendario POR EQUIPO de
    // ESPN: dos requests, sin depender de los rangos de fecha (que ESPN rechaza
    // con 400) ni del presupuesto del barrido día por día. Antes, "cuándo juega
    // Boca" no mostraba NADA aunque ESPN tuviera el partido a 4 días vista.
    let resolved: ResolvedEspnTeam | null = null;
    if (team) {
      // El club canónico de ESPN alimenta la búsqueda, la card y el contexto de
      // equipo/Wikipedia (con un alias tipo "barca", la wiki devolvía otra cosa).
      resolved = await resolveEspnTeam(team);
      const teamFixture = await fetchEspnTeamFixture(team, Math.max(next, 5), resolved);
      if (teamFixture && teamFixture.events.length > 0) {
        const upcomingMatches = teamFixture.events.map(({ event, leagueName }) => normalizeEspnEvent(event, leagueName));
        return await buildFixturePayload(upcomingMatches, resolved?.teamName ?? team, runCtx, "ESPN");
      }
      // El calendario del equipo quedó vacío (o no resolvió): sigue el scoreboard,
      // que cubre el resto de competencias del club/selección.
    }

    // Nombre canónico para los lookups de nombre libre (TheSportsDB, Wikipedia).
    const teamLabel = resolved?.teamName ?? team;

    // 🔴 KORU 3.0 — ESPN PRIMARIO para fixture. 🔴 FIX RANGOS: UN fetch por liga
    // con dates=START-END (antes: 7 fetches por día por liga = 63 requests →
    // rate-limit 429 de ESPN) + detección de COPAS ("copa del rey", "libertadores")
    // + sinónimos de clubes europeos + fallback por tokens para query crudo.
    const espnSearch = await searchEspnScoreboards(team || league, { resolvedTeam: resolved });
    const espnResults = espnSearch.events;
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
      return await buildFixturePayload(upcomingEspn, team || league, runCtx, "ESPN");
    }

    // Fallback: TheSportsDB
    // 🔴 FIX FIXTURE VACÍO (2026-09-16) — este fallback leía `.events` del
    // endpoint que responde con la clave SINGULAR `event`, así que devolvía []
    // SIEMPRE (mismo bug ya arreglado en match_live): el fixture nunca salía de
    // TheSportsDB, y "cuándo juega Boca" terminaba sin card.
    let events: TsdbEvent[] = [];
    let tsdbTeamInfo: { id: string; name: string; stadium?: string; location?: string; league?: string; description?: string } | null = null;
    let tsdbWiki: string | null = null;
    let tsdbWikiSource: { title: string; url: string; domain: string; snippet: string } | null = null;
    if (team) {
      const found = await fetchTsdbSearchEvents(teamLabel);
      events = found.events;
    }
    // OJO: el segundo lookup es INDEPENDIENTE del primero — un 429 en la búsqueda
    // por texto no debe impedir el fixture por id de equipo.
    if (events.length === 0 && team) {
      // 🔴 FIX PRÓXIMOS PARTIDOS POR EQUIPO (2026-09-16) — `eventsnext.php`
      // (por id de equipo) ES el endpoint de fixture y responde; antes se
      // llamaba a `eventsnextteam.php`, que da 404.
      const teamCtx = await fetchTeamContext(teamLabel);
      tsdbTeamInfo = teamCtx.teamInfo;
      tsdbWiki = teamCtx.wikipediaExtract;
      tsdbWikiSource = teamCtx.wikiSource;
      if (teamCtx.teamInfo?.id) {
        events = await fetchTsdbNextEvents(teamCtx.teamInfo.id, Math.max(next, 5));
      }
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

    // 🔴 FIX CARD FIXTURE (2026-09-16) — el path de TheSportsDB devolvía SOLO
    // matches: la card quedaba sin partido protagonista (`nextMatch`, el interior
    // que muestra rival/fecha/hora) y sin contexto de equipo (estadio, wiki).
    // Ahora se enriquece igual que el path de ESPN.
    const ctx = tsdbTeamInfo || tsdbWiki
      ? { teamInfo: tsdbTeamInfo, wikipediaExtract: tsdbWiki, wikiSource: tsdbWikiSource }
      : undefined;
    return await buildFixturePayload(normalizeTsdbUpcoming(upcoming, runCtx?.tzOffsetMin), teamLabel || league, runCtx, "TheSportsDB", ctx);
  },
};

// ─── team_follow ────────────────────────────────────────────────────────────
export const teamFollow: ToolHandler = {
  definition: defineTool(
    "team_follow",
    "Guarda un equipo como favorito para que Michi te avise cuando juegue o termine el partido. Úsala cuando el usuario diga 'seguí a Boca', 'ségal a Real Madrid', 'avisame cuando juegue Nadal'. Crea una memory tipo 'interest'.",
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
