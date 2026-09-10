/**
 * day_info — pipeline completo: tool args → DayInfoData → UiBlock → presentation.
 * Cubre la queja "pregunté por el día y me contestó con texto sin cards".
 */
import { describe, expect, it } from "vitest";
import { dayInfoFromArgs } from "./koruBackend";
import { blocksFromToolResults } from "./blocksFromToolResults";
import { toPresentation } from "../ui/cards/unified/presentation";
import type { UiBlock } from "../domain/types";

describe("day_info tool pipeline", () => {
  it("dayInfoFromArgs calcula día/semana/progresos en la tz del cliente", () => {
    // Madrid UTC+2 → getTimezoneOffset() = -120.
    // 2026-09-10 es jueves, semana ISO 37.
    const data = dayInfoFromArgs({}, -120);
    expect(data.type).toBe("day_info");
    expect(data.status).toBe("ok");
    // El weekday DEBE ser el del cliente, no el del server (UTC puede caer
    // un día atrás cerca de medianoche).
    const now = new Date();
    const shifted = new Date(now.getTime() - (-120) * 60_000);
    const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    expect(data.weekday).toBe(DIAS[shifted.getUTCDay()]);
    expect(data.year).toBe(shifted.getUTCFullYear());
    expect(data.weekNumber).toBeGreaterThanOrEqual(1);
    expect(data.weekNumber).toBeLessThanOrEqual(53);
    expect(data.dayProgress).toBeGreaterThanOrEqual(0);
    expect(data.dayProgress).toBeLessThanOrEqual(100);
    expect(data.yearProgress).toBeGreaterThanOrEqual(0);
    expect(data.yearProgress).toBeLessThanOrEqual(100);
  });

  it("dayInfoFromArgs calcula countdown con target ISO (2026-12-25)", () => {
    const data = dayInfoFromArgs({ target: "2026-12-25" }, -120);
    expect(data.target).toBeDefined();
    expect(data.target!.dateLabel).toBe("25 de diciembre de 2026");
    // días restantes coherentes con la fecha del día del cliente
    const shifted = new Date(Date.now() + 120 * 60_000);
    const startOfDay = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
    const expected = Math.round((Date.UTC(2026, 11, 25) - startOfDay) / 86_400_000);
    expect(data.target!.daysLeft).toBe(expected);
  });

  it("blocksFromToolResults mapea day_info result → UiBlock day_info", () => {
    const result = dayInfoFromArgs({}, -120);
    const blocks = blocksFromToolResults([{ name: "day_info", arguments: {}, result } as any]);
    expect(blocks.length).toBe(1);
    const b = blocks[0] as Extract<UiBlock, { type: "day_info" }>;
    expect(b.type).toBe("day_info");
    expect(b.weekday).toBe(result.weekday);
    expect(b.dateLabel).toBe(result.dateLabel);
    expect(b.weekNumber).toBe(result.weekNumber);
    expect(typeof b.dayProgress).toBe("number");
  });

  it("toPresentation renderiza day_info como card hero (no texto plano)", () => {
    const block: Extract<UiBlock, { type: "day_info" }> = {
      type: "day_info",
      weekday: "jueves",
      dateLabel: "10 de septiembre de 2026",
      weekNumber: 37,
      year: 2026,
      dayProgress: 34,
      yearProgress: 69,
      daysToWeekend: 2,
      isWeekend: false,
    };
    const p = toPresentation(block as UiBlock);
    expect(p.hero.title).toContain("Jueves");
    expect(p.hero.desc).toContain("10 de septiembre de 2026");
    expect(p.hero.accent.color).toBe("#6D52F8");
    expect(p.hero.metrics?.length).toBe(3);
    expect(p.detail?.sections?.length).toBeGreaterThanOrEqual(2);
    expect(p.detail?.actions?.length).toBe(2);
  });

  it("day_info con target muestra tile de countdown en el detalle", () => {
    const block: Extract<UiBlock, { type: "day_info" }> = {
      type: "day_info",
      weekday: "jueves",
      dateLabel: "10 de septiembre de 2026",
      weekNumber: 37,
      year: 2026,
      dayProgress: 34,
      yearProgress: 69,
      daysToWeekend: 2,
      isWeekend: false,
      target: { label: "viernes 25 de diciembre", daysLeft: 106, dateLabel: "25 de diciembre de 2026" },
    };
    const p = toPresentation(block as UiBlock);
    const tilesSection = p.detail?.sections?.find((s) => s.kind === "tiles");
    const labels = (tilesSection as any)?.tiles?.map((t: any) => t.label) ?? [];
    expect(labels).toContain("viernes 25 de diciembre");
    expect((tilesSection as any).tiles.length).toBe(6);
  });
});
