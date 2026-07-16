// ============================================================================
// aisleMap — Mapeo de categorías de supermercado a pasillos ordenados, para
// reordenar listas de compras según el recorrido típico de un supermercado.
//
// AISLE_ORDER define el orden en que se encuentran los pasillos al entrar al
// supermercado (frutas y verduras al frente, congelados al fondo, etc.).
// categorizeItem usa keyword matching simple (regex) para clasificar items
// sin categoría. sortItemsByAisle reordena un array de items por pasillo.
// ============================================================================

/** Orden de pasillos (menor = más cerca de la entrada). */
export const AISLE_ORDER: Record<string, number> = {
  frutas: 1,
  verduras: 2,
  panaderia: 3,
  lacteos: 4,
  carnes: 5,
  pescado: 6,
  congelados: 7,
  bebidas: 8,
  snacks: 9,
  limpieza: 10,
  higiene: 11,
  otros: 12,
};

/** Etiquetas legibles (español) para cada categoría, usadas como headers. */
export const AISLE_LABEL: Record<string, string> = {
  frutas: "Frutas y Verduras",
  verduras: "Frutas y Verduras",
  panaderia: "Panadería",
  lacteos: "Lácteos y Huevos",
  carnes: "Carnes",
  pescado: "Pescadería",
  congelados: "Congelados",
  bebidas: "Bebidas",
  snacks: "Snacks y Golosinas",
  limpieza: "Limpieza",
  higiene: "Higiene",
  otros: "Otros",
};

/**
 * Clasifica un item por nombre en una de las 12 categorías usando regex de
 * keywords comunes en español. Si no matchea, devuelve "otros".
 *
 * Normaliza acentos (NFD) antes de matchear para que "jabón" → "jabon" y
 * matchee el keyword "jabon".
 */
export function categorizeItem(name: string): string {
  const lower = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/manzana|banana|naranja|frut|uva|pera|kiwi|sandia|melon|anana|pina|durazno|ciruela|limon|mandarina/.test(lower)) return "frutas";
  if (/lechuga|tomate|cebolla|papa|verd|zanah|espinaca|acelga|brocoli|zapallo|pimiento|morro|aji|berenjena|puerro/.test(lower)) return "verduras";
  if (/pan|factur|croissant|masa|bisco|bizcoch|medialuna|pebetes|chipa/.test(lower)) return "panaderia";
  if (/leche|queso|yogur|mantequilla|huevo|crema|ricota|dulce de leche/.test(lower)) return "lacteos";
  if (/carne|pollo|res|cerdo|milanesa|bife|chorizo|salchicha|jamon|tocino|panceta/.test(lower)) return "carnes";
  if (/pescado|merluza|atun|salmon|calamar|camaron|langostino|mejillon|bacalao/.test(lower)) return "pescado";
  if (/helado|congel|frozen|pizza congel|hamburguesa congel|papas fritas/.test(lower)) return "congelados";
  if (/agua|gaseosa|jugo|vino|cerveza|cafe|te|sidra|champagne|sprite|coca|fanta|whisky|gin|vodka/.test(lower)) return "bebidas";
  if (/chocolate|galletita|chip|snack|caramelo|alfajor|chicle|postre|barra cereal/.test(lower)) return "snacks";
  if (/jabon|detergente|limpi|papel|serville|lavandina|suavizante|desodorante ambiente|esponja/.test(lower)) return "limpieza";
  if (/shampoo|pasta|cepillo|papel higien|acondicionador|jabon de tocador|coton|desodorante personal|afeitadora|maquillaje/.test(lower)) return "higiene";
  return "otros";
}

/**
 * Devuelve el orden de pasillo de una categoría (default 99 si no está en
 * el mapa, para que aparezca al final).
 */
export function aisleOrderFor(category: string): number {
  return AISLE_ORDER[category] ?? 99;
}

/**
 * Devuelve la etiqueta legible de una categoría (default "Otros").
 */
export function aisleLabelFor(category: string): string {
  return AISLE_LABEL[category] ?? "Otros";
}

/**
 * Reordena un array de items por pasillo. Si un item no tiene `category`,
 * se categoriza por nombre. Estable (preserva el orden relativo de items
 * del mismo pasillo).
 */
export function sortItemsByAisle<T extends { name: string; category?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const catA = a.category || categorizeItem(a.name);
    const catB = b.category || categorizeItem(b.name);
    return (AISLE_ORDER[catA] ?? 99) - (AISLE_ORDER[catB] ?? 99);
  });
}

/**
 * Agrupa items por categoría (preservando el orden de pasillo). Útil para
 * renderizar listas con headers de sección por pasillo.
 */
export function groupItemsByAisle<T extends { name: string; category?: string }>(
  items: T[],
): Array<{ category: string; label: string; items: T[] }> {
  const sorted = sortItemsByAisle(items);
  const groups: Array<{ category: string; label: string; items: T[] }> = [];
  for (const it of sorted) {
    const cat = it.category || categorizeItem(it.name);
    const last = groups[groups.length - 1];
    if (last && last.category === cat) {
      last.items.push(it);
    } else {
      groups.push({ category: cat, label: aisleLabelFor(cat), items: [it] });
    }
  }
  return groups;
}
