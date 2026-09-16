import { describe, expect, it } from "vitest";
import { recipeShow } from "../../tools/food/recipes";
import type { ToolRunContext } from "../../tools/types";
import { normalizeFinalPayload } from "./finalizePayload";

const state = { memories: [], commitments: [], records: [{
  id: "recipe-1", title: "Receta: Tortilla", collection: "Recetas",
  value: "2 huevos, sal", notes: "Batir los huevos.\nCocinar en la sartén.",
  url: "https://example.com/tortilla", domain: "home", kind: "recommendation",
}] };

describe("saved recipe card pipeline", () => {
  it("keeps saved ingredients and steps in the existing recipe card", async () => {
    const input = "Muéstrame la receta de tortilla que guardé";
    const result = await recipeShow.run({ query: "tortilla" }, { state, userInput: input } as unknown as ToolRunContext);
    const response = normalizeFinalPayload({ reply: "Aquí tienes tu receta.", uiBlocks: [] }, input, [{ id: "recipe", name: "recipe_show", result }]);
    expect(response.uiBlocks).toHaveLength(1);
    expect(response.uiBlocks[0]).toMatchObject({
      type: "recipe", name: "Receta: Tortilla",
      ingredients: [{ ingredient: "2 huevos" }, { ingredient: "sal" }],
      steps: [{ step: 1, text: "Batir los huevos." }, { step: 2, text: "Cocinar en la sartén." }],
      source: { url: "https://example.com/tortilla" },
    });
  });

  it("preserves multiple matches without inventing source links or missing steps", () => {
    const response = normalizeFinalPayload({ reply: "Tus recetas.", uiBlocks: [] }, "Mis recetas", [{
      id: "recipes", name: "recipe_show", result: {
        type: "recipe_show", status: "ok", recipes: [
          { title: "Tortilla", source: "Receta familiar" },
          { title: "Pan", steps: "Amasar.\r\n\r\nHornear.", source: "https://" },
          { title: "" },
        ],
      },
    }]);
    expect(response.uiBlocks).toHaveLength(2);
    expect(response.uiBlocks[0]).toMatchObject({ type: "recipe", title: "Tortilla" });
    expect(response.uiBlocks[0]).not.toHaveProperty("source", expect.anything());
    expect(response.uiBlocks[0]).not.toHaveProperty("steps", expect.anything());
    expect(response.uiBlocks[1]).toMatchObject({ type: "recipe", title: "Pan", steps: [
      { step: 1, text: "Amasar." }, { step: 2, text: "Hornear." },
    ] });
  });

  it("does not invent a recipe when the saved query has no matches", async () => {
    const result = await recipeShow.run({ query: "inexistente" }, { state, userInput: "Receta inexistente" } as unknown as ToolRunContext);
    const response = normalizeFinalPayload({ reply: "No encontré esa receta.", uiBlocks: [] }, "Receta inexistente", [{ id: "recipe", name: "recipe_show", result }]);
    expect(response.uiBlocks).toEqual([]);
  });
});
