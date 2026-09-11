// 🔴 FIX TZ — tests del formateo de kickoff en la tz del USUARIO.
// Contexto: el server corre en UTC (Render) y los fixtures mostraban la hora
// UTC cruda ("00:30" para un partido 21:30 AR / 02:30 Madrid). El cliente ya
// manda tzOffsetMin (getTimezoneOffset) en cada turn; ahora:
// - football.ts formatKickoffUserTz() formatea en la tz del usuario
// - blocksFromToolResults acepta tzOffsetMin y lo usa en kickoffTimeFrom /
//   shortDateFrom / pushFixtureCard
// - presentation.ts formatea la fecha del próximo partido en el browser
import { describe, it, expect } from "vitest";
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
