import { describe, expect, it, vi } from "vitest";
import { parseRecipeProposal } from "./recipeProposal";
import { recipeFind } from "./recipes";
import { createInitialState } from "../../domain/store";

const query = "vegetariana para dos, lista en 20 minutos, con garbanzos, tomate y huevos";
const recipe = {
  name: "Garbanzos con tomate y huevos", servings: 2, prepMinutes: 5, cookMinutes: 15,
  ingredients: [{ ingredient: "garbanzos cocidos", measure: "400 g" }, { ingredient: "tomate", measure: "300 g" }, { ingredient: "huevos", measure: "2 unidades" }],
  steps: ["Calentar los garbanzos con el tomate en una sartén.", "Añadir los huevos y cocinar hasta que estén completamente cuajados."],
};
describe("recipe proposal validation", () => {
  it("accepts complete proposals and strips unsupported claims", () => {
    const parsed = parseRecipeProposal(JSON.stringify({ ...recipe, thumbnail: "https://fake.test/photo", nutrition: { kcal: 10 }, source: "TheMealDB" }), query);
    expect(parsed).toMatchObject({ generated: true, servings: 2, prepTime: "5 min", cookTime: "15 min" });
    expect(parsed).not.toHaveProperty("nutrition");
    expect(parsed).not.toHaveProperty("thumbnail");
    expect(parsed).not.toHaveProperty("source");
  });
  it.each([
    { ...recipe, servings: 4 },
    { ...recipe, cookMinutes: 30 },
    { ...recipe, ingredients: recipe.ingredients.slice(1) },
    { ...recipe, ingredients: [...recipe.ingredients, { ingredient: "pollo", measure: "200 g" }] },
    { ...recipe, ingredients: recipe.ingredients.map(i => ({ ...i, measure: "a gusto" })) },
    { ...recipe, steps: [] },
  ])("rejects incomplete or conflicting proposals", invalid => {
    expect(parseRecipeProposal(JSON.stringify(invalid), query)).toBeNull();
  });
  it("rejects invalid JSON and dairy/eggs in vegan requests", () => {
    expect(parseRecipeProposal("not JSON", query)).toBeNull();
    expect(parseRecipeProposal(JSON.stringify(recipe), query.replace("vegetariana", "vegana"))).toBeNull();
  });
  it("does not fall back to unrelated search when the provider fails", async () => {
    const result = await recipeFind.run({ query }, { state: createInitialState(), userInput: query, chatFn: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(result).toMatchObject({ type: "recipe_find", status: "unavailable", recipes: [] });
  });
});
