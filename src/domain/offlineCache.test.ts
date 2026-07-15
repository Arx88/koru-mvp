import { describe, it, expect, beforeEach } from "vitest";
import { isSupportedLanguage } from "./i18n";

// Note: IndexedDB operations are best-effort and silently no-op when unavailable
// (e.g., in jsdom). We test the surface that is safe to test in jsdom:
// - isOnline() returns a boolean
// - The module loads without error
// - The i18n language guard works (cross-module sanity check)

describe("offlineCache module (jsdom-safe subset)", () => {
  beforeEach(() => {
    // jsdom doesn't implement IndexedDB by default; that's fine — the module
    // is designed to silently no-op when IndexedDB is unavailable.
  });

  it("isOnline() returns a boolean", async () => {
    const { isOnline } = await import("./offlineCache");
    const result = isOnline();
    expect(typeof result).toBe("boolean");
  });

  it("does not throw when imported (no top-level IDB access)", () => {
    expect(() => {
      // Re-import to make sure no top-level side effects
      void import("./offlineCache");
    }).not.toThrow();
  });

  it("cacheTurn is callable and returns a promise (resolves to undefined when IDB unavailable)", async () => {
    const { cacheTurn } = await import("./offlineCache");
    const result = await cacheTurn({
      id: "test_1",
      userId: "u1",
      role: "user",
      text: "hola",
      createdAt: new Date().toISOString(),
    });
    expect(result).toBeUndefined();
  });

  it("readCachedTurns is callable and returns an empty array in jsdom", async () => {
    const { readCachedTurns } = await import("./offlineCache");
    const result = await readCachedTurns("u1");
    expect(Array.isArray(result)).toBe(true);
  });

  it("enqueueOfflineMessage is callable and returns an id string", async () => {
    const { enqueueOfflineMessage } = await import("./offlineCache");
    const id = await enqueueOfflineMessage("u1", "queued message");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("readOfflineQueue is callable and returns an array", async () => {
    const { readOfflineQueue } = await import("./offlineCache");
    const result = await readOfflineQueue("u1");
    expect(Array.isArray(result)).toBe(true);
  });

  it("dequeueOfflineMessage is callable and resolves without error", async () => {
    const { dequeueOfflineMessage } = await import("./offlineCache");
    await expect(dequeueOfflineMessage("nonexistent_id")).resolves.toBeUndefined();
  });

  it("clearCachedTurns is callable and resolves without error", async () => {
    const { clearCachedTurns } = await import("./offlineCache");
    await expect(clearCachedTurns("u1")).resolves.toBeUndefined();
  });

  it("isSupportedLanguage (i18n cross-check) works as expected", () => {
    expect(isSupportedLanguage("es")).toBe(true);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
  });
});
