/**
 * Medición de métricas de calidad sobre el DOM renderizado.
 *
 * measureDom es AUTÓNOMA: todos los selectores y regexes viven DENTRO del
 * cuerpo de la función, sin constantes de módulo ni imports en runtime.
 * Eso permite que Playwright la serialice y la ejecute EN el navegador de
 * producción (element.evaluate), con exactamente la misma lógica que corre
 * en jsdom durante los tests. Un solo medidor, tres contextos.
 */
import type { DomMetrics } from "./rubric";

export function measureDom(root: ParentNode): DomMetrics {
  // ── texto: por NODOS de texto, no textContent pegado.
  // Los nodos adyacentes son unidades visuales distintas ("Lun" "18°–28°"
  // son 2 palabras para el usuario, aunque textContent las pegue).
  // Iconos de glifo (Material Symbols por ligadura): son iconos VISUALES,
  // no texto — se excluyen del conteo de palabras y se cuentan como iconos.
  const GLYPH_SEL =
    '.material-symbols-outlined, .material-symbols-rounded, .material-symbols-sharp, [class*="material-symbols"]';
  const inGlyph = (node: Node | null): boolean => {
    const p = node ? (node as ChildNode).parentElement : null;
    return p ? p.closest(GLYPH_SEL) != null : false;
  };
  const texts: string[] = [];
  let walker: TreeWalker | null = null;
  try {
    const doc = (root as Node).ownerDocument ?? (typeof document !== "undefined" ? document : null);
    walker = doc ? doc.createTreeWalker(root as Node, 4 /* SHOW_TEXT */) : null;
  } catch {
    walker = null;
  }
  if (walker) {
    let node = walker.nextNode();
    while (node) {
      if (!inGlyph(node)) texts.push(node.nodeValue || "");
      node = walker.nextNode();
    }
  } else {
    texts.push(root.textContent || "");
  }
  const rawText = texts.join(" ").replace(/\s+/g, " ").trim();
  const wordList = rawText.split(" ").filter((w) => /[a-z0-9áéíóúüñ]/i.test(w));
  const words = wordList.length;
  const meaningful = wordList.filter((w) => w.replace(/[^a-z0-9áéíóúüñ]/gi, "").length >= 3);
  const uniqueWords = new Set(meaningful.map((w) => w.toLowerCase())).size;

  // ── datos específicos: números con unidad, horas, fechas, monedas,
  // ratings y años — TODO lo que el usuario percibe como “dato concreto”. ──
  const dataRes: RegExp[] = [
    /\d+(?:[.,]\d+)?\s*(?:%|€|\$|£|°|kcal|kWh|kWp|km\/h|km|kg|min|pts?|goles?|páginas?|pág\b|reseñas?|capítulos?|estrellas?|veces|movimientos?|dB|bar|ml|cm|mm|g\b|m²|USD|EUR|ARS|JPY)/g,
    /\b(?:USD|EUR|GBP|ARS|JPY|US\$|C\$)\s?\d+(?:[.,]\d+)?/g,
    /\b\d+(?:[.,]\d+)?\s*(?:km\/h|horas?|hs?|días?|dias?|semanas?|meses?|años?|anos?|minutos?|veces)\b/gi,
    /\b\d{1,2}:\d{2}\b/g,
    /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g,
    /[€$£]\s?\d+(?:[.,]\d+)?/g,
    /\b\d+(?:[.,]\d+)?\s*\/\s*(?:5|10|100)\b/g,
    /\b(?:19|20)\d{2}\b/g,
    /\b\d+\s*[–—-]\s*\d+\b/g,
    /\b\d{1,3}\s*['′]\b/g,
    /\b\d+(?:[.,]\d+)?\s?(?:x|×)\d\b/g,
  ];
  let dataPoints = 0;
  for (const re of dataRes) dataPoints += (rawText.match(re) || []).length;
  dataPoints = Math.min(40, dataPoints);

  // ── interactivos ──
  const interactiveEls = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [role="button"], [role="tab"],' +
        ' [role="switch"], [role="checkbox"], [role="link"], [role="menuitem"],' +
        ' [contenteditable="true"]',
    ),
  );
  const interactive = interactiveEls.length;
  const stateful = interactiveEls.filter((el) =>
    el.matches(
      '[aria-pressed], [aria-expanded], [aria-checked], [aria-selected], [disabled],' +
        ' input, select, textarea, [role="tab"], [role="switch"], [role="checkbox"]',
    ),
  ).length;

  // ── CTAs accionables: labels cortos de la card, EXCLUYENDO el chrome del
  // shell (Volver/Guardar son navegación del marco, no funciones de la card).
  // En minis, el hint de CTA (`.koru-plan-hero-cta-hint`, [class*="cta"]) es
  // el affordance visible de la acción aunque la card entera sea el botón.
  const CHROME = new Set(["volver", "guardar", "✕", "x", "cerrar"]);
  const ctaLabelSet = new Set(
    interactiveEls
      .map((el) => {
        const label = (el.textContent || "").replace(/\s+/g, " ").trim();
        return label || (el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      })
      .filter((t) => t.length > 0 && t.length <= 28 && !CHROME.has(t.toLowerCase())),
  );
  root.querySelectorAll('[class*="cta"]').forEach((el) => {
    const label = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (label.length > 0 && label.length <= 40) ctaLabelSet.add(label);
  });
  const ctaLabels = ctaLabelSet.size;

  // ── estructura visual ──
  const headings = root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length;
  const icons =
    root.querySelectorAll("svg, img").length + root.querySelectorAll(GLYPH_SEL).length;

  // ── variedad visual (clases CSS distintas) ──
  const classTokens = new Set<string>();
  root.querySelectorAll("[class]").forEach((el) => {
    (el.getAttribute("class") || "")
      .split(/\s+/)
      .forEach((c) => {
        if (c.length >= 3) classTokens.add(c);
      });
  });
  const distinctClasses = classTokens.size;

  // ── accesibilidad (atributos) ──
  let a11yBits = 0;
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name;
      if (n.startsWith("aria-") || n === "role" || n === "alt" || n === "title" || n === "tabindex") {
        a11yBits++;
      }
    }
  });

  // ── estados de feedback visibles ──
  const feedbackStates = root.querySelectorAll(
    '[aria-pressed], [aria-expanded], [aria-selected], [disabled], [data-state],' +
      ' input:checked, [class*="skeleton"], [class*="empty"], [class*="loading"], [class*="done"]',
  ).length;

  // ── texto genérico/simulado ──
  const phRe = /lorem|ipsum|placeholder|fixme|todo:|asdf|qwerty|xxxx|texto de ejemplo/gi;
  const placeholders = (rawText.match(phRe) || []).length;

  return {
    words,
    uniqueWords,
    dataPoints,
    interactive,
    stateful,
    ctaLabels,
    headings,
    icons,
    distinctClasses,
    a11yBits,
    feedbackStates,
    placeholders,
  };
}

/** Métricas de texto plano (para replies de chat y probes de API). */
export function measureText(text: string): { words: number; dataPoints: number } {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter((w) => /[a-z0-9áéíóúüñ]/i.test(w)).length;
  const dataRes: RegExp[] = [
    /\d+(?:[.,]\d+)?\s*(?:%|€|\$|£|°|kcal|kWh|km|kg|min|pts?|horas?|hs?|días?|semanas?|meses?|años?|veces)/gi,
    /\b\d{1,2}:\d{2}\b/g,
    /[€$£]\s?\d+(?:[.,]\d+)?/g,
    /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g,
  ];
  let dataPoints = 0;
  for (const re of dataRes) dataPoints += (clean.match(re) || []).length;
  return { words, dataPoints };
}
