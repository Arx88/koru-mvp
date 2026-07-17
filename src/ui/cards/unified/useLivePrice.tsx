// ════════════════════════════════════════════════════════════════════════
//  useLivePrice — Hook para precio latiente (Cripto / Trading / Forex)
//  Kimi Tier-S spec: el precio "late" cada 3s con random-walk pequeño.
//  Flash verde si subió, rojo si bajó, neutro si igual.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

/**
 * Simula un precio que "late" cada ~3s con un random-walk pequeño (±0.15%).
 * No pretende ser un feed real de cripto — es una micro-animación visual
 * que da la sensación de "en vivo" sin consumir API quota.
 *
 * El precio base se mantiene (no deriva), sólo fluctúa alrededor.
 */
export function useLivePrice(basePrice: string | undefined, intervalMs = 3000) {
  const [displayPrice, setDisplayPrice] = useState(basePrice);
  const [direction, setDirection] = useState<"up" | "dn" | null>(null);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (!basePrice) return;
    setDisplayPrice(basePrice);
    prevRef.current = null;

    const id = setInterval(() => {
      // Parsear el número del string (ej: "$64.230" → 64230, "AR$ 1.250,50" → 1250.5)
      const num = parsePriceNumber(basePrice);
      if (num == null || !isFinite(num) || num <= 0) return;

      // Random-walk ±0.15%
      const delta = (Math.random() - 0.5) * 0.003 * num;
      const newNum = num + delta;

      // Formatear con la misma estructura del original
      const formatted = formatPriceLike(basePrice, newNum);
      setDisplayPrice(formatted);

      if (prevRef.current != null) {
        if (newNum > prevRef.current) setDirection("up");
        else if (newNum < prevRef.current) setDirection("dn");
        else setDirection(null);
      } else {
        setDirection(null);
      }
      prevRef.current = newNum;

      // Resetear la dirección después de 900ms (duración del flash)
      setTimeout(() => setDirection(null), 900);
    }, intervalMs);

    return () => clearInterval(id);
  }, [basePrice, intervalMs]);

  return { displayPrice, direction };
}

/** Parsea "$64.230" → 64230, "1.250,50" → 1250.5, "AR$ 1.250.500" → 1250500. */
function parsePriceNumber(s: string): number | null {
  if (!s) return null;
  // Quitar todo lo que no sea dígito, coma o punto
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  // Detectar formato: si hay coma y punto, asumir formato es-AR (1.250,50)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Si la coma está después del punto → punto es miles, coma es decimal
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    // Si el punto está después de la coma → coma es miles, punto es decimal
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  // Sólo coma → coma es decimal (formato es-AR sin miles)
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", "."));
  }
  // Sólo punto → punto es decimal (formato en-US)
  if (cleaned.includes(".")) {
    // Si hay múltiples puntos → son separadores de miles (1.250.500)
    const parts = cleaned.split(".");
    if (parts.length > 2) return parseFloat(parts.join(""));
    return parseFloat(cleaned);
  }
  // Sólo dígitos
  return parseFloat(cleaned);
}

/** Formatea el número nuevo respetando la estructura del original. */
function formatPriceLike(original: string, newNum: number): string {
  // Si el original tiene "$" o "AR$" al inicio, preservarlo
  const prefixMatch = original.match(/^[^\d.,]*/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const suffixMatch = original.match(/[^\d.,]*$/);
  const suffix = suffixMatch ? suffixMatch[0] : "";

  // Si el original usa coma como decimal (es-AR), formatear con coma
  const hasCommaDecimal = original.includes(",") &&
    (!original.includes(".") || original.lastIndexOf(",") > original.lastIndexOf("."));

  if (hasCommaDecimal) {
    // Formato es-AR: 1.250,50
    const rounded = Math.round(newNum * 100) / 100;
    const [intPart, decPart] = rounded.toString().split(".");
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const dec = decPart ? "," + decPart.padEnd(2, "0").slice(0, 2) : "";
    return prefix + intFormatted + dec + suffix;
  }

  // Formato en-US: 1,250.50 — o sólo enteros
  const rounded = Math.round(newNum * 100) / 100;
  const hasDecimalInOriginal = /\.\d{1,2}\b/.test(original);
  if (hasDecimalInOriginal) {
    return prefix + rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
  }
  // Sin decimales en el original → mantener enteros con separador de miles
  return prefix + Math.round(newNum).toLocaleString("en-US") + suffix;
}

/** Componente LivePrice — envuelve el valor del artValue y aplica la clase flash. */
export function LivePrice({ value, className }: { value: string | undefined; className?: string }) {
  const { displayPrice, direction } = useLivePrice(value);
  const flashClass = direction === "up" ? "up" : direction === "dn" ? "dn" : "";
  return (
    <span className={`koru-live-price ${flashClass} ${className ?? ""}`}>
      <span className="koru-live-dot" aria-hidden="true" />
      {displayPrice}
    </span>
  );
}
