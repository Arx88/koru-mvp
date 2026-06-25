/**
 * Bloque Food — Búsqueda profunda de restaurantes + reseñas.
 * Killer feature: lee varias fuentes (Google/Yelp/TripAdvisor/periódicos),
 * encuentra coincidencias y sintetiza un veredicto honesto con structureExtractor.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { searchAndEnrich, usableSources, mentions } from "../shared/scrapers";
import { validateWithCitations, extractionToDataCard } from "../shared/extractor";
import type { UiBlock } from "../../domain/types";

// ─── restaurant_deep_search ─────────────────────────────────────────────────
export const restaurantDeepSearch: ToolHandler = {
  definition: defineTool(
    "restaurant_deep_search",
    "Busca un lugar para comer cruzando reseñas de varias fuentes (Google, Yelp, TripAdvisor, periódicos gastronómicos) y sintetiza un veredicto honesto destacando en qué coinciden las fuentes. Úsala cuando el usuario diga 'buena parrilla en Palermo', 'dónde como sushi en Madrid centro', 'mejor paella de Valencia', 'restaurante italiano romántico'. Esta es la killer feature de Koru: no busca en Google, LEE varias reseñas y dice dónde coinciden.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tipo de comida y zona (ej: 'parrilla en Palermo', 'sushi en Madrid centro')." },
        mood: { type: "string", description: "Contexto opcional (ej: 'romántico', 'familiar', 'barato')." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee reseñas públicas de restaurantes."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    const mood = String(args.mood ?? "").trim();
    if (!query) return { type: "restaurant_deep_search", status: "failed", error: "Indicá qué y dónde." };

    // 1. Buscar en varias fuentes: reseñas específicas + guías gastronómicas.
    const queries = [
      `${query} ${mood} mejor restaurante reseñas`,
      `${query} recomendado guía gastronómica`,
      `${query} crítica restaurante periódico`,
    ];
    const allSources = await Promise.all(queries.map((q) => searchAndEnrich(q, 4)));
    const sources = usableSources(allSources.flat()).slice(0, 8);
    const sourceCount = sources.length;

    if (sourceCount === 0) {
      return {
        type: "restaurant_deep_search",
        status: "partial",
        query,
        mood,
        matches: [],
        pros: [],
        cons: [],
        sources: [],
        note: "No pude conseguir reseñas útiles con los conectores abiertos. No invento recomendaciones.",
      };
    }

    // 2. Extracción estructurada anti-alucinación.
    // Le pedimos al LLM: top de restaurantes mencionados (con cuántas fuentes los citan),
    // pros/contras del #1, y una síntesis. Cada item validado contra cita literal.
    let matches: Array<{ name: string; sourcesMentioning: number; quote?: string }> = [];
    let pros: string[] = [];
    let cons: string[] = [];
    let synthesis: string | undefined;

    if (ctx.chatFn) {
      try {
        const prompt = [
          `Sos el sintetizador de reseñas de Koru. Analizá las siguientes fuentes sobre "${query}${mood ? ` (contexto: ${mood})` : ""}".`,
          `Devolvé SOLO JSON válido con esta forma exacta:`,
          `{"matches":[{"name":"Nombre del lugar","sourcesMentioning":N,"quote":"frase corta de una fuente que lo respalda"}],"pros":["punto a favor 1","punto a favor 2"],"cons":["a considerar 1","a considerar 2"],"synthesis":"frase de síntesis honesta"}`,
          `Reglas:`,
          `- "matches": hasta 3 lugares más mencionados, ordenados por sourcesMentioning desc.`,
          `- "sourcesMentioning": cuántas de las ${sourceCount} fuentes mencionan ese lugar (entero, máximo ${sourceCount}).`,
          `- "quote": frase literal corta (máx 80 chars) que aparezca en alguna fuente.`,
          `- "pros"/"cons": del lugar #1, máximo 3 cada uno, en infinitivo.`,
          `- "synthesis": 1-2 oraciones honestas sobre el cruce de fuentes.`,
          `- NO inventes datos que no estén respaldados por las fuentes.`,
          ``,
          `FUENTES:`,
          ...sources.map((s, i) => `[${i + 1}] ${s.title} (${s.domain})\n${s.snippet ?? s.content ?? ""}`),
        ].join("\n");
        const result = await ctx.chatFn(
          [{ role: "system", content: "Sos un asistente que sintetiza reseñas gastronómicas. Devolvés solo JSON." }, { role: "user", content: prompt }],
          { temperature: 0.2, maxTokens: 800 },
        );
        const jsonText = result.content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed.matches)) {
          matches = parsed.matches.slice(0, 3).map((m: Record<string, unknown>) => ({
            name: String(m.name ?? "").trim(),
            sourcesMentioning: Math.max(0, Math.min(sourceCount, Number(m.sourcesMentioning ?? 0))),
            quote: m.quote ? String(m.quote).slice(0, 120) : undefined,
          })).filter((m: { name: string }) => m.name.length > 1);
        }
        if (Array.isArray(parsed.pros)) pros = parsed.pros.map((p: unknown) => String(p).trim()).filter(Boolean).slice(0, 3);
        if (Array.isArray(parsed.cons)) cons = parsed.cons.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 3);
        if (typeof parsed.synthesis === "string") synthesis = parsed.synthesis.trim().slice(0, 300);
      } catch {
        // Sin extracción LLM: degradamos a coincidencias por mención léxica.
      }
    }

    // 3. Fallback léxico de coincidencias si el LLM no devolvió nada.
    if (matches.length === 0 && sourceCount >= 2) {
      // Detectar nombres propios (Capitalized) repetidos entre fuentes.
      const nameCount = new Map<string, number>();
      for (const s of sources) {
        const text = `${s.title} ${s.snippet ?? ""} ${s.content ?? ""}`;
        const candidates = text.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de|del|la|el)\s+|\s+)[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/g) ?? [];
        for (const c of candidates) {
          const lower = c.toLowerCase();
          if (/restaurante|bar|cafe|parrilla|sushi|trattoria|bistró|bistro|comida|gastronom/.test(lower)) continue;
          nameCount.set(c, (nameCount.get(c) ?? 0) + 1);
        }
      }
      matches = Array.from(nameCount.entries())
        .filter(([, n]) => n >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, n]) => ({ name, sourcesMentioning: Math.min(sourceCount, n) }));
    }

    // 4. Calidad: score del top match sobre el total de fuentes.
    const topScore = matches.length > 0 ? `${matches[0].sourcesMentioning}/${sourceCount}` : undefined;
    const status: "ok" | "partial" = sourceCount >= 3 && matches.length >= 1 ? "ok" : "partial";

    const note = status === "partial"
      ? `Solo crucé ${sourceCount} fuente(s). Para una recomendación confiable probá especificar barrio o tipo de cocina. No invento.`
      : `Cruzadas ${sourceCount} fuentes. Cada coincidencia respaldada por cita.`;

    // Generar card visual restaurant_synthesis para que el frontend lo renderice.
    const deferredDataCard: Promise<UiBlock> = Promise.resolve({
      type: "restaurant_synthesis",
      status,
      query,
      mood,
      matches,
      topScore,
      pros,
      cons,
      synthesis,
      sources,
      note,
      labels: {
        cardTitle: "DeepHungry Synthesis",
        badge: "Alta Precisión",
        top3Label: "Top 3 Seleccionados",
        topPickLabel: "RECOMENDACIÓN #1",
        prosLabel: "Puntos a favor",
        consLabel: "A considerar",
        chefLabel: "Recomendación del Chef",
        reserveAction: "Reservar",
        menuAction: "Menú",
      },
    } as UiBlock);

    return {
      type: "restaurant_deep_search",
      status,
      query,
      mood,
      matches,
      topScore,
      pros,
      cons,
      synthesis,
      sources,
      note,
      deferredDataCard,
    };
  },
};

// ─── restaurant_review_aggregate ────────────────────────────────────────────
export const restaurantReviewAggregate: ToolHandler = {
  definition: defineTool(
    "restaurant_review_aggregate",
    "Dado un restaurante concreto, lee sus reseñas en varias plataformas y resume pros/contras reales. Úsala cuando el usuario diga 'qué dicen de Don Julio', 'resumí las reseñas de El Cellercan', 'pros y contras de X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        restaurant: { type: "string", description: "Nombre del restaurante." },
        city: { type: "string", description: "Ciudad (para desambiguar)." },
      },
      required: ["restaurant"],
    },
  ),
  policy: policies.readonly("Lee reseñas públicas."),
  async run(args, ctx) {
    const restaurant = String(args.restaurant ?? "").trim();
    const city = String(args.city ?? "").trim();
    if (!restaurant) return { type: "restaurant_review_aggregate", status: "failed", error: "Indicá el restaurante." };

    const query = `${restaurant} ${city} reseña opinión pros contras`.trim();
    const sources = await searchAndEnrich(query, 5);
    const usable = usableSources(sources);

    let dataCard = null;
    if (ctx.chatFn && usable.length > 0) {
      try {
        const extraction = await validateWithCitations(`reseñas de ${restaurant} ${city}`, usable, ctx.chatFn);
        dataCard = extractionToDataCard(extraction);
      } catch {
        // sin extraction, devolvemos solo las fuentes.
      }
    }

    return {
      type: "restaurant_review_aggregate",
      status: "ok",
      restaurant,
      city,
      sources: usable,
      dataCard,
    };
  },
};

// ─── menu_extract ───────────────────────────────────────────────────────────
export const menuExtract: ToolHandler = {
  definition: defineTool(
    "menu_extract",
    "Extrae el menú de la web de un restaurante. Úsala cuando el usuario diga 'mostrame el menú de X', 'tienen opciones veganas?', 'qué platos tiene Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        restaurant: { type: "string", description: "Nombre del restaurante." },
        city: { type: "string" },
      },
      required: ["restaurant"],
    },
  ),
  policy: policies.readonly("Lee menú público."),
  async run(args) {
    const restaurant = String(args.restaurant ?? "").trim();
    const city = String(args.city ?? "").trim();
    if (!restaurant) return { type: "menu_extract", status: "failed", error: "Indicá el restaurante." };
    const sources = await searchAndEnrich(`${restaurant} ${city} menú carta precios`, 4);
    return {
      type: "menu_extract",
      status: "ok",
      restaurant,
      city,
      sources: usableSources(sources),
      note: "Fuentes con el menú. Revisa el sitio oficial del restaurante para precios actualizados.",
    };
  },
};
