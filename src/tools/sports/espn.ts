/**
 * Bloque Sports — catálogo y RESOLVEDOR DE ENTIDADES de fútbol sobre ESPN.
 *
 * Por qué existe (2026-09-16). Hasta ahora "quién es el equipo" se decidía con un
 * diccionario escrito a mano (`CLUB_SYNONYMS`) y, cuando el club no estaba en la
 * lista, se caía a un heurístico de sacar palabras de la pregunta. Dos problemas
 * medidos en producción:
 *   1. Los clubes que nadie agregó al diccionario (Talleres, Instituto, Godoy
 *      Cruz…) no resolvían nunca: el fixture salía del barrido de ~20 ligas, que
 *      es caro y a 4+ días vista no llega.
 *   2. Los homónimos y el femenil/filial se colaban, porque el matcheo era por
 *      substring sobre texto libre.
 * ESPN tiene un buscador de entidades que devuelve el club CANÓNICO con su liga y
 * su id. Eso pasa a ser la fuente de verdad y el diccionario queda como HINT
 * (desempate y nombres en español).
 *
 * Supuestos VERIFICADOS contra la API real (no deducidos):
 *   - `type=team&sport=soccer` filtra de verdad: sin `sport=soccer`, "Boca"
 *     devuelve también un equipo de críquet ("Boca Raton Trailblazers").
 *   - La frase sucia devuelve 0 items ("cuándo juega Boca" → 0): hay que limpiarla
 *     ANTES de buscar (ver `cleanTeamQuery` en football.ts).
 *   - Este host responde 403 si se le manda un `User-Agent` propio y descriptivo
 *     ("MichiApp/1.0…"); el UA de navegador del fetcher compartido sí pasa, así
 *     que se puede usar `fetchJson` (y se gana retry + detección de HTML).
 *   - El calendario por equipo (`/teams/{id}/schedule`) es POR COMPETENCIA: ESPN
 *     expone un id distinto de la misma selección en cada torneo ("Spain" es 164
 *     en `uefa.nations` y 17640 en `fifa.wworldq.uefa`). Verificado: con el id
 *     correcto el calendario de una selección SÍ trae sus partidos (España: 6).
 *     Límite conocido y aceptado: son los partidos de ESA competencia, así que un
 *     amistoso de otra competencia puede no aparecer — por eso el caller mantiene
 *     el scoreboard como fallback cuando el calendario queda vacío.
 */

import { fetchJson } from "../shared/fetcher";
import { cachedSoft, ttls } from "../shared/cache";
import { countRequest, noteSource, type SourceStatus } from "../shared/telemetry";

/** Base de la API pública de ESPN para fútbol. */
export const ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Buscador de entidades de ESPN (equipos, ligas, atletas). */
export const ESPN_SEARCH_URL = "https://site.api.espn.com/apis/common/v3/search";

// Ligas ESPN con IDs conocidos para buscar resultados.
// INCLUYE selecciones nacionales (fifa.world, uefa.euro, etc) — sin esto,
// "cómo salió España ayer" no encuentra nada porque España no juega en ligas de clubes.
// Para clubes, solo top 5 ligas + Champions.
export const ESPN_LEAGUES: Array<{ id: string; name: string; aliases?: string[] }> = [
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

/** Ligas de selecciones del catálogo (ver `isNationalTeamLeague`). */
export const NATIONAL_LEAGUE_IDS = new Set(["fifa.world", "uefa.euro", "uefa.nations"]);

export function espnLeagueName(leagueId: string | undefined): string | undefined {
  if (!leagueId) return undefined;
  return ESPN_LEAGUES.find(l => l.id === leagueId)?.name;
}

export type EspnSearchItem = {
  id?: string;
  type?: string;
  displayName?: string;
  sport?: string;
  league?: string | string[];
};

/** Equipo resuelto por la búsqueda de ESPN (club canónico con liga e id). */
export type ResolvedEspnTeam = {
  teamId: string;
  /** Nombre canónico de ESPN ("Boca Juniors", no "boca"). */
  teamName: string;
  leagueId: string;
  leagueName?: string;
  /**
   * La liga resuelta es de selecciones (no de clubes). Es metadata para el
   * caller/diagnóstico: el calendario por equipo también funciona para
   * selecciones (siempre que la liga sea la que ESPN le asigna en esa competencia).
   */
  national: boolean;
  /** Puntaje del matcheo, para diagnóstico (ver `scoreEspnTeamCandidate`). */
  score: number;
};

/** El ítem de búsqueda trae `league` como string o array según la entidad. */
export function espnItemLeague(item: EspnSearchItem): string {
  const l = item.league;
  return Array.isArray(l) ? String(l[0] ?? "") : String(l ?? "");
}

/** Minúsculas + sin acentos, para comparar nombres ("Córdoba" ~ "cordoba"). */
export function normalizeEspnText(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿La liga es de selecciones? Cubre las que están en el catálogo y los
 * cualificatorios/juveniles (`fifa.wworldq.uefa`, `uefa.euro_u21_qual`).
 * OJO con el prefijo: `uefa.europa` (clubes) NO debe matchear `uefa.euro`, por eso
 * se exige fin de string o separador después de "euro"/"nations".
 */
export function isNationalTeamLeague(leagueId: string): boolean {
  if (!leagueId) return false;
  if (NATIONAL_LEAGUE_IDS.has(leagueId)) return true;
  return /^(fifa\.|uefa\.(euro|nations)($|[._]))/.test(leagueId);
}

/** Femenil, juveniles y filiales: no son "el club" que el usuario pregunta. */
function looksLikeReserveOrYouth(displayName: string, leagueId: string): boolean {
  const name = normalizeEspnText(displayName);
  if (/\b(women|femenil|femenino|fem)\b/.test(name)) return true;
  if (/\b(u1[5-9]|u2[0-3]|castilla|reserves?|filial)\b/.test(name)) return true;
  if (/\b(ii|iii)\b/.test(name)) return true;
  return /\.w\.|\.w$|_w\./.test(leagueId);
}

/**
 * Puntúa un candidato de la búsqueda contra el nombre buscado.
 * `-Infinity` = descartado (otro deporte, sin relación de nombre).
 * Notas de ranking: el nombre exacto gana; una liga del catálogo suma (evita el
 * homónimo de otro país, como "Boca Juniors de Cali"); femenil/juvenil/filial
 * restan fuerte, así "Real Madrid" no resuelve a Castilla ni al equipo femenil.
 */
export function scoreEspnTeamCandidate(item: EspnSearchItem, target: string): number {
  if (item.type && item.type !== "team") return Number.NEGATIVE_INFINITY;
  // match_live/match_schedule son tools de FÚTBOL: el básquet del homónimo
  // ("Boca Juniors" de la NBA G League) no es una opción válida.
  if (item.sport && item.sport !== "soccer") return Number.NEGATIVE_INFINITY;
  const name = normalizeEspnText(item.displayName ?? "");
  if (!name || !target) return Number.NEGATIVE_INFINITY;

  let score: number;
  if (name === target) score = 10;
  else if (name.startsWith(target)) score = 6; // "Boca Juniors" ⊃ "Boca"
  else if (target.startsWith(name)) score = 4; // el usuario escribió más que el nombre
  else if (name.includes(target)) score = 2;
  else return Number.NEGATIVE_INFINITY;

  if (ESPN_LEAGUES.some(l => l.id === espnItemLeague(item))) score += 4;
  if (looksLikeReserveOrYouth(item.displayName ?? "", espnItemLeague(item))) score -= 8;
  return score;
}

/**
 * Resuelve un nombre de equipo al club canónico de ESPN (id + liga).
 *
 * Cache: 24 h para una resolución lograda (el id de un club es estático) y 60 s
 * para el fallo, para no martillar la búsqueda cuando la fuente no responde o el
 * nombre no existe — pero sin quedar envenenado un día entero.
 */
export async function resolveEspnTeam(
  query: string,
  opts: { searchLimit?: number; ttlMs?: number } = {},
): Promise<ResolvedEspnTeam | null> {
  const q = String(query ?? "").replace(/\s+/g, " ").trim();
  if (!q) return null;
  const searchLimit = opts.searchLimit ?? 10;
  const t0 = Date.now();
  let fromNetwork = false;
  const items = await cachedSoft<EspnSearchItem[]>(
    `espn:resolve:${q.toLowerCase()}:${searchLimit}`,
    opts.ttlMs ?? ttls.reference,
    ttls.negative,
    async () => {
      fromNetwork = true;
      countRequest();
      const r = await fetchJson<{ items?: EspnSearchItem[] }>(
        `${ESPN_SEARCH_URL}?query=${encodeURIComponent(q)}&limit=${searchLimit}&type=team&sport=soccer`,
        { timeoutMs: 8_000 },
      );
      if (!r.ok) return null;
      // "Sin resultados" se trata como FALLO (TTL corto): un 200 vacío puede ser
      // un hipo de la búsqueda, y cachearlo 24 h dejaría al equipo sin resolver.
      const usable = (r.data?.items ?? []).filter(it => it.type === "team" && it.id);
      return usable.length > 0 ? usable : null;
    },
  );
  // El estado "ok" describe la RESOLUCIÓN (no el HTTP): la búsqueda puede
  // responder 200 y no haber ningún candidato usable.
  const status: SourceStatus = fromNetwork ? "ok" : "cache";
  const ms = Date.now() - t0;
  if (!items || items.length === 0) {
    noteSource("espn:search", fromNetwork ? "empty" : status, `query="${q}" (sin resultados)`, ms);
    return null;
  }

  const target = normalizeEspnText(q);
  let best: EspnSearchItem | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const score = scoreEspnTeamCandidate(item, target);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best || bestScore <= 0) {
    noteSource("espn:search", fromNetwork ? "empty" : status, `query="${q}" (${items.length} candidatos, ninguno usable)`, ms);
    return null;
  }
  const leagueId = espnItemLeague(best);
  if (!leagueId || !best.id) {
    noteSource("espn:search", fromNetwork ? "empty" : status, `query="${q}" (candidato sin id/liga)`, ms);
    return null;
  }

  noteSource("espn:search", status, `query="${q}" → ${leagueId}/${best.id} "${best.displayName ?? q}" (score ${bestScore})`, ms);
  return {
    teamId: String(best.id),
    teamName: best.displayName ?? q,
    leagueId,
    leagueName: espnLeagueName(leagueId),
    national: isNationalTeamLeague(leagueId),
    score: bestScore,
  };
}

/** Prefijo de país de un id de liga del catálogo: "arg.1" → "arg". */
function leagueCountry(leagueId: string): string {
  return leagueId.split(".")[0] ?? "";
}

/**
 * Confederación continental de cada país del catálogo. Sirve para saber qué copas
 * internacionales puede jugar un club de ese país.
 */
const CONTINENTAL_BY_COUNTRY: Record<string, string> = {
  arg: "conmebol", bra: "conmebol", col: "conmebol", chi: "conmebol", uru: "conmebol",
  par: "conmebol", per: "conmebol", ecu: "conmebol", ven: "conmebol", bol: "conmebol",
  esp: "uefa", eng: "uefa", ita: "uefa", ger: "uefa", fra: "uefa", por: "uefa", ned: "uefa",
};

/**
 * 🔴 FIX COSTO DEL SCOREBOARD (2026-09-16) — de las competiciones donde un club
 * PUEDE jugar, según su liga: la propia, las de su país, las de su confederación y
 * las de FIFA. Medido en vivo: la consulta del clásico Independiente–San Lorenzo
 * barría las 20 ligas del catálogo para descartar 19 → 104 requests; con este
 * filtro queda en las que importan (arg.1, arg.copa, conmebol.*, fifa.world).
 *
 * Devuelve `undefined` sin ligas resueltas: ahí NO se restringe nada (mejor gastar
 * requests que perder el partido cuando no sabemos de quién se habla).
 */
export function probableLeaguesFor(leagueIds: string[]): string[] | undefined {
  const ids = [...new Set(leagueIds.filter(Boolean))];
  if (ids.length === 0) return undefined;
  const countries = new Set(ids.map(leagueCountry).filter(c => c && !/^(fifa|uefa|conmebol|concacaf|caf|afc|club)$/.test(c)));
  const confederations = new Set([...countries].map(c => CONTINENTAL_BY_COUNTRY[c]).filter(Boolean));
  const out = new Set(ids);
  for (const league of ESPN_LEAGUES) {
    const country = leagueCountry(league.id);
    if (countries.has(country)) out.add(league.id); // mismo país: liga + copa doméstica
    else if (confederations.has(country)) out.add(league.id); // copas de su confederación
    else if (country === "fifa") out.add(league.id); // Mundial / amistosos
  }
  return [...out];
}

/**
 * Calendario COMPLETO del equipo en ESPN (una request, sin depender de los rangos
 * de fecha que ESPN rechaza con 400 — ver football.ts).
 *
 * Devuelve `null` si la fuente no respondió (se cachea 60 s) y `[]` si respondió
 * que no hay partidos (acierto: se cachea con el TTL largo).
 */
export async function fetchEspnTeamSchedule<E = unknown>(
  leagueId: string,
  teamId: string,
): Promise<E[] | null> {
  if (!leagueId || !teamId) return null;
  const t0 = Date.now();
  let fromNetwork = false;
  const events = await cachedSoft<E[]>(
    `espn:teamschedule:${leagueId}:${teamId}`,
    ttls.sportsStandings,
    ttls.negative,
    async () => {
      fromNetwork = true;
      countRequest();
      const r = await fetchJson<{ events?: E[] }>(
        `${ESPN_SITE_BASE}/${leagueId}/teams/${teamId}/schedule?fixture=true`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) return null;
      return (r.data?.events ?? []).filter(Boolean);
    },
  );
  const status: SourceStatus = !fromNetwork ? "cache" : events === null ? "failed" : events.length > 0 ? "ok" : "empty";
  noteSource("espn:team-schedule", status, `${leagueId}/${teamId}`, Date.now() - t0);
  return events;
}
