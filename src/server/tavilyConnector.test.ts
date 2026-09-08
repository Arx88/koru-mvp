/**
 * 🔴 FIX CONNECTORS (2026-09-09): conector Tavily opcional vía TAVILY_API_KEY.
 *
 * Contexto: desde la IP de datacenter de Render, TODOS los buscadores
 * scrapeables fallan (DDG "anomaly", Bing envenenado, GDELT 429, Reddit 403).
 * Tavily (API para agentes de IA, 1.000 créditos/mes gratis) es el conector
 * confiable: cuando la key existe es PRIMARIO; sin key el comportamiento no
 * cambia (cadena keyless). Si Tavily falla (key inválida/quota) cae a la
 * cadena local sin romper el turno.
 *
 * Estos tests usan runSearch REAL de koruBackend con fetch mockeado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSearch } from "./koruBackend";

const TAVILY_KEY = "tvly-test-key-123";

const TAVILY_FIXTURE = {
  results: [
    {
      title: "Apple AirPods Pro 3 review: Close to perfect",
      url: "https://www.soundguys.com/apple-airpods-pro-3-review/",
      content: "The AirPods Pro 3 improve noise cancellation and sound quality over the Pro 2.",
    },
    {
      title: "Apple AirPods Pro 3 review: The best AirPods yet",
      url: "https://www.tomsguide.com/audio/airpods/apple-airpods-pro-3-review",
      content: "We tested the AirPods Pro 3 for our full review with lab measurements.",
    },
  ],
};

const DDG_FIXTURE = `<!DOCTYPE html><html><body>
<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.pcmag.com%2Freviews%2Fairpods">PCMag AirPods review</a>
<a class="result__snippet">PCMag tested the AirPods Pro 3.</a>
</body></html>`;

const calls: Array<{ url: string; body?: string }> = [];

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  delete process.env.TAVILY_API_KEY;
  vi.unstubAllGlobals();
});

function mockFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: { method?: string; body?: string }) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body });
    if (u.includes("api.tavily.com")) {
      return new Response(JSON.stringify(TAVILY_FIXTURE), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("html.duckduckgo.com")) {
      return new Response(DDG_FIXTURE, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    if (u.includes("api.gdeltproject.org")) {
      return new Response(JSON.stringify({ articles: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // scrapeo de fuentes (fetchPageContent)
    return new Response("<html><body><article><p>Revisión completa del producto con análisis de sonido y comparativas reales del tester.</p></article></body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }));
}

describe("runSearch: conector Tavily (TAVILY_API_KEY)", () => {
  it("con la key: llama a api.tavily.com con la key en el body y devuelve SUS fuentes", async () => {
    process.env.TAVILY_API_KEY = TAVILY_KEY;
    mockFetch();
    const data = await runSearch({ query: "review airpods" }, true);
    const tavilyCall = calls.find((c) => c.url.includes("api.tavily.com"));
    expect(tavilyCall).toBeDefined();
    expect(String(tavilyCall?.body)).toContain(TAVILY_KEY);
    expect(data.sources.length).toBeGreaterThanOrEqual(2);
    expect(data.sources[0].url).toContain("soundguys.com");
    expect(data.sources.some((s) => s.domain === "tomsguide.com")).toBe(true);
  });

  it("con la key: Tavily es primario — NO llama a DDG si Tavily devolvió fuentes", async () => {
    process.env.TAVILY_API_KEY = TAVILY_KEY;
    mockFetch();
    await runSearch({ query: "review airpods" }, true);
    expect(calls.filter((c) => c.url.includes("duckduckgo.com"))).toHaveLength(0);
  });

  it("sin key: NO llama a Tavily y cae a la cadena keyless (DDG)", async () => {
    delete process.env.TAVILY_API_KEY;
    mockFetch();
    const data = await runSearch({ query: "review airpods" }, true);
    expect(calls.filter((c) => c.url.includes("api.tavily.com"))).toHaveLength(0);
    expect(data.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.sources.some((s) => s.domain === "pcmag.com")).toBe(true);
  });

  it("key inválida (Tavily responde 401): falla silenciosamente y cae a DDG sin romper el turno", async () => {
    process.env.TAVILY_API_KEY = "tvly-invalida";
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: { body?: string }) => {
      const u = String(url);
      calls.push({ url: u, body: init?.body });
      if (u.includes("api.tavily.com")) {
        return new Response(JSON.stringify({ detail: "Invalid API key" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      if (u.includes("html.duckduckgo.com")) {
        return new Response(DDG_FIXTURE, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      if (u.includes("api.gdeltproject.org")) {
        return new Response(JSON.stringify({ articles: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("<html><body><article><p>Análisis real del producto para el scrapeo de contenido.</p></article></body></html>", { status: 200 });
    }));
    const data = await runSearch({ query: "review airpods" }, true);
    expect(calls.some((c) => c.url.includes("api.tavily.com"))).toBe(true);
    expect(data.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.sources.some((s) => s.domain === "pcmag.com")).toBe(true);
  });
});
