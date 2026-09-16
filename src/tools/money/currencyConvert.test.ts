import { describe, it, expect, vi } from "vitest";
import { currencyConvert } from "./currencyConvert";
import { fetchJson } from "../shared/fetcher";

vi.mock("../shared/fetcher", () => ({
  fetchJson: vi.fn(async (raw: string) => {
    const url = new URL(raw);
    const amount = Number(url.searchParams.get("amount") ?? 1);
    return { ok: true, data: { amount, base: "USD", date: "2026-09-14", rates: { EUR: amount * 0.92 } } };
  }),
}));
vi.mock("../shared/rateLimiter", () => ({ limiters: { frankfurter: { acquire: vi.fn() } } }));

const ctx = {} as Parameters<typeof currencyConvert.run>[1];

describe("currency conversion cache", () => {
  it("reuses a unit rate without reusing the first converted amount", async () => {
    const first = await currencyConvert.run({ amount: 100, from: "USD", to: "EUR" }, ctx);
    const second = await currencyConvert.run({ amount: 500, from: "USD", to: "EUR" }, ctx);
    expect(first.converted).toBe(92);
    expect(second.converted).toBe(460);
    expect(first.rate).toBe(0.92);
    expect(second.rate).toBe(0.92);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(new URL(vi.mocked(fetchJson).mock.calls[0][0]).searchParams.get("amount")).toBe("1");
  });
});
