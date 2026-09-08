/**
 * 🔴 CADENA DE BÚSQUEDA KEYLESS (2026-09-10): "no quiero depender de
 * aplicaciones de terceros como Tavily".
 *
 * Nueva arquitectura: la cadena funciona 100% SIN key (GDELT → DDG html/lite →
 * Google News RSS → Bing News RSS → HN Algolia → GDELT universal). Tavily es
 * ÚLTIMO recurso y SOLO si el usuario setea TAVILY_API_KEY — nunca una
 * dependencia: sin key el comportamiento no cambia.
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

const EMPTY_HTML = "<html><body></body></html>";

const calls: Array<{ url: string; body?: string }> = [];

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  delete process.env.TAVILY_API_KEY;
  vi.unstubAllGlobals();
});

function mockFetch(overrides?: { tavilyStatus?: number }) {
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: { method?: string; body?: string }) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body });
    if (u.includes("api.tavily.com")) {
      return new Response(JSON.stringify(TAVILY_FIXTURE), { status: overrides?.tavilyStatus ?? 200, headers: { "Content-Type": "application/json" } });
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

/** Mock donde TODA la cadena keyless falla (0 fuentes / error). */
function mockAllKeylessEmpty() {
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: { body?: string }) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body });
    if (u.includes("api.tavily.com")) {
      return new Response(JSON.stringify(TAVILY_FIXTURE), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("api.gdeltproject.org")) {
      return new Response(JSON.stringify({ articles: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("hn.algolia.com")) {
      return new Response(JSON.stringify({ hits: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    // DDG html/lite + Google News RSS + Bing News RSS: vacíos
    return new Response(EMPTY_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
  }));
}

describe("runSearch: cadena keyless + Tavily como ÚLTIMO recurso", () => {
  it("sin key: la cadena keyless responde (DDG) — cero llamadas a Tavily", async () => {
    delete process.env.TAVILY_API_KEY;
    mockFetch();
    const data = await runSearch({ query: "review airpods" }, true);
    expect(calls.filter((c) => c.url.includes("api.tavily.com"))).toHaveLength(0);
    expect(data.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.sources.some((s) => s.domain === "pcmag.com")).toBe(true);
  });

  it("CON key pero keyless OK: Tavily NO se llama (deja de ser primario — no es dependencia)", async () => {
    process.env.TAVILY_API_KEY = TAVILY_KEY;
    mockFetch();
    const data = await runSearch({ query: "review airpods" }, true);
    expect(calls.filter((c) => c.url.includes("api.tavily.com"))).toHaveLength(0);
    expect(data.sources.some((s) => s.domain === "pcmag.com")).toBe(true);
  });

  it("CON key y TODA la keyless caída: Tavily rescata al final con SUS fuentes", async () => {
    process.env.TAVILY_API_KEY = TAVILY_KEY;
    mockAllKeylessEmpty();
    const data = await runSearch({ query: "review airpods" }, true);
    const tavilyCall = calls.find((c) => c.url.includes("api.tavily.com"));
    expect(tavilyCall).toBeDefined();
    expect(String(tavilyCall?.body)).toContain(TAVILY_KEY);
    expect(data.sources.length).toBeGreaterThanOrEqual(2);
    expect(data.sources[0].url).toContain("soundguys.com");
    // Orden: Tavily se llama DESPUÉS de DDG/RSS/HN (último de la cadena).
    const tavilyIdx = calls.findIndex((c) => c.url.includes("api.tavily.com"));
    const ddgIdx = calls.findIndex((c) => c.url.includes("duckduckgo.com"));
    expect(ddgIdx).toBeGreaterThanOrEqual(0);
    expect(tavilyIdx).toBeGreaterThan(ddgIdx);
  });

  it("key inválida (Tavily 401) + keyless OK: turno OK con fuentes de DDG, sin romper", async () => {
    process.env.TAVILY_API_KEY = "tvly-invalida";
    // keyless vacía + tavily 401 → 0 fuentes pero SIN crash
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
    expect(data.sources.some((s) => s.domain === "pcmag.com")).toBe(true);
  });
});

describe("runSearch: conectores RSS keyless (Bing News / Google News / HN)", () => {
  const BING_RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>AirPods Pro 3, análisis: una tercera generación que roza la perfección</title>
<link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=abc&amp;url=https%3a%2f%2fwww.xataka.com%2Faudio%2Fairpods-pro-3-analisis&amp;c=77</link>
<description>Probamos los AirPods Pro 3 con cancelación activa.</description></item>
</channel></rss>`;

  const GNEWS_RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Review de los AirPods Max 2 - WIRED</title>
<link>https://news.google.com/rss/articles/CBMabc123</link>
<description>Al fin Apple se pone serio con la calidad musical.</description><pubDate>Tue, 09 Sep 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

  const HN_JSON = { hits: [
    { title: "AirPods Pro 3 liberated from Apple's ecosystem", url: "https://github.com/example/airpods", points: 142, num_comments: 89 },
  ] };

  it("DDG caído → Google News RSS responde con fuentes reales", async () => {
    delete process.env.TAVILY_API_KEY;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      const u = String(url);
      calls.push({ url: u });
      if (u.includes("news.google.com")) return new Response(GNEWS_RSS, { status: 200 });
      if (u.includes("api.gdeltproject.org")) return new Response(JSON.stringify({ articles: [] }), { status: 200 });
      return new Response(EMPTY_HTML, { status: 200 });
    }));
    const data = await runSearch({ query: "airpods review" });
    expect(data.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.sources[0].url).toContain("news.google.com");
    expect(data.sources[0].title).toBe("Review de los AirPods Max 2");
  });

  it("DDG y GNews caídos → Bing News RSS decodifica la URL apiclick a la fuente real", async () => {
    delete process.env.TAVILY_API_KEY;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      const u = String(url);
      calls.push({ url: u });
      if (u.includes("bing.com/news")) return new Response(BING_RSS, { status: 200 });
      if (u.includes("news.google.com")) return new Response(EMPTY_HTML, { status: 200 });
      if (u.includes("api.gdeltproject.org")) return new Response(JSON.stringify({ articles: [] }), { status: 200 });
      return new Response(EMPTY_HTML, { status: 200 });
    }));
    const data = await runSearch({ query: "airpods análisis" });
    expect(data.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.sources[0].url).toContain("xataka.com");
    expect(data.sources[0].url).not.toContain("apiclick");
  });

  it("todo RSS caído en shopping → HN Algolia rescata (JSON, sin key)", async () => {
    delete process.env.TAVILY_API_KEY;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      const u = String(url);
      calls.push({ url: u });
      if (u.includes("hn.algolia.com")) return new Response(JSON.stringify(HN_JSON), { status: 200 });
      if (u.includes("api.gdeltproject.org")) return new Response(JSON.stringify({ articles: [] }), { status: 200 });
      return new Response(EMPTY_HTML, { status: 200 });
    }));
    const data = await runSearch({ query: "airpods" }, true);
    expect(data.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.sources[0].url).toContain("github.com");
    expect(data.sources[0].snippet).toContain("142 puntos");
  });
});
