/**
 * Koru PDF export — generates a printable PDF from a chat session or
 * individual deliverable. Pure server-side, no external deps.
 *
 * Strategy:
 * - Build a clean HTML document with the conversation/deliverable content.
 * - Set response Content-Type to text/html with `print` media query hooks.
 * - The browser's native "Save as PDF" (Ctrl/Cmd+P) handles the actual PDF.
 *
 * Why HTML-to-PDF instead of a PDF library:
 * - The chat contains uiBlocks with rich layouts (cards, tables, lists) that
 *   would take significant code to render with a low-level PDF library.
 * - HTML+CSS lets us reuse styles we already have.
 * - Modern browsers produce excellent PDFs via the print dialog.
 * - No new dependency to install/maintain.
 *
 * If a future requirement asks for true server-side PDF generation, we can
 * swap this implementation for `pdfkit` / `puppeteer` without changing the
 * endpoint contract.
 */

export type PdfTurn = {
  role: "user" | "koru";
  text: string;
  createdAt?: string;
  items?: Array<{
    type?: string;
    title?: string;
    subtitle?: string;
    note?: string;
    items?: Array<{ time?: string; title?: string; priority?: string; durationMinutes?: number }>;
    sources?: Array<{ title?: string; url?: string }>;
    summaryItems?: Array<{ label?: string; value?: string }>;
  }>;
};

export type PdfExportRequest = {
  title: string;
  userName?: string;
  language?: "es" | "en";
  turns: PdfTurn[];
  generatedAt?: string;
};

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function renderItem(item: NonNullable<PdfTurn["items"]>[number]): string {
  const parts: string[] = [];
  if (item.title) parts.push(`<div class="item-title">${esc(item.title)}</div>`);
  if (item.subtitle) parts.push(`<div class="item-subtitle">${esc(item.subtitle)}</div>`);
  if (item.note) parts.push(`<div class="item-note">${esc(item.note)}</div>`);

  if (Array.isArray(item.items) && item.items.length > 0) {
    parts.push("<ul class=\"item-list\">");
    for (const li of item.items) {
      const time = li.time ? `<span class="li-time">${esc(li.time)}</span>` : "";
      const priority = li.priority ? `<span class="li-prio">${esc(li.priority)}</span>` : "";
      const duration = li.durationMinutes ? `<span class="li-dur">${esc(li.durationMinutes)} min</span>` : "";
      parts.push(`<li>${time}<span class="li-title">${esc(li.title ?? "")}</span>${priority}${duration}</li>`);
    }
    parts.push("</ul>");
  }

  if (Array.isArray(item.summaryItems) && item.summaryItems.length > 0) {
    parts.push("<table class=\"item-table\">");
    for (const si of item.summaryItems) {
      parts.push(`<tr><td>${esc(si.label ?? "")}</td><td>${esc(si.value ?? "")}</td></tr>`);
    }
    parts.push("</table>");
  }

  if (Array.isArray(item.sources) && item.sources.length > 0) {
    parts.push("<div class=\"item-sources\"><strong>Fuentes:</strong><ul>");
    for (const s of item.sources) {
      parts.push(`<li>${esc(s.title || s.url || "")}${s.url ? ` — <a href="${esc(s.url)}">${esc(s.url)}</a>` : ""}</li>`);
    }
    parts.push("</ul></div>");
  }

  return parts.join("");
}

function renderTurn(turn: PdfTurn): string {
  const role = turn.role === "user" ? "user" : "koru";
  const roleLabel = turn.role === "user" ? "Tú" : "Koru";
  const time = formatTime(turn.createdAt);
  const timeHtml = time ? `<span class="turn-time">${time}</span>` : "";
  const itemsHtml = Array.isArray(turn.items) && turn.items.length > 0
    ? `<div class="turn-items">${turn.items.map(renderItem).join("")}</div>`
    : "";
  return `
    <div class="turn turn-${role}">
      <div class="turn-header">
        <span class="turn-role">${roleLabel}</span>
        ${timeHtml}
      </div>
      <div class="turn-text">${esc(turn.text)}</div>
      ${itemsHtml}
    </div>
  `;
}

export function buildPdfHtml(req: PdfExportRequest): string {
  const title = req.title || "Conversación con Koru";
  const userName = req.userName || "";
  const generatedAt = req.generatedAt || new Date().toISOString();
  const turnsHtml = (req.turns || []).map(renderTurn).join("");

  return `<!doctype html>
<html lang="${esc(req.language || "es")}">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.55;
      margin: 0;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 22px; margin: 0 0 4px; color: #0f1a14; }
    .meta { color: #5a6b62; font-size: 12px; margin-bottom: 24px; }
    .turn {
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      border: 1px solid #e3e8e5;
    }
    .turn-user { background: #f3f7f4; }
    .turn-koru { background: #fafaf5; border-color: #d9e0d6; }
    .turn-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .turn-role { font-weight: 600; font-size: 13px; color: #2d4a3a; }
    .turn-time { font-size: 11px; color: #8a9990; }
    .turn-text { font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
    .turn-items { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d9e0d6; }
    .item-title { font-weight: 600; font-size: 14px; color: #1a2a20; margin-bottom: 4px; }
    .item-subtitle { font-size: 12px; color: #5a6b62; margin-bottom: 4px; }
    .item-note { font-size: 12px; color: #5a6b62; font-style: italic; margin-bottom: 6px; }
    .item-list { padding-left: 18px; margin: 6px 0; }
    .item-list li { margin-bottom: 4px; font-size: 13px; }
    .li-time { font-weight: 600; color: #2d4a3a; margin-right: 8px; }
    .li-title { color: #1a2a20; }
    .li-prio { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: #eef2ef; color: #2d4a3a; margin-left: 8px; }
    .li-dur { font-size: 11px; color: #8a9990; margin-left: 8px; }
    .item-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; }
    .item-table td { padding: 4px 8px; border: 1px solid #e3e8e5; }
    .item-table td:first-child { background: #f3f7f4; font-weight: 500; }
    .item-sources { font-size: 11px; color: #5a6b62; margin-top: 8px; }
    .item-sources ul { padding-left: 16px; margin: 4px 0; }
    .item-sources a { color: #2d6a4f; word-break: break-all; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e3e8e5; font-size: 10px; color: #8a9990; text-align: center; }
    @media print {
      body { padding: 0; max-width: none; }
      .no-print { display: none !important; }
    }
    .print-bar {
      position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e3e8e5;
      padding: 10px 0; margin-bottom: 16px; display: flex; gap: 10px; align-items: center;
    }
    .print-bar button {
      background: #2d6a4f; color: white; border: none; padding: 8px 16px;
      border-radius: 8px; font-size: 13px; cursor: pointer;
    }
    .print-bar button.secondary { background: #eef2ef; color: #2d4a3a; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <button onclick="window.print()">Guardar como PDF / Imprimir</button>
    <button class="secondary" onclick="window.close()">Cerrar</button>
  </div>
  <h1>${esc(title)}</h1>
  <div class="meta">
    ${userName ? `Conversación entre ${esc(userName)} y Koru. ` : ""}Generado el ${esc(formatTime(generatedAt))}.
  </div>
  ${turnsHtml}
  <div class="footer">
    Generado por Koru — tu asistente personal.
  </div>
  <script>
    // Auto-open print dialog on load
    window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });
  </script>
</body>
</html>`;
}
