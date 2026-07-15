/**
 * Koru PDF export — generates real PDF files from chat sessions or individual
 * deliverables. Uses Puppeteer (headless Chromium) for true server-side PDF
 * generation that produces a downloadable .pdf file (not an HTML print view).
 *
 * Strategy:
 * - buildPdfHtml() renders the content as styled HTML with Koru branding.
 * - renderPdf(html) launches headless Chromium, prints to PDF, returns Buffer.
 * - Endpoint /api/koru/export-pdf streams the PDF binary as application/pdf.
 * - Endpoint /api/koru/export-deliverable exports a single block (plan, recipe,
 *   comparison, etc.) instead of the whole chat.
 *
 * Browser reuse: a single browser instance is launched lazily and reused
 * across requests to avoid the ~500ms launch cost on every PDF.
 */

const puppeteer = require("puppeteer");

let browserPromise: Promise<any> | null = null;

async function getBrowser(): Promise<any> {
  if (!browserPromise) {
    const p = puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // critical in containers with small /dev/shm
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });
    browserPromise = p;
    // If launch fails, reset so next call retries.
    p.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

export type PdfTurn = {
  role: "user" | "koru";
  text: string;
  createdAt?: string;
  items?: Array<{
    type?: string;
    title?: string;
    subtitle?: string;
    note?: string;
    items?: Array<{ time?: string; title?: string; priority?: string; durationMinutes?: number; icon?: string }>;
    sources?: Array<{ title?: string; url?: string }>;
    summaryItems?: Array<{ label?: string; value?: string }>;
    // Weather-specific
    now?: string;
    range?: string;
    rain?: string;
    advice?: string;
    // Match-specific
    homeTeam?: string;
    awayTeam?: string;
    homeScore?: number;
    awayScore?: number;
    status?: string;
    timeline?: Array<{ minute?: string; event?: string; team?: string }>;
    // Comparison
    items2?: Array<{ name?: string; price?: string; rating?: number; pros?: string[]; cons?: string[]; url?: string }>;
    // Crypto
    price?: number;
    change24h?: number;
    sparkline?: number[];
  }>;
};

export type PdfExportRequest = {
  title: string;
  userName?: string;
  language?: "es" | "en";
  turns: PdfTurn[];
  generatedAt?: string;
  /** If true, render only the items (deliverable view) without surrounding chat */
  deliverableOnly?: boolean;
  /** Block type when exporting a single deliverable */
  blockType?: string;
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

/**
 * Render a single UiBlock item with type-specific visual treatment.
 * Each type gets its own card style to match the chat experience.
 */
function renderItem(item: NonNullable<PdfTurn["items"]>[number]): string {
  const type = item.type || "generic";
  const titleHtml = item.title ? `<div class="card-title">${esc(item.title)}</div>` : "";
  const subtitleHtml = item.subtitle ? `<div class="card-subtitle">${esc(item.subtitle)}</div>` : "";
  const noteHtml = item.note ? `<div class="card-note">${esc(item.note)}</div>` : "";

  // Type-specific accent color (matches Koru brand palette)
  const accentByType: Record<string, string> = {
    weather: "#3b82f6",
    plan: "#2d6a4f",
    comparison: "#8b5cf6",
    crypto_portfolio: "#f59e0b",
    live_match: "#ef4444",
    match_timeline: "#ef4444",
    recipe: "#ec4899",
    movie_info: "#6366f1",
    book_info: "#0ea5e9",
    research_sources: "#14b8a6",
    shopping_list: "#84cc16",
    smart_checklist: "#14b8a6",
    forex: "#a855f7",
    route_timeline: "#06b6d4",
  };
  const accent = accentByType[type] || "#5a6b62";

  let bodyHtml = "";

  // Plan items
  if (Array.isArray(item.items) && item.items.length > 0 && (type === "plan" || type === "smart_checklist")) {
    bodyHtml += `<ul class="plan-list">`;
    for (const li of item.items) {
      const time = li.time ? `<span class="li-time">${esc(li.time)}</span>` : "";
      const priority = li.priority ? `<span class="li-prio priority-${esc(li.priority.toLowerCase())}">${esc(li.priority)}</span>` : "";
      const duration = li.durationMinutes ? `<span class="li-dur">${esc(li.durationMinutes)} min</span>` : "";
      bodyHtml += `<li>${time}<span class="li-title">${esc(li.title ?? "")}</span>${priority}${duration}</li>`;
    }
    bodyHtml += `</ul>`;
  }

  // Summary items (weather, forex)
  if (Array.isArray(item.summaryItems) && item.summaryItems.length > 0) {
    bodyHtml += `<div class="summary-grid">`;
    for (const si of item.summaryItems) {
      bodyHtml += `<div class="summary-cell"><div class="summary-label">${esc(si.label ?? "")}</div><div class="summary-value">${esc(si.value ?? "")}</div></div>`;
    }
    bodyHtml += `</div>`;
  }

  // Match (live_match / match_timeline)
  if (type === "live_match" && (item.homeTeam || item.awayTeam)) {
    const home = esc(item.homeTeam || "Local");
    const away = esc(item.awayTeam || "Visitante");
    const hs = item.homeScore != null ? esc(item.homeScore) : "-";
    const as = item.awayScore != null ? esc(item.awayScore) : "-";
    const status = item.status ? `<div class="match-status">${esc(item.status)}</div>` : "";
    bodyHtml += `
      <div class="match-scoreboard">
        <div class="match-team">${home}</div>
        <div class="match-score">${hs} <span class="match-vs">-</span> ${as}</div>
        <div class="match-team">${away}</div>
      </div>
      ${status}
    `;
    if (Array.isArray(item.timeline) && item.timeline.length > 0) {
      bodyHtml += `<ul class="match-timeline">`;
      for (const ev of item.timeline) {
        bodyHtml += `<li><span class="ev-minute">${esc(ev.minute || "")}</span> ${esc(ev.event || "")}</li>`;
      }
      bodyHtml += `</ul>`;
    }
  }

  // Comparison
  if (type === "comparison" && Array.isArray(item.items2) && item.items2.length > 0) {
    bodyHtml += `<table class="comparison-table"><thead><tr><th>Producto</th><th>Precio</th><th>Rating</th></tr></thead><tbody>`;
    for (const p of item.items2) {
      const stars = p.rating ? "★".repeat(Math.round(p.rating)) + "☆".repeat(5 - Math.round(p.rating)) : "";
      bodyHtml += `<tr><td>${esc(p.name || "")}</td><td>${esc(p.price || "-")}</td><td class="stars">${stars}</td></tr>`;
      if (p.pros?.length || p.cons?.length) {
        bodyHtml += `<tr class="pros-cons"><td colspan="3">`;
        if (p.pros?.length) bodyHtml += `<div class="pros">✓ ${p.pros.map(esc).join(" · ")}</div>`;
        if (p.cons?.length) bodyHtml += `<div class="cons">✗ ${p.cons.map(esc).join(" · ")}</div>`;
        bodyHtml += `</td></tr>`;
      }
    }
    bodyHtml += `</tbody></table>`;
  }

  // Crypto sparkline (SVG)
  if (type === "crypto_portfolio" && Array.isArray(item.sparkline) && item.sparkline.length > 1) {
    const w = 200, h = 40;
    const max = Math.max(...item.sparkline);
    const min = Math.min(...item.sparkline);
    const range = max - min || 1;
    const points = item.sparkline.map((v, i) => {
      const x = (i / (item.sparkline!.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const changeColor = (item.change24h ?? 0) >= 0 ? "#10b981" : "#ef4444";
    bodyHtml += `
      <div class="crypto-card">
        ${item.price != null ? `<div class="crypto-price" style="color: ${changeColor}">$${esc(item.price.toLocaleString())}</div>` : ""}
        ${item.change24h != null ? `<div class="crypto-change" style="color: ${changeColor}">${item.change24h >= 0 ? "+" : ""}${esc(item.change24h)}%</div>` : ""}
        <svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
          <polyline points="${points}" fill="none" stroke="${changeColor}" stroke-width="1.5" />
        </svg>
      </div>
    `;
  }

  // Sources
  if (Array.isArray(item.sources) && item.sources.length > 0) {
    bodyHtml += `<div class="card-sources"><strong>Fuentes:</strong><ul>`;
    for (const s of item.sources) {
      bodyHtml += `<li>${esc(s.title || s.url || "")}${s.url ? ` — <a href="${esc(s.url)}">${esc(s.url)}</a>` : ""}</li>`;
    }
    bodyHtml += `</ul></div>`;
  }

  // Type badge
  const typeLabel: Record<string, string> = {
    weather: "Clima",
    plan: "Plan",
    comparison: "Comparativa",
    crypto_portfolio: "Crypto",
    live_match: "Partido",
    match_timeline: "Fixture",
    recipe: "Receta",
    movie_info: "Película",
    book_info: "Libro",
    research_sources: "Búsqueda",
    shopping_list: "Lista",
    smart_checklist: "Checklist",
    forex: "Divisas",
    route_timeline: "Ruta",
  };
  const badge = typeLabel[type] ? `<span class="type-badge" style="background: ${accent}">${typeLabel[type]}</span>` : "";

  return `
    <div class="deliverable-card" style="border-left-color: ${accent}">
      <div class="card-header">${badge}${titleHtml}</div>
      ${subtitleHtml}
      ${noteHtml}
      <div class="card-body">${bodyHtml}</div>
    </div>
  `;
}

function renderTurn(turn: PdfTurn): string {
  const role = turn.role === "user" ? "user" : "koru";
  const roleLabel = turn.role === "user" ? "Tú" : "Koru";
  const time = formatTime(turn.createdAt);
  const timeHtml = time ? `<span class="turn-time">${time}</span>` : "";
  const avatarHtml = turn.role === "koru"
    ? `<div class="turn-avatar koru-avatar">🌿</div>`
    : `<div class="turn-avatar user-avatar">👤</div>`;
  const itemsHtml = Array.isArray(turn.items) && turn.items.length > 0
    ? `<div class="turn-items">${turn.items.map(renderItem).join("")}</div>`
    : "";
  return `
    <div class="turn turn-${role}">
      ${avatarHtml}
      <div class="turn-content">
        <div class="turn-header">
          <span class="turn-role">${roleLabel}</span>
          ${timeHtml}
        </div>
        <div class="turn-text">${esc(turn.text)}</div>
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Build the styled HTML document that will be printed to PDF.
 * Includes Koru branding (forest/cream palette, mascot emoji, header bar).
 */
export function buildPdfHtml(req: PdfExportRequest): string {
  const title = req.title || "Conversación con Koru";
  const userName = req.userName || "";
  const generatedAt = req.generatedAt || new Date().toISOString();
  const turnsHtml = (req.turns || []).map(renderTurn).join("");

  // Deliverable-only mode: render just the cards, no chat turns
  const bodyContent = req.deliverableOnly
    ? `<div class="deliverables-only">${(req.turns || []).flatMap(t => t.items || []).map(renderItem).join("")}</div>`
    : turnsHtml;

  return `<!doctype html>
<html lang="${esc(req.language || "es")}">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page {
      margin: 22mm 18mm 26mm 18mm;
      @bottom-center {
        content: "Koru · Página " counter(page) " de " counter(pages);
        font-size: 9px;
        color: #8a9990;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.55;
      margin: 0;
      padding: 0;
    }
    .brand-header {
      background: linear-gradient(135deg, #2d6a4f 0%, #1a4d33 100%);
      color: #fafaf5;
      padding: 18px 24px;
      border-radius: 0 0 12px 12px;
      margin: -22mm -18mm 16mm -18mm;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      font-size: 28px;
      line-height: 1;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .brand-tagline {
      font-size: 11px;
      opacity: 0.8;
      margin-top: 2px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 4px;
      color: #0f1a14;
      font-weight: 700;
    }
    .meta {
      color: #5a6b62;
      font-size: 11px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e3e8e5;
    }
    /* Turn styles */
    .turn {
      display: flex;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      border: 1px solid #e3e8e5;
    }
    .turn-user { background: #f3f7f4; }
    .turn-koru { background: #fafaf5; border-color: #d9e0d6; }
    .turn-avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .koru-avatar { background: #2d6a4f; }
    .user-avatar { background: #523A9E; }
    .turn-content { flex: 1; min-width: 0; }
    .turn-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 4px;
    }
    .turn-role { font-weight: 600; font-size: 12px; color: #2d4a3a; }
    .turn-time { font-size: 10px; color: #8a9990; }
    .turn-text {
      font-size: 13px;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #1a2a20;
    }
    .turn-items {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #d9e0d6;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* Deliverable card */
    .deliverable-card {
      background: #ffffff;
      border: 1px solid #e3e8e5;
      border-left: 4px solid #5a6b62;
      border-radius: 10px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .type-badge {
      color: white;
      font-size: 9px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .card-title { font-weight: 700; font-size: 14px; color: #1a2a20; }
    .card-subtitle { font-size: 11px; color: #5a6b62; margin-bottom: 4px; }
    .card-note { font-size: 11px; color: #5a6b62; font-style: italic; margin-bottom: 8px; }
    .card-body { font-size: 12px; }
    /* Plan list */
    .plan-list { padding-left: 16px; margin: 6px 0; list-style: none; }
    .plan-list li {
      margin-bottom: 6px;
      padding: 4px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .li-time { font-weight: 700; color: #2d6a4f; min-width: 50px; font-size: 12px; }
    .li-title { color: #1a2a20; flex: 1; min-width: 0; }
    .li-prio {
      font-size: 9px; padding: 1px 6px; border-radius: 4px;
      color: white; font-weight: 600;
    }
    .priority-alta { background: #ef4444; }
    .priority-media { background: #f59e0b; }
    .priority-baja { background: #10b981; }
    .li-dur { font-size: 10px; color: #8a9990; }
    /* Summary grid (weather/forex) */
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 8px 0; }
    .summary-cell { background: #f3f7f4; border-radius: 8px; padding: 8px 10px; }
    .summary-label { font-size: 10px; color: #5a6b62; text-transform: uppercase; letter-spacing: 0.4px; }
    .summary-value { font-size: 16px; font-weight: 700; color: #1a2a20; margin-top: 2px; }
    /* Match scoreboard */
    .match-scoreboard {
      display: flex; justify-content: space-around; align-items: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white; border-radius: 10px; padding: 14px; margin: 8px 0;
    }
    .match-team { font-size: 14px; font-weight: 600; flex: 1; text-align: center; }
    .match-score { font-size: 24px; font-weight: 800; flex: 0 0 auto; padding: 0 12px; }
    .match-vs { color: #8a9990; margin: 0 4px; font-size: 16px; }
    .match-status { text-align: center; font-size: 10px; color: #ef4444; font-weight: 600; margin-top: 4px; }
    .match-timeline { padding-left: 16px; font-size: 11px; }
    .match-timeline li { margin-bottom: 2px; }
    .ev-minute { font-weight: 700; color: #2d6a4f; }
    /* Comparison table */
    .comparison-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
    .comparison-table th { background: #2d6a4f; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    .comparison-table td { padding: 6px 8px; border-bottom: 1px solid #e3e8e5; }
    .comparison-table .stars { color: #f59e0b; letter-spacing: 1px; }
    .pros-cons td { background: #fafaf5; font-size: 10px; }
    .pros { color: #10b981; margin-bottom: 2px; }
    .cons { color: #ef4444; }
    /* Crypto */
    .crypto-card { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .crypto-price { font-size: 22px; font-weight: 800; }
    .crypto-change { font-size: 14px; font-weight: 600; }
    .sparkline { display: inline-block; vertical-align: middle; }
    /* Sources */
    .card-sources { font-size: 10px; color: #5a6b62; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e3e8e5; }
    .card-sources ul { padding-left: 14px; margin: 4px 0; }
    .card-sources a { color: #2d6a4f; word-break: break-all; }
    /* Deliverable-only mode */
    .deliverables-only { display: flex; flex-direction: column; gap: 12px; }
    /* Footer */
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e3e8e5;
      font-size: 9px;
      color: #8a9990;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="brand-header">
    <div class="brand-logo">🌿</div>
    <div>
      <div class="brand-name">Koru</div>
      <div class="brand-tagline">Tu asistente personal</div>
    </div>
  </div>
  <h1>${esc(title)}</h1>
  <div class="meta">
    ${userName ? `Conversación entre <strong>${esc(userName)}</strong> y Koru. ` : ""}Generado el ${esc(formatTime(generatedAt))}.
  </div>
  ${bodyContent}
  <div class="footer">
    Generado por Koru — koru-mvp.onrender.com · Documento confidencial
  </div>
</body>
</html>`;
}

/**
 * Render HTML to PDF using headless Chromium. Returns a Buffer of PDF bytes.
 * Reuses a single browser instance across calls for performance.
 */
export async function renderPdf(html: string, opts: { format?: "A4" | "Letter" } = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    const pdfBuffer = await page.pdf({
      format: opts.format || "A4",
      printBackground: true,
      margin: { top: "22mm", right: "18mm", bottom: "26mm", left: "18mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="font-size: 9px; color: #8a9990; width: 100%; text-align: center; padding: 0 18mm;">
          Koru · Página <span class="pageNumber"></span> de <span class="totalPages"></span>
        </div>
      `,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

/**
 * Close the shared browser instance (useful for graceful shutdown in tests).
 */
export async function closePdfBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
