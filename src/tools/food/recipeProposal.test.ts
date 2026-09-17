import { describe, expect, it, vi } from "vitest";
import { parseRecipeProposal, proposeRecipe } from "./recipeProposal";
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
  it("accepts object steps without weakening quantities or cooking checks", () => {
    const objectSteps = { ...recipe, steps: recipe.steps.map(step => ({ step })) };
    expect(parseRecipeProposal(JSON.stringify(objectSteps), query)?.instructions).toBe(recipe.steps.join("\n"));
    expect(parseRecipeProposal(JSON.stringify({ ...objectSteps, ingredients: [...recipe.ingredients, { ingredient: "Sal", measure: "al gusto" }] }), query)).toBeNull();
    expect(parseRecipeProposal(JSON.stringify({ ...objectSteps, steps: [{ step: "Calienta los garbanzos con el tomate." }, { step: "Cocina hasta que las claras estén cuajadas y las yemas sigan líquidas." }] }), query)).toBeNull();
  });
  it("requests one correction and validates the complete replacement", async () => {
    const chatFn = vi.fn()
      .mockResolvedValueOnce({ content: JSON.stringify({ ...recipe, ingredients: [...recipe.ingredients, { ingredient: "sal", measure: "al gusto" }] }) })
      .mockResolvedValueOnce({ content: JSON.stringify(recipe) });
    const result = await proposeRecipe(query, { state: createInitialState(), userInput: query, chatFn });
    expect(result).toHaveProperty("recipe.servings", 2);
    expect(chatFn).toHaveBeenCalledTimes(2);
    expect(chatFn.mock.calls[1][0][3].content).toContain("cantidades-invalidas");
  });
  it("stops after one rejected correction and exposes no raw provider error", async () => {
    const chatFn = vi.fn().mockResolvedValue({ content: "not JSON" });
    const result = await recipeFind.run({ query }, { state: createInitialState(), userInput: query, chatFn });
    expect(result).toMatchObject({ status: "unavailable", recipes: [], detail: "json-invalido" });
    expect(chatFn).toHaveBeenCalledTimes(2);
  });
  it("does not retry a provider refusal", async () => {
    const chatFn = vi.fn().mockResolvedValue({ content: '{"unavailable":true}' });
    expect(await proposeRecipe(query, { state: createInitialState(), userInput: query, chatFn })).toEqual({ error: "modelo-dijo-no-viable" });
    expect(chatFn).toHaveBeenCalledTimes(1);
  });
  it("does not fall back to unrelated search when the provider fails", async () => {
    const result = await recipeFind.run({ query }, { state: createInitialState(), userInput: query, chatFn: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(result).toMatchObject({ type: "recipe_find", status: "unavailable", recipes: [] });
  });
});
