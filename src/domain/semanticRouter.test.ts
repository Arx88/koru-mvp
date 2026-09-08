import { describe, expect, it } from "vitest";
import { SemanticRouter, cosineSimilarity, ROUTE_EXAMPLES, type EmbedFn, type RouteCategory, type RouteTool } from "./semanticRouter";
import { foldAccents } from "./commitments";

// ── cosineSimilarity: matemática pura ──────────────────────────────

describe("cosineSimilarity", () => {
  it("devuelve 1 para vectores idénticos", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("devuelve 0 para vectores ortogonales", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("devuelve -1 para vectores opuestos", () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 5);
  });

  it("devuelve valor intermedio para vectores parecidos", () => {
    const sim = cosineSimilarity([1, 2, 3], [1, 2, 2.9]);
    expect(sim).toBeGreaterThan(0.99);
    expect(sim).toBeLessThan(1);
  });

  it("devuelve 0 para vectores con norma cero (seguridad)", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("NO confunde magnitud con dirección (un vector chico positivo no es ortogonal)", () => {
    // Regresión del mock viejo: [0.01, ...] apunta a la dirección de todos-unos
    // y tiene similitud ALTA contra cualquier vector positivo. El coseno mide
    // dirección, no magnitud.
    const sim = cosineSimilarity([0.01, 0.01, 0.01], [1, 2, 3]);
    expect(sim).toBeGreaterThan(0.9);
  });
});

// ── SemanticRouter: lógica de routing con embedFn mock ─────────────
// El mock produce vectores DETERMINÍSTICOS derivados de ROUTE_EXAMPLES
// (la lista real del router, importada): cada par (categoría, tool) recibe
// su propia dirección one-hot, así el vecino más cercano de un mensaje es
// exactamente el ejemplo esperado y el margen entre categorías queda enorme.
// El vector "desconocido" vive en una dimensión DEDICADA: coseno ≈ 0.1 contra
// cualquier par (dirección distinta, no magnitud chica como el mock viejo).

describe("SemanticRouter", () => {
  // ── Vectores por par (categoría, tool) + dimensión extra p/ desconocido ──
  const pairs = ROUTE_EXAMPLES.map((e) => `${e.category}::${e.tool ?? "none"}`);
  const uniquePairs = [...new Set(pairs)];
  const pairIndex = new Map(uniquePairs.map((p, i) => [p, i]));
  const DIM = uniquePairs.length + 1; // +1: dimensión exclusiva del "desconocido"
  const UNKNOWN_DIM = uniquePairs.length;

  function pairVec(category: RouteCategory, tool?: RouteTool): number[] {
    const v = new Array<number>(DIM).fill(0.05);
    const idx = pairIndex.get(`${category}::${tool ?? "none"}`);
    if (idx === undefined) return unknownVec();
    v[idx] = 0.95;
    return v;
  }

  function unknownVec(): number[] {
    const v = new Array<number>(DIM).fill(0.05);
    v[UNKNOWN_DIM] = 0.95;
    return v;
  }

  /** Vector del par al que pertenece un texto de ejemplo (match insensible a
   *  tildes, como hace el router con foldAccents en ambos lados). */
  function pairVecForText(text: string): number[] {
    const folded = foldAccents(text);
    const ex = ROUTE_EXAMPLES.find((e) => foldAccents(e.text) === folded);
    return ex ? pairVec(ex.category, ex.tool) : unknownVec();
  }

  const base = new Array<number>(DIM).fill(0.1);

  function mockEmbedFn(text: string): Promise<number[]> {
    // 1. Texto idéntico a un ejemplo (folded) → vector de su par.
    const folded = foldAccents(text);
    const ex = ROUTE_EXAMPLES.find((e) => foldAccents(e.text) === folded);
    if (ex) return Promise.resolve(pairVec(ex.category, ex.tool));
    // 2. Inputs de test: clasificar por palabras representativas al par
    //    dominante de esa categoría (primer par declarado de la categoría).
    if (/(mundial|boca|noticias|refuerzos|partido|dolar|ayer|madrid)/.test(folded)) {
      return Promise.resolve(pairVecForText("últimas noticias de tecnología"));
    }
    if (/(clima|lluvia|frio|campera|tiempo|hace|buenos aires)/.test(folded)) {
      return Promise.resolve(pairVecForText("¿qué tiempo hace?"));
    }
    if (/(hola|gracias|como estas|reventada)/.test(folded)) {
      return Promise.resolve(pairVecForText("hola Koru"));
    }
    // 3. Desconocido real: dimensión dedicada → similitud ~0.1 contra todo.
    return Promise.resolve(unknownVec());
  }

  it("inicializa embediendo los ejemplos una sola vez", async () => {
    let callCount = 0;
    const embedFn: EmbedFn = async (text) => {
      callCount++;
      return mockEmbedFn(text);
    };
    const router = new SemanticRouter(embedFn);
    await router.initialize();
    const initialCount = callCount;
    // Llamar initialize de nuevo no debe embedir otra vez.
    await router.initialize();
    expect(callCount).toBe(initialCount);
    expect(callCount).toBe(ROUTE_EXAMPLES.length);
  });

  it("clasifica mensaje de world_info con tool web_search", async () => {
    const router = new SemanticRouter(mockEmbedFn);
    const result = await router.route("¿qué pasó en el mundial?");
    expect(result.category).toBe("world_info");
    expect(result.tool).toBe("web_search");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("clasifica mensaje de weather con tool weather y extrae city", async () => {
    const router = new SemanticRouter(mockEmbedFn);
    const result = await router.route("¿qué tiempo hace en Buenos Aires?");
    expect(result.category).toBe("weather");
    expect(result.tool).toBe("weather");
    expect(result.toolArgs?.city).toBe("Buenos Aires");
  });

  it("clasifica conversación SIN tool", async () => {
    const router = new SemanticRouter(mockEmbedFn);
    const result = await router.route("hola Koru");
    expect(result.category).toBe("conversation");
    expect(result.tool).toBeUndefined();
  });

  it("cae a conversation cuando la confianza es baja (umbral)", async () => {
    const mixedEmbed: EmbedFn = async (text) => {
      // Solo el input de test usa un vector NEGATIVO (dirección opuesta a los
      // pares positivos → similitud negativa); los ejemplos van por mockEmbedFn.
      if (foldAccents(text) === "zxcv qwer asdf") {
        return new Array<number>(DIM).fill(-0.9);
      }
      return mockEmbedFn(text);
    };
    const router = new SemanticRouter(mixedEmbed);
    await router.initialize();
    const result = await router.route("zxcv qwer asdf");
    expect(result.category).toBe("conversation");
  });

  it("es agnóstico al proveedor: funciona con cualquier embedFn", async () => {
    // Simula otro proveedor (dimensionalidad igual, dirección distinta).
    const v = new Array<number>(DIM).fill(0.05);
    v[0] = 0.95;
    const otherProvider: EmbedFn = async () => v;
    const router = new SemanticRouter(otherProvider);
    await router.initialize();
    const result = await router.route("cualquier cosa con vector world-like");
    // Como el mock siempre devuelve el mismo vector, la categoría más cercana gana.
    expect(result.category).toBeDefined();
  });

  it("extrae query para web_search desde el mensaje", async () => {
    const router = new SemanticRouter(mockEmbedFn);
    const result = await router.route("buscar refuerzos del Madrid");
    expect(result.toolArgs?.query).toBe("buscar refuerzos del Madrid");
    expect(result.toolArgs?.mode).toBe("world");
  });

  it("maneja mensajes vacíos sin romper", async () => {
    // Mensaje vacío: vector desconocido (dimensión dedicada). No debe lanzar.
    const router = new SemanticRouter(mockEmbedFn);
    const result = await router.route("");
    expect(result).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  // ── extractToolArgs: el truco special/base contra el texto FOLDEADO ──
  // El router embedea foldAccents(texto) en ambos lados (ejemplos y mensaje),
  // así que la comparación del mock también se hace sobre el texto foldedeado.

  it("extrae query para match_schedule y match_live", async () => {
    const target = "juega Boca hoy";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("match_schedule");
    expect(result.toolArgs).toEqual({ query: target });

    const target2 = "tabla de la liga";
    const special2 = pairVecForText(target2);
    const embedFn2: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target2) ? special2 : base);
    const router2 = new SemanticRouter(embedFn2);
    const result2 = await router2.route(target2);
    expect(result2.tool).toBe("match_live");
    expect(result2.toolArgs).toEqual({ query: target2 });
  });

  it("extrae coin para crypto_price", async () => {
    const target = "precio del bitcoin";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("crypto_price");
    // El extractor actual aísla la moneda real del mensaje (mejor que pasar
    // el texto completo — comportamiento tras la refactorización del router).
    expect(result.toolArgs).toEqual({ coin: "bitcoin" });
  });

  it("extrae symbol para stock_quote", async () => {
    const target = "cotización de Apple";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("stock_quote");
    expect(result.toolArgs).toEqual({ symbol: target });
  });

  it("extrae defaults para currency_convert", async () => {
    const target = "precio del dólar";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("currency_convert");
    expect(result.toolArgs).toEqual({ amount: 1, from: "USD", to: "ARS" });
  });

  it("extrae query para route_traffic", async () => {
    const target = "cómo llego a Palermo";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("route_traffic");
    expect(result.toolArgs).toEqual({ query: target });
  });

  it("extrae destination para travel_itinerary", async () => {
    const target = "quiero viajar a Madrid";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("travel_itinerary");
    expect(result.toolArgs).toEqual({ destination: target });
  });

  it("extrae args para review → shopping_compare y web_search", async () => {
    const target1 = "review de auriculares";
    const target2 = "opiniones del iPhone 16";

    const special1 = pairVecForText(target1);
    const embedFn1: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target1) ? special1 : base);
    const router1 = new SemanticRouter(embedFn1);
    const result1 = await router1.route(target1);
    expect(result1.tool).toBe("shopping_compare");
    expect(result1.toolArgs).toEqual({ query: target1, mode: "shopping" });

    const special2 = pairVecForText(target2);
    const embedFn2: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target2) ? special2 : base);
    const router2 = new SemanticRouter(embedFn2);
    const result2 = await router2.route(target2);
    expect(result2.tool).toBe("web_search");
    expect(result2.toolArgs).toEqual({ query: target2, mode: "world" });
  });

  it("enruta birthday hacia save_personal_item", async () => {
    const target = "cumpleaños de Ana";
    const special = pairVecForText(target);
    const embedFn: EmbedFn = async (text) => (foldAccents(text) === foldAccents(target) ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("save_personal_item");
    expect(result.category).toBe("birthday");
  });
});
