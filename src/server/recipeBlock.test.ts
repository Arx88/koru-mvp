import { describe, expect, it } from "vitest";
import { blocksFromToolResults } from "./blocksFromToolResults";

describe("recipe_find card mapping", () => {
  it("preserves proposal portions, times and provenance without inventing a source", () => {
    const ingredients = [{ ingredient: "garbanzos cocidos", measure: "400 g" }, { ingredient: "tomate", measure: "300 g" }, { ingredient: "huevos", measure: "2 unidades" }];
    const [card] = blocksFromToolResults([{ id: "recipe", name: "recipe_find", result: {
      type: "recipe_find", status: "ok", recipes: [{
        generated: true, name: "Garbanzos con tomate y huevos", servings: 2,
        prepTime: "5 min", cookTime: "15 min", description: "Propuesta de Michi · 2 porciones · 20 min estimados.",
        ingredients, instructions: "Calentar los garbanzos y el tomate.\nCocinar los huevos completamente.",
      }],
    } }]);
    expect(card).toMatchObject({ type: "recipe", servings: 2, prepTime: "5 min", cookTime: "15 min", ingredients,
      description: "Propuesta de Michi · 2 porciones · 20 min estimados.",
      steps: [{ step: 1, text: "Calentar los garbanzos y el tomate." }, { step: 2, text: "Cocinar los huevos completamente." }],
    });
    expect(card).not.toHaveProperty("source", expect.anything());
    expect(card).not.toHaveProperty("nutrition", expect.anything());
    expect(card).not.toHaveProperty("image", expect.anything());
  });
  it("retains TheMealDB attribution for retrieved recipes", () => {
    const [card] = blocksFromToolResults([{ id: "recipe", name: "recipe_find", result: {
      type: "recipe_find", status: "ok", recipes: [{ name: "Pasta", instructions: "Cook pasta." }],
    } }]);
    expect(card).toMatchObject({ type: "recipe", source: { title: "TheMealDB", url: "https://www.themealdb.com/" } });
  });
});
