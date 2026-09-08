/**
 * 🔴 FIX BÚSQUEDAS ROTAS EN PRODUCCIÓN (2026-09-09) — test de regresión.
 *
 * DuckDuckGo sirve una página de "anomaly" (anti-bot, HTTP 202) a los
 * User-Agents que no parecen un navegador real. El UA custom
 * "KoruLocal/1.0 (+local-first assistant)" disparaba el bloqueo desde IPs de
 * datacenter (Render), dejando TODAS las búsquedas con 0 fuentes — la causa
 * raíz de "dame review de airpods" sin resultados y "No pude conseguir fuentes
 * útiles con los conectores abiertos".
 *
 * Regla: los fetches de búsqueda van a html.duckduckgo.com (endpoint canónico,
 * sin el 302 de duckduckgo.com) con UA de navegador real + Accept-Language.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchDuckDuckGo } from "../tools/shared/scrapers";

const FIXTURE_HTML = `<!DOCTYPE html>
<html><body>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.soundguys.com%2Fapple-airpods-pro-3-review%2F&amp;rut=abc">Apple AirPods Pro 3 review: Close to perfect</a>
  <a class="result__snippet">The new AirPods Pro 3 improve noise cancellation and sound quality.</a>
</div>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.tomsguide.com%2Fairpods">Apple AirPods Pro 3 review: The best AirPods yet | Tom&#x27;s Guide</a>
  <a class="result__snippet">We tested the AirPods Pro 3 for our full review.</a>
</div>
</body></html>`;

let capturedUrl = "";
let capturedHeaders: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    capturedUrl = String(url);
    capturedHeaders = { ...(init?.headers ?? {}) };
    return new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchDuckDuckGo: conector anti-bloqueo", () => {
  it("usa el endpoint canónico html.duckduckgo.com (sin 302 de duckduckgo.com)", async () => {
    await searchDuckDuckGo("review airpods pro");
    expect(capturedUrl).toContain("https://html.duckduckgo.com/html/?q=");
    expect(capturedUrl).not.toContain("://duckduckgo.com/html");
  });

  it("envía UA de navegador real (Chrome), no un UA custom que dispara el anti-bot", async () => {
    await searchDuckDuckGo("review airpods pro");
    const ua = capturedHeaders["User-Agent"] ?? "";
    expect(ua).toMatch(/Mozilla\/5\.0.*AppleWebKit.*Chrome\/\d+/);
    expect(ua).not.toMatch(/KoruAgent|KoruLocal/i);
  });

  it("pide contenido en español con Accept-Language", async () => {
    await searchDuckDuckGo("review airpods pro");
    expect(capturedHeaders["Accept-Language"]).toContain("es");
  });

  it("parsea los resultados reales (títulos, URLs decodificadas de uddg, snippets)", async () => {
    const sources = await searchDuckDuckGo("review airpods pro");
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0].url).toBe("https://www.soundguys.com/apple-airpods-pro-3-review/");
    expect(sources[0].title).toContain("Apple AirPods Pro 3 review");
    expect(sources[0].snippet).toContain("noise cancellation");
    expect(sources.some((s) => s.domain === "tomsguide.com")).toBe(true);
  });
});
