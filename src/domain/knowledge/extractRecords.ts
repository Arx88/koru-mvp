import { cleanupShoppingTaskTitle, extractShoppingItems, hasShoppingIntent, isAvailabilityStatement } from "../intent";
import {
  cleanupInventoryValue,
  cleanupTaskText,
  dueHintFromText,
  extractAmount,
  extractUrl,
  inferCurrency,
  isExpenseCapture,
  isRetrievalQuestion,
  personFromText,
  recordKey,
  sentenceCase,
  splitIdeas,
  type LifeRecordDraft,
} from "./extractUtils";

export function extractLifeRecordsFromText(input: string): LifeRecordDraft[] {
  const records: LifeRecordDraft[] = [];
  if (isRetrievalQuestion(input)) return records;
  const ideas = splitIdeas(input);
  const all = [input, ...ideas];

  for (const idea of all) {
    const lower = foldAccents(idea);
    const amount = extractAmount(idea);
    const url = extractUrl(idea);
    const dueHint = dueHintFromText(idea);
    const person = personFromText(idea);
    const shoppingItems = extractShoppingItems(idea);

    if (amount && /\b(gaste|gast[eé]|pague|pagu[eé]|compre|compr[eé]|factura|alquiler|super|supermercado)\b/i.test(lower)) {
      records.push({
        domain: "money",
        kind: "expense",
        title: sentenceCase(idea),
        amount,
        currency: inferCurrency(idea),
        dueHint,
        notes: idea,
        tags: ["gasto"],
      });
    }

    if (/\b(medicamento|medicacion|pastilla|tomar|dosis|ibuprofeno|sertralina|turno medico|m[eé]dico)\b/i.test(lower)) {
      records.push({
        domain: "health",
        kind: lower.includes("turno") || lower.includes("medico") ? "medical_info" : "medication",
        title: sentenceCase(idea),
        value: amount ? String(amount) : undefined,
        dueHint,
        notes: idea,
        tags: ["salud"],
      });
    }

    if (/\b(dormi|dorm[ií]|sue[nñ]o|horas)\b/i.test(lower) && amount) {
      records.push({
        domain: "health",
        kind: "sleep",
        title: `Dormí ${amount} horas`,
        amount,
        notes: idea,
        tags: ["sueño"],
      });
    }

    if (shoppingItems.length > 0) {
      records.push({
        domain: "home",
        kind: "shopping_item",
        title: cleanupShoppingTaskTitle(idea),
        value: shoppingItems.join(", "),
        dueHint,
        notes: idea,
        tags: ["compras", "casa"],
      });
    }

    if (
      isAvailabilityStatement(idea) &&
      /\b(tengo para comer|hay en casa|heladera|nevera|freezer|despensa|arroz|pollo|pasta|verduras|huevos|leche)\b/i.test(lower)
    ) {
      records.push({
        domain: "home",
        kind: "meal_inventory",
        title: sentenceCase(idea),
        value: cleanupInventoryValue(idea),
        notes: idea,
        tags: ["comida"],
      });
    }

    if (url || /\b(herramienta|tool|link|enlace|me gusto|me gust[oó])\b/i.test(lower)) {
      records.push({
        domain: "work",
        kind: "tool_link",
        title: sentenceCase(idea.replace(url ?? "", "").trim() || url || idea),
        url,
        notes: idea,
        tags: ["herramienta"],
      });
    }

    if (/\b(reunion|reuni[oó]n|meeting|notas|minuta)\b/i.test(lower)) {
      records.push({
        domain: "work",
        kind: "meeting_note",
        title: sentenceCase(idea),
        person,
        dueHint,
        notes: idea,
        tags: ["reunion"],
      });
    }

    if (/\b(deadline|vence|entrega|fecha limite|fecha l[ií]mite)\b/i.test(lower)) {
      records.push({
        domain: "work",
        kind: "deadline",
        title: sentenceCase(idea),
        dueHint,
        notes: idea,
        tags: ["deadline"],
      });
    }

    if (/\b(cumple|cumplea[nñ]os)\b/i.test(lower)) {
      records.push({
        domain: "relationship",
        kind: "birthday",
        title: sentenceCase(idea),
        person,
        dueHint,
        notes: idea,
        tags: ["cumpleaños"],
      });
    }

    if (/\b(regalo|regale|regal[eé])\b/i.test(lower)) {
      records.push({
        domain: "relationship",
        kind: "gift",
        title: sentenceCase(idea),
        person,
        notes: idea,
        tags: ["regalo"],
      });
    }

    if (
      !isExpenseCapture(idea) &&
      !hasShoppingIntent(idea) &&
      /\b(plomero|fontanero|seguro|paquete|llega|lista del super|lista supermercado)\b/i.test(lower)
    ) {
      records.push({
        domain: "home",
        kind: "home_task",
        title: sentenceCase(idea),
        dueHint,
        notes: idea,
        tags: ["casa"],
      });
    }

    if (/\b(idea|no quiero perder|guardar esto|anota esto|captura)\b/i.test(lower)) {
      records.push({
        domain: "capture",
        kind: "idea",
        title: cleanupTaskText(idea),
        notes: idea,
        tags: ["idea"],
      });
    }

    if (/\b(serie|libro|restaurante|viaje|me recomendaron|quiero probar|empece|empec[eé])\b/i.test(lower)) {
      records.push({
        domain: "interest",
        kind: "recommendation",
        title: sentenceCase(idea),
        person,
        notes: idea,
        tags: ["interes"],
      });
    }

    if (/\b(decidir|decisi[oó]n|puedo permitirme|me conviene)\b/i.test(lower)) {
      records.push({
        domain: amount ? "money" : "capture",
        kind: "decision",
        title: sentenceCase(idea),
        amount,
        currency: inferCurrency(idea),
        notes: idea,
        tags: ["decision"],
      });
    }
  }

  const seen = new Set<string>();
  return records
    .filter((record) => {
      const key = recordKey(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
