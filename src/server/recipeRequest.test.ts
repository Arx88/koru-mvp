import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/store";
import { runKoruBackendTurn, type ProviderConfig } from "./koruBackend";

const input = "Quiero una receta vegetariana para dos, lista en 20 minutos, con garbanzos, tomate y huevos. Dame cantidades exactas y pasos en una tarjeta de receta. No me ofrezcas recordatorios.";
const proposal = {
  name: "Garbanzos con tomate y huevos", servings: 2, prepMinutes: 5, cookMinutes: 15,
  ingredients: [{ ingredient: "garbanzos cocidos", measure: "400 g" }, { ingredient: "tomate", measure: "300 g" }, { ingredient: "huevos", measure: "2 unidades" }],
  steps: ["Calentar los garbanzos cocidos con el tomate durante 8 minutos.", "Añadir los huevos y cocinar tapado hasta que clara y yema estén firmes."],
};
const config: ProviderConfig = { nvidiaApiKey: "fake-key", nvidiaBaseUrl: "https://api.nvidia.com", nvidiaModel: "nvidia/nemotron-3.5-lightning-30b-a3b", openRouterKeys: [], openRouterModels: [] };
afterEach(() => vi.unstubAllGlobals());

describe("constrained recipe request through backend", () => {
  it("dispatches recipe_find with the configured model and preserves the specialized card", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      calls.push({ url: String(url), body });
      const content = JSON.stringify(body.messages ?? []);
      if (String(url).includes("/api/chat")) throw new Error("Cloud provider must not use Ollama endpoint");
      if (String(url).includes("/v1/chat/completions")) {
        const message = content.includes("Propón una receta casera") ? { content: JSON.stringify(proposal) }
          : content.includes('"role":"tool"') ? { content: JSON.stringify({ reply: "Te dejé la propuesta en la tarjeta.", uiBlocks: [] }) }
          : { content: "", tool_calls: [{ id: "recipe", type: "function", function: { name: "recipe_find", arguments: JSON.stringify({ query: "vegetariana para dos, lista en 20 minutos, con garbanzos, tomate y huevos" }) } }] };
        return new Response(JSON.stringify({ model: config.nvidiaModel, choices: [{ message }] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }));
    const result = await runKoruBackendTurn({ input, history: [], state: createInitialState(), model: config.nvidiaModel }, config);
    expect(result.uiBlocks).toEqual([expect.objectContaining({ type: "recipe", name: proposal.name, servings: 2, prepTime: "5 min", cookTime: "15 min", ingredients: proposal.ingredients, steps: expect.arrayContaining([expect.objectContaining({ text: proposal.steps[1] })]) })]);
    expect(result.uiBlocks[0]).not.toHaveProperty("source", expect.anything());
    expect(result.uiBlocks[0]).not.toHaveProperty("nutrition", expect.anything());
    expect(result.suggestedActions).toEqual([]);
    const generation = calls.find(c => JSON.stringify(c.body.messages ?? []).includes("Propón una receta casera"));
    expect(generation?.url).toContain("/v1/chat/completions");
    expect(generation?.body.model).toBe(config.nvidiaModel);
  });
});
