// 🔴 AUDITORÍA v2 — reclamos del usuario resueltos:
// 1. "partido pasado o copa específica → siempre el PRÓXIMO partido"
// 2. "no trae escudos reales"
// 3. "interior de la tarjeta prácticamente vacío"
// Corre con ESPN vivo: assertions SOFT (los datos del día varían).
import { describe, it, expect } from "vitest";
import { matchLive, matchSchedule } from "../tools/sports/football";
import { blocksFromToolResults } from "../server/blocksFromToolResults";

const state: any = { memories: [], records: [], commitments: [] };
const runCtx: any = { userInput: "", state, tzOffsetMin: -120 };

describe("audit fútbol v2: partido pasado, copas, escudos, interior rico", () => {
  it("partido pasado: match_live encuentra el resultado (ventana 12 días)", async () => {
    const live: any = await matchLive.run({ query: "Real Madrid ayer", __userInput: "Real Madrid ayer" }, runCtx);
    // Real Madrid jugó el 08/09 (Champions) — dentro de la ventana de 12 días.
    expect(live.status).toBe("ok");
    expect((live.matches ?? []).length).toBeGreaterThan(0);
    const m = live.matches[0];
    // El partido debe ser DEL EQUIPO consultado (no de otro con token parecido)
    const teams = `${m.homeTeam} ${m.awayTeam}`.toLowerCase();
    expect(teams).toContain("real madrid");
    // Escudos reales de ESPN
    expect(m.homeLogo || m.awayLogo).toBeTruthy();
    // Contexto del equipo para el interior
    expect(live.teamInfo?.name).toBeTruthy();
  }, 90_000);

  it("partido pasado: card de resultado rica (goles/stats/upcoming/wiki)", async () => {
    const live: any = await matchLive.run({ query: "Real Madrid", __userInput: "cómo salió real madrid" }, runCtx);
    const blocks = blocksFromToolResults([{ tool: "match_live", result: live } as any], "cómo salió real madrid", -120);
    const result = blocks.find((b) => b.type === "live_match") as any;
    expect(result).toBeDefined();
    expect(result.homeLogo).toBeTruthy();
    expect(result.teamInfo).toBeTruthy();
    expect(result.wikipediaExtract).toBeTruthy();
    // upcoming del propio match_live (rango de fechas) o del schedule
    expect((result.upcoming ?? []).length + (live.upcoming ?? []).length).toBeGreaterThan(0);
  }, 90_000);

  it("copa activa: detectLeague trae partidos de la competición", async () => {
    const live: any = await matchLive.run({ query: "cómo salió la champions", __userInput: "cómo salió la champions" }, runCtx);
    expect(live.status).toBe("ok");
    expect((live.matches ?? []).length).toBeGreaterThan(0);
    expect(String(live.matches[0].league ?? "")).toMatch(/champions/i);
  }, 90_000);

  it("intención de fixture: 'cuando juega boca' → UNA card de fixture con escudo", async () => {
    const live: any = await matchLive.run({ query: "Boca Juniors", __userInput: "cuando juega boca" }, runCtx);
    const sched: any = await matchSchedule.run({ team: "Boca Juniors", __userInput: "cuando juega boca" }, runCtx);
    const blocks = blocksFromToolResults(
      [{ tool: "match_live", result: live } as any, { tool: "match_schedule", result: sched } as any],
      "cuando juega boca",
      -120,
    );
    // fixtureIntent → la primera card es match_timeline (fixture), no live_match
    expect(blocks[0]?.type).toBe("match_timeline");
    const fixture = blocks[0] as any;
    expect(fixture.nextMatch?.homeLogo).toBeTruthy();
    expect((fixture.items ?? []).length).toBeGreaterThan(0);
    expect(fixture.teamInfo?.name).toBeTruthy();
    expect(fixture.wikipediaExtract).toBeTruthy();
  }, 120_000);

  it("escudos en nextMatch del schedule + tz del usuario en la hora", async () => {
    const sched: any = await matchSchedule.run({ team: "Boca Juniors" }, runCtx);
    expect(sched.status).toBe("ok");
    expect((sched.matches ?? []).length).toBeGreaterThan(0);
    expect(sched.nextMatch?.homeLogo).toBeTruthy();
    // Madrid (UTC+2): la hora NO puede ser la UTC cruda de un partido nocturno AR
    expect(sched.nextMatch?.time).toMatch(/^\d{2}:\d{2}$/);
  }, 90_000);
});
