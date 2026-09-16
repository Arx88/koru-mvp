// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker(source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8")) {
  const handlers: Record<string, (event: any) => void> = {};
  const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}), add: vi.fn(async () => {}) };
  const fetch = vi.fn(async () => { throw new Error("offline"); });
  vm.runInNewContext(source, {
    self: { location: { origin: "https://app.test" }, addEventListener: (type: string, fn: any) => { handlers[type] = fn; } },
    caches: { open: async () => cache, match: cache.match },
    fetch, Request, Response, URL, Promise,
  });
  function request(path: string, mode: RequestMode = "cors") {
    let response: Promise<Response> | undefined;
    const lifetime: Promise<unknown>[] = [];
    handlers.fetch({
      request: new Request(`https://app.test${path}`, { method: "GET", mode }),
      respondWith: (value: Promise<Response>) => { response = value; },
      waitUntil: (value: Promise<unknown>) => lifetime.push(value),
    });
    return { response, lifetime };
  }
  return { request, fetch };
}

describe("offline service worker", () => {
  it("returns a real 503 response when neither network nor cache is available", async () => {
    const { request } = worker();
    for (const path of ["/", "/assets/app.js"]) {
      const event = request(path);
      const response = await event.response;
      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(503);
      expect(event.lifetime.length).toBeGreaterThan(0);
      await Promise.all(event.lifetime);
    }
  });

  it("does not intercept private, API, callback or query-string requests", () => {
    const { request, fetch } = worker();
    for (const path of ["/api/michi/turn", "/koru-integrations.json", "/oauth/callback", "/?code=private", "/assets/profile.json"]) {
      expect(request(path).response).toBeUndefined();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
