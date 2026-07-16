// Wine pairing — heuristic mapping from recipe category / main ingredient
// to a suggested wine, with a short Spanish reason and a 0-1 pairing score.
// Pure function: no I/O, no side effects. Used by presentation.ts to render
// a "Maridaje" section inside recipe detail screens.

/**
 * Suggests a wine pairing for a recipe based on its category, area (cuisine)
 * and main ingredient. The function inspects a single lowercase string built
 * from `category` + `mainIngredient` and matches against keyword groups:
 * beef → Malbec, pasta/pizza → Chianti, fish/seafood → Albariño, etc.
 * Falls back to a versatile Tempranillo when nothing matches.
 */
export function suggestWinePairing(
  category: string,
  area?: string,
  mainIngredient?: string,
): { wine: string; reason: string; pairingScore: number } {
  const c = (category + " " + (mainIngredient ?? "")).toLowerCase();
  if (/beef|steak|carne|res/.test(c)) return { wine: "Malbec", reason: "Cuerpo para la carne roja", pairingScore: 0.9 };
  if (/pasta|pizza|italian/.test(c)) return { wine: "Chianti", reason: "Acidez corta la grasa del queso", pairingScore: 0.85 };
  if (/fish|seafood|pescado|marisc/.test(c)) return { wine: "Albariño", reason: "Frescor marino", pairingScore: 0.88 };
  if (/chicken|pollo/.test(c)) return { wine: "Chardonnay", reason: "Versatilidad", pairingScore: 0.8 };
  if (/dessert|postre|cake|dulce/.test(c)) return { wine: "Moscato", reason: "Dulzor complementa", pairingScore: 0.85 };
  if (/spicy|picante|curry|mexican|mexic/.test(c)) return { wine: "Riesling", reason: "Dulzor calma el picante", pairingScore: 0.82 };
  // area-based fallback before the generic Tempranillo
  const a = (area ?? "").toLowerCase();
  if (/mexic|india|thai|sushi|japonesa|japanese/.test(a)) return { wine: "Riesling", reason: "Dulzor calma el picante", pairingScore: 0.78 };
  return { wine: "Tempranillo", reason: "Versátil con comida mediterránea", pairingScore: 0.7 };
}
