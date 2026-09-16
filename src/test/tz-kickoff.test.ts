// 🔴 FIX TZ — tests del formateo de kickoff en la tz del USUARIO.
// Contexto: el server corre en UTC (Render) y los fixtures mostraban la hora
// UTC cruda ("00:30" para un partido 21:30 AR / 02:30 Madrid). El cliente ya
// manda tzOffsetMin (getTimezoneOffset) en cada turn; ahora:
// - football.ts formatKickoffUserTz() formatea en la tz del usuario
// - blocksFromToolResults acepta tzOffsetMin y lo usa en kickoffTimeFrom /
//   shortDateFrom / pushFixtureCard
// - presentation.ts formatea la fecha del próximo partido en el browser
import { describe, it, expect, vi, afterEach } from "vitest";
import { formatKickoffUserTz } from "../tools/sports/football";
import { blocksFromToolResults } from "../server/blocksFromToolResults";

// Partido real: Boca vs Central Córdoba, ESPN ISO 2026-09-12T00:30Z
// = sábado 02:30 Madrid (CEST, UTC+2) = viernes 21:30 Argentina (UTC-3)
const BOCA_ISO = "2026-09-12T00:30:00Z";

describe("formatKickoffUserTz", () => {
  it("Madrid (getTimezoneOffset -120): 00:30Z → 02:30", () => {
    expect(formatKickoffUserTz(BOCA_ISO, -120)).toBe("02:30");
  });

  it("Argentina (getTimezoneOffset +180): 00:30Z → 21:30", () => {
    expect(formatKickoffUserTz(BOCA_ISO, 180)).toBe("21:30");
  });

  it("sin tz (legacy): hora del runtime (UTC en CI) → 00:30", () => {
    // En vitest el container corre UTC: comportamiento legacy documentado.
    expect(formatKickoffUserTz(BOCA_ISO, undefined)).toBe("00:30");
  });

  it("withDate: fecha completa en tz del usuario (Madrid → sábado)", () => {
    const label = formatKickoffUserTz(BOCA_ISO, -120, { withDate: true });
    expect(label).toContain("02:30");
    expect(label).toMatch(/s[aá]b|sat/i); // sábado en Madrid (12/09)
  });

  it("withDate: Argentina → VIERNES 11/09 (día anterior, no sábado)", () => {
    const label = formatKickoffUserTz(BOCA_ISO, 180, { withDate: true });
    expect(label).toContain("21:30");
    expect(label).toMatch(/vie|fri/i); // viernes en Argentina (11/09)
  });

  it("fecha inválida → undefined (no crashea)", () => {
    expect(formatKickoffUserTz("no-es-fecha", -120)).toBeUndefined();
    expect(formatKickoffUserTz(undefined, -120)).toBeUndefined();
    expect(formatKickoffUserTz(null, -120)).toBeUndefined();
  });
});

describe("blocksFromToolResults con tzOffsetMin (fixture card)", () => {
  const scheduleResult = {
    tool: "match_schedule",
    result: {
      type: "match_schedule",
      status: "ok",
      team: "Boca Juniors",
      matches: [
        {
          homeTeam: "Boca Juniors",
          awayTeam: "Central Córdoba",
          date: BOCA_ISO,
          league: "Argentine Primera División",
        },
      ],
      nextMatch: {
        homeTeam: "Boca Juniors",
        awayTeam: "Central Córdoba",
        date: BOCA_ISO,
        time: "02:30", // ya formateado por football.ts con tz del usuario
        league: "Argentine Primera División",
      },
      teamInfo: { name: "Boca Juniors", league: "Primera División" },
    },
  };

  it("respeta el time del tool y formatea items en tz Madrid", () => {
    const blocks = blocksFromToolResults([scheduleResult] as any, "cuando juega boca", -120);
    const fixture = blocks.find((b) => b.type === "match_timeline");
    expect(fixture).toBeDefined();
    // nextMatch.time pre-formateado por el tool (user tz) pasa intacto
    expect((fixture as any).nextMatch?.time).toBe("02:30");
    // item.minute = fecha en tz Madrid → SÁBADO 12/09
    expect((fixture as any).items?.[0]?.minute).toMatch(/s[aá]b.*12\/09/i);
    // item.sub lleva la hora en tz Madrid → 02:30
    expect((fixture as any).items?.[0]?.sub).toContain("02:30");
  });

  it("tz Argentina: items en VIERNES 11/09 y 21:30", () => {
    const blocks = blocksFromToolResults([scheduleResult] as any, "cuando juega boca", 180);
    const fixture = blocks.find((b) => b.type === "match_timeline");
    expect((fixture as any).items?.[0]?.minute).toMatch(/vie.*11\/09/i);
    expect((fixture as any).items?.[0]?.sub).toContain("21:30");
  });

  it("sin tz (legacy): fecha/hora del runtime (UTC) — no rompe", () => {
    const blocks = blocksFromToolResults([scheduleResult] as any, "cuando juega boca");
    const fixture = blocks.find((b) => b.type === "match_timeline");
    expect((fixture as any).items?.[0]?.minute).toMatch(/s[aá]b.*12\/09/i); // UTC
    expect((fixture as any).items?.[0]?.sub).toContain("00:30");
  });
});

/**
 * 🔴 FIX HORA SIN CLIENTE (2026-09-16) — el offset del cliente llega sólo cuando
 * hay cliente. Los turnos del motor proactivo (avisos de partido) corren sin uno,
 * y ahí la hora caía al reloj del server (UTC en Render): la notificación de un
 * partido de las 21:15 en Buenos Aires decía "00:15". Ahora se usa el huso IANA
 * del perfil. Los tests de acá afirman la HORA REAL en cada huso, así que valen
 * con cualquier TZ del proceso (no como los del camino legacy, que asumen UTC).
 */
describe("formatKickoffUserTz — huso IANA del perfil (turnos sin cliente)", () => {
  it("Buenos Aires: 00:30Z es 21:30 del día ANTERIOR", () => {
    expect(formatKickoffUserTz(BOCA_ISO, undefined, { timeZone: "America/Argentina/Buenos_Aires" })).toBe("21:30");
    const label = formatKickoffUserTz(BOCA_ISO, undefined, { timeZone: "America/Argentina/Buenos_Aires", withDate: true });
    expect(label).toContain("21:30");
    expect(label).toMatch(/vie|fri/i);
  });

  it("Madrid: el mismo instante es sábado 02:30", () => {
    expect(formatKickoffUserTz(BOCA_ISO, undefined, { timeZone: "Europe/Madrid" })).toBe("02:30");
  });

  it("medianoche en el huso: 03:00Z en Buenos Aires es 00:00 (no 24:00)", () => {
    expect(formatKickoffUserTz("2026-09-12T03:00:00Z", undefined, { timeZone: "America/Argentina/Buenos_Aires" })).toBe("00:00");
  });

  it("un huso inválido ('auto', vacío, inexistente) NO rompe: cae al runtime", () => {
    for (const bad of ["auto", "", "Marte/Olympus"]) {
      expect(() => formatKickoffUserTz(BOCA_ISO, undefined, { timeZone: bad })).not.toThrow();
      expect(formatKickoffUserTz(BOCA_ISO, undefined, { timeZone: bad })).toBe(formatKickoffUserTz(BOCA_ISO));
    }
  });

  it("el offset del cliente manda sobre el huso del perfil (es exacto para esa fecha)", () => {
    expect(formatKickoffUserTz(BOCA_ISO, 180, { timeZone: "Europe/Madrid" })).toBe("21:30");
  });
});

describe("match_schedule sin cliente: la card usa el huso del perfil", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Fixture a 3 días vista con kickoff 00:30Z → 21:30 en Buenos Aires (UTC-3 todo el año). */
  const futureKickoff = () => {
    const d = new Date(Date.now() + 3 * 864e5);
    d.setUTCHours(0, 30, 0, 0);
    return d.toISOString();
  };

  function installFetch(kickoff: string) {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }) as unknown as Response;
      if (url.includes("common/v3/search")) {
        return json({ items: [{ type: "team", id: "5", displayName: "Boca Juniors", sport: "soccer", league: "arg.1" }] });
      }
      if (url.includes("/teams/5/schedule")) {
        return json({
          events: [{
            id: "1",
            date: kickoff,
            competitions: [{
              date: kickoff,
              competitors: [
                { homeAway: "home", team: { displayName: "Boca Juniors" } },
                { homeAway: "away", team: { displayName: "Central Córdoba" } },
              ],
            }],
          }],
        });
      }
      return json({});
    });
  }

  it("sin tzOffsetMin, la hora sale en la zona del perfil (no en la del server)", async () => {
    vi.resetModules();
    const kickoff = futureKickoff();
    installFetch(kickoff);
    const { matchSchedule } = await import("../tools/sports/football");
    const sched: any = await matchSchedule.run(
      { team: "Boca Juniors" },
      { userInput: "cuando juega Boca", state: { userProfile: { timezone: "America/Argentina/Buenos_Aires" } } } as any,
    );
    expect(sched.nextMatch?.time).toBe("21:30");
    expect(sched.timeZone).toBe("America/Argentina/Buenos_Aires");
  });

  it("con tzOffsetMin, manda el cliente y no se consulta el perfil", async () => {
    vi.resetModules();
    installFetch(futureKickoff());
    const { matchSchedule } = await import("../tools/sports/football");
    const sched: any = await matchSchedule.run(
      { team: "Boca Juniors" },
      { userInput: "cuando juega Boca", tzOffsetMin: 180, state: { userProfile: { timezone: "Europe/Madrid" } } } as any,
    );
    // -180 (= UTC-3) → mismo resultado que el huso argentino, pero por el offset.
    expect(sched.nextMatch?.time).toBe("21:30");
    expect(sched.timeZone).toBeUndefined();
  });
});
