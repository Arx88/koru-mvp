import { describe, expect, it } from "vitest";
import { formatCurrency, normalizeCurrencyCode } from "./currencyConverter";

// ============================================================================
// Conversión de moneda — funciones puras de normalización y formato.
// (convertCurrency hace red — no se testea acá; getCachedRate es cache puro
//  y ya lo cubren los tests de dominio que lo consumen.)
// ============================================================================

describe("normalizeCurrencyCode", () => {
  it("mapea símbolos a su código ISO", () => {
    expect(normalizeCurrencyCode("€")).toBe("EUR");
    expect(normalizeCurrencyCode("£")).toBe("GBP");
    expect(normalizeCurrencyCode("$")).toBe("USD");
    expect(normalizeCurrencyCode("R$")).toBe("BRL");
    expect(normalizeCurrencyCode("AR$")).toBe("ARS");
    expect(normalizeCurrencyCode("C$")).toBe("CAD");
    expect(normalizeCurrencyCode("Fr")).toBe("CHF");
  });

  it("normaliza códigos existentes sin romperlos", () => {
    expect(normalizeCurrencyCode("EUR")).toBe("EUR");
    expect(normalizeCurrencyCode("eur")).toBe("EUR");
    expect(normalizeCurrencyCode("  JPY ")).toBe("JPY");
    expect(normalizeCurrencyCode("CHF")).toBe("CHF");
  });

  it("vacío y null-safe devuelven string vacío", () => {
    expect(normalizeCurrencyCode("")).toBe("");
    expect(normalizeCurrencyCode("   ")).toBe("");
    expect(normalizeCurrencyCode(undefined as unknown as string)).toBe("");
  });

  it("el caso del bug real: símbolo € contra userCurrency EUR son la misma moneda", () => {
    // Antes del fix, el pre-fetch pedía convertCurrency("€"→"EUR") a la API
    // (from=€&to=EUR) en cada render del travel_plan. Ahora la normalización
    // los iguala y el effect lo salta.
    expect(normalizeCurrencyCode("€")).toBe(normalizeCurrencyCode("EUR"));
  });
});

describe("formatCurrency", () => {
  it("usa el símbolo correcto por código", () => {
    expect(formatCurrency(180, "EUR")).toContain("€");
    expect(formatCurrency(180, "EUR")).not.toContain("EUR");
    expect(formatCurrency(178.5, "EUR")).toBe("€178,50");
    expect(formatCurrency(29110, "JPY")).toBe("¥29.110");
  });

  it("formato es-ES: decimales con coma (agrupación depende del ICU del runtime)", () => {
    // 4 dígitos: el separador de miles varía según el build de ICU de Node
    // (small-icu lo omite); lo garantizado es la coma decimal y el símbolo.
    expect(formatCurrency(7400, "EUR")).toMatch(/^€7\.?400,00$/);
    expect(formatCurrency(1234.5, "ARS")).toMatch(/^\$1\.?234,50$/);
    // 5+ dígitos: agrupación completa en cualquier ICU razonable.
    expect(formatCurrency(29110, "JPY")).toBe("¥29.110");
  });

  it("código desconocido usa el código como prefijo (honesto)", () => {
    expect(formatCurrency(99, "XYZ")).toContain("XYZ");
  });
});
