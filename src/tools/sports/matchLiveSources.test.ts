/**
 * 🔴 REGRESIÓN FUENTES DEPORTIVAS (2026-09-15) — bug reportado por el usuario:
 * "como salio independiente con sanlorenzo" → Michi decía "No encontré partidos
 * recientes de Independiente en mis fuentes deportivas" + una card de BÚSQUEDA
 * genérica (Wikipedia del club) mientras ESPN SÍ tenía el partido (1-1, 13/09).
 *
 * Tres causas cubiertas acá, todas con fetch mockeado (sin red):
 *  1. ESPN responde HTTP 400 "Failed to get events endpoint" para la ventana que
 *     usa la tool, y `if (!res.ok) return {}` lo leía como "sin partidos". Ahora
 *     ese fallo se distingue y se barre día por día.
 *  2. TheSportsDB: la respuesta viene en la clave `event` (SINGULAR) y el código
 *     leía `events` → siempre vacío; y la consulta era la frase cruda del usuario
 *     cuando `searchevents.php` exige "Equipo vs Equipo".
 *  3. Si NINGUNA fuente responde, el status es "unavailable" (→ el chat dice
 *     "probá de nuevo en unos minutos") y NO "no_data" (→ disparaba el plan B de
 *     búsqueda web con una card que no contestaba nada).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { tsdbQueryCandidates } from "./football";

type MockOptions = {
  espnSingleDayFails?: boolean;
  tsdb?: "pair-ok" | "empty" | "down" | "cross-sport";
  /** Suma un partido de un HOMÓNIMO (Independiente Santa Fe) a lo que devuelve ESPN. */
  espnDecoy?: boolean;
};

const ESPN_ERROR = { code: 400, message: "Failed to get events endpoint." };

function espnEvent(home: string, away: string, homeScore: string | undefined, awayScore: string | undefined, state: "pre" | "post", date = "2026-09-13T22:15Z") {
  return {
    id: `ev-${home}-${away}`,
    name: `${away} at ${home}`,
    date,
    status: { type: { state, description: state === "post" ? "Full Time" : "Scheduled" } },
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { displayName: home, shortDisplayName: home, logo: `https://logo/${home}.png` }, score: homeScore },
          { homeAway: "away", team: { displayName: away, shortDisplayName: away, logo: `https://logo/${away}.png` }, score: awayScore },
        ],
      },
    ],
  };
}

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as Response;

function installFetch(opts: MockOptions) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);

    // ── ESPN ──
    if (url.includes("site.api.espn.com")) {
      const dates = new URL(url).searchParams.get("dates") ?? "";
      const isRange = dates.includes("-");
      // El bug real: los RANGOS son una lotería (400) y los días sueltos responden.
      if (isRange) return jsonResponse(ESPN_ERROR, 400);
      if (opts.espnSingleDayFails) return jsonResponse(ESPN_ERROR, 400);
      const events = [espnEvent("Independiente", "San Lorenzo", "1", "1", "post")];
      if (opts.espnDecoy) {
        // Señuelo MÁS RECIENTE y con el nombre EXACTO del club pedido: sin el
        // texto completo del usuario, el matcheo por nombre suelto lo elige a él.
        events.push(espnEvent("Independiente", "Vasco da Gama", "3", "1", "post", "2026-09-15T22:15Z"));
      }
      return jsonResponse({ events });
    }

    // ── TheSportsDB ──
    if (url.includes("thesportsdb.com")) {
      if (opts.tsdb === "down") return jsonResponse({ message: "rate limit" }, 429);
      // Homónimo de OTRO deporte primero: TSDB tiene un "Boca Juniors" de
      // básquet además del club de fútbol.
      if (opts.tsdb === "cross-sport") {
        if (url.includes("searchteams.php")) {
          return jsonResponse({ teams: [
            { idTeam: "basket-boca", strTeam: "Boca Juniors", strSport: "Basketball", strLeague: "Argentinian Basketball" },
            { idTeam: "soccer-boca", strTeam: "Boca Juniors", strSport: "Soccer", strLeague: "Argentinian Primera Division" },
          ] });
        }
        if (url.includes("eventslast.php")) {
          const id = new URL(url).searchParams.get("id");
          if (id === "basket-boca") {
            return jsonResponse({ results: [{
              strEvent: "Boca Juniors vs NBA G League United", strSport: "Basketball", strLeague: "NBA G League",
              strHomeTeam: "Boca Juniors", strAwayTeam: "NBA G League United", strTimestamp: "2026-09-24T00:00:00",
              intHomeScore: "88", intAwayScore: "91", strStatus: "FT",
            }] });
          }
          return jsonResponse({ results: [{
            strEvent: "Boca Juniors vs São Paulo", strSport: "Soccer", strLeague: "Copa Sudamericana",
            strHomeTeam: "Boca Juniors", strAwayTeam: "São Paulo", strTimestamp: "2026-09-16T00:30:00",
            intHomeScore: "1", intAwayScore: "1", strStatus: "FT",
          }] });
        }
        if (url.includes("searchevents.php")) {
          // El partido de básquet es MÁS RECIENTE/futuro → ordenado, queda primero.
          return jsonResponse({ event: [
            { idEvent: "nba1", strEvent: "Boca Juniors vs NBA G League United", strSport: "Basketball", strLeague: "NBA G League",
              strHomeTeam: "Boca Juniors", strAwayTeam: "NBA G League United", strTimestamp: "2026-09-24T00:00:00",
              intHomeScore: null, intAwayScore: null, strStatus: "NS" },
            { idEvent: "sa1", strEvent: "Boca Juniors vs São Paulo", strSport: "Soccer", strLeague: "Copa Sudamericana",
              strHomeTeam: "Boca Juniors", strAwayTeam: "São Paulo", strTimestamp: "2026-09-16T00:30:00",
              intHomeScore: "1", intAwayScore: "1", strStatus: "FT" },
          ] });
        }
        if (url.includes("eventsnext.php")) return jsonResponse({ events: [] });
        return jsonResponse({});
      }
      if (url.includes("searchteams.php")) {
        return jsonResponse({ teams: [{ idTeam: "135156", strTeam: "Independiente", strLeague: "Argentinian Primera Division" }] });
      }
      if (url.includes("searchevents.php")) {
        // Exige "Equipo vs Equipo": con la frase cruda responde null (comportamiento real).
        const q = new URL(url).searchParams.get("e") ?? "";
        if (opts.tsdb === "pair-ok" && /^Independiente vs San Lorenzo$/i.test(q)) {
          return jsonResponse({
            event: [
              {
                idEvent: "2398079",
                strEvent: "Independiente vs San Lorenzo",
                strTimestamp: "2026-09-13T22:15:00",
                dateEvent: "2026-09-13",
                strLeague: "Argentinian Primera Division",
                strHomeTeam: "Independiente",
                strAwayTeam: "San Lorenzo",
                strHomeTeamBadge: "https://badge/independiente.png",
                strAwayTeamBadge: "https://badge/sanlorenzo.png",
                intHomeScore: "1",
                intAwayScore: "1",
                strStatus: "FT",
              },
            ],
          });
        }
        return jsonResponse({ event: null });
      }
      if (url.includes("eventslast.php")) return jsonResponse({ results: [] });
      if (url.includes("eventsnext.php")) return jsonResponse({ events: [] });
      return jsonResponse({});
    }

    return jsonResponse({});
  });
}

/** Importa el módulo con caché en memoria limpia (el caché es module-level). */
async function freshMatchLive() {
  vi.resetModules();
  const mod = await import("./football");
  return mod.matchLive;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tsdbQueryCandidates — consulta TheSportsDB bien formada", () => {
  it("arma \"Equipo vs Equipo\" desde el fraseo natural del usuario", () => {
    const candidates = tsdbQueryCandidates("Como salio independiente con sanlorenzo");
    expect(candidates[0]).toBe("Independiente vs San Lorenzo");
    expect(candidates).toContain("Como salio independiente con sanlorenzo");
  });

  it("no inventa pares cuando hay un solo club", () => {
    const candidates = tsdbQueryCandidates("cuando juega Boca");
    expect(candidates[0]).toBe("Boca Juniors");
    expect(candidates.some(c => c.includes(" vs "))).toBe(false);
  });
});

describe("match_live con fuentes caídas (determinista, sin red)", () => {
  it("ESPN 400 en TODOS los rangos → barre día por día y encuentra el clásico", async () => {
    installFetch({});
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "como salio independiente con sanlorenzo", __userInput: "como salio independiente con sanlorenzo" }, {} as any);

    expect(live.status).toBe("ok");
    expect(live.source).toBe("ESPN");
    expect(live.matches[0].homeTeam).toBe("Independiente");
    expect(live.matches[0].awayTeam).toBe("San Lorenzo");
    expect(live.matches[0].homeScore).toBe(1);
    expect(live.matches[0].awayScore).toBe(1);
  });

  it("ESPN caído + TheSportsDB responde el par exacto → el resultado sale de TSDB", async () => {
    installFetch({ espnSingleDayFails: true, tsdb: "pair-ok" });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "Como salio independiente con sanlorenzo", __userInput: "como salio independiente con sanlorenzo" }, {} as any);

    expect(live.status).toBe("ok");
    expect(live.source).toBe("TheSportsDB");
    expect(live.matches[0].homeScore).toBe(1);
    expect(live.matches[0].awayScore).toBe(1);
    // Escudos reales (strHomeTeamBadge / strAwayTeamBadge) → la card los muestra.
    expect(live.matches[0].homeLogo).toContain("independiente");
  });

  it("ninguna fuente responde → status \"unavailable\" (no \"no_data\")", async () => {
    installFetch({ espnSingleDayFails: true, tsdb: "down" });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "Como salio independiente con sanlorenzo", __userInput: "como salio independiente con sanlorenzo" }, {} as any);

    expect(live.status).toBe("unavailable");
    expect(live.note).toMatch(/Probá de nuevo en unos minutos/i);
    // Sin matches: no hay dato que mostrar (y sin status "no_data" no se dispara
    // el plan B de búsqueda web que generaba la card genérica).
  });

  it("query recortado a UN club + __userInput con el par → sale el par, no el homónimo", async () => {
    // Caso real del deploy (2026-09-16): el router llamó a la tool con
    // query="independiente", y el matcheo por substring mostraba
    // "Vasco da Gama 2-0 Independiente Santa Fe" como si fuera el clásico.
    installFetch({ espnDecoy: true });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run(
      { query: "independiente", __userInput: "como salió independiente con san lorenzo" },
      {} as any,
    );

    expect(live.status).toBe("ok");
    expect(live.matches[0].homeTeam).toBe("Independiente");
    expect(live.matches[0].awayTeam).toBe("San Lorenzo");
    expect(JSON.stringify(live)).not.toMatch(/vasco/i);
  });

  it("TSDB devuelve un partido de BÁSQUET del homónimo → se descarta y queda el de fútbol", async () => {
    installFetch({ espnSingleDayFails: true, tsdb: "cross-sport" });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "cuándo juega Boca", __userInput: "cuándo juega Boca" }, {} as any);

    // El evento de básquet (2026-09-24) ordenaba primero por fecha; no debe
    // aparecer un partido de la NBA G League en una consulta de fútbol.
    const text = JSON.stringify(live);
    expect(text).not.toMatch(/nba g league/i);
    expect(live.status).toBe("ok");
    expect(live.source).toBe("TheSportsDB");
    expect(live.matches[0].awayTeam).toBe("São Paulo");
    expect(live.matches[0].homeTeam).toBe("Boca Juniors");
  });

  it("searchteams devuelve el homónimo de básquet primero → el resultado sale del club de fútbol", async () => {
    installFetch({ espnSingleDayFails: true, tsdb: "cross-sport" });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "como salio Boca", __userInput: "como salio Boca" }, {} as any);

    expect(live.status).toBe("ok");
    expect(live.matches[0].awayTeam).toBe("São Paulo");
    expect(live.matches[0].homeTeam).toBe("Boca Juniors");
    expect(JSON.stringify(live)).not.toMatch(/nba g league/i);
    // El equipo elegido es el de fútbol, no el de básquet.
    expect(live.teamInfo?.id).toBe("soccer-boca");
  });

  it("las fuentes responden pero no hay partido → \"no_data\" (no es fuente caída)", async () => {
    installFetch({ tsdb: "empty" });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "Independiente Santa Fe vs Always Ready", __userInput: "como salio ese partido" }, {} as any);

    expect(live.status).not.toBe("unavailable");
  });
});
