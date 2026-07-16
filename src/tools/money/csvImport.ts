/**
 * CSV bank import — parser para extractos bancarios exportados.
 *
 * Sin API, sin key, sin intervención del usuario más allá de seleccionar el
 * archivo. Detecta automáticamente:
 *  - Delimitador (coma, punto y coma, tab).
 *  - Formato de fecha (ISO yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy, dd-mm-yy).
 *  - Signo del monto (positivos y negativos; números con coma o punto decimal).
 *  - Cabecera (si la primera fila es texto, la salta).
 *
 * La heurística es deliberadamente tolerante: cualquier columna que parezca
 * fecha se usa como `date`, cualquier columna que parezca monto como `amount`
 * (respetando signo), y la primera columna textual larga se usa como
 * `description`. La currency por defecto es EUR pero se puede override.
 */

export type ParsedBankTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
};

/** Resultado del parseo con metadata para feedback en la UI. */
export type CsvImportResult = {
  transactions: ParsedBankTransaction[];
  delimiter: string;
  detectedDateColumn?: number;
  detectedAmountColumn?: number;
  detectedDescriptionColumn?: number;
  headerSkipped: boolean;
  warnings: string[];
};

// ─── Detección de delimitador ────────────────────────────────────────────────

/**
 * Cuenta cuántas veces aparece cada candidato en la primera línea no vacía.
 * El delimitador con más ocurrencias (mínimo 1) gana. Empate → coma.
 */
function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const c of candidates) {
    // Divide y cuenta piezas no vacías para evitar falsos positivos con
    // delimitadores consecutivos al final.
    const count = firstLine.split(c).filter((p) => p.trim().length > 0).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

// ─── Detección de fecha ──────────────────────────────────────────────────────

const DATE_PATTERNS: Array<{ re: RegExp; format: string }> = [
  // ISO: 2024-01-31
  { re: /^\d{4}-\d{2}-\d{2}$/, format: "yyyy-mm-dd" },
  // 31/01/2024 o 31-01-2024 (formato europeo día primero)
  { re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/, format: "dd/mm/yyyy" },
  // 01/31/2024 (formato americano mes primero — se decide heurísticamente)
  { re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/, format: "mm/dd/yyyy" },
];

function tryParseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO directo
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00Z");
    if (!isNaN(d.getTime())) return s;
  }
  // dd/mm/yyyy o dd-mm-yyyy
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    let day: number;
    let month: number;
    let year: number;
    // Si el primer número es > 12, es el día (formato europeo).
    if (parseInt(a, 10) > 12) {
      day = parseInt(a, 10);
      month = parseInt(b, 10);
    } else if (parseInt(b, 10) > 12) {
      // El segundo > 12 → es día, el primero es mes (formato americano).
      day = parseInt(b, 10);
      month = parseInt(a, 10);
    } else {
      // Ambiguo: asumimos europeo (dd/mm/yyyy) — default España/Latam.
      day = parseInt(a, 10);
      month = parseInt(b, 10);
    }
    year = parseInt(y, 10);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d.getTime())) return null;
    return iso;
  }
  // Intento fallback con Date.parse (algunos bancos traen "Jan 5, 2024").
  const t = Date.parse(s);
  if (Number.isFinite(t)) {
    const d = new Date(t);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// ─── Detección de monto ──────────────────────────────────────────────────────

/**
 * Parsea un monto que puede venir en varios formatos:
 *   "1.234,56" (europeo)
 *   "1,234.56" (americano)
 *   "1234.56"
 *   "1234,56"
 *   "-50.00" / "(50.00)" (negativo entre paréntesis — convención bancaria)
 *   "€ 50.00", "EUR 50", "+50"
 *
 * Respeta el signo explícito. Paréntesis → negativo.
 */
function tryParseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  // Paréntesis → negativo.
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Símbolo explícito.
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  // Quitar símbolos de moneda y espacios.
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  // Si tiene ambos separadores, deducir cuál es decimal.
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // El último separador es el decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // Coma es decimal → punto es miles.
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Punto es decimal → coma es miles.
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Solo coma. Si aparece una sola vez y hay 1-2 dígitos después → decimal.
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0] + "." + parts[1];
    } else {
      // Sino, es separador de miles.
      s = s.replace(/,/g, "");
    }
  } else if (hasDot) {
    // Solo punto. Igual: si hay un punto con 1-2 dígitos al final → decimal.
    const parts = s.split(".");
    if (parts.length > 2) {
      // Múltiples puntos → miles (1.234.567).
      s = s.replace(/\./g, "");
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // "1.234" probablemente miles; "12.34" decimal.
      // Ambiguo: si la parte entera tiene exactamente 3 dígitos y la decimal 3,
      // asumimos miles (1.234 = 1234).
      s = s.replace(/\./g, "");
    }
    // Sino dejamos como está (decimal válido).
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// ─── Detección de columnas ───────────────────────────────────────────────────

const HEADER_DATE_HINTS = /^(date|fecha|fecha operacion|fecha valor|operation date|transaction date|posted at|booked at)$/i;
const HEADER_AMOUNT_HINTS = /^(amount|importe|monto|valor|transaction amount|credit|debit|saldo|balance)$/i;
const HEADER_DESC_HINTS = /^(description|concepto|descripcion|detalle|memo|narrative|merchant|beneficiary|beneficiario|titular)$/i;
const HEADER_CURRENCY_HINTS = /^(currency|moneda|divisa|ccy)$/i;

function looksLikeDateHeader(h: string): boolean {
  return HEADER_DATE_HINTS.test(h.trim());
}
function looksLikeAmountHeader(h: string): boolean {
  return HEADER_AMOUNT_HINTS.test(h.trim());
}
function looksLikeDescriptionHeader(h: string): boolean {
  return HEADER_DESC_HINTS.test(h.trim());
}
function looksLikeCurrencyHeader(h: string): boolean {
  return HEADER_CURRENCY_HINTS.test(h.trim());
}

/**
 * Detección por cabecera: si la primera fila contiene tokens conocidos
 * (date/fecha, amount/importe, description/concepto), usamos esos índices.
 * Sino, hacemos detección por contenido (sample de las primeras filas).
 */
function detectColumns(
  headerRow: string[] | null,
  sampleRows: string[][],
): { dateCol: number; amountCol: number; descCol: number; currencyCol: number | null } {
  let dateCol = -1;
  let amountCol = -1;
  let descCol = -1;
  let currencyCol: number | null = null;

  if (headerRow) {
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i] ?? "";
      if (dateCol === -1 && looksLikeDateHeader(h)) dateCol = i;
      else if (amountCol === -1 && looksLikeAmountHeader(h)) amountCol = i;
      else if (descCol === -1 && looksLikeDescriptionHeader(h)) descCol = i;
      else if (currencyCol === null && looksLikeCurrencyHeader(h)) currencyCol = i;
    }
  }

  // Fallback por contenido: sample de hasta 5 filas.
  if (dateCol === -1 || amountCol === -1 || descCol === -1) {
    const colCount = Math.max(
      headerRow?.length ?? 0,
      ...sampleRows.map((r) => r.length),
    );
    let bestDateCol = -1;
    let bestDateHits = 0;
    let bestAmountCol = -1;
    let bestAmountHits = 0;
    let bestDescCol = -1;
    let bestDescHits = 0;
    for (let c = 0; c < colCount; c++) {
      let dateHits = 0;
      let amountHits = 0;
      let descHits = 0;
      for (const row of sampleRows) {
        const v = (row[c] ?? "").trim();
        if (!v) continue;
        if (tryParseDate(v) != null) dateHits++;
        else if (tryParseAmount(v) != null) amountHits++;
        else descHits++;
      }
      if (dateHits > bestDateHits) {
        bestDateHits = dateHits;
        bestDateCol = c;
      }
      if (amountHits > bestAmountHits) {
        bestAmountHits = amountHits;
        bestAmountCol = c;
      }
      if (descHits > bestDescHits && c !== bestDateCol && c !== bestAmountCol) {
        bestDescHits = descHits;
        bestDescCol = c;
      }
    }
    if (dateCol === -1 && bestDateCol !== -1) dateCol = bestDateCol;
    if (amountCol === -1 && bestAmountCol !== -1) amountCol = bestAmountCol;
    if (descCol === -1 && bestDescCol !== -1) descCol = bestDescCol;
    // Si todavía no encontramos description, tomar la primera columna textual.
    if (descCol === -1) {
      for (let c = 0; c < colCount; c++) {
        if (c === dateCol || c === amountCol || c === currencyCol) continue;
        descCol = c;
        break;
      }
    }
  }

  if (dateCol === -1) dateCol = 0;
  if (amountCol === -1) amountCol = dateCol === 0 ? 1 : 0;
  if (descCol === -1) {
    const used = new Set([dateCol, amountCol, currencyCol]);
    descCol = [0, 1, 2, 3].find((c) => !used.has(c)) ?? 0;
  }
  return { dateCol, amountCol, descCol, currencyCol };
}

// ─── CSV splitter (tolerante a comillas) ─────────────────────────────────────

/**
 * Divide una línea respetando comillas dobles (convención RFC 4180).
 * Si el delimiter es ",", una celda "con, coma" cuenta como un solo campo.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Parsea un texto CSV de extracto bancario y devuelve las transacciones
 * normalizadas. No lanza: ante cualquier fallo de parseo de una fila, la
 * salta y acumula un warning.
 *
 * @param csvText  Contenido completo del archivo CSV.
 * @param currency Override de moneda (default "EUR").
 */
export function parseBankCSV(
  csvText: string,
  currency = "EUR",
): ParsedBankTransaction[] {
  return parseBankCSVWithMeta(csvText, currency).transactions;
}

/** Igual que `parseBankCSV` pero devuelve metadata de detección para UI. */
export function parseBankCSVWithMeta(
  csvText: string,
  currency = "EUR",
): CsvImportResult {
  const warnings: string[] = [];
  if (!csvText || !csvText.trim()) {
    return {
      transactions: [],
      delimiter: ",",
      headerSkipped: false,
      warnings: ["Archivo vacío."],
    };
  }
  // Normalizar saltos de línea (CRLF → LF).
  const text = csvText.replace(/\r\n?/g, "\n");
  // BOM al inicio (algunos exports Windows lo traen).
  const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      transactions: [],
      delimiter: ",",
      headerSkipped: false,
      warnings: ["Archivo sin filas con contenido."],
    };
  }

  const delimiter = detectDelimiter(lines[0]);

  // Detectar si la primera fila es header (sin fecha válida en la columna
  // que será dateCol tentativa).
  const firstRow = splitCsvLine(lines[0], delimiter);
  let headerRow: string[] | null = null;
  let dataStart = 0;
  // Heurística: si ninguna celda de la primera fila parsea como fecha Y hay
  // alguna celda con texto "fecha/date/importe/amount/concepto", es header.
  const hasHeaderHint = firstRow.some(
    (c) =>
      looksLikeDateHeader(c) ||
      looksLikeAmountHeader(c) ||
      looksLikeDescriptionHeader(c) ||
      looksLikeCurrencyHeader(c),
  );
  const anyDateInFirst = firstRow.some((c) => tryParseDate(c) != null);
  if (hasHeaderHint && !anyDateInFirst) {
    headerRow = firstRow;
    dataStart = 1;
  }

  // Sample de hasta 5 filas de datos para detección por contenido.
  const sample = lines
    .slice(dataStart, dataStart + 5)
    .map((l) => splitCsvLine(l, delimiter));
  const { dateCol, amountCol, descCol, currencyCol } = detectColumns(headerRow, sample);

  const transactions: ParsedBankTransaction[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const row = splitCsvLine(lines[i], delimiter);
    const rawDate = (row[dateCol] ?? "").trim();
    const rawAmount = (row[amountCol] ?? "").trim();
    const rawDesc = (row[descCol] ?? "").trim();
    const date = tryParseDate(rawDate);
    const amount = tryParseAmount(rawAmount);
    if (date == null) {
      if (i < dataStart + 3) warnings.push(`Fila ${i + 1}: fecha no reconocida "${rawDate}".`);
      continue;
    }
    if (amount == null) {
      if (i < dataStart + 3) warnings.push(`Fila ${i + 1}: monto no reconocido "${rawAmount}".`);
      continue;
    }
    // Currency: si la columna existe y trae código ISO, usarlo; sino default.
    let cur = currency;
    if (currencyCol != null && row[currencyCol]) {
      const c = row[currencyCol].trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(c)) cur = c;
    }
    transactions.push({
      date,
      description: rawDesc || "(sin descripción)",
      amount,
      currency: cur,
    });
  }

  if (transactions.length === 0) {
    warnings.push("No se reconocieron transacciones válidas. Revisa el formato del CSV.");
  }

  return {
    transactions,
    delimiter,
    detectedDateColumn: dateCol,
    detectedAmountColumn: amountCol,
    detectedDescriptionColumn: descCol,
    headerSkipped: headerRow != null,
    warnings,
  };
}
