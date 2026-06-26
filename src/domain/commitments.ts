import type { Commitment } from "./types";

export type CommitmentIdentity = Pick<Commitment, "title" | "dueHint">;

const ACTION_ALIASES: Array<[RegExp, string]> = [
  [/\b(mandar|enviar|pasar)\b/g, "enviar"],
  [/\b(contactar|hablar|telefonear)\b/g, "llamar"],
  [/\b(comprar|buscar precio|comparar precio)\b/g, "comprar"],
  [/\b(preparar|armar|hacer|crear)\b/g, "preparar"],
  [/\b(revisar|chequear|verificar)\b/g, "revisar"],
];

const STOP_WORDS = new Set([
  "a",
  "al",
  "algo",
  "con",
  "de",
  "del",
  "el",
  "en",
  "esto",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "mis",
  "para",
  "por",
  "que",
  "recordame",
  "recuerdame",
  "acordame",
  "un",
  "una",
  "y",
]);

export function foldAccents(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function compactWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function canonicalDueHint(dueHint: string): string {
  const normalized = foldAccents(dueHint);
  if (/\b(hoy|ahora|urgente|esta tarde|esta noche)\b/.test(normalized)) return "hoy";
  if (/\b(manana|proximo dia|siguiente dia)\b/.test(normalized)) return "manana";
  if (/\b(reunion|cita|turno)\b/.test(normalized)) return "evento";
  return "sin fecha";
}

function stripTaskPrefixes(text: string): string {
  return text
    .replace(/\b(tengo que|debo|necesito|prometi|prometi que|recordar|recordame|recuerdame|acordame|acordarme de|hay que|me falta|falto|pendiente de|sumar|agregar|anadir|poner)\b/g, " ")
    .replace(/\b(para manana|manana|hoy|ahora|urgente|esta tarde|esta noche|a las \d{1,2}(?::\d{2})?)\b/g, " ");
}

function normalizeActions(text: string): string {
  return ACTION_ALIASES.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function tokenizeCore(text: string): string[] {
  return compactWhitespace(normalizeActions(stripTaskPrefixes(foldAccents(text))))
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function canonicalCommitmentCore(title: string): string {
  const tokens = tokenizeCore(title);
  const set = new Set(tokens);

  if (set.has("proveedor") && (set.has("llamar") || set.has("mensaje") || set.has("enviar"))) {
    return "contactar proveedor";
  }
  if (set.has("presupuesto") && (set.has("enviar") || set.has("mandar") || set.has("preparar"))) {
    return `${set.has("preparar") ? "preparar" : "enviar"} presupuesto`;
  }
  if (set.has("reunion")) {
    const person = tokens.find((token) => !["reunion", "preparar", "confirmar"].includes(token));
    return person ? `reunion ${person}` : "reunion";
  }
  if (set.has("stock") || set.has("reposicion")) {
    return "revisar stock";
  }
  if (set.has("comprar")) {
    const item = tokens.find((token) => !["comprar", "lista", "super", "supermercado"].includes(token));
    return item ? `comprar ${item}` : "comprar";
  }

  return tokens.slice(0, 8).join(" ") || compactWhitespace(foldAccents(title));
}

export function commitmentIdentityKey(commitment: CommitmentIdentity): string {
  return canonicalCommitmentCore(commitment.title);
}

function duePriority(dueHint: string): number {
  const canonical = canonicalDueHint(dueHint);
  if (canonical === "hoy") return 3;
  if (canonical === "manana" || canonical === "evento") return 2;
  return 1;
}

export function mergeDueHint(existing: string, incoming: string): string {
  if (duePriority(incoming) > duePriority(existing)) return incoming.trim() || existing;
  if (canonicalDueHint(existing) === "sin fecha" && incoming.trim()) return incoming.trim();
  return existing;
}

export function uniqueCommitmentList<T extends CommitmentIdentity>(commitments: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const commitment of commitments) {
    const key = commitmentIdentityKey(commitment);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, commitment);
      continue;
    }
    byKey.set(key, {
      ...existing,
      dueHint: mergeDueHint(existing.dueHint, commitment.dueHint),
    });
  }
  return Array.from(byKey.values());
}
