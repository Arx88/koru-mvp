import { describe, it, expect } from "vitest";
import { buildPdfHtml, type PdfExportRequest } from "./pdfExport";

const sampleTurns: PdfExportRequest = {
  title: "Conversación de prueba",
  userName: "Alex",
  language: "es",
  turns: [
    {
      role: "user",
      text: "Hola Koru, ¿qué tal?",
      createdAt: new Date("2026-07-15T10:00:00Z").toISOString(),
    },
    {
      role: "koru",
      text: "¡Hola Alex! Todo bien por aquí. ¿En qué te puedo ayudar?",
      createdAt: new Date("2026-07-15T10:00:05Z").toISOString(),
      items: [
        {
          type: "weather",
          title: "Clima en Madrid",
          subtitle: "24°C, soleado",
          summaryItems: [
            { label: "Temp", value: "24°C" },
            { label: "Humedad", value: "45%" },
          ],
        },
      ],
    },
  ],
};

describe("pdfExport module", () => {
  describe("buildPdfHtml()", () => {
    it("produces a non-empty HTML string", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html.length).toBeGreaterThan(500);
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("</html>");
    });

    it("includes the title in <title> and <h1>", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("<title>Conversación de prueba</title>");
      expect(html).toContain("<h1>Conversación de prueba</h1>");
    });

    it("escapes HTML special characters in user text (XSS protection)", () => {
      const html = buildPdfHtml({
        title: "Test",
        turns: [
          { role: "user", text: "<script>alert('xss')</script>", createdAt: new Date().toISOString() },
        ],
      });
      expect(html).not.toContain("<script>alert('xss')</script>");
      expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    });

    it("escapes HTML in item titles too", () => {
      const html = buildPdfHtml({
        title: "Test",
        turns: [
          {
            role: "koru",
            text: "ok",
            createdAt: new Date().toISOString(),
            items: [{ title: "<b>bold</b> & dangerous" }],
          },
        ],
      });
      expect(html).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; dangerous");
    });

    it("includes turn text content", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("Hola Koru, ¿qué tal?");
      expect(html).toContain("¡Hola Alex! Todo bien por aquí");
    });

    it("includes item content (weather card)", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("Clima en Madrid");
      expect(html).toContain("24°C, soleado");
    });

    it("renders summary grid when summaryItems is present", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain('class="summary-grid"');
      expect(html).toContain('class="summary-cell"');
      expect(html).toContain("Temp");
      expect(html).toContain("Humedad");
    });

    it("includes the user's name in the meta line", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("Alex");
      expect(html).toContain("Conversación entre");
      expect(html).toContain("y Koru");
    });

    it("handles empty turns array gracefully", () => {
      const html = buildPdfHtml({
        title: "Empty",
        turns: [],
      });
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("<h1>Empty</h1>");
    });

    it("handles missing optional fields gracefully", () => {
      const html = buildPdfHtml({
        title: "Min",
        turns: [
          { role: "user", text: "hi" },
          { role: "koru", text: "hello" },
        ],
      });
      expect(html.length).toBeGreaterThan(200);
      expect(html).toContain("hi");
      expect(html).toContain("hello");
    });

    it("includes the brand header (Koru logo + name)", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain('class="brand-header"');
      expect(html).toContain('class="brand-logo"');
      expect(html).toContain("🌿");
      expect(html).toContain('class="brand-name"');
      expect(html).toContain("Koru");
    });

    it("includes the @page rule with footer page numbers", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("@page");
      expect(html).toContain("counter(page)");
    });

    it("renders item list (plan items) when items[].items is present", () => {
      const html = buildPdfHtml({
        title: "Plan",
        turns: [
          {
            role: "koru",
            text: "Acá tenés tu plan",
            createdAt: new Date().toISOString(),
            items: [
              {
                type: "plan",
                title: "Plan de hoy",
                items: [
                  { time: "08:00", title: "Lanzar producto", priority: "Alta", durationMinutes: 30 },
                  { time: "10:00", title: "Reunión con socio", priority: "Media", durationMinutes: 45 },
                ],
              },
            ],
          },
        ],
      });
      expect(html).toContain('class="plan-list"');
      expect(html).toContain("Lanzar producto");
      expect(html).toContain("08:00");
      expect(html).toContain('class="li-prio priority-alta"');
      expect(html).toContain("30 min");
    });

    it("renders sources section when sources[] is present", () => {
      const html = buildPdfHtml({
        title: "Sources",
        turns: [
          {
            role: "koru",
            text: "Acá lo que encontré",
            createdAt: new Date().toISOString(),
            items: [
              {
                type: "research_sources",
                title: "Resultados de búsqueda",
                sources: [
                  { title: "Wikipedia", url: "https://es.wikipedia.org/wiki/Koru" },
                ],
              },
            ],
          },
        ],
      });
      expect(html).toContain('class="card-sources"');
      expect(html).toContain("Wikipedia");
      expect(html).toContain("https://es.wikipedia.org/wiki/Koru");
    });

    it("respects language attribute on <html>", () => {
      const htmlEs = buildPdfHtml({ ...sampleTurns, language: "es" });
      const htmlEn = buildPdfHtml({ ...sampleTurns, language: "en" });
      expect(htmlEs).toContain('<html lang="es">');
      expect(htmlEn).toContain('<html lang="en">');
    });

    // 🔴 New tests for v2 (branding + card rendering)

    it("renders match scoreboard for live_match items", () => {
      const html = buildPdfHtml({
        title: "Partido",
        turns: [
          {
            role: "koru",
            text: "España le ganó 2-1",
            createdAt: new Date().toISOString(),
            items: [{
              type: "live_match",
              title: "España vs Francia",
              homeTeam: "España",
              awayTeam: "Francia",
              homeScore: 2,
              awayScore: 1,
              status: "Finalizado",
              timeline: [{ minute: "23'", event: "Gol de Yamal", team: "España" }],
            }],
          },
        ],
      });
      expect(html).toContain('class="match-scoreboard"');
      expect(html).toContain('class="match-score"');
      expect(html).toContain("España");
      expect(html).toContain("Francia");
      expect(html).toContain("Finalizado");
    });

    it("renders comparison table with stars and pros/cons", () => {
      const html = buildPdfHtml({
        title: "Comparativa",
        turns: [{
          role: "koru",
          text: "Te comparé los dos",
          createdAt: new Date().toISOString(),
          items: [{
            type: "comparison",
            title: "Auriculares",
            items2: [
              { name: "Sony WH-1000", price: "$350", rating: 5, pros: ["Buen sonido"], cons: ["Caro"] },
            ],
          }],
        }],
      });
      expect(html).toContain('class="comparison-table"');
      expect(html).toContain("Sony WH-1000");
      expect(html).toContain("$350");
      expect(html).toContain("★"); // star rating
      expect(html).toContain('class="pros"');
      expect(html).toContain('class="cons"');
    });

    it("renders crypto sparkline SVG when sparkline data is present", () => {
      const html = buildPdfHtml({
        title: "BTC",
        turns: [{
          role: "koru",
          text: "BTC subió",
          createdAt: new Date().toISOString(),
          items: [{
            type: "crypto_portfolio",
            title: "Bitcoin",
            price: 65000,
            change24h: 3.5,
            sparkline: [60, 62, 61, 64, 65],
          }],
        }],
      });
      expect(html).toContain('class="crypto-card"');
      expect(html).toContain("<svg");
      expect(html).toContain("<polyline");
      expect(html).toContain("65,000");
    });

    it("renders type badge with correct color per type", () => {
      const html = buildPdfHtml({
        title: "Test",
        turns: [{
          role: "koru",
          text: "ok",
          createdAt: new Date().toISOString(),
          items: [{ type: "weather", title: "Clima" }],
        }],
      });
      expect(html).toContain('class="type-badge"');
      expect(html).toContain("Clima"); // badge label for weather
    });

    it("uses accent color from type in border-left", () => {
      const html = buildPdfHtml({
        title: "Test",
        turns: [{
          role: "koru",
          text: "ok",
          createdAt: new Date().toISOString(),
          items: [{ type: "plan", title: "Mi plan" }],
        }],
      });
      // Plan accent is #2d6a4f
      expect(html).toContain("#2d6a4f");
    });

    it("deliverableOnly mode renders only the cards, no chat turns", () => {
      const html = buildPdfHtml({
        ...sampleTurns,
        deliverableOnly: true,
      });
      expect(html).toContain('class="deliverables-only"');
      // Should NOT contain the turn wrapper
      expect(html).not.toContain('class="turn turn-user"');
      // But SHOULD contain the deliverable card content
      expect(html).toContain('class="deliverable-card"');
      expect(html).toContain("Clima en Madrid");
    });

    it("includes footer with Koru branding", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain('class="footer"');
      expect(html).toContain("Generado por Koru");
      expect(html).toContain("koru-mvp.onrender.com");
    });

    it("includes auto-print script (window.print on load)", () => {
      // v2 keeps the HTML-to-PDF browser-fallback approach: the HTML auto-opens
      // the print dialog on load so the user can save as PDF in 1 click.
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("window.print()");
      expect(html).toContain("print-bar");
    });
  });
});
