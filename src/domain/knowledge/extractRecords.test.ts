import { describe, it, expect } from "vitest";
import { extractLifeRecordsFromText } from "./extractRecords";

describe("extractLifeRecordsFromText", () => {
  it("extracts an expense", () => {
    const records = extractLifeRecordsFromText("gasté 18 euros en farmacia");
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("expense");
    expect(records[0].amount).toBe(18);
    expect(records[0].currency).toBe("EUR");
  });

  it("does not extract records from retrieval questions", () => {
    const records = extractLifeRecordsFromText("¿cuánto gasté esta semana?");
    expect(records).toHaveLength(0);
  });

  it("extracts a shopping item", () => {
    const records = extractLifeRecordsFromText("necesito comprar leche, huevos y pan");
    const shopping = records.filter((r) => r.kind === "shopping_item");
    expect(shopping.length).toBeGreaterThan(0);
    expect(shopping[0].value).toMatch(/leche/);
  });

  it("deduplicates records", () => {
    const records = extractLifeRecordsFromText("gasté 10 euros. gasté 10 euros.");
    expect(records.length).toBeLessThanOrEqual(2);
  });
});
