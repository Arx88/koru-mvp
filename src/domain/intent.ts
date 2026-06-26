import { foldAccents } from "./commitments";

const SHOPPING_ACTION_RE =
  /\b(comprar|compra|comprame|agregar|agrega|sumar|suma|anadir|anade|poner|pon|reponer|reposicion|me falta|faltan|falta|lista del super|lista supermercado|supermercado)\b/i;

const TASK_CUE_RE =
  /\b(tengo que|debo|necesito|prometi|recordar|recordame|recuerdame|acordarme|acordame|no me dejes olvidar|reunion|reuniones|cita|turno|comprar|mandar|enviar|llamar|escribir|preparar|hablar|comparar|lanzar|revisar|buscar|hacer seguimiento)\b/i;

const SHOPPING_STOP_WORDS = new Set([
  "a",
  "acordame",
  "agrega",
  "agregar",
  "al",
  "anade",
  "anadir",
  "comprar",
  "compra",
  "comprame",
  "de",
  "debo",
  "del",
  "el",
  "en",
  "falta",
  "faltan",
  "hoy",
  "la",
  "las",
  "lista",
  "lo",
  "los",
  "manana",
  "me",
  "mi",
  "necesito",
  "no",
  "olvidar",
  "para",
  "pon",
  "poner",
  "que",
  "recordame",
  "recuerdame",
  "reponer",
  "reposicion",
  "super",
  "supermercado",
  "tengo",
  "una",
  "y",
]);

const HOUSEHOLD_ITEMS = [
  "aceite",
  "agua",
  "arroz",
  "avena",
  "azucar",
  "cafe",
  "carne",
  "cereal",
  "detergente",
  "fruta",
  "galletas",
  "huevos",
  "jabon",
  "leche",
  "limon",
  "pan",
  "papel",
  "pasta",
  "pollo",
  "queso",
  "sal",
  "servilletas",
  "tomate",
  "verduras",
  "yerba",
  "yogur",
];

const EXPENSE_CUE_RE =
  /\b(anota(?:r)?\s+gasto|gaste|gast[eé]|pague|pagu[eé]|factura|alquiler|recibo|cuota)\b/i;

const MONEY_DECISION_RE =
  /\b(puedo\s+permitirme|me\s+conviene|decidir|decision|decisi[oó]n|vale\s+la\s+pena|comprarlo|permitir)\b/i;

const ALARM_OR_TIME_CUE_RE =
  /\b(alarma|despertador|temporizador|timer|avisame\s+a\s+las|av[ií]same\s+a\s+las|recordatorio\s+a\s+las)\b/i;

function compact(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function hasTaskCue(text: string): boolean {
  return TASK_CUE_RE.test(foldAccents(text));
}

export function hasShoppingIntent(text: string): boolean {
  const lower = foldAccents(text);
  if (EXPENSE_CUE_RE.test(lower) || MONEY_DECISION_RE.test(lower) || ALARM_OR_TIME_CUE_RE.test(lower)) return false;
  const explicitListCue =
    /\b(lista del super|lista supermercado|a la lista|supermercado|super|agregar|agrega|sumar|suma|anadir|anade|reponer|reposicion|me falta|faltan|falta)\b/i.test(lower);
  const hasHouseholdItem = HOUSEHOLD_ITEMS.some((item) => new RegExp(`\\b${item}\\b`, "i").test(lower));
  const householdActionCue = /\b(recordame|recuerdame|acordame|necesito|tengo que|comprar|compra|poner|pon)\b/i.test(lower);
  if (explicitListCue) return true;
  return hasHouseholdItem && householdActionCue && SHOPPING_ACTION_RE.test(lower);
}

function normalizeShoppingText(text: string): string {
  return foldAccents(text)
    .replace(/\b(no me dejes olvidar|recordame que|recuerdame que|acordame que|me tengo que|tengo que|hay que|debo|necesito)\b/g, " ")
    .replace(/\b(agregar|agrega|sumar|suma|anadir|anade|poner|pon|comprar|compra|comprame|reponer|reposicion|me falta|faltan|falta)\b/g, " ")
    .replace(/\b(a la lista|lista del super|lista supermercado|en el super|en supermercado|para casa|en casa|hoy|manana)\b/g, " ")
    .replace(/[^\p{L}0-9,\sy]+/gu, " ");
}

export function extractShoppingItems(text: string): string[] {
  if (!hasShoppingIntent(text)) return [];
  const normalized = normalizeShoppingText(text);
  const explicit = HOUSEHOLD_ITEMS.filter((item) => new RegExp(`\\b${item}\\b`, "i").test(normalized));
  const inferred = normalized
    .split(/,|\by\b/i)
    .map((part) =>
      compact(part)
        .split(/\s+/)
        .filter((token) => token.length > 1 && !SHOPPING_STOP_WORDS.has(token))
        .join(" "),
    )
    .filter((part) => part.length > 1 && !/^(casa|lista|super)$/.test(part));

  return Array.from(new Set([...explicit, ...inferred])).slice(0, 8);
}

export function cleanupShoppingTaskTitle(text: string): string {
  const items = extractShoppingItems(text);
  if (items.length > 0) return `Comprar ${items.join(", ")}`;
  return compact(
    text
      .replace(/^\s*(recordame que|recuerdame que|acordame que|recordame|recuerdame|acordame|tengo que|debo|necesito|hay que)\s+/i, "")
      .replace(/^\s*que\s+/i, ""),
  );
}

export function isAvailabilityStatement(text: string): boolean {
  const lower = foldAccents(text);
  if (hasShoppingIntent(text) || /\b(no tengo|ya no tengo|se acabo|se termino|me falta|faltan|comprar)\b/i.test(lower)) {
    return false;
  }
  return /\b(tengo|hay|queda|quedan|disponible|en casa|heladera|nevera|freezer|despensa|para comer)\b/i.test(lower);
}

export function isNewsIntent(text: string): boolean {
  return /\b(noticia|noticias|actualidad|ultimas novedades|que paso hoy|tendencias)\b/i.test(foldAccents(text));
}

export function isWorldSignalIntent(text: string): boolean {
  const lower = foldAccents(text);
  return /\b(el mundo|mundo|se esta hablando|estan hablando|que se habla|de que hablan|tendencia|tendencias|radar|me entere|enterarme|te enteraste|que esta pasando|que paso hoy|senales|señales)\b/i.test(lower);
}
