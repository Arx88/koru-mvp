/**
 * Receipt OCR con Tesseract.js — sin API key, 100% local.
 *
 * Tesseract.js reconoce texto en imágenes en el browser (WASM). Para tickets
 * en español + inglés usamos 'spa+eng'. El output se parsea buscando líneas
 * con formato "descripción  $X.YY" — patrón típico de tickets/receipts.
 *
 * El reconocimiento tarda 2-10s por imagen dependiendo del tamaño. La UI
 * debe mostrar un loader mientras tanto.
 */

// tesseract.js se carga dinámicamente para no romper el bundle

export type ReceiptItem = {
  description: string;
  amount: number;
};

export type ReceiptScanResult = {
  items: ReceiptItem[];
  rawText: string;
};

/**
 * Parsea el texto reconocido por Tesseract buscando líneas con el patrón:
 *   descripción  $X.YY
 *   descripción  X.YY
 *   descripción  X,YY  (coma decimal — común en receipts europeos)
 *
 * Ignora totales, subtítulos y líneas sin precio al final.
 */
export function parseReceiptLines(text: string): ReceiptItem[] {
  if (!text) return [];
  const items: ReceiptItem[] = [];
  const seen = new Set<string>();
  // Patrón: texto + al final (con o sin $) número con 2 decimales.
  const lineRe = /(.+?)\s+\$?(\d+[.,]\d{2})\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) !== null) {
    const desc = m[1].trim();
    const amountStr = m[2].replace(",", ".");
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (desc.length < 2) continue;
    // Filtrar totales y subtítulos comunes.
    const lower = desc.toLowerCase();
    if (
      /\b(total|subtotal|sub-total|propina|tip|iva|tax|impuesto|balance|saldo|cambio|change|efectivo|cash|tarjeta|card)\b/.test(
        lower,
      )
    ) {
      continue;
    }
    const key = `${lower}|${amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ description: desc, amount });
  }
  return items;
}

/**
 * Escanea una imagen de receipt con Tesseract.js y devuelve los ítems
 * detectados (descripción + monto).
 *
 * @param imageFile File/Blob de la imagen del ticket.
 * @returns { items, rawText }. Si falla el OCR, devuelve items vacíos y
 *          rawText con el error.
 */
export async function scanReceipt(
  imageFile: File | Blob,
): Promise<ReceiptScanResult> {
  if (!imageFile) return { items: [], rawText: "" };
  try {
    const Tesseract = (await import("tesseract.js")).default;
    const result = await Tesseract.recognize(imageFile, "spa+eng", {
      logger: () => {
        // Silenciamos el logger para no spamear consola. La UI puede pasar
        // su propio callback si quiere mostrar progreso.
      },
    });
    const rawText = result?.data?.text ?? "";
    const items = parseReceiptLines(rawText);
    return { items, rawText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { items: [], rawText: `OCR falló: ${msg}` };
  }
}
