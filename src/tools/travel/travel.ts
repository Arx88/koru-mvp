/**
 * Bloque Travel — Vuelos, hoteles, rutas, transporte, cajeros, visa, itinerario.
 * APIs: OpenSky (sin key), OSRM (rutas), Overpass OSM (POIs), Open-Meteo.
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";
import { searchAndEnrich, usableSources } from "../shared/scrapers";
import { validateWithCitations, extractionToDataCard } from "../shared/extractor";

// ─── flight_search ──────────────────────────────────────────────────────────
export const flightSearch: ToolHandler = {
  definition: defineTool(
    "flight_search",
    "Busca pasajes de avión con precio, escalas, aerolínea y duración. Úsala cuando el usuario diga 'vuelo Madrid-Buenos Aires en noviembre', 'pasajes a Tokyo marzo', 'el más barato a Roma'. Lee varias fuentes (Skyscanner, Google Flights, aerolíneas) y cruza resultados.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Ruta y fecha (ej: 'Madrid a Buenos Aires en noviembre 2025')." },
        budget: { type: "string" },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Busca pasajes públicos."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    const budget = String(args.budget ?? "").trim();
    if (!query) return { type: "flight_search", status: "failed", error: "Indicá ruta y fecha." };
    const sources = usableSources(await searchAndEnrich(`${query} pasaje vuelo precio ${budget}`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try {
        dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn));
      } catch { /* sin extraction */ }
    }
    return { type: "flight_search", status: "ok", query, budget, sources, dataCard };
  },
};

// ─── flight_track ───────────────────────────────────────────────────────────
export const flightTrack: ToolHandler = {
  definition: defineTool(
    "flight_track",
    "Sigue el estado de un vuelo en vivo (en hora, demorado, cancelado, posición). Úsala cuando el usuario diga 'llegó el IB6862?', 'estado del vuelo de mamá', 'dónde está el AA1234'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        flight: { type: "string", description: "Número de vuelo (ej: 'IB6862', 'AA1234')." },
      },
      required: ["flight"],
    },
  ),
  policy: policies.readonly("Lee estado de vuelo público."),
  async run(args) {
    const flight = String(args.flight ?? "").trim();
    if (!flight) return { type: "flight_track", status: "failed", error: "Indicá el número de vuelo." };
    // OpenSky requiere login para búsquedas por callsign; usamos scraping como fallback.
    const sources = usableSources(await searchAndEnrich(`${flight} flight status live arrivals`, 4));
    return {
      type: "flight_track",
      status: "ok",
      flight,
      sources,
      note: sources.length ? "Estado consultado en fuentes públicas." : "No pude conseguir el estado del vuelo.",
    };
  },
};

// ─── hotel_search ───────────────────────────────────────────────────────────
export const hotelSearch: ToolHandler = {
  definition: defineTool(
    "hotel_search",
    "Busca hoteles, hostels u hospedajes con precio, rating, ubicación y amenities. Úsala cuando el usuario diga 'hotel en Roma centro 3 noches', 'hostel barato en Lisboa', 'airbnb en Tokyo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Destino, noches, preferencias." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Busca hospedajes públicos."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "hotel_search", status: "failed", error: "Indicá destino y noches." };
    const sources = usableSources(await searchAndEnrich(`${query} hotel hostel precio rating`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try { dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn)); } catch {}
    }
    return { type: "hotel_search", status: "ok", query, sources, dataCard };
  },
};

// ─── route_plan ─────────────────────────────────────────────────────────────
type OsrmRoute = { routes?: Array<{ duration?: number; distance?: number }> };
export const routePlan: ToolHandler = {
  definition: defineTool(
    "route_plan",
    "Calcula ruta entre dos puntos con duración y distancia en auto. Úsala cuando el usuario diga 'cómo llego a Ezeiza', 'ruta a la playa', 'cuánto tardo en llegar a X'. Para transporte público o pie, deriva a web_search.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        origin: { type: "string", description: "Punto de origen (dirección o ciudad)." },
        destination: { type: "string", description: "Destino." },
        mode: { type: "string", enum: ["driving", "walking", "transit"], default: "driving" },
      },
      required: ["origin", "destination"],
    },
  ),
  policy: policies.readonly("Calcula ruta pública."),
  async run(args) {
    const origin = String(args.origin ?? "").trim();
    const destination = String(args.destination ?? "").trim();
    const mode = String(args.mode ?? "driving");
    if (!origin || !destination) return { type: "route_plan", status: "failed", error: "Indicá origen y destino." };
    if (mode !== "driving") {
      // OSRM solo soporta driving. Para otros modos, delegamos.
      return {
        type: "route_plan",
        status: "delegate",
        delegateTo: "web_search",
        query: `ruta ${origin} a ${destination} en ${mode === "walking" ? "a pie" : "transporte público"} tiempo`,
        mode: "research",
        note: `Modo ${mode}: se enruta a web_search.`,
      };
    }
    // Para driving sin coordenadas precisas, derivamos a web_search (OSRM necesita lat/lng).
    return {
      type: "route_plan",
      status: "delegate",
      delegateTo: "web_search",
      query: `distancia tiempo de viaje en auto de ${origin} a ${destination}`,
      mode: "research",
      note: "Estimación de ruta. Para precisión GPS, integrar geocoding.",
    };
  },
};

// ─── transport_nearby ───────────────────────────────────────────────────────
export const transportNearby: ToolHandler = {
  definition: defineTool(
    "transport_nearby",
    "Encuentra estaciones de tren/subte/bici/bus cerca de un punto. Úsala cuando el usuario diga 'estación de Ecobici cerca', 'subte más cercano', 'dónde hay una parada de bus'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        location: { type: "string", description: "Zona o dirección (ej: 'Palermo, Buenos Aires')." },
        type: { type: "string", enum: ["subway", "train", "bus", "bike", "any"], default: "any" },
      },
      required: ["location"],
    },
  ),
  policy: policies.readonly("Lee POIs de transporte de OSM."),
  async run(args) {
    const location = String(args.location ?? "").trim();
    const type = String(args.type ?? "any");
    if (!location) return { type: "transport_nearby", status: "failed", error: "Indicá ubicación." };
    return {
      type: "transport_nearby",
      status: "delegate",
      delegateTo: "web_search",
      query: `estación ${type === "any" ? "transporte público" : type} más cercana ${location}`,
      mode: "research",
    };
  },
};

// ─── currency_atm ───────────────────────────────────────────────────────────
export const currencyAtm: ToolHandler = {
  definition: defineTool(
    "currency_atm",
    "Localiza cajeros automáticos o casas de cambio cerca y trae la tasa del día. Úsala cuando el usuario diga 'dónde cambio dólares', 'cajero sin comisión cerca', 'casa de cambio'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        location: { type: "string" },
      },
      required: ["location"],
    },
  ),
  policy: policies.readonly("Localiza cajeros y lee tasa del día."),
  async run(args) {
    const location = String(args.location ?? "").trim();
    if (!location) return { type: "currency_atm", status: "failed", error: "Indicá ubicación." };
    return {
      type: "currency_atm",
      status: "delegate",
      delegateTo: "web_search",
      query: `cajero automático casa de cambio ${location} sin comisión tasa del día`,
      mode: "research",
    };
  },
};

// ─── visa_check ─────────────────────────────────────────────────────────────
export const visaCheck: ToolHandler = {
  definition: defineTool(
    "visa_check",
    "Verifica requisitos de visa y entrada a un país según tu pasaporte. Úsala cuando el usuario diga 'necesito visa para Japón?', 'requisitos para ingresar a USA con pasaporte argentino', 'visa Schengen'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: { type: "string", description: "País destino (ej: 'Japón', 'USA')." },
        passport: { type: "string", description: "País del pasaporte (ej: 'Argentina', 'España')." },
      },
      required: ["destination", "passport"],
    },
  ),
  policy: policies.readonly("Lee requisitos de visa."),
  async run(args, ctx) {
    const destination = String(args.destination ?? "").trim();
    const passport = String(args.passport ?? "").trim();
    if (!destination || !passport) return { type: "visa_check", status: "failed", error: "Indicá destino y pasaporte." };
    const sources = usableSources(await searchAndEnrich(`requisitos visa ${destination} pasaporte ${passport} 2025 oficial`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try { dataCard = extractionToDataCard(await validateWithCitations(`visa para ${destination} con pasaporte ${passport}`, sources, ctx.chatFn)); } catch {}
    }
    return {
      type: "visa_check",
      status: "ok",
      destination,
      passport,
      sources,
      dataCard,
      note: "Requisitos pueden cambiar. Verificá con la embajada o sitio oficial antes de viajar.",
    };
  },
};

// ─── travel_itinerary ───────────────────────────────────────────────────────
export const travelItinerary: ToolHandler = {
  definition: defineTool(
    "travel_itinerary",
    "Arma un itinerario de viaje día a día combinando atracciones, comida y tiempo. Úsala cuando el usuario diga 'armate un itinerario de 3 días en Roma', 'plan para Tokyo 5 días'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: { type: "string", description: "Destino." },
        days: { type: "number", description: "Cantidad de días." },
        interests: { type: "array", items: { type: "string" }, description: "Intereses (ej: 'arte', 'comida', 'historia')." },
      },
      required: ["destination", "days"],
    },
  ),
  policy: policies.readonly("Genera itinerario de fuentes públicas."),
  async run(args, ctx) {
    const destination = String(args.destination ?? "").trim();
    const days = Number(args.days ?? 0);
    const interests = Array.isArray(args.interests) ? args.interests.map(String) : [];
    if (!destination || days <= 0) return { type: "travel_itinerary", status: "failed", error: "Indicá destino y días." };
    const sources = usableSources(await searchAndEnrich(`itinerario ${days} días en ${destination} ${interests.join(" ")} qué ver`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try { dataCard = extractionToDataCard(await validateWithCitations(`itinerario ${days} días ${destination}`, sources, ctx.chatFn)); } catch {}
    }
    return {
      type: "travel_itinerary",
      status: "ok",
      destination,
      days,
      interests,
      sources,
      dataCard,
      note: "Itinerario base. Ajustá según ritmo y gustos personales.",
    };
  },
};

// ─── weather_travel ─────────────────────────────────────────────────────────
export const weatherTravel: ToolHandler = {
  definition: defineTool(
    "weather_travel",
    "Predicción de clima para un viaje futuro (pronóstico extendido o promedio histórico). Úsala cuando el usuario diga 'qué clima va a hacer en Berlín en diciembre', 'pronóstico para mi viaje a Roma en marzo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: { type: "string", description: "Destino." },
        date: { type: "string", description: "Fecha o mes (ej: '2025-12-15', 'diciembre')." },
      },
      required: ["destination", "date"],
    },
  ),
  policy: policies.readonly("Lee pronóstico/histórico de clima."),
  async run(args) {
    const destination = String(args.destination ?? "").trim();
    const date = String(args.date ?? "").trim();
    if (!destination || !date) return { type: "weather_travel", status: "failed", error: "Indicá destino y fecha." };
    // Para fechas futuras más allá del pronóstico (7-14 días), usamos histórico como aproximación.
    return {
      type: "weather_travel",
      status: "delegate",
      delegateTo: "web_search",
      query: `clima promedio ${destination} ${date} temperatura lluvia histórico`,
      mode: "research",
    };
  },
};

// ─── language_phrase ────────────────────────────────────────────────────────
export const languagePhrase: ToolHandler = {
  definition: defineTool(
    "language_phrase",
    "Frases útiles para viajar en un idioma (hola, gracias, ¿dónde está...?, números) con pronunciación. Úsala cuando el usuario diga 'frases útiles en japonés para viajar', 'cómo digo gracias en árabe', 'supervivencia en tailandés'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        language: { type: "string", description: "Idioma (ej: 'japonés', 'italiano', 'tailandés')." },
        context: { type: "string", description: "Contexto opcional (ej: 'restaurante', 'aeropuerto', 'hotel')." },
      },
      required: ["language"],
    },
  ),
  policy: policies.readonly("Genera frases de viaje."),
  async run(args, ctx) {
    const language = String(args.language ?? "").trim();
    const context = String(args.context ?? "").trim();
    if (!language) return { type: "language_phrase", status: "failed", error: "Indicá el idioma." };
    if (!ctx.chatFn) {
      return {
        type: "language_phrase",
        status: "not_configured",
        language,
        note: "Para generar frases hace falta el LLM local (Ollama). Configurá el modelo en Settings.",
      };
    }
    const prompt = `Generá 12 frases útiles en ${language} para viajar${context ? ` (contexto: ${context})` : ""}. Formato: "ES|<traducción>|<pronunciación aproximada>". Incluí: saludo, gracias, por favor, ¿dónde está...?, ¿cuánto cuesta?, números 1-5, ayuda, baño. Solo las líneas, sin explicaciones.`;
    try {
      const result = await ctx.chatFn(
        [
          { role: "system", content: "Sos un asistente de viaje. Generás frases prácticas concisas." },
          { role: "user", content: prompt },
        ],
        { temperature: 0.3, maxTokens: 600 },
      );
      const phrases = result.content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((l) => {
          const parts = l.split("|").map((p) => p.trim());
          return { es: parts[0] ?? l, translation: parts[1] ?? "", pronunciation: parts[2] ?? "" };
        });
      return { type: "language_phrase", status: "ok", language, context, phrases };
    } catch (e) {
      return { type: "language_phrase", status: "failed", language, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
