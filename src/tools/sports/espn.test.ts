/**
 * Tests del RESOLVEDOR DE ENTIDADES de ESPN (./espn). Sin red: `fetch` mockeado.
 *
 * Cubre los tres comportamientos que reemplazan al diccionario escrito a mano:
 *   1. `sport=soccer` / homónimos: un equipo de OTRO deporte no puede ganar.
 *   2. femenil/filial/juvenil: "Real Madrid" no resuelve a Castilla ni al femenil.
 *   3. clubes FUERA del diccionario propio (Talleres) resuelven igual, porque la
 *      fuente de verdad es la búsqueda de ESPN y no la lista mantenida a mano.
 * Además: las selecciones se marcan como tales (su calendario por equipo no
 * existe) y los FALLOS se cachean 60 s para no martillar la búsqueda.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type EspnItem = { type?: string; id?: string; displayName?: string; sport?: string; league?: string };

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body }) as unknown as Response;

const searchBody = (items: EspnItem[]) => ({ items });

/** Instala un fetch mockeado y devuelve el contador de requests por host+path. */
function installFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  });
  return calls;
}

/** Importa el módulo con la caché en memoria limpia (es module-level). */
async function freshEspn() {
  vi.resetModules();
  return await import("./espn");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scoreEspnTeamCandidate — ranking de candidatos", () => {
  it("descarta otro deporte: el 'Boca Juniors' de básquet no puede ganar", async () => {
    const { scoreEspnTeamCandidate } = await freshEspn();
    const soccer = scoreEspnTeamCandidate({ type: "team", id: "5", displayName: "Boca Juniors", sport: "soccer", league: "arg.1" }, "boca");
    const basket = scoreEspnTeamCandidate({ type: "team", id: "999", displayName: "Boca Juniors", sport: "basketball", league: "arg.basket" }, "boca");
    expect(soccer).toBeGreaterThan(0);
    expect(basket).toBe(Number.NEGATIVE_INFINITY);
  });

  it("prefiere el club senior en liga conocida sobre femenil, filial y juveniles", async () => {
    const { scoreEspnTeamCandidate } = await freshEspn();
    const senior = scoreEspnTeamCandidate({ type: "team", id: "86", displayName: "Real Madrid", sport: "soccer", league: "esp.1" }, "real madrid");
    const women = scoreEspnTeamCandidate({ type: "team", id: "21128", displayName: "Real Madrid", sport: "soccer", league: "esp.w.1" }, "real madrid");
    const castilla = scoreEspnTeamCandidate({ type: "team", id: "7000", displayName: "Real Madrid Castilla", sport: "soccer", league: "club.friendly" }, "real madrid");
    const u19 = scoreEspnTeamCandidate({ type: "team", id: "132407", displayName: "Real Madrid U19", sport: "soccer", league: "global.u20.intercontinental_cup" }, "real madrid");
    const alternatives = [women, castilla, u19];
    expect(Math.max(...alternatives)).toBeLessThan(senior);
    // El femenil tiene el nombre EXACTO pero su liga resta 8: sin la penalización
    // (nombre exacto + 10) le ganaría al senior, que es el bug que se evitó.
    expect(women).toBeLessThan(10);
    expect(castilla).toBeLessThan(0);
    expect(u19).toBeLessThan(0);
  });

  it("un nombre sin relación se descarta (no resuelve cualquier cosa)", async () => {
    const { scoreEspnTeamCandidate } = await freshEspn();
    expect(scoreEspnTeamCandidate({ type: "team", id: "1", displayName: "Kashiwa Reysol", sport: "soccer", league: "jpn.1" }, "boca")).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("isNationalTeamLeague — la trampa del prefijo", () => {
  it("uefa.euro (selecciones) sí; uefa.europa (clubes) NO", async () => {
    const { isNationalTeamLeague } = await freshEspn();
    expect(isNationalTeamLeague("uefa.euro")).toBe(true);
    expect(isNationalTeamLeague("uefa.euro_u21_qual")).toBe(true);
    expect(isNationalTeamLeague("fifa.world")).toBe(true);
    expect(isNationalTeamLeague("fifa.wworldq.uefa")).toBe(true);
    expect(isNationalTeamLeague("uefa.europa")).toBe(false);
    expect(isNationalTeamLeague("arg.1")).toBe(false);
  });
});

describe("resolveEspnTeam — clubes que el diccionario propio no conoce", () => {
  it("resuelve un club fuera del diccionario (Talleres) con su liga", async () => {
    installFetch(() => jsonResponse(searchBody([
      { type: "team", id: "19", displayName: "Talleres (Córdoba)", sport: "soccer", league: "arg.1" },
      { type: "team", id: "10161", displayName: "Talleres de Remedios", sport: "soccer", league: "arg.3" },
    ])));
    const { resolveEspnTeam } = await freshEspn();
    const r = await resolveEspnTeam("Talleres");
    expect(r).not.toBeNull();
    expect(r!.teamId).toBe("19");
    expect(r!.teamName).toBe("Talleres (Córdoba)");
    expect(r!.leagueId).toBe("arg.1");
    expect(r!.national).toBe(false);
  });

  it("pide el filtro sport=soccer y el tipo team", async () => {
    const calls = installFetch(() => jsonResponse(searchBody([
      { type: "team", id: "5", displayName: "Boca Juniors", sport: "soccer", league: "arg.1" },
    ])));
    const { resolveEspnTeam } = await freshEspn();
    await resolveEspnTeam("Boca Juniors");
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("type=team");
    expect(calls[0]).toContain("sport=soccer");
    expect(calls[0]).toContain("query=Boca%20Juniors");
  });

  it("la frase sucia no resuelve nada (hay que limpiarla ANTES de buscar)", async () => {
    // Verificado contra la API real: "cuándo juega Boca" → 0 items.
    const calls = installFetch(() => jsonResponse(searchBody([])));
    const { resolveEspnTeam } = await freshEspn();
    expect(await resolveEspnTeam("cuándo juega Boca")).toBeNull();
    expect(calls.length).toBe(1);
  });

  it("una selección se marca como nacional (su calendario por equipo no existe)", async () => {
    installFetch(() => jsonResponse(searchBody([
      { type: "team", id: "164", displayName: "Spain", sport: "soccer", league: "uefa.nations" },
      { type: "team", id: "18220", displayName: "Spain U23", sport: "soccer", league: "fifa.olympics" },
    ])));
    const { resolveEspnTeam } = await freshEspn();
    const r = await resolveEspnTeam("Spain");
    expect(r!.teamId).toBe("164");
    expect(r!.national).toBe(true);
  });

  it("cachea la resolución lograda (una sola request para el mismo club)", async () => {
    const calls = installFetch(() => jsonResponse(searchBody([
      { type: "team", id: "5", displayName: "Boca Juniors", sport: "soccer", league: "arg.1" },
    ])));
    const { resolveEspnTeam } = await freshEspn();
    await resolveEspnTeam("Boca Juniors");
    await resolveEspnTeam("Boca Juniors");
    expect(calls.length).toBe(1);
  });

  it("un fallo de la fuente devuelve null y NO se reintenta en el acto (caché negativa)", async () => {
    // El host responde 403 con un UA propio (verificado): ante un fallo, la
    // resolución no puede martillar la búsqueda en cada tool del mismo turno.
    const calls = installFetch(() => jsonResponse({ code: 403, message: "Forbidden" }, 403));
    const { resolveEspnTeam } = await freshEspn();
    expect(await resolveEspnTeam("Boca Juniors")).toBeNull();
    expect(await resolveEspnTeam("Boca Juniors")).toBeNull();
    expect(calls.length).toBe(1);
  });
});

describe("fetchEspnTeamSchedule — calendario por equipo", () => {
  it("devuelve los eventos y los cachea", async () => {
    const calls = installFetch(url => url.includes("/schedule")
      ? jsonResponse({ events: [{ id: "401841577", name: "Boca Juniors at San Lorenzo" }] })
      : jsonResponse({}));
    const { fetchEspnTeamSchedule } = await freshEspn();
    const first = await fetchEspnTeamSchedule<{ id: string }>("arg.1", "5");
    const second = await fetchEspnTeamSchedule<{ id: string }>("arg.1", "5");
    expect(first?.length).toBe(1);
    expect(second?.length).toBe(1);
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("/arg.1/teams/5/schedule?fixture=true");
  });

  it("un HTTP no-ok es FALLO (null, TTL corto), no un calendario vacío", async () => {
    const calls = installFetch(() => jsonResponse({ code: 400, message: "Failed to get events endpoint." }, 400));
    const { fetchEspnTeamSchedule } = await freshEspn();
    expect(await fetchEspnTeamSchedule("arg.1", "5")).toBeNull();
    expect(await fetchEspnTeamSchedule("arg.1", "5")).toBeNull();
    expect(calls.length).toBe(1);
  });

  it("un calendario sin partidos futuros es un ACIERTO ([]), no un fallo", async () => {
    installFetch(() => jsonResponse({ events: [] }));
    const { fetchEspnTeamSchedule } = await freshEspn();
    expect(await fetchEspnTeamSchedule("arg.1", "5")).toEqual([]);
  });
});
