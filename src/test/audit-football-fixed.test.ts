// AUDITORÍA del flujo de fútbol CON FIXES (temporal): ejecuta las tools reales
// + blocksFromToolResults (con merge) + toPresentation, y verifica:
// 1. UNA sola card (no doble resultado+fixture)
// 2. Sin stats fabricadas 50/50
// 3. Sin marcador 0-0 en partidos programados
// 4. Extensión con datos en todos los casos
import { describe, it, expect } from "vitest";
import { matchLive, matchSchedule } from "../tools/sports/football";
import { blocksFromToolResults } from "../server/blocksFromToolResults";
import { toPresentation } from "../ui/cards/unified/presentation";

const QUERIES = (process.env.KORU_QUERIES ?? "Barcelona||Boca Juniors||Real Madrid").split("||");

describe("audit: pipeline fútbol CON FIXES", () => {
  for (const q of QUERIES) {
    it(`query: "${q}"`, async () => {
      const state: any = { memories: [], records: [], commitments: [] };
      const executions: any[] = [];

      console.log(`\n════════ QUERY: "${q}" ════════`);
      const r1 = await matchLive.run({ query: q, __userInput: q }, { userInput: q, state });
      console.log(`match_live → status=${(r1 as any).status} | matches=${((r1 as any).matches ?? []).length} | teamInfo=${(r1 as any).teamInfo ? "sí" : "no"}`);
      const m0 = ((r1 as any).matches ?? [])[0] as any;
      if (m0) console.log(`  P1: ${m0.homeTeam} ${m0.homeScore ?? "?"}-${m0.awayScore ?? "?"} ${m0.awayTeam} (${m0.status}) [state=${m0.state ?? "—"}]`);
      executions.push({ id: "t1", name: "match_live", result: r1 });

      const r2 = await matchSchedule.run({ team: q, __userInput: q }, { userInput: q, state });
      const sMatches = ((r2 as any).matches ?? []) as any[];
      console.log(`match_schedule → status=${(r2 as any).status} | matches=${sMatches.length} | nextMatch=${(r2 as any).nextMatch ? "sí" : "no"} | teamInfo=${(r2 as any).teamInfo ? "sí" : "no"} | wiki=${(r2 as any).wikipediaExtract ? "sí" : "no"}`);
      if (sMatches[0]) console.log(`  F1: ${sMatches[0].homeTeam} vs ${sMatches[0].awayTeam} · ${sMatches[0].date}`);
      executions.push({ id: "t2", name: "match_schedule", result: r2 });

      const blocks = blocksFromToolResults(executions, q);
      console.log(`\nUiBlocks: ${blocks.length} → ${(blocks as any[]).map((b: any) => b.type).join(", ")}`);

      // ✅ CHECK 1: máximo 1 card de contenido + 1 de "otros resultados"
      const matchBlocks = (blocks as any[]).filter((b: any) => b.type === "live_match" || b.type === "match_timeline");
      expect(matchBlocks.length).toBeLessThanOrEqual(2);
      const fixtureCards = matchBlocks.filter((b: any) => b.type === "match_timeline" && (b.items ?? []).length > 0 && /pr[óo]ximo|vs/i.test((b.items?.[0] as any)?.text ?? ""));
      if (matchBlocks.some((b: any) => b.type === "live_match" && !/otros resultados/i.test(b.title ?? ""))) {
        // si hay card de resultado, NO debe haber card de fixture aparte
        expect(fixtureCards.length).toBe(0);
      }

      for (const b of blocks as any[]) {
        if (b.type !== "live_match" && b.type !== "match_timeline") continue;
        const p = toPresentation(b) as any;
        const detail = p?.detail;
        console.log(`\n◆ ${b.type} ${b.title ? `("${b.title}")` : ""}:`);
        // ✅ CHECK 2: sin stats fabricadas
        if (b.type === "live_match") {
          for (const s of b.stats ?? []) {
            expect(s.leftPercent === 50 && s.rightPercent === 50 && !b.detailedStats).toBe(false);
          }
          // ✅ CHECK 3: programado → artValue no es "0-0"
          const isPre = b.state === "pre" || /scheduled|not started|pr[oó]xim/i.test(b.status ?? "");
          if (isPre) {
            console.log(`  scheduled → artValue="${p.hero.artValue}" (antes "0-0")`);
            expect(p.hero.artValue).not.toBe("0-0");
          }
          if (b.upcoming?.length) console.log(`  upcoming mergeado: ${b.upcoming.length} próximos ✓`);
        }
        // ✅ CHECK 4: extensión con datos
        if (detail) {
          const secs = detail.sections ?? [];
          console.log(`  EXT: ${secs.length} secciones → ${secs.map((s: any) => `${s.kind}:"${s.title}"(${s.kind === "rows" ? (s.rows?.length ?? 0) : s.kind === "timeline" ? (s.steps?.length ?? 0) : "?"})`).join(" · ")}`);
          expect(secs.length).toBeGreaterThan(0);
        } else {
          console.log(`  EXT: ❌ undefined`);
          // la única card sin extensión permitida: "otros resultados" vacía (no se emite)
          expect((b.items ?? []).length).toBe(0);
          expect(b.teamInfo).toBeFalsy();
        }
      }
      console.log(`\n✓ query "${q}" OK`);
    }, 180_000);
  }
});
