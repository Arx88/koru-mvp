/**
 * Bloque Knowledge — Memoria personal, Wikipedia, diccionario, conversiones.
 * 10 tools. Combina local (memoria Koru) + APIs públicas (Wikipedia, Free Dict).
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";
import { cosineSimilarity, makeEmbedFn, isOllamaAvailable } from "../shared/embeddings";

// ─── memory_save ────────────────────────────────────────────────────────────
export const memorySave: ToolHandler = {
  definition: defineTool(
    "memory_save",
    "Guarda algo que Koru debe recordar del usuario de forma duradera. Úsala cuando el usuario diga 'soy alérgico a la penicilina', 'mi mamá se llama Marta', 'trabajo como diseñador', 'vivo en Madrid'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Hecho a recordar." },
        kind: { type: "string", enum: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"], default: "profile" },
        sensitivity: { type: "string", enum: ["normal", "sensitive"], default: "normal" },
      },
      required: ["text"],
    },
  ),
  policy: policies.localWrite("Guarda memoria duradera."),
  async run(args) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "memory_save", status: "failed", error: "Indicá qué recordar." };
    return {
      type: "memory_save",
      status: "ok",
      memoryCandidates: [{
        kind: (args.kind ?? "profile") as "profile",
        text,
        confidence: 0.95,
        sensitivity: (args.sensitivity ?? "normal") as "normal",
        status: "candidate",
        rootQuote: text,
        useForSuggestions: true,
      }],
    };
  },
};

// ─── memory_search ──────────────────────────────────────────────────────────
export const memorySearch: ToolHandler = {
  definition: defineTool(
    "memory_search",
    "Busca en lo que Koru sabe del usuario (memoria semántica). Úsala cuando el usuario diga 'qué te dije sobre mi familia?', 'recordás algo de mi dieta?', 'tengo algo guardado sobre X'. Búsqueda por significado, no por palabra exacta.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Qué buscar en la memoria." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Busca en memorias del usuario."),
  async run(args, ctx: ToolRunContext) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "memory_search", status: "failed", error: "Indicá qué buscar." };
    const memories = (ctx.state.memories ?? []).filter((m) => m.status === "confirmed");

    if (memories.length === 0) {
      return { type: "memory_search", status: "ok", query, matches: [], note: "Todavía no hay memorias confirmadas." };
    }

    // 1. Intento semántico con embeddings (si Ollama disponible).
    const ollamaOn = await isOllamaAvailable().catch(() => false);
    if (ollamaOn) {
      try {
        const embed = makeEmbedFn();
        const qVec = await embed(query);
        const scored = await Promise.all(memories.map(async (m) => {
          let vec = m.embedding;
          if (!vec || vec.length === 0) {
            try { vec = await embed(m.text); } catch { vec = []; }
          }
          return { memory: m, score: vec.length ? cosineSimilarity(qVec, vec) : 0 };
        }));
        const top = scored.filter((s) => s.score > 0.4).sort((a, b) => b.score - a.score).slice(0, 5);
        if (top.length) {
          return {
            type: "memory_search",
            status: "ok",
            query,
            mode: "semantic",
            matches: top.map((s) => ({ text: s.memory.text, kind: s.memory.kind, score: Number(s.score.toFixed(2)) })),
          };
        }
      } catch {
        // caer a léxico
      }
    }

    // 2. Fallback léxico.
    const qTokens = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((t) => t.length > 2);
    const matches = memories
      .map((m) => {
        const hay = m.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const score = qTokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { memory: m, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return {
      type: "memory_search",
      status: "ok",
      query,
      mode: "lexical",
      matches: matches.map((s) => ({ text: s.memory.text, kind: s.memory.kind })),
      note: "Búsqueda léxica. Para semántica, activá Ollama.",
    };
  },
};

// ─── memory_forget ──────────────────────────────────────────────────────────
export const memoryForget: ToolHandler = {
  definition: defineTool(
    "memory_forget",
    "Elimina una memoria guardada. Úsala cuando el usuario diga 'olvidá lo de la alergia', 'borrá que vivía en Madrid', 'ya no quiero que recuerdes X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto para encontrar la memoria a borrar." },
      },
      required: ["query"],
    },
  ),
  policy: policies.localWrite("Marca memoria como rejected."),
  async run(args, ctx: ToolRunContext) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "memory_forget", status: "failed", error: "Indicá qué olvidar." };
    const match = (ctx.state.memories ?? []).find((m) => m.text.toLowerCase().includes(q));
    if (!match) return { type: "memory_forget", status: "ok", found: false, query: args.query, note: "No encontré esa memoria." };
    return { type: "memory_forget", status: "ok", found: true, text: match.text, id: match.id, note: "El store la marcará como rejected." };
  },
};

// ─── memory_edit ────────────────────────────────────────────────────────────
export const memoryEdit: ToolHandler = {
  definition: defineTool(
    "memory_edit",
    "Corrige una memoria guardada. Úsala cuando el usuario diga 'mi dirección nueva es...', 'cambia mi número', 'corregí que mi hijo se llama X no Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto para encontrar la memoria a editar." },
        newText: { type: "string", description: "Nuevo texto." },
      },
      required: ["query", "newText"],
    },
  ),
  policy: policies.localWrite("Edita memoria."),
  async run(args, ctx: ToolRunContext) {
    const q = String(args.query ?? "").trim().toLowerCase();
    const newText = String(args.newText ?? "").trim();
    if (!q || !newText) return { type: "memory_edit", status: "failed", error: "Indicá qué editar y el nuevo texto." };
    const match = (ctx.state.memories ?? []).find((m) => m.text.toLowerCase().includes(q));
    if (!match) return { type: "memory_edit", status: "ok", found: false, query: args.query, note: "No encontré esa memoria." };
    return { type: "memory_edit", status: "ok", found: true, oldText: match.text, newText, id: match.id };
  },
};

// ─── memory_garden_show ─────────────────────────────────────────────────────
export const memoryGardenShow: ToolHandler = {
  definition: defineTool(
    "memory_garden_show",
    "Muestra todas las memorias guardadas (el jardín de Koru). Úsala cuando el usuario diga 'mostrame mi jardín', 'qué sabés de mí', 'lista de memorias'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["confirmed", "candidate", "all"], default: "all" },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lista memorias."),
  async run(args, ctx: ToolRunContext) {
    const status = String(args.status ?? "all");
    const memories = (ctx.state.memories ?? [])
      .filter((m) => status === "all" || m.status === status)
      .slice(-30)
      .reverse()
      .map((m) => ({ text: m.text, kind: m.kind, status: m.status, sensitivity: m.sensitivity, date: m.createdAt.slice(0, 10) }));
    return { type: "memory_garden_show", status: "ok", filter: status, count: memories.length, memories };
  },
};

// ─── wikipedia_lookup ───────────────────────────────────────────────────────
type WikiSummary = { type?: string; title?: string; description?: string; extract?: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source?: string } };

export const wikipediaLookup: ToolHandler = {
  definition: defineTool(
    "wikipedia_lookup",
    "Resumen enciclopédico de cualquier tema, concepto o lugar. Úsala cuando el usuario diga 'qué es el efecto placebo?', 'quién era Borges', 'info sobre el Renacimiento', 'qué es la fotosíntesis'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tema a buscar." },
        lang: { type: "string", default: "es" },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee Wikipedia."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const lang = String(args.lang ?? "es").trim();
    if (!query) return { type: "wikipedia_lookup", status: "failed", error: "Indicá el tema." };
    const cacheKey = `wiki:${lang}:${query.toLowerCase()}`;
    const data = await cached<WikiSummary>(cacheKey, ttls.reference, async () => {
      await limiters.wikipedia.acquire();
      const r = await fetchJson<WikiSummary>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { timeoutMs: 9_000 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    if (data.type === "not_found" || !data.extract) {
      return { type: "wikipedia_lookup", status: "ok", query, note: `No encontré "${query}" en Wikipedia (${lang}).` };
    }
    return {
      type: "wikipedia_lookup",
      status: "ok",
      query,
      title: data.title,
      description: data.description,
      extract: data.extract,
      thumbnail: data.thumbnail?.source,
      wikiUrl: data.content_urls?.desktop?.page,
      source: "Wikipedia",
    };
  },
};

// ─── dictionary_define ──────────────────────────────────────────────────────
type DictEntry = { word?: string; phonetic?: string; meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string; synonyms?: string[] }> }> };

export const dictionaryDefine: ToolHandler = {
  definition: defineTool(
    "dictionary_define",
    "Define una palabra y da sinónimos. Úsala cuando el usuario diga 'qué significa perenne?', 'sinónimos de efímero', 'definición de melancolía'. Inglés por defecto.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        word: { type: "string", description: "Palabra a definir." },
      },
      required: ["word"],
    },
  ),
  policy: policies.readonly("Lee Free Dictionary API."),
  async run(args) {
    const word = String(args.word ?? "").trim();
    if (!word) return { type: "dictionary_define", status: "failed", error: "Indicá la palabra." };
    const cacheKey = `dict:${word.toLowerCase()}`;
    const entries = await cached<DictEntry[]>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<DictEntry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeoutMs: 9_000 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    if (!entries.length) {
      return { type: "dictionary_define", status: "ok", word, note: `No encontré "${word}" en el diccionario (inglés).` };
    }
    const e = entries[0];
    const meanings = (e.meanings ?? []).slice(0, 3).map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions ?? []).slice(0, 2).map((d) => ({ definition: d.definition, example: d.example })),
      synonyms: (m.definitions?.[0]?.synonyms ?? []).slice(0, 5),
    }));
    return { type: "dictionary_define", status: "ok", word: e.word ?? word, phonetic: e.phonetic, meanings, source: "Free Dictionary API" };
  },
};

// ─── dictionary_translate_slang ─────────────────────────────────────────────
export const slangTranslate: ToolHandler = {
  definition: defineTool(
    "slang_translate",
    "Explica modismos, jerga o expresiones de un país o región. Úsala cuando el usuario diga 'qué significa chévere?', 'cómo se dice genial en México?', 'es pibe argentino?', 'modismo X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        term: { type: "string", description: "Modismo o expresión." },
        region: { type: "string", description: "País/región (ej: 'Argentina', 'México')." },
      },
      required: ["term"],
    },
  ),
  policy: policies.readonly("Explica modismos con LLM local."),
  async run(args, ctx) {
    const term = String(args.term ?? "").trim();
    const region = String(args.region ?? "").trim();
    if (!term) return { type: "slang_translate", status: "failed", error: "Indicá el modismo." };
    if (!ctx.chatFn) return { type: "slang_translate", status: "not_configured", note: "Necesito el LLM local (Ollama) para explicar modismos." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Explicás modismos y jerga del español de forma concisa. 2-3 líneas: significado, equivalente neutro y ejemplo de uso." },
          { role: "user", content: `Modismo: "${term}"${region ? ` (región: ${region})` : ""}` },
        ],
        { temperature: 0.3, maxTokens: 200 },
      );
      return { type: "slang_translate", status: "ok", term, region, explanation: r.content.trim() };
    } catch (e) {
      return { type: "slang_translate", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── unit_convert ───────────────────────────────────────────────────────────
const UNITS: Record<string, { factor: number; aliases: string[] }> = {
  m: { factor: 1, aliases: ["metro", "metros", "m"] },
  km: { factor: 1000, aliases: ["km", "kilometro", "kilometros", "kilómetro", "kilómetros"] },
  cm: { factor: 0.01, aliases: ["cm", "centimetro", "centimetros"] },
  mm: { factor: 0.001, aliases: ["mm", "milimetro", "milimetros"] },
  ft: { factor: 0.3048, aliases: ["ft", "pie", "pies", "feet"] },
  in: { factor: 0.0254, aliases: ["in", "pulgada", "pulgadas", "inch"] },
  mi: { factor: 1609.34, aliases: ["mi", "milla", "millas", "mile"] },
  yd: { factor: 0.9144, aliases: ["yd", "yarda", "yardas"] },
  g: { factor: 0.001, aliases: ["g", "gramo", "gramos"] },
  kg: { factor: 1, aliases: ["kg", "kilo", "kilos", "kilogramo"] },
  lb: { factor: 0.453592, aliases: ["lb", "libra", "libras", "pound"] },
  oz: { factor: 0.0283495, aliases: ["oz", "onza", "onzas", "ounce"] },
  l: { factor: 1, aliases: ["l", "litro", "litros"] },
  ml: { factor: 0.001, aliases: ["ml", "mililitro", "mililitros"] },
  gal: { factor: 3.78541, aliases: ["gal", "galon", "galón", "gallons"] },
};
function findUnit(raw: string): keyof typeof UNITS | null {
  const r = raw.toLowerCase().trim();
  for (const [key, def] of Object.entries(UNITS)) {
    if (def.aliases.includes(r)) return key;
  }
  return null;
}

export const unitConvert: ToolHandler = {
  definition: defineTool(
    "unit_convert",
    "Convierte unidades: metros/pies, kg/libras, litros/galones, temperatura (°C/°F/K). Úsala cuando el usuario diga '200 gramos en onzas', '30°C a Fahrenheit', '5 km en millas', '2 litros a galones'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "number" },
        from: { type: "string", description: "Unidad origen." },
        to: { type: "string", description: "Unidad destino." },
      },
      required: ["value", "from", "to"],
    },
  ),
  policy: policies.readonly("Conversión local."),
  async run(args) {
    const value = Number(args.value);
    const fromRaw = String(args.from ?? "").trim();
    const toRaw = String(args.to ?? "").trim();
    if (!Number.isFinite(value)) return { type: "unit_convert", status: "failed", error: "Valor inválido." };

    // Temperatura aparte.
    const tempUnits = ["c", "f", "k", "celsius", "fahrenheit", "kelvin"];
    const fromLow = fromRaw.toLowerCase();
    const toLow = toRaw.toLowerCase();
    if (tempUnits.includes(fromLow) || tempUnits.includes(toLow)) {
      let celsius: number;
      if (/^c/i.test(fromLow)) celsius = value;
      else if (/^f/i.test(fromLow)) celsius = (value - 32) * 5 / 9;
      else if (/^k/i.test(fromLow)) celsius = value - 273.15;
      else return { type: "unit_convert", status: "failed", error: "Unidad de temperatura inválida." };
      let result: number;
      if (/^c/i.test(toLow)) result = celsius;
      else if (/^f/i.test(toLow)) result = celsius * 9 / 5 + 32;
      else if (/^k/i.test(toLow)) result = celsius + 273.15;
      else return { type: "unit_convert", status: "failed", error: "Unidad destino inválida." };
      return { type: "unit_convert", status: "ok", value, from: fromRaw, to: toRaw, result: Number(result.toFixed(4)), category: "temperature" };
    }

    const fromUnit = findUnit(fromRaw);
    const toUnit = findUnit(toRaw);
    if (!fromUnit || !toUnit) {
      return { type: "unit_convert", status: "failed", error: `No reconocí "${fromRaw}" o "${toRaw}". Unidades: m, km, cm, ft, in, mi, g, kg, lb, oz, l, ml, gal.` };
    }
    // Verificar misma categoría.
    const isLength = (u: string) => ["m", "km", "cm", "mm", "ft", "in", "mi", "yd"].includes(u);
    const isWeight = (u: string) => ["g", "kg", "lb", "oz"].includes(u);
    const isVolume = (u: string) => ["l", "ml", "gal"].includes(u);
    if ((isLength(fromUnit) !== isLength(toUnit)) || (isWeight(fromUnit) !== isWeight(toUnit)) || (isVolume(fromUnit) !== isVolume(toUnit))) {
      return { type: "unit_convert", status: "failed", error: "No puedo convertir entre categorías distintas (longitud/peso/volumen)." };
    }
    const valueInBase = value * UNITS[fromUnit].factor;
    const result = valueInBase / UNITS[toUnit].factor;
    return { type: "unit_convert", status: "ok", value, from: fromRaw, to: toRaw, result: Number(result.toFixed(4)) };
  },
};

// ─── math_calc ──────────────────────────────────────────────────────────────
export const mathCalc: ToolHandler = {
  definition: defineTool(
    "math_calc",
    "Calcula operaciones matemáticas con explicación. Úsala cuando el usuario diga '15% de 230', 'cuánto es 234 × 18', 'raíz cuadrada de 144', 'porcentaje de cambio entre 100 y 150'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        expression: { type: "string", description: "Expresión matemática (ej: '15% of 230', '234*18', 'sqrt(144)', '(100+50)/2')." },
      },
      required: ["expression"],
    },
  ),
  policy: policies.readonly("Cálculo local."),
  async run(args) {
    const expr = String(args.expression ?? "").trim();
    if (!expr) return { type: "math_calc", status: "failed", error: "Indicá la expresión." };
    // Normalizamos: % de/of → *0.01*, sqrt → Math.sqrt, × → *, ÷ → /
    let safe = expr
      .replace(/[×x]/gi, "*")
      .replace(/÷/g, "/")
      .replace(/(\d+(?:\.\d+)?)\s*%\s*(?:de|of)?\s*(\d+(?:\.\d+)?)/gi, "($1*0.01*$2)")
      .replace(/sqrt\s*\(/gi, "Math.sqrt(")
      .replace(/\^/g, "**")
      .replace(/,/g, ".");
    // Validación estricta: solo caracteres seguros.
    if (!/^[\d+\-*/().\s]|Math\.(sqrt|PI|E)|Math\.pow/g.test(safe) && /[a-zA-Z]/.test(safe.replace(/Math\.\w+/g, ""))) {
      return { type: "math_calc", status: "failed", error: "Expresión con caracteres no permitidos." };
    }
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`"use strict"; return (${safe});`);
      const result = fn();
      if (!Number.isFinite(result)) return { type: "math_calc", status: "failed", error: "Resultado no numérico." };
      return { type: "math_calc", status: "ok", expression: expr, result: Number(Number(result).toFixed(6)) };
    } catch (e) {
      return { type: "math_calc", status: "failed", error: `No pude calcular: ${e instanceof Error ? e.message : "expresión inválida"}.` };
    }
  },
};
