/**
 * 🔴 v4 — Conversor de divisas para Travel Planner.
 *
 * Usa la API gratuita del Banco Central Europeo (Frankfurter, sin API key,
 * tasas diarias) para convertir montos entre dos monedas.
 *
 * Características:
 *  - `convertCurrency(amount, from, to)` → `{ amount, rate, formatted }`
 *    La firma cumple el contrato del task: devuelve el monto convertido, la
 *    tasa unitaria (rate) y una cadena formateada tipo
 *    "¥29.110 ≈ €178,50" (símbolo de la moneda origen + monto original,
 *    seguido del símbolo destino + monto convertido).
 *  - Cache 24h en un Map a nivel módulo. Si la par (from, to) ya está
 *    cacheada y no expiró, se devuelve sin volver a llamar a la API.
 *  - `getCachedRate(from, to)` accessor síncrono: devuelve la tasa cacheada
 *    o null si no hay. Útil para mappers de presentación (que son síncronos)
 *    mostrar el monto convertido cuando la tasa ya fue pre-fetchada por el
 *    card (ver KoruUnifiedCard.useEffect).
 *  - `formatCurrency(amount, currency)` formatea con el símbolo adecuado.
 *
 * Frankfurter no requiere API key. Documentación: https://www.frankfurter.app/
 */

import { fetchJson } from "../shared/fetcher";

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

type ConvertResult = {
  amount: number;
  rate: number;
  formatted: string;
};

// ─── Cache de tasas (24h, módulo-level Map) ─────────────────────────────────

type CachedRate = {
  rate: number;
  date: string;       // ISO date de la respuesta del BCE
  fetchedAt: number;  // epoch ms
};

const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const rateCache = new Map<string, CachedRate>();

function cacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}`;
}

/**
 * Devuelve la tasa cacheada para (from, to) si existe y no expiró, si no null.
 * Síncrono — útil para presentation mappers.
 */
export function getCachedRate(from: string, to: string): number | null {
  if (!from || !to) return null;
  const upperFrom = from.toUpperCase();
  const upperTo = to.toUpperCase();
  if (upperFrom === upperTo) return 1;
  const entry = rateCache.get(cacheKey(upperFrom, upperTo));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > RATE_CACHE_TTL_MS) {
    rateCache.delete(cacheKey(upperFrom, upperTo));
    return null;
  }
  return entry.rate;
}

/**
 * Devuelve la fecha (ISO) de la última actualización del BCE para (from, to),
 * o null si no hay cache. Útil para mostrar "Actualizado: 2025-01-15".
 */
export function getCachedRateDate(from: string, to: string): string | null {
  if (!from || !to) return null;
  const entry = rateCache.get(cacheKey(from.toUpperCase(), to.toUpperCase()));
  return entry?.date ?? null;
}

// ─── Formato de moneda ───────────────────────────────────────────────────────

/** Símbolos comunes para las monedas más usadas. Fallback: el código ISO. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  ARS: "$",
  MXN: "$",
  COP: "$",
  CLP: "$",
  BRL: "R$",
  CHF: "Fr",
  CAD: "C$",
  AUD: "A$",
  INR: "₹",
  KRW: "₩",
  RUB: "₽",
  TRY: "₺",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
};

/**
 * Formatea un monto con el símbolo de la moneda. Formato es-ES (separador
 * miles ".", decimal ","). Si no hay símbolo conocido, usa el código ISO
 * como prefijo (ej. "ARS 12.345").
 *
 * Ejemplos:
 *   formatCurrency(178.5, "EUR")   → "€178,50"
 *   formatCurrency(29110, "JPY")   → "¥29.110"
 *   formatCurrency(1234.5, "ARS")  → "$1.234,50"
 */
export function formatCurrency(amount: number, currency: string): string {
  const code = (currency ?? "").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? code;
  // Formato es-ES: separador de miles "." y decimal ","
  // Para monedas sin decimales (JPY, KRW, CLP), redondeamos a enteros.
  const noDecimals = ["JPY", "KRW", "CLP", "PYG", "UYU", "HUF", "ISK", "VND"].includes(code);
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}

// ─── convertCurrency — API pública ───────────────────────────────────────────

/**
 * Convierte `amount` unidades de `from` a `to` usando la tasa del BCE.
 * Cachea la tasa por 24h.
 *
 * Ejemplo:
 *   await convertCurrency(29110, "JPY", "EUR")
 *   → { amount: 178.50, rate: 0.00613, formatted: "¥29.110 ≈ €178,50" }
 *
 * Si from === to, devuelve rate=1 sin llamar a la API.
 * Si la API falla o no devuelve tasa, lanza Error (el caller decide el fallback).
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<ConvertResult> {
  const upperFrom = (from ?? "").toUpperCase().trim();
  const upperTo = (to ?? "").toUpperCase().trim();
  if (!upperFrom || !upperTo) {
    throw new Error("convertCurrency: from and to are required");
  }
  if (!Number.isFinite(amount)) {
    throw new Error("convertCurrency: amount must be a finite number");
  }

  // Caso trivial: misma moneda.
  if (upperFrom === upperTo) {
    return {
      amount,
      rate: 1,
      formatted: formatCurrency(amount, upperFrom),
    };
  }

  // Cache hit?
  const cached = getCachedRate(upperFrom, upperTo);
  let rate: number;
  let date: string;
  if (cached != null) {
    rate = cached;
    date = getCachedRateDate(upperFrom, upperTo) ?? new Date().toISOString().slice(0, 10);
  } else {
    // Fetch a Frankfurter. La API devuelve { amount, base, date, rates: { TO: rate } }.
    // Pedimos amount=1 para obtener la tasa unitaria directamente.
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(upperFrom)}&to=${encodeURIComponent(upperTo)}`;
    const res = await fetchJson<FrankfurterResponse>(url, { timeoutMs: 15_000, retries: 1 });
    if (!res.ok || !res.data) {
      throw new Error(`convertCurrency: ${res.error ?? `HTTP ${res.status}`}`);
    }
    const rateValue = res.data.rates?.[upperTo];
    if (typeof rateValue !== "number" || !Number.isFinite(rateValue)) {
      throw new Error(`convertCurrency: no rate for ${upperFrom}→${upperTo}`);
    }
    rate = rateValue;
    date = res.data.date ?? new Date().toISOString().slice(0, 10);
    // Guardar en cache.
    rateCache.set(cacheKey(upperFrom, upperTo), {
      rate,
      date,
      fetchedAt: Date.now(),
    });
  }

  const converted = amount * rate;
  const roundedAmount = Math.round(converted * 100) / 100;
  const roundedRate = Math.round(rate * 1_000_000) / 1_000_000;

  return {
    amount: roundedAmount,
    rate: roundedRate,
    formatted: `${formatCurrency(amount, upperFrom)} ≈ ${formatCurrency(roundedAmount, upperTo)}`,
  };
}
