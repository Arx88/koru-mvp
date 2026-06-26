import { describe, expect, it } from "vitest";
import { SemanticRouter, cosineSimilarity, type EmbedFn } from "./semanticRouter";

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
});

// ── SemanticRouter: lógica de routing con embedFn mock ─────────────
// El mock produce vectores predecibles para poder testear el comportamiento
// del router (umbral, fallback, inicialización) sin depender de Ollama.

describe("SemanticRouter", () => {
  // Mock: cada texto se mapea a un vector distinto por categoría.
  // Mock determinista: clasifica por categoría usando tags en el texto.
  // Los ejemplos modelo reales (definidos en semanticRouter.ts) se embeden
  // según su propia categoría, simulando que embeddings reales agrupan
  // textos de la misma intención. Para inputs de test, usamos palabras
  // que caen en la rama correcta del mock.
  const VECTOR_WORLD = [0.9, 0.1, 0.1, 0.1, 0.1, 0.1];
  const VECTOR_WEATHER = [0.1, 0.9, 0.1, 0.1, 0.1, 0.1];
  const VECTOR_CONVERSATION = [0.1, 0.1, 0.9, 0.1, 0.1, 0.1];
  const VECTOR_ACTION = [0.1, 0.1, 0.1, 0.9, 0.1, 0.1];
  const VECTOR_PERSONAL = [0.1, 0.1, 0.1, 0.1, 0.9, 0.1];
  const VECTOR_PLANNING = [0.1, 0.1, 0.1, 0.1, 0.1, 0.9];
  // Ortogonal a TODO: vector cero modificado para similitud muy baja.
  const VECTOR_UNKNOWN = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01];

  // Mapeo texto→categoría para los ejemplos modelo reales (definidos en el router).
  // Esto hace que el mock embeda los ejemplos de cada categoría con su vector,
  // simulando embeddings reales que agrupan intenciones similares.
  const EXAMPLE_CATEGORIES: Record<string, string> = {
    "¿qué pasó hoy en el mundial?": "world",
    "resultados de la copa": "world",
    "últimas noticias de tecnología": "world",
    "¿cómo le fue a Boca?": "world",
    "¿qué pasó en Argentina hoy?": "world",
    "precio del dólar hoy": "world",
    "¿quién ganó el partido?": "world",
    "che, ¿qué onda lo de ayer?": "world",
    "buscar refuerzos del Madrid": "world",
    "fichajes del mercado de pases": "world",
    "buscá información sobre el tema": "world",
    "¿qué tiempo hace?": "weather",
    "¿necesito paraguas?": "weather",
    "¿qué me pongo hoy?": "weather",
    "¿hace frío afuera?": "weather",
    "¿va a llover?": "weather",
    "¿cómo está el día?": "weather",
    "¿qué auriculares compro?": "shopping",
    "necesito una batería externa": "shopping",
    "¿dónde compro X más barato?": "shopping",
    "¿cuál es mejor, A o B?": "shopping",
    "recomendame un celular": "shopping",
    "¿cómo organizo hoy?": "planning",
    "tengo muchas cosas": "planning",
    "¿qué hago primero?": "planning",
    "ayudame a planificar el día": "planning",
    "no me da el tiempo": "planning",
    "¿cuánto gasté?": "personal",
    "¿qué tenía para comer?": "personal",
    "¿qué pendientes tengo?": "personal",
    "¿recordás lo que te dije?": "personal",
    "¿qué links guardé?": "personal",
    "hola Koru": "conversation",
    "buenos días": "conversation",
    "gracias": "conversation",
    "¿cómo estás?": "conversation",
    "hoy estoy reventada": "conversation",
    "te quiero contar algo": "conversation",
    "qué lindo día": "conversation",
    "me aburro": "conversation",
    "creame una alarma": "action",
    "recordame llamar al médico": "action",
    "guardá esto": "action",
    "anotá un gasto": "action",
    "tengo que comprar leche": "action",
  };

  function mockEmbedFn(text: string): Promise<number[]> {
    const lower = text.toLowerCase().trim();
    // 1. Si es un ejemplo modelo conocido, usar su vector de categoría.
    const exampleCat = EXAMPLE_CATEGORIES[text] ?? EXAMPLE_CATEGORIES[lower];
    if (exampleCat) {
      const v = {
        world: VECTOR_WORLD, weather: VECTOR_WEATHER, conversation: VECTOR_CONVERSATION,
        action: VECTOR_ACTION, personal: VECTOR_PERSONAL, planning: VECTOR_PLANNING,
        shopping: VECTOR_WORLD, // shopping usa web_search-like, agrupamos con world para el mock
      }[exampleCat] ?? VECTOR_UNKNOWN;
      return Promise.resolve(v);
    }
    // 2. Para inputs de test, clasificar por palabras representativas.
    if (/(mundial|boca|noticias|refuerzos|partido|dolar|ayer|madrid)/.test(lower)) {
      return Promise.resolve(VECTOR_WORLD);
    }
    if (/(clima|lluvia|fr[ií]o|campera|tiempo|hace|buenos aires)/.test(lower)) {
      return Promise.resolve(VECTOR_WEATHER);
    }
    if (/(hola|gracias|c[oó]mo est[aá]s|reventada)/.test(lower)) {
      return Promise.resolve(VECTOR_CONVERSATION);
    }
    // 3. Desconocido real: vector casi cero → similitud baja con todo.
    return Promise.resolve(VECTOR_UNKNOWN);
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
    expect(callCount).toBeGreaterThan(0);
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
      // Solo el input de test usa vector ortogonal; los ejemplos modelo usan
      // mockEmbedFn para no colisionar con el vector del input.
      if (text === "zxcv qwer asdf") {
        return [-0.9, -0.9, -0.9, -0.1, -0.1, -0.1];
      }
      return mockEmbedFn(text);
    };
    const router = new SemanticRouter(mixedEmbed);
    await router.initialize();
    const result = await router.route("zxcv qwer asdf");
    expect(result.category).toBe("conversation");
  });

  it("es agnóstico al proveedor: funciona con cualquier embedFn", async () => {
    // Simula otro proveedor de embeddings (OpenAI, etc.) con vectores distintos.
    const otherProvider: EmbedFn = async () => [0.95, 0.05, 0.05, 0.05, 0.05, 0.05];
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
    // Mensaje vacío: el mock devuelve VECTOR_UNKNOWN (ortogonal tras el fix).
    // Pero más importante: no debe lanzar excepción.
    const router = new SemanticRouter(mockEmbedFn);
    const result = await router.route("");
    expect(result).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  // ── Nuevos handlers de extractToolArgs ───────────────────────────
  // Usamos un embedFn determinista que da un vector "especial" solo al
  // ejemplo target y al input del test, garantizando que ese ejemplo gane.

  it("extrae query para match_schedule y match_live", async () => {
    const target = "juega Boca hoy";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("match_schedule");
    expect(result.toolArgs).toEqual({ query: target });

    const target2 = "tabla de la liga";
    const embedFn2: EmbedFn = async (text) => (text === target2 ? special : base);
    const router2 = new SemanticRouter(embedFn2);
    const result2 = await router2.route(target2);
    expect(result2.tool).toBe("match_live");
    expect(result2.toolArgs).toEqual({ query: target2 });
  });

  it("extrae coin para crypto_price", async () => {
    const target = "precio del bitcoin";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("crypto_price");
    expect(result.toolArgs).toEqual({ coin: target });
  });

  it("extrae symbol para stock_quote", async () => {
    const target = "cotización de Apple";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("stock_quote");
    expect(result.toolArgs).toEqual({ symbol: target });
  });

  it("extrae defaults para currency_convert", async () => {
    const target = "precio del dólar";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("currency_convert");
    expect(result.toolArgs).toEqual({ amount: 1, from: "USD", to: "ARS" });
  });

  it("extrae query para route_traffic", async () => {
    const target = "cómo llego a Palermo";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("route_traffic");
    expect(result.toolArgs).toEqual({ query: target });
  });

  it("extrae destination para travel_itinerary", async () => {
    const target = "quiero viajar a Madrid";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("travel_itinerary");
    expect(result.toolArgs).toEqual({ destination: target });
  });

  it("extrae args para review → shopping_compare y web_search", async () => {
    const target1 = "review de auriculares";
    const target2 = "opiniones del iPhone 16";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];

    const embedFn1: EmbedFn = async (text) => (text === target1 ? special : base);
    const router1 = new SemanticRouter(embedFn1);
    const result1 = await router1.route(target1);
    expect(result1.tool).toBe("shopping_compare");
    expect(result1.toolArgs).toEqual({ query: target1, mode: "shopping" });

    const embedFn2: EmbedFn = async (text) => (text === target2 ? special : base);
    const router2 = new SemanticRouter(embedFn2);
    const result2 = await router2.route(target2);
    expect(result2.tool).toBe("web_search");
    expect(result2.toolArgs).toEqual({ query: target2, mode: "world" });
  });

  it("enruta birthday hacia save_personal_item", async () => {
    const target = "cumpleaños de Ana";
    const special = [0.99, 0.01, 0.01, 0.01, 0.01, 0.01];
    const base = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const embedFn: EmbedFn = async (text) => (text === target ? special : base);
    const router = new SemanticRouter(embedFn);
    const result = await router.route(target);
    expect(result.tool).toBe("save_personal_item");
    expect(result.category).toBe("birthday");
  });
});
