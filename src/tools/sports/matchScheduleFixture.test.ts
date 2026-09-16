/**
 * 🔴 REGRESIÓN FIXTURE (2026-09-16) — bug reportado: "cuándo juega Boca" no
 * mostraba NINGUNA card, aunque ESPN tuviera el partido (Boca en San Lorenzo,
 * 20/09). Tres causas cubiertas acá, todas con fetch mockeado (sin red):
 *  1. ESPN rechaza los RANGOS de fecha (HTTP 400) y el barrido día por día reparte
 *     su presupuesto entre ~20 ligas → un partido a 4+ días vista quedaba afuera.
 *     Ahora se resuelve el equipo (search v3) y se pide su CALENDARIO completo.
 *  2. El fallback de TheSportsDB leía `.events` del endpoint que responde con la
 *     clave SINGULAR `event` → SIEMPRE [] (nunca aportaba fixture).
 *  3. Un `match_schedule` sin partidos futuros pero CON info de equipo devolvía
 *     cero cards, aunque su mensaje decía "te mostramos info del equipo".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { blocksFromToolResults } from "../../server/blocksFromToolResults";

type Mode = "espn-team-calendar" | "tsdb-singular-key";

const inDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString();
const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body }) as unknown as Response;

const espnScheduleEvent = (home: string, away: string, id: string, date: string) => ({
  id,
  date,
  name: `${away} at ${home}`,
  season: { displayName: "2026 Argentine Liga Profesional de Fútbol" },
  competitions: [{
    id,
    date,
    venue: { fullName: `Estadio ${home}`, address: { city: "Buenos Aires", country: "Argentina" } },
    competitors: [
      { homeAway: "home", team: { id: "18", displayName: home, abbreviation: "LOC", logos: [{ href: `https://a.espncdn.com/i/teamlogos/soccer/500/${home.replace(/\s/g, "")}.png` }] } },
      { homeAway: "away", team: { id: "5", displayName: away, abbreviation: "VIS", logos: [{ href: `https://a.espncdn.com/i/teamlogos/soccer/500/${away.replace(/\s/g, "")}.png` }] } },
    ],
  }],
});

function installFetch(mode: Mode) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);

    // ── ESPN ──
    if (url.includes("site.api.espn.com") || url.includes("sports.core.api.espn.com")) {
      // El bug de fondo: los RANGOS se rechazan (400) y el scoreboard no da futuro.
      if (url.includes("scoreboard")) return jsonResponse({ code: 400, message: "Failed to get events endpoint." }, 400);
      if (url.includes("common/v3/search")) {
        if (mode !== "espn-team-calendar") return jsonResponse({ items: [] });
        return jsonResponse({
          items: [
            { type: "team", id: "5", displayName: "Boca Juniors", sport: "soccer", league: "arg.1" },
            { type: "team", id: "999", displayName: "Boca Juniors Basketball", sport: "basketball", league: "arg.basket" },
          ],
        });
      }
      if (url.includes("/teams/5/schedule")) {
        return jsonResponse({
          events: [
            espnScheduleEvent("San Lorenzo", "Boca Juniors", "401841577", inDays(4)),
            espnScheduleEvent("Boca Juniors", "Unión (Santa Fe)", "401841590", inDays(18)),
          ],
        });
      }
      return jsonResponse({});
    }

    // ── TheSportsDB ──
    if (url.includes("thesportsdb.com")) {
      if (url.includes("searchteams.php")) return jsonResponse({ teams: [] });
      if (url.includes("searchevents.php")) {
        if (mode !== "tsdb-singular-key") return jsonResponse({ event: null });
        // Clave SINGULAR `event` (el código viejo leía `.events` → siempre vacío).
        return jsonResponse({
          event: [{
            idEvent: "2398079",
            strEvent: "Boca Juniors vs Vélez",
            strSport: "Soccer",
            strLeague: "Argentinian Primera Division",
            strHomeTeam: "Boca Juniors",
            strAwayTeam: "Vélez",
            strHomeTeamBadge: "https://r2.thesportsdb.com/badge/boca.png",
            strAwayTeamBadge: "https://r2.thesportsdb.com/badge/velez.png",
            strTimestamp: inDays(6),
            dateEvent: inDays(6).slice(0, 10),
            strSportIconGreen: "",
          }],
        });
      }
      if (url.includes("eventsnext.php")) return jsonResponse({ events: [] });
      return jsonResponse({});
    }

    // ── Wikipedia ──
    if (url.includes("es.wikipedia.org")) {
      if (url.includes("rest_v1/page/summary")) {
        return jsonResponse({ extract: "El Club Atlético Boca Juniors es una entidad deportiva argentina.", content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Boca_Juniors" } } });
      }
      return jsonResponse({ query: { search: [{ title: "Boca Juniors", snippet: "club de fútbol argentino" }] } });
    }

    return jsonResponse({});
  });
}

/** Importa el módulo con caché en memoria limpia (el caché es module-level). */
async function freshMatchSchedule() {
  vi.resetModules();
  const mod = await import("./football");
  return mod.matchSchedule;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fixture: calendario por equipo de ESPN", () => {
  it("rangos de ESPN rechazados (400) → el fixture sale del calendario del equipo", async () => {
    installFetch("espn-team-calendar");
    const matchSchedule = await freshMatchSchedule();
    const sched: any = await matchSchedule.run({ team: "Boca Juniors", __userInput: "cuando juega boca" }, { tzOffsetMin: 180 } as any);

    expect(sched.status).toBe("ok");
    expect(sched.matches.length).toBe(2);
    expect(sched.matches[0].homeTeam).toBe("San Lorenzo");
    expect(sched.matches[0].awayTeam).toBe("Boca Juniors");
    // Escudos del calendario (vienen en `logos[]`, no en `logo`).
    expect(sched.matches[0].homeLogo).toContain("espncdn");
    // Eventos sin `status`: el partido es PROGRAMADO, no finalizado.
    expect(sched.matches[0].state).toBe("pre");
    expect(String(sched.matches[0].status)).toMatch(/programad/i);
    expect(sched.nextMatch.homeLogo).toBeTruthy();
  });

  it("la card de fixture se arma con los próximos partidos y el protagonista", async () => {
    installFetch("espn-team-calendar");
    const matchSchedule = await freshMatchSchedule();
    const sched: any = await matchSchedule.run({ team: "Boca Juniors", __userInput: "cuando juega boca" }, { tzOffsetMin: 180 } as any);

    const blocks = blocksFromToolResults([{ tool: "match_schedule", result: sched } as any], "cuando juega boca", 180);
    const card: any = blocks.find(b => b.type === "match_timeline");
    expect(card).toBeDefined();
    expect(card.items.length).toBe(2);
    expect(card.items[0].text).toContain("Boca Juniors");
    expect(card.nextMatch?.homeLogo).toBeTruthy();
    // El basket del homónimo no debe colarse.
    expect(JSON.stringify(blocks)).not.toMatch(/basketball/i);
  });
});

describe("fixture: fallback de TheSportsDB", () => {
  it("lee la clave SINGULAR `event` y devuelve el próximo partido", async () => {
    installFetch("tsdb-singular-key");
    const matchSchedule = await freshMatchSchedule();
    const sched: any = await matchSchedule.run({ team: "Boca Juniors", __userInput: "cuando juega boca" }, { tzOffsetMin: 180 } as any);

    expect(sched.status).toBe("ok");
    expect(sched.matches.length).toBeGreaterThan(0);
    expect(sched.matches[0].homeTeam).toBe("Boca Juniors");
    expect(sched.matches[0].awayTeam).toBe("Vélez");
    expect(sched.nextMatch?.homeLogo).toContain("boca.png");
    expect(sched.source).toContain("TheSportsDB");
  });
});

describe("card de equipo cuando no hay fixture", () => {
  it("match_schedule sin partidos pero con info de equipo → card de equipo (no cero cards)", () => {
    const sched: any = {
      type: "match_schedule",
      status: "ok",
      team: "Boca Juniors",
      matches: [],
      teamInfo: { id: "135156", name: "Boca Juniors", stadium: "La Bombonera", league: "Argentinian Primera Division" },
      wikipediaExtract: "El Club Atlético Boca Juniors es una entidad deportiva argentina.",
      note: 'No hay próximos partidos de "Boca Juniors" programados. Te mostramos info del equipo.',
    };
    const blocks = blocksFromToolResults([{ tool: "match_schedule", result: sched } as any], "cuando juega boca", 180);

    const card: any = blocks.find(b => b.type === "match_timeline");
    expect(card).toBeDefined();
    expect(card.title).toBe("Boca Juniors");
    expect(card.teamInfo?.stadium).toBe("La Bombonera");
    expect(card.wikipediaExtract).toBeTruthy();
  });
});
