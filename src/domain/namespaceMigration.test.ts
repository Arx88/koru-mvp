import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateIndexedDbNamespaces } from "./namespaceMigration";

const spec = { from: "koru-offline", to: "michi-offline", version: 1, upgrade: vi.fn() };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("legacy database startup", () => {
  it("continues without deleting data when a legacy open never settles", async () => {
    vi.useFakeTimers();
    const request: any = {};
    const deleteDatabase = vi.fn();
    vi.stubGlobal("indexedDB", { open: vi.fn(() => request), deleteDatabase });
    const migration = migrateIndexedDbNamespaces([spec]);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(migration).resolves.toEqual([]);
    expect(deleteDatabase).not.toHaveBeenCalled();
    const close = vi.fn();
    request.result = { close };
    request.onsuccess();
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes a late connection after a blocked event", async () => {
    const request: any = {};
    vi.stubGlobal("indexedDB", { open: vi.fn(() => request) });
    const migration = migrateIndexedDbNamespaces([spec]);
    request.onblocked();
    await expect(migration).resolves.toEqual([]);
    const close = vi.fn();
    request.result = { close };
    request.onsuccess();
    expect(close).toHaveBeenCalledOnce();
  });
});
