import { describe, it, expect } from "vitest";
import { SemanticRouter } from "../domain/semanticRouter";

async function buildEmbedFn() {
  const baseUrl = "http://172.23.144.1:11434";
  return async (text: string) => {
    const r = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    const d = await r.json();
    return d.embedding ?? [];
  };
}

async function withRouter() {
  const fn = await buildEmbedFn();
  const router = new SemanticRouter(fn);
  await router.initialize();
  return router;
}

const cases: { category: string; expectedCategory: string; expectedTool?: string }[] = [
  { category: "02-bienestar-1", expectedCategory: "conversation" },
  { category: "03-clima-1", expectedCategory: "weather", expectedTool: "weather" },
  { category: "03-clima-2", expectedCategory: "weather", expectedTool: "weather" },
  { category: "03-clima-3", expectedCategory: "weather", expectedTool: "weather" },
  { category: "04-planes-1", expectedCategory: "planning", expectedTool: "plan_day" },
  { category: "04-planes-2", expectedCategory: "planning", expectedTool: "plan_day" },
  { category: "04-planes-3", expectedCategory: "planning", expectedTool: "plan_day" },
  { category: "05-product-1", expectedCategory: "shopping", expectedTool: "shopping_compare" },
  { category: "05-product-2", expectedCategory: "shopping", expectedTool: "shopping_compare" },
  { category: "06-social-1", expectedCategory: "personal_query" },
  { category: "07-match-1", expectedCategory: "sports" },
  { category: "08-activity-1", expectedCategory: "personal_query" },
  { category: "09-gen-1", expectedCategory: "world_info" },
  { category: "10-travel-1", expectedCategory: "travel", expectedTool: "travel_itinerary" },
  { category: "11-shopping-1", expectedCategory: "action" },
  { category: "12-files-1", expectedCategory: "action" },
  { category: "13-market-1", expectedCategory: "world_info" },
  { category: "14-delivery-1", expectedCategory: "world_info" },
  { category: "15-health-1", expectedCategory: "action" },
  { category: "16-urgent-1", expectedCategory: "world_info" },
  { category: "01-morning-1", expectedCategory: "action" },
  { category: "01-morning-2", expectedCategory: "personal_query" },
  { category: "01-morning-3", expectedCategory: "conversation" },
];

describe("router intent (batch)", { sequential: true, timeout: 120_000 }, () => {
  for (const c of cases) {
    it(`${c.category} → ${c.expectedCategory}`, { timeout: 30_000 }, async () => {
      const router = await withRouter();
      const promptMap: Record<string, string> = {
        "01-morning-1": "dame el resumen del dia",
        "01-morning-2": "que tengo para hoy",
        "01-morning-3": "buenos dias koru",
        "02-bienestar-1": "como estoy de salud",
        "03-clima-1": "que tiempo hace",
        "03-clima-2": "hace frio afuera",
        "03-clima-3": "necesito paraguas",
        "04-planes-1": "organiza mi dia",
        "04-planes-2": "tengo mucho que hacer",
        "04-planes-3": "ayudame a planificar",
        "05-product-1": "que celular compro",
        "05-product-2": "mejor auricular",
        "06-social-1": "cumple de juan",
        "07-match-1": "resultado del partido",
        "08-activity-1": "cuantos pasos",
        "09-gen-1": "generame una imagen",
        "10-travel-1": "quiero viajar a Paris",
        "11-shopping-1": "lista de compras",
        "12-files-1": "exportame el archivo",
        "13-market-1": "cuanto esta el btc",
        "14-delivery-1": "donde esta mi paquete",
        "15-health-1": "recordame tomar pastillas",
        "16-urgent-1": "es urgente",
      };
      const result = await router.route(promptMap[c.category]);
      console.log(`${c.category} => ${result.category} ${result.tool ?? ""} (${result.confidence.toFixed(3)})`);
      expect(result.category).toBe(c.expectedCategory);
      if (c.expectedTool) {
        expect(result.tool).toBe(c.expectedTool);
      }
    });
  }
});
