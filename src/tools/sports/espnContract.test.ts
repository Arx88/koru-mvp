/**
 * 🔴 TEST DE CONTRATO con la API REAL de ESPN (`PROBE=1 npx vitest run ...`).
 *
 * Por qué existe: los tests de regresión mockean `fetch`, así que no pueden
 * detectar que la fuente cambió de forma. Los tres bugs reales de la sesión del
 * 2026-09-16 fueron exactamente de ese tipo —clave `event` vs `events`, 403 con
 * `User-Agent` propio, 400 en rangos de fecha—: todos pasaban los tests mockeados
 * y fallaban en producción.
 *
 * Acá se afirman los SUPUESTOS sobre los que está construido ./espn. Si ESPN
 * cambia, esto falla ruidosamente en vez de degradar la tool en silencio.
 * No corre en la suite normal (necesita red y es sensible a la latencia).
 *
 * Uso:  PROBE=1 npx vitest run src/tools/sports/espnContract.test.ts
 *
 * Este archivo ya se ganó el sueldo una vez: la primera corrida desmintió un
 * supuesto propio ("las selecciones no tienen calendario por equipo") que estaba
 * por convertirse en código. Ver el caso de Spain más abajo.
 */
import { describe, expect, it } from "vitest";
import { ESPN_SITE_BASE, fetchEspnTeamSchedule, resolveEspnTeam } from "./espn";

const LIVE = !!process.env.PROBE;
const TIMEOUT = 30_000;

describe.skipIf(!LIVE)("contrato con ESPN (red real)", () => {
  it("resuelve un club que NO está en el diccionario propio", async () => {
    const r = await resolveEspnTeam("Talleres");
    expect(r).not.toBeNull();
    expect(r!.leagueId).toBe("arg.1");
    expect(r!.national).toBe(false);
  }, TIMEOUT);

  it("resuelve Boca Juniors al club de arg.1 y no al homónimo de otro deporte", async () => {
    const r = await resolveEspnTeam("Boca Juniors");
    expect(r).not.toBeNull();
    expect(r!.teamId).toBe("5");
    expect(r!.leagueId).toBe("arg.1");
    expect(r!.teamName).toMatch(/Boca/i);
  }, TIMEOUT);

  it("prefiere el club senior: Real Madrid → esp.1 (no femenil ni Castilla)", async () => {
    const r = await resolveEspnTeam("Real Madrid");
    expect(r!.leagueId).toBe("esp.1");
  }, TIMEOUT);

  it("una frase sucia NO resuelve (0 items): hay que limpiarla antes de buscar", async () => {
    expect(await resolveEspnTeam("cuándo juega Boca")).toBeNull();
  }, TIMEOUT);

  it("una selección se marca `national`", async () => {
    const r = await resolveEspnTeam("Spain");
    expect(r).not.toBeNull();
    expect(r!.national).toBe(true);
  }, TIMEOUT);

  it("el calendario por equipo devuelve eventos con competiciones", async () => {
    const events = await fetchEspnTeamSchedule<any>("arg.1", "5");
    expect(events).not.toBeNull();
    expect(events!.length).toBeGreaterThan(0);
    expect(events![0].competitions?.length ?? 0).toBeGreaterThan(0);
  }, TIMEOUT);

  it("el calendario de una SELECCIÓN también trae partidos (id por competencia)", async () => {
    // Supuesto corregido por este mismo test: al principio se asumió que las
    // selecciones no tenían calendario. Sí tienen — y la trampa es que ESPN da un
    // id DISTINTO por competencia (medido: "Spain" = 164 en uefa.nations y 17640 en
    // fifa.wworldq.uefa). El calendario cubre la competencia del id resuelto; por
    // eso el scoreboard sigue siendo el fallback de matchSchedule.
    const spain = await resolveEspnTeam("Spain");
    const events = await fetchEspnTeamSchedule<any>(spain!.leagueId, spain!.teamId);
    expect(events).not.toBeNull();
    expect(events!.length).toBeGreaterThan(0);
    expect(events![0].competitions?.length ?? 0).toBeGreaterThan(0);
  }, TIMEOUT);

  it("un DÍA suelto del scoreboard responde 200 (base del barrido día por día)", async () => {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const res = await fetch(`${ESPN_SITE_BASE}/arg.1/scoreboard?dates=${day}`, { signal: AbortSignal.timeout(15_000) });
    expect(res.status).toBe(200);
  }, TIMEOUT);
});
