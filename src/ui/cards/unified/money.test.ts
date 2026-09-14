import { describe, it, expect } from "vitest";
import { moneyEsAr, formatMoneyNumber, parsePriceNumber } from "./money";

describe("moneyEsAr", () => {
  it("formatea el precio crudo que manda el backend (String(number) + código)", () => {
    expect(moneyEsAr("77312.805 USD")).toBe("77.312,81 USD");
    expect(moneyEsAr("64.2305 USD")).toBe("64,23 USD");
    expect(moneyEsAr("0.00042 BTC")).toBe("0,00042 BTC");
  });

  it("respeta lo que ya viene formateado o con símbolo (no lo reinterpreta)", () => {
    expect(moneyEsAr("$2.847.600")).toBe("$2.847.600");
    expect(moneyEsAr("USD 77.312,80")).toBe("USD 77.312,80");
    expect(moneyEsAr("1.250,50")).toBe("1.250,50");
    expect(moneyEsAr("64.230")).toBe("64.230");
    expect(moneyEsAr("sin datos")).toBe("sin datos");
  });

  it("sobrevive a vacíos y basura", () => {
    expect(moneyEsAr("")).toBe("");
    expect(moneyEsAr(undefined)).toBe("");
    expect(moneyEsAr(null)).toBe("");
  });
});

describe("formatMoneyNumber", () => {
  it("usa dos decimales fijos para montos y más para los chicos", () => {
    expect(formatMoneyNumber(1250.5)).toBe("1.250,50");
    expect(formatMoneyNumber(0.042)).toBe("0,042");
    expect(formatMoneyNumber(0.00042)).toBe("0,00042");
  });
});

describe("parsePriceNumber", () => {
  it("no se come los decimales del punto", () => {
    expect(parsePriceNumber("77312.805")).toBeCloseTo(77312.805, 3);
    expect(parsePriceNumber("1.250,50")).toBeCloseTo(1250.5, 2);
    // Un único punto se asume decimal en-US (limitación documentada del parser).
    expect(parsePriceNumber("$64.230")).toBeCloseTo(64.23, 2);
  });
});
