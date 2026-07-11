/**
 * Shared extraction helpers used by the local reflection pipeline.
 * These are intentionally deterministic/regex-based and kept separate from
 * LLM-driven extraction so they can be reused by tests, the backend agent,
 * and any future clients.
 */

import { foldAccents } from "../commitments";
import type { LifeRecord, MemoryKind, MemorySensitivity } from "../types";

const relationshipNames = /\b(ana|mama|papa|lucia|juan|martin|socia|socio|cliente|proveedor)\b/gi;

export type LifeRecordDraft = Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">;

export function sentenceCase(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

export function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function splitIdeas(input: string): string[] {
  return input
    .split(/[.\n;]+|,\s*(?=(?:tengo|necesito|quiero|hay|debo|prometi|prometí|hablar|preparar|comparar|lanzar|mandar|enviar|llamar|revisar|comprar|buscar|hacer|escribir)\b)|\sy\s(?=(?:tengo|necesito|quiero|me|hay|hoy|manana|mañana|falto|faltó|debo|prometi|prometí|hablar|preparar|comparar|lanzar|mandar|enviar|llamar|revisar|comprar|buscar|hacer|escribir)\b)/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 5)
    .slice(0, 8);
}

export function extractAmount(text: string): number | undefined {
  const match = /(?:\$|€|usd|eur|ars)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:\$|€|usd|eur|ars)?/i.exec(text);
  if (!match) return undefined;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? amount : undefined;
}

export function extractUrl(text: string): string | undefined {
  return /(https?:\/\/[^\s]+|www\.[^\s]+)/i.exec(text)?.[1];
}

export function personFromText(text: string): string | undefined {
  const explicit = /\b(?:a|con|de|para)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+)\b/.exec(text);
  if (explicit?.[1]) return explicit[1];
  const known = /\b(Ana|Lucia|Lucía|Juan|Martin|Martín|mama|mamá|papa|papá|socio|socia|cliente|proveedor)\b/i.exec(text);
  return known?.[1];
}

export function dueHintFromText(text: string): string | undefined {
  const lower = foldAccents(text);
  if (/\bhoy|ahora|urgente\b/.test(lower)) return "hoy";
  if (/\bmanana\b/.test(lower)) return "mañana";
  if (/\bsemana\b/.test(lower)) return "esta semana";
  if (/\bmes\b/.test(lower)) return "este mes";
  return undefined;
}

export function inferCurrency(text: string): string | undefined {
  const lower = foldAccents(text);
  if (lower.includes("euro")) return "EUR";
  if (text.includes("€") || lower.includes("eur")) return "EUR";
  if (text.includes("$") || lower.includes("usd")) return "USD";
  if (lower.includes("ars")) return "ARS";
  return undefined;
}

export function isRetrievalQuestion(text: string): boolean {
  const lower = foldAccents(text);
  if (/\b(recordame|recuerdame|acordame|anota|anotar|guardar|guarda|tengo que|debo|necesito|hay que)\b/i.test(lower)) {
    return false;
  }
  return /[?¿]/.test(text) || /\b(que tengo|cuanto|cual|cuales|dime|decime|mostrame|muestrame|recuerdas|recordas)\b/i.test(lower);
}

export function isExpenseCapture(text: string): boolean {
  return /\b(anota(?:r)?\s+gasto|gaste|gast[eé]|pague|pagu[eé]|factura|alquiler|recibo|cuota)\b/i.test(foldAccents(text));
}

export function recordKey(record: LifeRecordDraft): string {
  const normalizedTitle = foldAccents(record.value ?? record.title)
    .replace(/\b(anota|anotar|gaste|gasto|pague|pago|compre|compra|recordame|tengo|hay|en casa|hoy|manana|mañana|por la manana|por la mañana)\b/g, " ")
    .replace(/\d+(?:[.,]\d{1,2})?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return [
    record.domain,
    record.kind,
    record.amount ?? "",
    record.currency ?? "",
    foldAccents(record.person ?? ""),
    foldAccents(record.url ?? ""),
    normalizedTitle,
  ].join("|");
}

export function cleanupInventoryValue(text: string): string {
  return text
    .replace(/^(tengo|hay|en casa|para comer|comida)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanupTaskText(text: string): string {
  return sentenceCase(text.replace(/^(idea|anota esto|guardar esto|no quiero perder)\s*:?\s*/i, "").trim() || text);
}

export function isTaskLike(text: string): boolean {
  return /\b(tengo que|debo|necesito|prometi|recordar|recordame|recuerdame|acordame|comprar|mandar|enviar|llamar|escribir|preparar|buscar|busca|buscame|investiga|investigar|comparar|compara|comparame|dame|decime|dime)\b/i.test(foldAccents(text));
}

export function isPureAction(text: string): boolean {
  return /^\s*(tengo que|debo|necesito|prometi|recordar|recordame|recuerdame|acordame|comprar|mandar|enviar|llamar|escribir|preparar|buscar|busca|buscame|investiga|investigar|comparar|compara|comparame|dame|decime|dime)\b/i.test(foldAccents(text));
}

export function isDurableMemoryText(text: string): boolean {
  const lower = foldAccents(text);
  if (isPureAction(text)) return false;
  if (/^(debo|tengo que|necesito|recordar|mandar|enviar|llamar|comprar)\b/i.test(text)) return false;
  return includesAny(lower, [
    "soy",
    "trabajo",
    "siempre",
    "normalmente",
    "prefiero",
    "me gusta",
    "no me gusta",
    "quiero",
    "objetivo",
    "meta",
    "me cuesta",
    "me preocupa",
    "mi rutina",
    "cliente",
    "stock",
    "local",
  ]);
}

export function classifyMemoryKind(text: string): MemoryKind {
  const lower = foldAccents(text);
  if (includesAny(lower, ["no quiero", "no me gusta", "prefiero que no", "limite"])) return "boundary";
  if (includesAny(lower, ["quiero", "objetivo", "meta", "me gustaria"])) return "goal";
  if (includesAny(lower, ["rutina", "siempre", "normalmente", "todos los dias"])) return "routine";
  if (includesAny(lower, ["cliente", "stock", "proveedor", "local", "venta", "pedido"])) return "retail";
  if (includesAny(lower, ["ansiedad", "agotado", "quemado", "triste", "solo", "sola", "salud"])) return "wellbeing";
  if (relationshipNames.test(text)) {
    relationshipNames.lastIndex = 0;
    return "relationship";
  }
  relationshipNames.lastIndex = 0;
  if (includesAny(lower, ["prefiero", "me gusta", "odio", "me sirve"])) return "preference";
  return "profile";
}

export function isSensitive(text: string): boolean {
  const lower = foldAccents(text);
  return includesAny(lower, [
    "ansiedad",
    "depres",
    "salud",
    "medico",
    "dinero",
    "deuda",
    "pareja",
    "miedo",
    "crisis",
    "abuso",
    "solo",
    "sola",
  ]);
}

export function confidenceFor(text: string, sensitivity: MemorySensitivity): number {
  const lower = foldAccents(text);
  if (sensitivity === "sensitive") return 0.58;
  if (includesAny(lower, ["siempre", "prefiero", "mi rutina", "todos los dias"])) return 0.84;
  return 0.74;
}
