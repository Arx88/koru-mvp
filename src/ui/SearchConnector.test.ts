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

/** Fixture del endpoint lite (tabla: <a class='result-link'> + <td class='result-snippet'>). */
const FIXTURE_LITE_HTML = `<!DOCTYPE HTML>
<html><body>
<table>
<tr><td>1.</td><td><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.soundguys.com%2Fapple-airpods-pro-3-review%2F&amp;rut=abc" class='result-link'>Apple AirPods Pro 3 review: Close to perfect - SoundGuys</a></td></tr>
<tr><td>&nbsp;</td><td class='result-snippet'>Apple looks to improve upon the AirPods Pro 2, but those are big shoes to fill.</td></tr>
<tr><td>2.</td><td><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.pcmag.com%2Freviews%2Fapple-airpods-pro-3" class='result-link'>Third Time's the Charm: I Tested Apple's AirPods Pro 3</a></td></tr>
<tr><td>&nbsp;</td><td class='result-snippet'>We tested the AirPods Pro 3 for our full review with measurements.</td></tr>
</table>
</body></html>`;

/** Página anti-bot "anomaly" de DDG (lo que devuelve a IPs flaggeadas — 0 resultados). */
const ANOMALY_HTML = `<!DOCTYPE html>
<html><body><div class="anomaly-notification">
<h1>Unfortunately, bots use DuckDuckGo too</h1>
<p>If you believe this is an error, please contact us.</p>
</div></body></html>`;

beforeEach(() => {
  capturedUrl = "";
  capturedHeaders = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchDuckDuckGo: conector anti-bloqueo", () => {
  it("usa el endpoint canónico html.duckduckgo.com (sin 302 de duckduckgo.com)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      capturedUrl = String(url);
      capturedHeaders = { ...(init?.headers ?? {}) };
      return new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
    }));
    await searchDuckDuckGo("review airpods pro");
    expect(capturedUrl).toContain("https://html.duckduckgo.com/html/?q=");
    expect(capturedUrl).not.toContain("://duckduckgo.com/html");
  });

  it("envía UA de navegador real (Chrome), no un UA custom que dispara el anti-bot", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      capturedUrl = String(url);
      capturedHeaders = { ...(init?.headers ?? {}) };
      return new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
    }));
    await searchDuckDuckGo("review airpods pro");
    const ua = capturedHeaders["User-Agent"] ?? "";
    expect(ua).toMatch(/Mozilla\/5\.0.*AppleWebKit.*Chrome\/\d+/);
    expect(ua).not.toMatch(/KoruAgent|KoruLocal/i);
  });

  it("pide contenido en español con Accept-Language", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      capturedUrl = String(url);
      capturedHeaders = { ...(init?.headers ?? {}) };
      return new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
    }));
    await searchDuckDuckGo("review airpods pro");
    expect(capturedHeaders["Accept-Language"]).toContain("es");
  });

  it("parsea los resultados reales (títulos, URLs decodificadas de uddg, snippets)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } })));
    const sources = await searchDuckDuckGo("review airpods pro");
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0].url).toBe("https://www.soundguys.com/apple-airpods-pro-3-review/");
    expect(sources[0].title).toContain("Apple AirPods Pro 3 review");
    expect(sources[0].snippet).toContain("noise cancellation");
    expect(sources.some((s) => s.domain === "tomsguide.com")).toBe(true);
  });
});

/** 🔴 Cadena de respaldo: html → lite. La página "anomaly" de DDG (HTTP 202
 * sin result__a) es lo que recibe el server desde IPs de datacenter cuando
 * DDG las flaggea — en ese caso DEBE reintentar por lite.duckduckgo.com. */
describe("searchDuckDuckGo: fallback a lite.duckduckgo.com", () => {
  it("cuando el endpoint HTML devuelve la página anti-bot (0 resultados), reintenta por lite y devuelve SUS resultados", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("lite.duckduckgo.com")) {
        return new Response(FIXTURE_LITE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      // html.duckduckgo.com → página anomaly (sin resultados parseables)
      return new Response(ANOMALY_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
    }));
    const sources = await searchDuckDuckGo("review airpods pro");
    expect(calls.some((c) => c.includes("html.duckduckgo.com"))).toBe(true);
    expect(calls.some((c) => c.includes("lite.duckduckgo.com"))).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0].url).toContain("soundguys.com");
    expect(sources[0].title).toContain("AirPods Pro 3 review");
  });

  it("cuando html funciona, NO llama a lite (cero latencia extra en el caso feliz)", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
    }));
    const sources = await searchDuckDuckGo("review airpods pro");
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(calls.filter((c) => c.includes("lite.duckduckgo.com"))).toHaveLength(0);
  });
});
