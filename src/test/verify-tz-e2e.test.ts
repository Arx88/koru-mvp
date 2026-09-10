// Verificación E2E del FIX TZ con ESPN vivo: cliente Madrid (tzOffsetMin=-120)
// pide "cuando juega boca" → la card debe mostrar hora Madrid, no UTC.
import { describe, it, expect } from "vitest";
import { matchSchedule } from "../tools/sports/football";
import { blocksFromToolResults } from "../server/blocksFromToolResults";

const TZ_MADRID = -120; // getTimezoneOffset() CEST (UTC+2)

describe("e2e FIX TZ: fixture de Boca con cliente Madrid", () => {
  it("muestra hora de Madrid, no UTC crudo", async () => {
    const runResult: any = await matchSchedule.run(
      { team: "Boca Juniors", __userInput: "cuando juega boca" },
      { userInput: "cuando juega boca", state: { memories: [], records: [], commitments: [] } as any, tzOffsetMin: TZ_MADRID },
    );
    console.log("nextMatch (tool):", JSON.stringify(runResult.nextMatch));
    console.log("matches[0].date ISO:", runResult.matches?.[0]?.date);

    const blocks = blocksFromToolResults(
      [{ tool: "match_schedule", result: runResult } as any],
      "cuando juega boca",
      TZ_MADRID,
    );
    const fixture = blocks.find((b) => b.type === "match_timeline") as any;
    console.log("items:", JSON.stringify(fixture?.items?.slice(0, 2), null, 1));

    // El partido de Boca vs Central Córdoba es 2026-09-12T00:30Z:
    // Madrid = 02:30, UTC crudo = 00:30. NO debe aparecer la hora UTC.
    const sub0 = String(fixture?.items?.[0]?.sub ?? "");
    if (runResult.nextMatch?.time) {
      expect(runResult.nextMatch.time).not.toBe("00:30");
      expect(runResult.nextMatch.time).toMatch(/^\d{2}:\d{2}$/);
    }
    expect(sub0).not.toContain("00:30");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
