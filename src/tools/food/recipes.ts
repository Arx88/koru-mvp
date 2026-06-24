/**
 * Bloque Food — Recetas, info nutricional, vino, cálculo de macros.
 * APIs: TheMealDB (key pública "1"), Open Food Facts (sin key), USDA.
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import type { LifeRecord } from "../../domain/types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

const MEALDB_KEY = "1"; // key pública gratuita.
const MEALDB_BASE = `https://www.themealdb.com/api/json/v1/${MEALDB_KEY}`;

type MealDbMeal = {
  idMeal?: string;
  strMeal?: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strMealThumb?: string;
  strYoutube?: string;
  [k: string]: unknown; // strIngredient1..20, strMeasure1..20
};

function extractIngredients(meal: MealDbMeal): Array<{ ingredient: string; measure: string }> {
  const out: Array<{ ingredient: string; measure: string }> = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const meas = meal[`strMeasure${i}`];
    if (typeof ing === "string" && ing.trim()) {
      out.push({ ingredient: ing.trim(), measure: typeof meas === "string" ? meas.trim() : "" });
    }
  }
  return out;
}

// ─── recipe_find ────────────────────────────────────────────────────────────
export const recipeFind: ToolHandler = {
  definition: defineTool(
    "recipe_find",
    "Busca recetas por nombre, tipo de cocina o categoría. Úsala cuando el usuario diga 'receta de carbonara', 'algo con pollo', 'postre sin horno', 'plato italiano'. Devuelve ingredientes y pasos.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Nombre de plato o categoría (ej: 'carbonara', 'arrabiata', 'Seafood')." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee recetas públicas."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "recipe_find", status: "failed", error: "Indicá qué receta." };

    const cacheKey = `recipe:${query.toLowerCase()}`;
    const meals = await cached<MealDbMeal[]>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<{ meals?: MealDbMeal[] }>(
        `${MEALDB_BASE}/search.php?s=${encodeURIComponent(query)}`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.meals ?? [];
    });

    if (meals.length === 0) {
      return { type: "recipe_find", status: "ok", query, recipes: [], note: `No encontré recetas para "${query}".` };
    }

    return {
      type: "recipe_find",
      status: "ok",
      query,
      recipes: meals.slice(0, 5).map((m) => ({
        name: m.strMeal,
        category: m.strCategory,
        area: m.strArea,
        ingredients: extractIngredients(m),
        instructions: m.strInstructions,
        thumbnail: m.strMealThumb,
        videoUrl: m.strYoutube,
      })),
      source: "TheMealDB",
      sourceUrl: "https://www.themealdb.com/",
    };
  },
};

// ─── recipe_by_ingredients ──────────────────────────────────────────────────
export const recipeByIngredients: ToolHandler = {
  definition: defineTool(
    "recipe_by_ingredients",
    "Busca recetas que puedas hacer con los ingredientes que ya tienes. Úsala cuando el usuario diga 'tengo huevos, pan y queso', 'con zanahoria y arnés', 'qué cocino con lo que tengo en heladera'. Reduce desperdicio.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        ingredients: { type: "array", items: { type: "string" }, description: "Lista de ingredientes disponibles." },
      },
      required: ["ingredients"],
    },
  ),
  policy: policies.readonly("Busca recetas por ingredientes."),
  async run(args) {
    const list = Array.isArray(args.ingredients) ? args.ingredients.map(String).filter(Boolean) : [];
    if (list.length === 0) return { type: "recipe_by_ingredients", status: "failed", error: "Indicá los ingredientes." };
    // TheMealDB soporta filtro por 1 ingrediente principal.
    const main = list[0];
    const cacheKey = `recipe_ing:${main.toLowerCase()}`;
    const meals = await cached<MealDbMeal[]>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<{ meals?: MealDbMeal[] }>(
        `${MEALDB_BASE}/filter.php?i=${encodeURIComponent(main)}`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.meals ?? [];
    });
    return {
      type: "recipe_by_ingredients",
      status: "ok",
      ingredients: list,
      recipes: meals.slice(0, 8).map((m) => ({ name: m.strMeal, thumbnail: m.strMealThumb })),
      note: `Recetas con "${main}". Revisa que tengas los demás ingredientes.`,
      source: "TheMealDB",
    };
  },
};

// ─── recipe_save ────────────────────────────────────────────────────────────
export const recipeSave: ToolHandler = {
  definition: defineTool(
    "recipe_save",
    "Guarda una receta para consultarl después. Úsala cuando el usuario diga 'guardá esa carbonara', 'esta de tortilla dejala', 'guardo esa receta'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        ingredients: { type: "array", items: { type: "string" } },
        steps: { type: "string", description: "Instrucciones." },
        source: { type: "string", description: "Origen (URL o nombre)." },
      },
      required: ["title"],
    },
  ),
  policy: policies.localWrite("Guarda receta como record."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    if (!title) return { type: "recipe_save", status: "failed", error: "Indicá el título." };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "home",
      kind: "recommendation",
      title: `Receta: ${title}`,
      value: Array.isArray(args.ingredients) ? args.ingredients.join(", ") : undefined,
      notes: args.steps ? String(args.steps) : undefined,
      url: args.source ? String(args.source) : undefined,
      collection: "Recetas",
    };
    return {
      type: "recipe_save",
      status: "ok",
      title,
      records: [record],
      block: { type: "saved_record", title: "Receta guardada", records: [record] },
    };
  },
};

// ─── recipe_show ────────────────────────────────────────────────────────────
export const recipeShow: ToolHandler = {
  definition: defineTool(
    "recipe_show",
    "Muestra una receta guardada anteriormente. Úsala cuando el usuario diga 'mostrame la receta del flan que guardé', 'cuál era esa de tortilla'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Parte del nombre de la receta guardada." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee receta guardada."),
  async run(args, ctx: ToolRunContext) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "recipe_show", status: "failed", error: "Indicá qué receta buscar." };
    const matches = (ctx.state.records ?? [])
      .filter((r) => r.collection === "Recetas" && r.title.toLowerCase().includes(q))
      .slice(-5)
      .map((r) => ({ title: r.title, ingredients: r.value, steps: r.notes, source: r.url }));
    if (matches.length === 0) {
      return { type: "recipe_show", status: "ok", query: args.query, recipes: [], note: "No encontré esa receta guardada." };
    }
    return { type: "recipe_show", status: "ok", query: args.query, recipes: matches };
  },
};

// ─── food_info ──────────────────────────────────────────────────────────────
export const foodInfo: ToolHandler = {
  definition: defineTool(
    "food_info",
    "Info nutricional y de ingredientes de un producto por código de barras. Úsala cuando el usuario diga 'qué tiene este yogurt del código 7622210449284', 'ingredientes de este producto', 'alérgenos del barcode X'. Datos abiertos de Open Food Facts.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        barcode: { type: "string", description: "Código de barras (EAN/UPC)." },
      },
      required: ["barcode"],
    },
  ),
  policy: policies.readonly("Lee producto de Open Food Facts."),
  async run(args) {
    const barcode = String(args.barcode ?? "").replace(/\D/g, "");
    if (!barcode) return { type: "food_info", status: "failed", error: "Indicá el código de barras." };

    const cacheKey = `off:${barcode}`;
    const product = await cached<{
      product_name?: string;
      brands?: string;
      ingredients_text?: string;
      allergens?: string;
      nutriments?: Record<string, number>;
      nutriscore_grade?: string;
      image_url?: string;
      status?: number;
      status_verbose?: string;
    }>(cacheKey, ttls.reference, async () => {
      await limiters.openFoodFacts.acquire();
      const r = await fetchJson<{ product?: typeof product; status?: number }>(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.product ?? {};
    });

    if (!product.product_name) {
      return { type: "food_info", status: "ok", barcode, note: `Producto ${barcode} no encontrado en la base.` };
    }

    return {
      type: "food_info",
      status: "ok",
      barcode,
      name: product.product_name,
      brand: product.brands,
      ingredients: product.ingredients_text,
      allergens: product.allergens,
      nutriScore: product.nutriscore_grade?.toUpperCase(),
      nutrition: product.nutriments ? {
        energyKcal100g: product.nutriments["energy-kcal_100g"],
        fat100g: product.nutriments.fat_100g,
        sugars100g: product.nutriments.sugars_100g,
        salt100g: product.nutriments.salt_100g,
        proteins100g: product.nutriments.proteins_100g,
      } : undefined,
      imageUrl: product.image_url,
      source: "Open Food Facts",
      sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    };
  },
};

// ─── wine_pairing ───────────────────────────────────────────────────────────
export const winePairing: ToolHandler = {
  definition: defineTool(
    "wine_pairing",
    "Sugiere un vino para acompañar una comida. Úsala cuando el usuario diga 'qué vino va con cordero', 'tinto para pasta', 'maridaje para salmón'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        food: { type: "string", description: "Comida (ej: 'cordero', 'pasta', 'salmón')." },
        color: { type: "string", enum: ["red", "white", "rosé", "any"], default: "any" },
      },
      required: ["food"],
    },
  ),
  policy: policies.readonly("Reglas locales de maridaje."),
  async run(args) {
    const food = String(args.food ?? "").trim().toLowerCase();
    if (!food) return { type: "wine_pairing", status: "failed", error: "Indicá la comida." };

    const pairings: Array<{ match: RegExp; wines: string[] }> = [
      { match: /cordero|chivo|venado|caza|parrilla|asado|carne roja|res/i, wines: ["Malbec", "Cabernet Sauvignon", "Tempranillo"] },
      { match: /pasta|lasaña|risotto|hongos|setas/i, wines: ["Barolo", "Sangiovese", "Chianti"] },
      { match: /salmón|atún|pescado azul|sushi/i, wines: ["Pinot Noir", "Chardonnay", "Sauvignon Blanc"] },
      { match: /marisco|gamba|langostino|ostra|ceviche/i, wines: ["Albariño", "Sauvignon Blanc", "Champagne Brut"] },
      { match: /pollo|pavo|ave/i, wines: ["Chardonnay", "Pinot Noir", "Tempranillo joven"] },
      { match: /queso|tabla de quesos/i, wines: ["Rioja", "Malbec", "Port"] },
      { match: /postre|chocolate|frutilla|frutas/i, wines: ["Moscatel", "Sauternes", "Oporto"] },
      { match: /picante|curry|india|tailandesa/i, wines: ["Riesling", "Gewürztraminer"] },
      { match: /pescado blanco|merluza|lenguado/i, wines: ["Verdejo", "Sauvignon Blanc", "Albariño"] },
    ];
    const found = pairings.find((p) => p.match.test(food));
    const wines = found?.wines ?? ["Pinot Noir", "Chardonnay", "Malbec"];
    const filtered = args.color && args.color !== "any"
      ? wines // Sin base de datos real; mantenemos la sugerencia genérica.
      : wines;
    return {
      type: "wine_pairing",
      status: "ok",
      food,
      color: args.color ?? "any",
      suggestions: filtered,
      note: found ? "Sugerencias basadas en reglas clásicas de maridaje." : "No tengo match específico; estas son sugerencias versátiles.",
    };
  },
};

// Tabla local aproximada de valores nutricionales por 100g.
const NUTRITION_TABLE: Record<string, { kcal: number; protein: number; carbs: number; fat: number }> = {
  "huevo": { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  "pollo": { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  "carne": { kcal: 250, protein: 26, carbs: 0, fat: 17 },
  "pescado": { kcal: 206, protein: 22, carbs: 0, fat: 12 },
  "arroz": { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  "pasta": { kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  "pan": { kcal: 265, protein: 9, carbs: 49, fat: 3.2 },
  "leche": { kcal: 42, protein: 3.4, carbs: 5, fat: 1 },
  "queso": { kcal: 402, protein: 25, carbs: 1.3, fat: 33 },
  "yogur": { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  "manzana": { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  "banana": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "aceite": { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  "azúcar": { kcal: 387, protein: 0, carbs: 100, fat: 0 },
  "miel": { kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  "garbanzos": { kcal: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  "lentejas": { kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  "papa": { kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  "tomate": { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  "zanahoria": { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  "cebolla": { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  "espinaca": { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  "brócoli": { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  "palta": { kcal: 160, protein: 2, carbs: 9, fat: 15 },
  "aceitunas": { kcal: 115, protein: 0.8, carbs: 6, fat: 11 },
  "chocolate": { kcal: 546, protein: 4.9, carbs: 61, fat: 31 },
  "avena": { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  "mantequilla": { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  "mayonesa": { kcal: 680, protein: 1, carbs: 0.6, fat: 75 },
  "ketchup": { kcal: 112, protein: 1, carbs: 26, fat: 0.2 },
  "tortilla": { kcal: 218, protein: 10, carbs: 25, fat: 8 },
  "empanada": { kcal: 295, protein: 9, carbs: 28, fat: 16 },
  "milanesa": { kcal: 246, protein: 22, carbs: 11, fat: 13 },
  "hamburguesa": { kcal: 295, protein: 17, carbs: 30, fat: 12 },
  "pizza": { kcal: 266, protein: 11, carbs: 33, fat: 10 },
  "helado": { kcal: 207, protein: 3.5, carbs: 24, fat: 11 },
};

function parseQuantity(input: string): { factor: number; unit: string; original: string } {
  const s = input.trim().toLowerCase();
  const match = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gramo|gramos|kg|kilo|kilos|ml|litro|litros|unidad|unidades|taza|tazas|cdita|cditas|cda|cucharada|cucharadas|cucharadita|cucharaditas|porción|porciones|rodaja|rodajas|plato|platos|rebanada|rebanadas)?$/i);
  if (!match) return { factor: 1, unit: "porción", original: s || "100g" };
  const val = parseFloat(match[1]);
  const unit = (match[2] ?? "").toLowerCase();
  const unitMap: Record<string, number> = {
    g: 1, gr: 1, gramo: 1, gramos: 1,
    kg: 1000, kilo: 1000, kilos: 1000,
    ml: 1, litro: 1000, litros: 1000,
    unidad: 55, unidades: 55,
    taza: 240, tazas: 240,
    cdita: 5, cditas: 5, cucharadita: 5, cucharaditas: 5,
    cda: 15, cucharada: 15, cucharadas: 15,
    porción: 150, porciones: 150,
    rodaja: 30, rodajas: 30,
    plato: 300, platos: 300,
    rebanada: 30, rebanadas: 30,
  };
  const grams = unitMap[unit] ?? 100;
  const factor = (val * grams) / 100;
  return { factor, unit, original: s };
}

function bestMatch(food: string): string | null {
  const q = food.toLowerCase().trim();
  if (NUTRITION_TABLE[q]) return q;
  for (const k of Object.keys(NUTRITION_TABLE)) {
    if (k.includes(q) || q.includes(k)) return k;
  }
  const words = q.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const k of Object.keys(NUTRITION_TABLE)) {
      if (k.includes(word)) return k;
    }
  }
  return null;
}

// ─── nutrition_calc ─────────────────────────────────────────────────────────
export const nutritionCalc: ToolHandler = {
  definition: defineTool(
    "nutrition_calc",
    "Calcula calorías y macros aproximados de un alimento o comida. Úsala cuando el usuario diga 'cuántas calorías tiene esa carbonara', 'macros del pollo', 'cuánto aporta un huevo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        food: { type: "string", description: "Alimento o comida (ej: 'huevo', '1 taza de arroz', 'porción de pizza')." },
        quantity: { type: "string", description: "Cantidad opcional (ej: '100g', '2 unidades')." },
      },
      required: ["food"],
    },
  ),
  policy: policies.readonly("Cálculo nutricional aproximado."),
  async run(args) {
    const food = String(args.food ?? "").trim();
    const quantity = String(args.quantity ?? "").trim();
    if (!food) return { type: "nutrition_calc", status: "failed", error: "Indicá el alimento." };

    const match = bestMatch(food);
    if (!match) {
      return {
        type: "nutrition_calc",
        status: "ok",
        food,
        quantity,
        note: `No tengo datos nutricionales para "${food}". Probá con un alimento más común (ej: pollo, arroz, huevo).`,
        items: [],
        block: { type: "data_card", title: food, items: [{ label: "Sin datos", value: "Alimento no encontrado", detail: "Usá un nombre más común" }] },
      };
    }

    const base = NUTRITION_TABLE[match];
    const q = parseQuantity(quantity || "100g");
    const kcal = Math.round(base.kcal * q.factor);
    const protein = Math.round(base.protein * q.factor * 10) / 10;
    const carbs = Math.round(base.carbs * q.factor * 10) / 10;
    const fat = Math.round(base.fat * q.factor * 10) / 10;

    return {
      type: "nutrition_calc",
      status: "ok",
      food,
      matchedFood: match,
      quantity: q.original,
      note: `Valores aproximados para ${q.original} de ${match} (base 100g: ${base.kcal} kcal, ${base.protein}g prot, ${base.carbs}g carb, ${base.fat}g grasa).`,
      items: [
        { label: "Calorías", value: `${kcal} kcal` },
        { label: "Proteínas", value: `${protein} g` },
        { label: "Carbohidratos", value: `${carbs} g` },
        { label: "Grasas", value: `${fat} g` },
      ],
      block: {
        type: "data_card",
        title: `${match} — ${q.original}`,
        items: [
          { label: "Calorías", value: `${kcal} kcal`, detail: "aprox." },
          { label: "Proteínas", value: `${protein} g`, detail: "aprox." },
          { label: "Carbohidratos", value: `${carbs} g`, detail: "aprox." },
          { label: "Grasas", value: `${fat} g`, detail: "aprox." },
        ],
      },
    };
  },
};
