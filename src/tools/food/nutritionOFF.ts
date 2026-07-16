/**
 * Open Food Facts nutrition — sin API key.
 *
 * Endpoint:
 *   https://world.openfoodfacts.org/cgi/search.pl?search_terms={ING}
 *     &search_simple=1&action=process&json=1
 *
 * Devuelve productos con `nutriments` (por 100g). Promediamos los top 3
 * resultados con datos nutricionales válidos para devolver un valor
 * representativo del ingrediente buscado.
 *
 * Usado por recipeBlock para inyectar tiles de nutrición cuando el ingrediente
 * principal tiene datos en OFF.
 */

import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

export type NutritionInfo = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

type OffNutriments = {
  "energy-kcal_100g"?: number;
  "energy_100g"?: number; // kJ
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
};

type OffProduct = {
  product_name?: string;
  nutriments?: OffNutriments;
};

type OffSearchResponse = {
  count?: number;
  page?: number;
  products?: OffProduct[];
};

function kJtoKcal(kj: number): number {
  return Math.round(kj / 4.184);
}

function productNutrition(p: OffProduct): NutritionInfo | null {
  const n = p.nutriments;
  if (!n) return null;
  const kcal =
    typeof n["energy-kcal_100g"] === "number"
      ? n["energy-kcal_100g"]
      : typeof n["energy_100g"] === "number"
        ? kJtoKcal(n["energy_100g"])
        : undefined;
  const protein = n.proteins_100g;
  const carbs = n.carbohydrates_100g;
  const fat = n.fat_100g;
  if (
    typeof kcal !== "number" ||
    typeof protein !== "number" ||
    typeof carbs !== "number" ||
    typeof fat !== "number"
  ) {
    return null;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

/**
 * Trae info nutricional promedio (por 100g) de un ingrediente desde Open Food
 * Facts. Promedia hasta 3 productos con datos válidos.
 *
 * @param ingredient Nombre del ingrediente (ej: "arroz", "pollo", "yogur").
 * @returns NutritionInfo por 100g, o null si no hay datos.
 */
export async function fetchNutrition(
  ingredient: string,
): Promise<NutritionInfo | null> {
  const q = (ingredient ?? "").trim();
  if (!q) return null;

  const cacheKey = `off:nutrition:${q.toLowerCase()}`;
  return cached<NutritionInfo | null>(cacheKey, ttls.reference, async () => {
    await limiters.openFoodFacts.acquire();
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
      `&search_simple=1&action=process&json=1&page_size=10`;
    const res = await fetchJson<OffSearchResponse>(url, { timeoutMs: 10_000 });
    if (!res.ok || !res.data || !Array.isArray(res.data.products)) return null;

    const nutritions = res.data.products
      .map(productNutrition)
      .filter((n): n is NutritionInfo => n !== null)
      .slice(0, 3);
    if (nutritions.length === 0) return null;

    const avg: NutritionInfo = {
      kcal: Math.round(
        nutritions.reduce((s, n) => s + n.kcal, 0) / nutritions.length,
      ),
      protein:
        Math.round(
          (nutritions.reduce((s, n) => s + n.protein, 0) / nutritions.length) * 10,
        ) / 10,
      carbs:
        Math.round(
          (nutritions.reduce((s, n) => s + n.carbs, 0) / nutritions.length) * 10,
        ) / 10,
      fat:
        Math.round(
          (nutritions.reduce((s, n) => s + n.fat, 0) / nutritions.length) * 10,
        ) / 10,
    };
    return avg;
  });
}
