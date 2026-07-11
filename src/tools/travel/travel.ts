/**
 * Bloque Travel — Vuelos, hoteles, rutas, transporte, cajeros, visa, itinerario.
 * APIs: OpenSky (sin key), OSRM (rutas), Overpass OSM (POIs), Open-Meteo.
 */

import { defineTool, policies, type ToolHandler } from "../types";
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
      try { dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn)); } catch (err) { console.warn("[Koru] travel dataCard extraction failed:", err instanceof Error ? err.message : err); }
    }
    return { type: "hotel_search", status: "ok", query, sources, dataCard };
  },
};

// ─── route_plan ─────────────────────────────────────────────────────────────
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
  policy: policies.readonly("Calcula ruta via OSRM + geocoding."),
  async run(args) {
    const origin = String(args.origin ?? "").trim();
    const destination = String(args.destination ?? "").trim();
    const mode = String(args.mode ?? "driving");
    if (!origin || !destination) return { type: "route_plan", status: "failed", error: "Indicá origen y destino." };
    // Fase 3.4: usar Open-Meteo geocoding + OSRM para rutas reales.
    try {
      // Geocoding de origen y destino
      const [origGeo, destGeo] = await Promise.all([
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(origin)}&count=1&format=json`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&format=json`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
      ]) as [{ results?: Array<{ latitude: number; longitude: number; name: string }> }, { results?: Array<{ latitude: number; longitude: number; name: string }> }];
      const orig = origGeo.results?.[0];
      const dest = destGeo.results?.[0];
      if (!orig || !dest) return { type: "route_plan", status: "ok", origin, destination, mode, note: "No pude geolocalizar origen o destino. Probá con nombres de ciudad más específicos." };
      // OSRM driving route
      const profile = mode === "walking" ? "foot" : "driving";
      const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${orig.longitude},${orig.latitude};${dest.longitude},${dest.latitude}?overview=false`;
      const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
      const osrmData = await osrmRes.json() as { routes?: Array<{ distance?: number; duration?: number }> };
      const route = osrmData.routes?.[0];
      if (!route) return { type: "route_plan", status: "ok", origin, destination, mode, note: "No encontré ruta entre esos puntos." };
      const km = route.distance ? (route.distance / 1000).toFixed(1) : "?";
      const mins = route.duration ? Math.round(route.duration / 60) : "?";
      return {
        type: "route_plan", status: "ok", origin, destination, mode,
        text: `De ${orig.name} a ${dest.name}: ${km} km, ${mins} min en ${mode === "walking" ? "a pie" : "auto"}.`,
        distanceKm: km, durationMin: mins,
      };
    } catch (err) {
      console.warn("[Koru] route_plan OSRM failed:", err instanceof Error ? err.message : err);
      return { type: "route_plan", status: "failed", error: "No pude calcular la ruta. Verificá los nombres de las ciudades." };
    }
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
  policy: policies.readonly("Busca POIs de transporte via OpenStreetMap Overpass."),
  async run(args) {
    const location = String(args.location ?? "").trim();
    const transportType = String(args.type ?? "any");
    if (!location) return { type: "transport_nearby", status: "failed", error: "Indicá ubicación." };
    // Fase 3.4: usar Open-Meteo geocoding + Overpass API para transporte real.
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&format=json`, { signal: AbortSignal.timeout(8000) });
      const geoData = await geoRes.json() as { results?: Array<{ latitude: number; longitude: number; name: string }> };
      const geo = geoData.results?.[0];
      if (!geo) return { type: "transport_nearby", status: "ok", location, transportType, note: `No encontré coordenadas de ${location}.` };
      // Overpass API: buscar estaciones de transporte en radio de 2km
      const transportFilter = transportType === "subway" ? "railway=subway" : transportType === "train" ? "railway=station" : transportType === "bus" ? "highway=bus_stop" : transportType === "bike" ? "amenity=bicycle_rental" : "(railway=subway|railway=station|highway=bus_stop|amenity=bicycle_rental)";
      const overpassQuery = `[out:json][timeout:8];(node["${transportFilter}"](around:2000,${geo.latitude},${geo.longitude}););out 10;`;
      const opRes = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: overpassQuery, signal: AbortSignal.timeout(9000) });
      const opData = await opRes.json() as { elements?: Array<{ tags?: { name?: string; railway?: string; highway?: string } }> };
      const stations = (opData.elements ?? []).map(e => ({ name: e.tags?.name ?? "Estación", kind: e.tags?.railway ?? e.tags?.highway ?? "transporte" })).slice(0, 5);
      if (stations.length === 0) return { type: "transport_nearby", status: "ok", location, transportType, note: `No encontré estaciones de transporte cerca de ${geo.name}.` };
      return { type: "transport_nearby", status: "ok", location, transportType, stations, text: `Encontré ${stations.length} estaciones cerca de ${geo.name}: ${stations.map(s => s.name).join(", ")}.` };
    } catch (err) {
      console.warn("[Koru] transport_nearby Overpass failed:", err instanceof Error ? err.message : err);
      return { type: "transport_nearby", status: "failed", error: `No pude buscar transporte cerca de ${location}.` };
    }
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
  policy: policies.readonly("Busca tasa de cambio via Frankfurter API."),
  async run(args) {
    const location = String(args.location ?? "").trim();
    if (!location) return { type: "currency_atm", status: "failed", error: "Indicá ubicación." };
    // Fase 3.3: usar Frankfurter API para tasa del día + Wikipedia para info de cajeros.
    try {
      // Tasa USD→EUR como referencia de cambio del día
      const rateRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", { signal: AbortSignal.timeout(8000) });
      const rateData = await rateRes.json() as { rates?: Record<string, number>; date?: string };
      const eurRate = rateData.rates?.EUR;
      const date = rateData.date;
      return {
        type: "currency_atm",
        status: "ok",
        location,
        text: eurRate ? `Tasa del día (${date}): 1 USD = ${eurRate} EUR. Para cajeros específicos en ${location}, te sugiero buscar en Google Maps "cajero automático" o "casa de cambio" en esa zona.` : `No pude obtener la tasa del día. Para cajeros en ${location}, buscá en Google Maps.`,
        rate: eurRate ? `${eurRate}` : undefined,
        date,
      };
    } catch (err) {
      console.warn("[Koru] currency_atm Frankfurter failed:", err instanceof Error ? err.message : err);
      return { type: "currency_atm", status: "failed", error: `No pude obtener información de cambio para ${location}.` };
    }
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
      try { dataCard = extractionToDataCard(await validateWithCitations(`visa para ${destination} con pasaporte ${passport}`, sources, ctx.chatFn)); } catch (err) { console.warn("[Koru] travel visa dataCard failed:", err instanceof Error ? err.message : err); }
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
      try { dataCard = extractionToDataCard(await validateWithCitations(`itinerario ${days} días ${destination}`, sources, ctx.chatFn)); } catch (err) { console.warn("[Koru] travel itinerary dataCard failed:", err instanceof Error ? err.message : err); }
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
  policy: policies.readonly("Lee clima via Open-Meteo + Wikipedia."),
  async run(args) {
    const destination = String(args.destination ?? "").trim();
    const date = String(args.date ?? "").trim();
    if (!destination || !date) return { type: "weather_travel", status: "failed", error: "Indicá destino y fecha." };
    // Fase 3.3: usar Open-Meteo geocoding + current weather + Wikipedia para histórico.
    try {
      // 1. Geocoding: obtener lat/lon del destino
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&format=json`, { signal: AbortSignal.timeout(8000) });
      const geoData = await geoRes.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country?: string }> };
      const geo = geoData.results?.[0];
      if (!geo) return { type: "weather_travel", status: "ok", destination, date, note: `No encontré coordenadas de ${destination}.` };
      // 2. Current weather
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto`, { signal: AbortSignal.timeout(8000) });
      const weatherData = await weatherRes.json() as { current?: { temperature_2m: number; precipitation: number; wind_speed_10m: number } };
      const cur = weatherData.current;
      return {
        type: "weather_travel",
        status: "ok",
        destination,
        date,
        location: `${geo.name}${geo.country ? `, ${geo.country}` : ""}`,
        text: cur ? `Clima actual en ${geo.name}: ${cur.temperature_2m}°C, precipitación ${cur.precipitation}mm, viento ${cur.wind_speed_10m} km/h. Para ${date}, consultá un pronóstico extendido cerca de esa fecha.` : `Encontré ${geo.name} pero no pude obtener el clima.`,
        temperature: cur?.temperature_2m,
        precipitation: cur?.precipitation,
        windSpeed: cur?.wind_speed_10m,
      };
    } catch (err) {
      console.warn("[Koru] weather_travel Open-Meteo failed:", err instanceof Error ? err.message : err);
      return { type: "weather_travel", status: "failed", error: `No pude obtener clima para ${destination}.` };
    }
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
