import { describe, expect, it } from "vitest";
import { cryptoPriceArgsFromInput, recipeArgsFromInput } from "./koruBackend";
import { translateQueryToEnglish } from "../tools/food/recipes";

// 🔴 FIX CARDS (2026-09-12): bug en vivo — "cuánto está el bitcoin" / "dame una
// receta de X" llegaban como TEXTO plano sin tarjeta cuando el LLM no llamaba
// la tool. Estas helpers alimentan la inyección determinista post-LLM (misma
// técnica que weatherToolCallsToInject) y el override del semantic router.

describe("cryptoPriceArgsFromInput — inyección determinista de crypto_price", () => {
  it("el caso exacto del usuario: precio de bitcoin", () => {
    expect(cryptoPriceArgsFromInput("cuánto está el bitcoin?")).toEqual({ coin: "bitcoin" });
  });

  it("variantes de pedido de cotización con y sin acentos", () => {
    expect(cryptoPriceArgsFromInput("a cuanto esta el btc")).toEqual({ coin: "btc" });
    expect(cryptoPriceArgsFromInput("precio de ETH")).toEqual({ coin: "eth" });
    expect(cryptoPriceArgsFromInput("cotización de solana")).toEqual({ coin: "solana" });
    expect(cryptoPriceArgsFromInput("como viene el dogecoin hoy")).toEqual({ coin: "dogecoin" });
    expect(cryptoPriceArgsFromInput("cuanto vale ethereum ahora")).toEqual({ coin: "ethereum" });
    expect(cryptoPriceArgsFromInput("precio del cripto")).toEqual({ coin: "cripto" });
  });

  it("ticker suelto → intención de precio implícita", () => {
    expect(cryptoPriceArgsFromInput("btc?")).toEqual({ coin: "btc" });
    expect(cryptoPriceArgsFromInput("ETH")).toEqual({ coin: "eth" });
  });

  it("NO dispara sin intención de precio (wikipedia / save / noticias)", () => {
    expect(cryptoPriceArgsFromInput("qué es el bitcoin")).toBeNull();
    expect(cryptoPriceArgsFromInput("compré bitcoin, anótalo")).toBeNull();
    expect(cryptoPriceArgsFromInput("noticias de ethereum")).toBeNull();
    expect(cryptoPriceArgsFromInput("hola")).toBeNull();
  });
});

describe("recipeArgsFromInput — inyección determinista de recipe_find", () => {
  it("el caso exacto del usuario: dame una receta de pasta", () => {
    expect(recipeArgsFromInput("dame una receta de pasta")).toEqual({ query: "pasta" });
  });

  it("variantes: plato concreto, cómo hago, qué cocino con X, plural", () => {
    expect(recipeArgsFromInput("receta de carbonara")).toEqual({ query: "carbonara" });
    expect(recipeArgsFromInput("cómo hago una lasaña?")).toEqual({ query: "lasaña" });
    expect(recipeArgsFromInput("qué cocino con pollo")).toEqual({ query: "pollo" });
    expect(recipeArgsFromInput("buscame recetas de postre por favor")).toEqual({ query: "postre" });
  });

  it("NO dispara para guardar/mostrar recetas ya guardadas (recipe_save/show)", () => {
    expect(recipeArgsFromInput("guarda esta receta de pollo")).toBeNull();
    expect(recipeArgsFromInput("muéstrame la receta del flan que guardé")).toBeNull();
  });

  it("NO dispara para pedidos sin plato concreto (el LLM pide aclaración)", () => {
    expect(recipeArgsFromInput("dame una receta")).toBeNull();
    expect(recipeArgsFromInput("qué cocino?")).toBeNull();
  });

  it("NO dispara para inputs sin intención de receta", () => {
    expect(recipeArgsFromInput("dame una película de terror")).toBeNull();
    expect(recipeArgsFromInput("hola")).toBeNull();
  });
});

describe("translateQueryToEnglish — puente ES→EN para TheMealDB", () => {
  it("traduce ingredientes comunes al índice inglés", () => {
    expect(translateQueryToEnglish("pollo")).toBe("chicken");
    expect(translateQueryToEnglish("carne")).toBe("beef");
    expect(translateQueryToEnglish("sopa")).toBe("soup");
    // 🔴 caso del usuario: milanesas → breaded (Breaded Steak / Lomo de Res Apanado)
    expect(translateQueryToEnglish("milanesas")).toBe("breaded");
    expect(translateQueryToEnglish("milanesa")).toBe("breaded");
  });

  it("frases multi-palabra: suelta conectores e invierte tipo de plato", () => {
    expect(translateQueryToEnglish("sopa de tomate")).toBe("tomato soup");
    expect(translateQueryToEnglish("ensalada de pollo")).toBe("chicken salad");
  });

  it("lo que ya está en inglés (o es nombre propio) pasa intacto", () => {
    expect(translateQueryToEnglish("carbonara")).toBe("carbonara");
    expect(translateQueryToEnglish("pasta")).toBe("pasta");
  });
});
