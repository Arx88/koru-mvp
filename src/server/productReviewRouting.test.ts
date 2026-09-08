/**
 * 🔴 FIX ROUTING (bug en vivo 2026-09-08) — review/reseña de PRODUCTO.
 *
 * Reproducción real en koru-mvp.onrender.com:
 *  - "dame review de airpods" → el LLM NO llamó tools y respondió
 *    "Busco reseñas recientes…" (intención sin acción, turno vacío).
 *  - "dame review de nintendo switch" → movie_info → card "Tu Película"
 *    con el artículo de Wikipedia "List of Nintendo Switch games".
 *
 * Guards testeados acá:
 *  1. explicitProductReviewQuery detecta el patrón explícito de review de
 *     producto y extrae el query limpio.
 *  2. NO matchea cine/series/libros/restaurantes (esos van a movie_info /
 *     book_info / restaurant_deep_search).
 *  3. systemPrompt + descripciones de tools llevan la regla de routing
 *     (guardian de fuente, como los tests de systemPrompt).
 */
import { describe, it, expect } from "vitest";
import { explicitProductReviewQuery } from "./koruBackend";

describe("explicitProductReviewQuery — detección de review de producto", () => {
  it("extrae el producto de los phrasings comunes", () => {
    expect(explicitProductReviewQuery("dame review de airpods")).toBe("airpods");
    expect(explicitProductReviewQuery("dame review de la nintendo switch")).toBe("nintendo switch");
    expect(explicitProductReviewQuery("review de airpods pro 2")).toBe("airpods pro 2");
    expect(explicitProductReviewQuery("reseña del dyson v15")).toBe("dyson v15");
    expect(explicitProductReviewQuery("opiniones del iphone 16")).toBe("iphone 16");
    expect(explicitProductReviewQuery("qué tal está el galaxy s24")).toBe("galaxy s24");
    expect(explicitProductReviewQuery("análisis de la playstation 5")).toBe("playstation 5");
    expect(explicitProductReviewQuery("dale una crítica de los airpods max")).toBe("airpods max");
  });

  it("NO captura consultas que no son reviews de producto", () => {
    expect(explicitProductReviewQuery("hola")).toBeNull();
    expect(explicitProductReviewQuery("que tiempo hace en madrid")).toBeNull();
    expect(explicitProductReviewQuery("a que hora es la puesta de sol")).toBeNull();
    expect(explicitProductReviewQuery("como salio españa ayer")).toBeNull();
    // Sin producto tras la palabra clave → no hay query útil.
    expect(explicitProductReviewQuery("review")).toBeNull();
  });

  it("deja pasar cine/series/libros/restaurantes al flujo del LLM", () => {
    // "reseña de la película avatar" → movie_info, NO shopping_compare.
    expect(explicitProductReviewQuery("reseña de la película avatar")).toBeNull();
    expect(explicitProductReviewQuery("review de la serie severance")).toBeNull();
    expect(explicitProductReviewQuery("análisis del libro cien años de soledad")).toBeNull();
    expect(explicitProductReviewQuery("reseña del juego elden ring")).toBeNull();
    expect(explicitProductReviewQuery("opiniones del restaurante casa lucio")).toBeNull();
    expect(explicitProductReviewQuery("crítica de la canción del verano")).toBeNull();
  });
});

describe("guardians de fuente — reglas de routing en prompts y tools", () => {
  const read = (p: string) => {
    const fs = require("fs");
    return fs.readFileSync(p, "utf8");
  };

  it("systemPrompt distingue movie_info (solo cine/series) de review de producto", () => {
    const src = read("./src/server/systemPrompt.ts");
    // movie_info ya no dice "Reseña de X" genérico (provocaba el misrouting).
    expect(src).not.toContain('"Reseña de X"');
    expect(src).toContain("PELÍCULAS Y SERIES SOLAMENTE");
    expect(src).toContain("REGLA CRÍTICA DE ROUTING: si el usuario pide un review");
    // Few-shots de review de producto.
    expect(src).toContain("dame review de airpods");
    expect(src).toContain("review de la nintendo switch");
  });

  it("web_search y shopping_compare describen el routing correcto en TOOL_DEFINITIONS", () => {
    const src = read("./src/server/koruBackend.ts");
    expect(src).toContain("REVIEWS O RESEÑAS DE PRODUCTOS (shopping_compare)");
    expect(src).toContain("pidiendo REVIEW/RESEÑA/ANÁLISIS/OPINIONES de un producto concreto");
  });

  it("movie_info (toolbox externo) prohíbe productos físicos", () => {
    const src = read("./src/tools/people/people.ts");
    expect(src).toContain("NUNCA la uses para consolas, gadgets");
  });
});
