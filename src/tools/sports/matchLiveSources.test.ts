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
  tsdb?: "pair-ok" | "empty" | "down";
};

const ESPN_ERROR = { code: 400, message: "Failed to get events endpoint." };

function espnEvent(home: string, away: string, homeScore: string | undefined, awayScore: string | undefined, state: "pre" | "post") {
  return {
    id: `ev-${home}-${away}`,
    name: `${away} at ${home}`,
    date: "2026-09-13T22:15Z",
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
      return jsonResponse({ events: [espnEvent("Independiente", "San Lorenzo", "1", "1", "post")] });
    }

    // ── TheSportsDB ──
    if (url.includes("thesportsdb.com")) {
      if (opts.tsdb === "down") return jsonResponse({ message: "rate limit" }, 429);
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

  it("las fuentes responden pero no hay partido → \"no_data\" (no es fuente caída)", async () => {
    installFetch({ tsdb: "empty" });
    const matchLive = await freshMatchLive();
    const live: any = await matchLive.run({ query: "Independiente Santa Fe vs Always Ready", __userInput: "como salio ese partido" }, {} as any);

    expect(live.status).not.toBe("unavailable");
  });
});
