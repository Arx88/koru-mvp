/**
 * Bloque Docs — Generación de documentos, OCR, análisis de datos.
 * Sub-grupo de "Docs/Productividad".
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import type { LifeRecord, AssistantArtifact } from "../../domain/types";

// ─── doc_create_md ───────────────────────────────────────────────────────────
export const docCreateMd: ToolHandler = {
  definition: defineTool(
    "doc_create_md",
    "Genera un documento Markdown (.md) con estructura: encabezados, listas, código, tablas. Úsala cuando el usuario diga 'hacé un doc con la minuta', 'escribí un README', 'documentá esta idea'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Contenido o instrucciones de qué debe llevar el doc." },
      },
      required: ["title", "content"],
    },
  ),
  policy: policies.localWrite("Genera documento local."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!title || !content) return { type: "doc_create_md", status: "failed", error: "Indicá título y contenido." };
    const body = `# ${title}\n\n_Generado por Koru el ${new Date().toISOString().slice(0, 10)}._\n\n${content}\n`;
    const artifact: AssistantArtifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "documento"}.md`,
      kind: "markdown",
      mimeType: "text/markdown",
      sizeLabel: `${body.length} caracteres`,
      content: body,
    };
    return {
      type: "doc_create_md",
      status: "ok",
      title,
      artifact,
      block: { type: "resource_bundle", title, files: [artifact] },
    };
  },
};

// ─── doc_create_pdf ─────────────────────────────────────────────────────────
// Sin lib PDF pesada en runtime: delegamos al navegador (print to PDF) cuando
// hay UI; aquí generamos un HTML listo para imprimir y un .txt fallback.
export const docCreatePdf: ToolHandler = {
  definition: defineTool(
    "doc_create_pdf",
    "Genera un PDF con formato (encabezados, párrafos, tablas). Úsala cuando el usuario diga 'pasá eso a PDF', 'hacé un informe en PDF del viaje', 'documento PDF con estos apuntes'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title", "content"],
    },
  ),
  policy: policies.localWrite("Genera documento HTML listo para imprimir/PDF."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!title || !content) return { type: "doc_create_pdf", status: "failed", error: "Indicá título y contenido." };
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}h1{border-bottom:2px solid #444;padding-bottom:8px}</style>
</head><body><h1>${title}</h1><p><em>Generado por Koru el ${new Date().toISOString().slice(0, 10)}.</em></p>${content.split(/\n+/).map((p) => `<p>${p}</p>`).join("\n")}</body></html>`;
    const artifact: AssistantArtifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "documento"}.html`,
      kind: "document",
      mimeType: "text/html",
      sizeLabel: `${html.length} caracteres (imprimir como PDF)`,
      content: html,
    };
    return {
      type: "doc_create_pdf",
      status: "ok",
      title,
      artifact,
      note: "Se generó HTML listo para imprimir como PDF. Ábrelo y usa Ctrl+P → Guardar como PDF.",
      block: { type: "resource_bundle", title, files: [artifact] },
    };
  },
};

// ─── doc_create_word ────────────────────────────────────────────────────────
// .docx real requiere lib pesada. Generamos .doc (HTML con mime Word) que
// MS Word abre sin problemas.
export const docCreateWord: ToolHandler = {
  definition: defineTool(
    "doc_create_word",
    "Genera un documento Word (.doc) editable. Úsala cuando el usuario diga 'hacé un CV en Word', 'documento con estos apuntes', 'Word con la minuta'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title", "content"],
    },
  ),
  policy: policies.localWrite("Genera documento Word-compatible."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!title || !content) return { type: "doc_create_word", status: "failed", error: "Indicá título y contenido." };
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${content.split(/\n+/).map((p) => `<p>${p}</p>`).join("\n")}</body></html>`;
    const artifact: AssistantArtifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "documento"}.doc`,
      kind: "document",
      mimeType: "application/msword",
      sizeLabel: `${html.length} caracteres`,
      content: html,
    };
    return {
      type: "doc_create_word",
      status: "ok",
      title,
      artifact,
      block: { type: "resource_bundle", title, files: [artifact] },
    };
  },
};

// ─── doc_create_excel ───────────────────────────────────────────────────────
// .xlsx real requiere lib. Generamos CSV que Excel abre, + HTML tabla.
export const docCreateExcel: ToolHandler = {
  definition: defineTool(
    "doc_create_excel",
    "Genera una planilla Excel (.csv) con datos o tabla. Úsala cuando el usuario diga 'Excel con mis gastos del mes', 'planilla de notas del curso', 'tabla en Excel'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Filas de la tabla (cada fila es un array de celdas)." },
      },
      required: ["title", "rows"],
    },
  ),
  policy: policies.localWrite("Genera CSV/Excel."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const rows = Array.isArray(args.rows) ? args.rows : [];
    if (!title || rows.length === 0) return { type: "doc_create_excel", status: "failed", error: "Indicá título y filas." };
    const escape = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map((row) => (Array.isArray(row) ? row : []).map((c) => escape(String(c))).join(",")).join("\n");
    const artifact: AssistantArtifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "planilla"}.csv`,
      kind: "spreadsheet",
      mimeType: "text/csv",
      sizeLabel: `${rows.length} filas × ${rows[0]?.length ?? 0} columnas`,
      content: csv,
    };
    return {
      type: "doc_create_excel",
      status: "ok",
      title,
      artifact,
      note: "Se generó CSV (Excel lo abre directo). Para formato nativo .xlsx se necesita lib adicional.",
      block: { type: "resource_bundle", title, files: [artifact] },
    };
  },
};

// ─── ocr_text ───────────────────────────────────────────────────────────────
export const ocrText: ToolHandler = {
  definition: defineTool(
    "ocr_text",
    "Extrae texto de una imagen (ticket, cartel, documento, captura). Úsala cuando el usuario diga 'leé este ticket de compra', 'qué dice este cartel?', 'extraé el texto de esta imagen'. Usa visión local de Ollama (LLaVA / Llama 3.2 Vision).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        imageUrl: { type: "string", description: "URL o data URL de la imagen." },
        prompt: { type: "string", description: "Qué buscar (ej: 'total', 'fecha', 'productos')." },
      },
      required: ["imageUrl"],
    },
  ),
  policy: policies.readonly("Procesa imagen con modelo local."),
  async run(args, ctx: ToolRunContext) {
    const imageUrl = String(args.imageUrl ?? "").trim();
    const prompt = String(args.prompt ?? "Extraé todo el texto visible en la imagen, preservando estructura.").trim();
    if (!imageUrl) return { type: "ocr_text", status: "failed", error: "Indicá la imagen." };
    if (!ctx.chatFn) {
      return { type: "ocr_text", status: "not_configured", note: "OCR requiere modelo de visión local (Ollama LLaVA). Configuralo en Settings." };
    }
    // ctx.chatFn es de texto; la integración con Ollama Vision requiere endpoint /api/generate con imágenes.
    // Delegamos a web_search del motor para OCR en la nube como fallback, o pedimos al usuario subir la imagen vía chat.
    return {
      type: "ocr_text",
      status: "delegate",
      delegateTo: "web_search",
      query: `extraer texto OCR imagen ${prompt}`,
      mode: "research",
      note: "OCR local con Ollama Vision requiere integración específica (no soportada por chatFn). Subí la imagen por el chat y Koru la procesará.",
    };
  },
};

// ─── data_analyze ───────────────────────────────────────────────────────────
export const dataAnalyze: ToolHandler = {
  definition: defineTool(
    "data_analyze",
    "Analiza datos pegados (CSV, tabla, lista de números) calculando media, mediana, suma, máx, mín, tendencias y top. Úsala cuando el usuario diga 'analizá estos gastos', 'tendencia de mis ventas', 'resumen estadístico de estos datos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        data: { type: "string", description: "Datos pegados (CSV, una fila por línea, o lista de números)." },
        focus: { type: "string", description: "Qué analizar (ej: 'tendencia', 'top 5', 'promedio mensual')." },
      },
      required: ["data"],
    },
  ),
  policy: policies.readonly("Cálculo estadístico local."),
  async run(args) {
    const raw = String(args.data ?? "").trim();
    const focus = String(args.focus ?? "resumen").trim();
    if (!raw) return { type: "data_analyze", status: "failed", error: "Pegá los datos." };

    // Detectar si es números puros o CSV.
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const numbers: number[] = [];
    let csvMode = false;
    for (const line of lines) {
      const cells = line.split(/[,\t;|]/).map((c) => c.trim());
      if (cells.length > 1) { csvMode = true; break; }
      const n = Number(cells[0]);
      if (Number.isFinite(n)) numbers.push(n);
    }

    if (csvMode) {
      // Modo CSV: delegar al LLM local si hay, si no, mensaje claro.
      return {
        type: "data_analyze",
        status: "ok",
        mode: "csv",
        rows: lines.length,
        focus,
        note: "Datos tabulares detectados. Para análisis profundo de CSV, el LLM del turno puede procesar el contenido directamente.",
      };
    }

    if (numbers.length === 0) {
      return { type: "data_analyze", status: "failed", error: "No pude extraer números de los datos." };
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((s, n) => s + n, 0);
    const mean = sum / numbers.length;
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return {
      type: "data_analyze",
      status: "ok",
      mode: "numbers",
      focus,
      count: numbers.length,
      sum: Number(sum.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      min,
      max,
      range: Number((max - min).toFixed(2)),
      top5: sorted.slice(-5).reverse(),
      bottom5: sorted.slice(0, 5),
    };
  },
};

// ─── data_chart ─────────────────────────────────────────────────────────────
export const dataChart: ToolHandler = {
  definition: defineTool(
    "data_chart",
    "Genera un gráfico (líneas, barras, torta) a partir de datos. Úsala cuando el usuario diga 'gráfico de mis gastos por mes', 'barras de mis hábitos de sueño', 'visualizar esta serie'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        type: { type: "string", enum: ["bar", "line", "pie"], default: "bar" },
        labels: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "number" } },
      },
      required: ["title", "labels", "values"],
    },
  ),
  policy: policies.localWrite("Genera HTML con gráfico."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const type = String(args.type ?? "bar");
    const labels = Array.isArray(args.labels) ? args.labels.map(String) : [];
    const values = Array.isArray(args.values) ? args.values.map(Number) : [];
    if (!title || labels.length === 0 || values.length === 0) {
      return { type: "data_chart", status: "failed", error: "Indicá título, etiquetas y valores." };
    }
    // SVG simple embebido en HTML (sin dependencias). Barras por defecto.
    const max = Math.max(...values, 1);
    const width = 480;
    const barH = type === "bar" ? 28 : 0;
    const chartH = type === "bar" ? labels.length * (barH + 6) + 30 : 200;
    let svgBody = "";
    if (type === "bar") {
      labels.forEach((label, i) => {
        const w = (values[i] / max) * (width - 160);
        const y = i * (barH + 6) + 10;
        svgBody += `<rect x="150" y="${y}" width="${w}" height="${barH}" fill="#3b82f6" rx="3"/><text x="10" y="${y + barH / 2 + 5}" font-size="13">${label}</text><text x="${155 + w}" y="${y + barH / 2 + 5}" font-size="13">${values[i]}</text>`;
      });
    } else if (type === "line") {
      const stepX = (width - 60) / Math.max(values.length - 1, 1);
      const points = values.map((v, i) => `${30 + i * stepX},${chartH - 20 - (v / max) * (chartH - 40)}`).join(" ");
      svgBody = `<polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2"/>${labels.map((l, i) => `<text x="${30 + i * stepX - 10}" y="${chartH - 5}" font-size="11">${l}</text>`).join("")}`;
    } else {
      // pie: ángulos
      const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
      let acc = 0;
      const cx = width / 2; const cy = chartH / 2; const r = Math.min(cx, cy) - 10;
      const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
      values.forEach((v, i) => {
        const start = (acc / total) * 2 * Math.PI;
        acc += Math.abs(v);
        const end = (acc / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(start); const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end); const y2 = cy + r * Math.sin(end);
        const large = end - start > Math.PI ? 1 : 0;
        svgBody += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>`;
        const midA = (start + end) / 2;
        svgBody += `<text x="${cx + r * 0.6 * Math.cos(midA)}" y="${cy + r * 0.6 * Math.sin(midA)}" font-size="11" fill="white">${labels[i]}</text>`;
      });
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${chartH}"><rect width="100%" height="100%" fill="white"/><text x="10" y="20" font-size="15" font-weight="bold">${title}</text>${svgBody}</svg>`;
    const artifact: AssistantArtifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 30) || "grafico"}.svg`,
      kind: "document",
      mimeType: "image/svg+xml",
      sizeLabel: `${labels.length} puntos`,
      content: svg,
    };
    return { type: "data_chart", status: "ok", title, type, artifact, block: { type: "resource_bundle", title, files: [artifact] } };
  },
};
