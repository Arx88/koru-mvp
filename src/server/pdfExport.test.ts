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

    it("renders items table when summaryItems is present", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain('class="item-table"');
      expect(html).toContain("Temp");
      expect(html).toContain("Humedad");
    });

    it("includes the user's name in the meta line", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("Alex");
      expect(html).toContain("Conversación entre Alex y Koru");
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

    it("includes the print stylesheet (auto-opens print dialog)", () => {
      const html = buildPdfHtml(sampleTurns);
      expect(html).toContain("window.print()");
      expect(html).toContain("@media print");
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
      expect(html).toContain('class="item-list"');
      expect(html).toContain("Lanzar producto");
      expect(html).toContain("08:00");
      expect(html).toContain("Alta");
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
      expect(html).toContain('class="item-sources"');
      expect(html).toContain("Wikipedia");
      expect(html).toContain("https://es.wikipedia.org/wiki/Koru");
    });

    it("respects language attribute on <html>", () => {
      const htmlEs = buildPdfHtml({ ...sampleTurns, language: "es" });
      const htmlEn = buildPdfHtml({ ...sampleTurns, language: "en" });
      expect(htmlEs).toContain('<html lang="es">');
      expect(htmlEn).toContain('<html lang="en">');
    });
  });
});
