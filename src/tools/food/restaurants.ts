/**
 * Bloque Food — Búsqueda profunda de restaurantes + reseñas.
 * Killer feature: lee varias fuentes (Google/Yelp/TripAdvisor/periódicos),
 * encuentra coincidencias y sintetiza un veredicto honesto con structureExtractor.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { searchAndEnrich, usableSources } from "../shared/scrapers";
import { validateWithCitations, extractionToDataCard } from "../shared/extractor";
import { fetchJson, fetchText } from "../shared/fetcher";
import { findBackingSource } from "../../domain/structureExtractor";
import type { UiBlock } from "../../domain/types";
import { searchPlacesOSM } from "./osmPlaces";

// ─── Google Places enrichment ──────────────────────────────────────────────

/** Detalles estructurados de un restaurante desde Google Places API. */
export interface RestaurantDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: number; // 1-4
  openingHours?: string[];
  photos?: string[]; // photo URLs
  menuHighlights?: Array<{ dish: string; price?: string }>;
  reserveUrl?: string;
  /** 🔴 v4: URL del website oficial del place (Google Places field "website"). */
  website?: string;
}

// Shapes mínimas de la respuesta de Google Places (Find Place From Text).
interface GooglePlacesPhoto {
  photo_reference: string;
  height: number;
  width: number;
  html_attributions: string[];
}

interface GooglePlacesCandidate {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  formatted_phone_number?: string;
  opening_hours?: { weekday_text?: string[]; open_now?: boolean };
  photos?: GooglePlacesPhoto[];
  url?: string;
  website?: string;
}

interface GoogleFindPlaceResponse {
  candidates?: GooglePlacesCandidate[];
  status: string;
  error_message?: string;
}

// ─── Menu highlights scraping ───────────────────────────────────────────────

/**
 * 🔴 v4: extrae hasta 5 highlights del menú desde el HTML del website del
 * restaurante. Heurística simple:
 *  1. Sanea el HTML (elimina <script>/<style>, decodifica entidades básicas).
 *  2. Busca pares (texto del plato, precio) en dos patrones:
 *     a) <li> o <h3>/<h4> con texto corto, seguido de un precio en la misma
 *        línea o en el siguiente nodo de texto.
 *     b) Línea de texto plano con un precio al final (formato "Paella €18").
 *  3. Filtra por palabras clave gastronómicas para evitar ruido (ej. links de
 *     navegación con "€" por promociones).
 *  4. Devuelve hasta 5 items únicos.
 *
 * Best-effort: si el sitio bloquea el fetch o el HTML no tiene precios, devuelve [].
 */
const FOOD_KEYWORDS = /\b(pizza|pasta|ensalada|sopa|postre|carne|pescado|pollo|vegan|cel[ií]aco|paella|hamburguesa|sushi|ramen|taco|burrito|ceviche|croquetas|tortilla|gazpacho|fabada|pulpo|chulet[oó]n|bife|milanesa|empanada|locro|asado|matambre|cordero|cochinillo|bacalao|rabas|calamares|gambas|-langostinos|mejillones|almejas|risotto|ñ[oñ]oqui|lasa[ñn]a|ravioles|sorrentinos|fideos|tallarines|focaccia|pancake|waffle|tarta|flan|helado|mousse|tiramis[uú]|profiterol|crepe|cr[eè]me|coulant|brownie|cheesecake|limonada|zumo|jugo|smoothie|cafe|caf[eé]|capuchino|latte|vino|cerveza|c[oó]ctel|mojito|agua)\b/i;

const PRICE_PATTERN = /(?:€|EUR|usd|\$|£|¥|ARS|MXN|COP|CLP|BRL)\s?\d+(?:[.,]\d{1,2})?/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function extractMenuHighlights(html: string, max = 5): Array<{ dish: string; price?: string }> {
  if (!html) return [];
  // 1. Sanea: elimina scripts/styles/comments.
  const sanitized = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?(?:nav|header|footer|aside|form|button|svg|img|iframe)[^>]*>/gi, " ");

  const found: Array<{ dish: string; price?: string }> = [];
  const seen = new Set<string>();

  // 2a. Pattern: <li ...>text...price</li> (o <h3>/<h4>)
  const blockRe = /<(?:li|h[2345]|p|div)[^>]*>([\s\S]{0,400}?)<\/(?:li|h[2345]|p|div)>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(sanitized)) !== null && found.length < max) {
    const raw = m[1] ?? "";
    // Limpia tags internas y decodifica entidades.
    const text = decodeEntities(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text.length < 3 || text.length > 120) continue;
    const priceMatch = text.match(PRICE_PATTERN);
    if (!priceMatch) continue;
    const price = priceMatch[0].replace(/\s+/g, " ").trim();
    const dish = text.replace(price, "").replace(/[|\-–—:•·]+\s*$/, "").trim();
    if (!dish || dish.length < 3) continue;
    // Filtra ruido: debe contener palabra gastronómica O parecer nombre de plato.
    if (!FOOD_KEYWORDS.test(dish) && !/^[A-ZÁÉÍÓÚÑ]/.test(dish)) continue;
    // Descarta si el "plato" parece link de navegación (muy corto + todo mayúsculas).
    if (dish === dish.toUpperCase() && dish.length < 12) continue;
    const key = dish.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ dish, price });
  }

  // 2b. Pattern: línea de texto plano con precio al final ("Paella €18").
  if (found.length < max) {
    const lines = decodeEntities(sanitized.replace(/<[^>]+>/g, "\n"))
      .split(/\n/)
      .map(l => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    for (const line of lines) {
      if (found.length >= max) break;
      if (line.length < 5 || line.length > 120) continue;
      const priceMatch = line.match(PRICE_PATTERN);
      if (!priceMatch) continue;
      const price = priceMatch[0].replace(/\s+/g, " ").trim();
      const dish = line.replace(price, "").replace(/[|\-–—:•·]+\s*$/, "").trim();
      if (!dish || dish.length < 3) continue;
      if (!FOOD_KEYWORDS.test(dish) && !/^[A-ZÁÉÍÓÚÑ]/.test(dish)) continue;
      if (dish === dish.toUpperCase() && dish.length < 12) continue;
      const key = dish.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ dish, price });
    }
  }

  return found;
}

/**
 * Trae detalles enriquecidos de un restaurante desde Google Places API.
 *
 * 1. Find Place From Text (input=name) → primer candidato con todos los fields.
 * 2. Construye URLs de foto via Place Photo endpoint (maxwidth=400).
 *
 * Requiere `process.env.GOOGLE_PLACES_KEY`. Lanza error si no está.
 */
export async function fetchRestaurantDetails(
  placeName: string,
  location?: { lat: number; lng: number },
): Promise<RestaurantDetails> {
  const KEY = process.env.GOOGLE_PLACES_KEY;
  if (!KEY) throw new Error("Google Places API key required");

  const input = location
    ? `${placeName} @${location.lat},${location.lng}`
    : placeName;

  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "geometry",
    "rating",
    "user_ratings_total",
    "price_level",
    "formatted_phone_number",
    "opening_hours",
    "photos",
    "url",
    "website",
  ].join(",");

  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(input)}` +
    `&inputtype=textquery` +
    `&fields=${fields}` +
    `&key=${KEY}`;

  const result = await fetchJson<GoogleFindPlaceResponse>(url, { timeoutMs: 12_000 });
  if (!result.ok || !result.data) {
    throw new Error(result.error ?? `Google Places API failed (HTTP ${result.status})`);
  }

  const data = result.data;
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error(`No Google Places result for "${placeName}"`);
  }

  // Construir URLs de foto via Place Photo endpoint (maxwidth=400).
  // El endpoint sirve la imagen directamente (no JSON), así que la URL misma
  // es el `src` utilizable por un <img>.
  const photos = (candidate.photos ?? [])
    .slice(0, 5)
    .map(
      (p) =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400` +
        `&photoreference=${encodeURIComponent(p.photo_reference)}` +
        `&key=${KEY}`,
    );

  const details: RestaurantDetails = {
    placeId: candidate.place_id,
    name: candidate.name,
    address: candidate.formatted_address,
    lat: candidate.geometry.location.lat,
    lng: candidate.geometry.location.lng,
    phone: candidate.formatted_phone_number,
    rating: typeof candidate.rating === "number" ? candidate.rating : undefined,
    ratingCount: typeof candidate.user_ratings_total === "number" ? candidate.user_ratings_total : undefined,
    priceLevel: typeof candidate.price_level === "number" ? candidate.price_level : undefined,
    openingHours: candidate.opening_hours?.weekday_text,
    photos: photos.length > 0 ? photos : undefined,
    reserveUrl: candidate.url,
    website: candidate.website,
  };

  // 🔴 v4: scraping de highlights del menú desde el website oficial del place.
  // Best-effort: si no hay website, o el fetch falla, o no encontramos precios,
  // simplemente dejamos menuHighlights como undefined (la card degradará sin
  // esa sección). Nunca propagamos el error — el enriquecimiento base ya quedó.
  if (candidate.website) {
    try {
      const htmlRes = await fetchText(candidate.website, { timeoutMs: 12_000 });
      if (htmlRes.ok && htmlRes.text) {
        const highlights = extractMenuHighlights(htmlRes.text, 5);
        if (highlights.length > 0) {
          details.menuHighlights = highlights;
        }
      }
    } catch (err) {
      console.warn(`[Koru] restaurant menu scraping failed for ${candidate.website}:`, err instanceof Error ? err.message : err);
    }
  }

  return details;
}

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
    // 🔴 v3: el tipo de matches ahora incluye los campos enriquecidos por Google Places
    //        (placeId, lat/lng, address, phone, rating, ratingCount, priceLevel, photos, reserveUrl).
    type RestaurantMatch = {
      name: string;
      sourcesMentioning: number;
      quote?: string;
      imageUrl?: string;
      rating?: number;
      placeId?: string;
      lat?: number;
      lng?: number;
      address?: string;
      phone?: string;
      ratingCount?: number;
      priceLevel?: number;
      photos?: string[];
      reserveUrl?: string;
      distanceFromUser?: string;
      // 🔴 v4: highlights del menú extraídos por scraping del website.
      menuHighlights?: Array<{ dish: string; price?: string }>;
    };
    let matches: RestaurantMatch[] = [];
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
          // 🔴 V5: anti-hallucination — validate each match's `quote` against
          // the sources using the SAME validator that `validateWithCitations`
          // uses internally (findBackingSource, en structureExtractor.ts).
          // Si la quote del LLM no aparece literalmente en ningún source, el
          // match se descarta como alucinación. Antes confiábamos en
          // ctx.chatFn directo y cualquier invento del modelo pasaba al user.
          const rawMatches = parsed.matches.slice(0, 3).map((m: Record<string, unknown>) => ({
            name: String(m.name ?? "").trim(),
            sourcesMentioning: Math.max(0, Math.min(sourceCount, Number(m.sourcesMentioning ?? 0))),
            quote: m.quote ? String(m.quote).slice(0, 120) : undefined,
          })) as Array<{ name: string; sourcesMentioning: number; quote?: string }>;
          matches = rawMatches
            .filter((m) => m.name.length > 1)
            .filter((m) => typeof m.quote === "string" && m.quote.length > 0 && findBackingSource(m.quote, sources) !== null);
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
          // 🔴 V5: filtro expandido — descarta genéricos gastronómicos EN/ES
          // y adjetivos listicle ("best", "top") que aparecían como falsos
          // positivos en queries tipo "Best Italian Restaurants".
          if (/restaurante|restaurants|bar|cafe|parrilla|sushi|trattoria|bistró|bistro|comida|gastronom|italian|french|best|top/.test(lower)) continue;
          nameCount.set(c, (nameCount.get(c) ?? 0) + 1);
        }
      }
      matches = Array.from(nameCount.entries())
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, n]): RestaurantMatch => ({ name, sourcesMentioning: Math.min(sourceCount, n) }));
    }

    // 🔴 v3: enriquecer top matches con Google Places API (photos, rating, address,
    //        phone, priceLevel, reserveUrl, lat/lng). Best-effort: si no hay API key
    //        o falla alguna llamada, simplemente se omite el enriquecimiento y la
    //        card degradará a la data léxica/LLM que ya teníamos.
    if (matches.length > 0 && process.env.GOOGLE_PLACES_KEY) {
      const enriched = await Promise.all(
        matches.slice(0, 3).map(async (m): Promise<RestaurantMatch> => {
          try {
            const details = await fetchRestaurantDetails(m.name);
            return {
              ...m,
              placeId: details.placeId,
              lat: details.lat,
              lng: details.lng,
              address: details.address,
              phone: details.phone,
              rating: details.rating ?? m.rating,
              ratingCount: details.ratingCount,
              priceLevel: details.priceLevel,
              photos: details.photos,
              reserveUrl: details.reserveUrl,
              // 🔴 v4: highlights del menú (scraping del website).
              menuHighlights: details.menuHighlights,
            };
          } catch {
            // Sin enriquecimiento — mantenemos el match como está.
            return m;
          }
        }),
      );
      matches = enriched;
    } else if (matches.length > 0) {
      // 🔴 FREE FALLBACK: sin GOOGLE_PLACES_KEY usamos OSM (Nominatim) para
      // conseguir al menos lat/lng/address del restaurante. Best-effort: si
      // no encuentra el lugar, mantenemos el match con la data léxica.
      const enriched = await Promise.all(
        matches.slice(0, 3).map(async (m): Promise<RestaurantMatch> => {
          try {
            const osmPlaces = await searchPlacesOSM(`${m.name} ${query}`);
            const first = osmPlaces[0];
            if (first) {
              return {
                ...m,
                lat: first.lat,
                lng: first.lng,
                address: first.name,
                // OSM no expone rating/phone/photos; los dejamos como estaban.
              };
            }
          } catch {
            // Sin enriquecimiento OSM — mantenemos el match como está.
          }
          return m;
        }),
      );
      matches = enriched;
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

    let dataCard: UiBlock | null = null;
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
