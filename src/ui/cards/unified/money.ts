/**
 * Números de dinero con el locale del producto (es-AR).
 *
 * El problema que resuelve: el backend manda el precio como lo escupe JS
 * (`String(77312.805)` → "77312.805 USD") y la card lo imprimía crudo, así que
 * el MISMO dato se veía "77312.805 USD" en la tarjeta y "USD 77.312,80" en el
 * texto del chat — dos locales en la misma pantalla. Esto normaliza la parte
 * numérica y deja intactos símbolos y códigos de moneda.
 */

/** 77.312,81 USD / USD 77.312,81 / $2.847.600 / 1.250,50 / 0,00042 BTC */
const MONEY_RE = /^([^0-9]*?)\s*([-+]?\d[\d.,\s]*?)\s*([^0-9]*)$/;

/** Parsea "77312.805" → 77312.805 y "1.250,50" → 1250.5 (misma heurística que
 *  usa el precio en vivo de la card, una sola fuente). Ojo: con un único punto
 *  asume decimal en-US, así que "$64.230" da 64,23 — por eso `moneyEsAr` nunca
 *  reescribe strings con símbolo de moneda. */
export function parsePriceNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    // La coma está después del punto → punto = miles, coma = decimal.
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return Number.parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    // El punto está después de la coma → coma = miles, punto = decimal.
    return Number.parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) return Number.parseFloat(cleaned.replace(",", "."));
  if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length > 2) return Number.parseFloat(parts.join(""));
    return Number.parseFloat(cleaned);
  }
  return Number.parseFloat(cleaned);
}

/** Formatea un número con separador de miles y decimales proporcionales al
 *  tamaño: 2 fijos para montos (77.312,81), hasta 4 por debajo del peso 
 *  (0,0420) y hasta 6 para un satoshi (0,00042). */
export function formatMoneyNumber(value: number): string {
  if (!Number.isFinite(value)) return "?";
  const fmt = (min: number, max: number) =>
    new Intl.NumberFormat("es-AR", { minimumFractionDigits: min, maximumFractionDigits: max }).format(value);
  if (Math.abs(value) >= 1) return fmt(2, 2);
  if (Math.abs(value) >= 0.01) return fmt(0, 4);
  return fmt(0, 6);
}

/** ¿Es un `String(número)` de JS seguido de un código de moneda? Ese patrón lo
 *  produce el backend (`${r.price} ${r.currency}`): número plano, sin separador
 *  de miles ni coma decimal, y el código de moneda detrás. Es el único caso en
 *  el que reescribimos con confianza ("64.230" a secas es ambiguo: miles acá,
 *  decimal en US) — por eso exigimos el código. */
const RAW_WITH_CODE_RE = /^([-+]?\d+(?:\.\d+)?)\s+([A-Z]{2,5})$/;

/** Deja el string de dinero en el locale del producto. Si no puede parsearlo o
 *  ya viene formateado con símbolo (`$2.847.600`), lo devuelve tal cual. */
export function moneyEsAr(raw: unknown): string {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) return "";
  const m = s.match(MONEY_RE);
  if (!m) return s;
  const [, rawPrefix, rawNum, rawSuffix] = m;
  const prefix = rawPrefix.trim();
  const suffix = rawSuffix.trim();
  // Con símbolo de moneda asumimos que ya lo formateó quien lo generó.
  if (/[$€£¥₿]/.test(prefix)) return s;
  const match = `${rawNum} ${suffix}`.match(RAW_WITH_CODE_RE);
  if (!match) return s;

  const value = parsePriceNumber(match[1]);
  if (value == null) return s;
  const head = prefix ? `${prefix} ` : "";
  return `${head}${formatMoneyNumber(value)} ${match[2]}`;
}
