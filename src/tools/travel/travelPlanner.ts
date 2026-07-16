/**
 * Travel Planner — Route fetching with Google Maps Directions API.
 *
 * `fetchRoute` calcula una ruta real entre origen y destino usando la
 * Directions API de Google. Devuelve pasos (instrucciones), distancia,
 * duración, nivel de tráfico (comparando `duration_in_traffic` vs `duration`),
 * rutas alternativas, y —para modo driving— estimación de combustible y CO2.
 *
 * Si no hay `GOOGLE_MAPS_KEY` en el entorno, lanza un error explícito para que
 * el caller pueda caer a un fallback (OSRM, web_search, etc.).
 *
 * Este módulo es pura lógica de fetch + parseo; no registra una ToolHandler
 * (eso lo hace `travel.ts` desde `routePlan` y desde tools futuras que consuman
 * `fetchRoute` para enriquecer el `route_map` UiBlock con `steps` y
 * `alternatives`).
 */

import { fetchJson } from "../shared/fetcher";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type TravelMode = "driving" | "transit" | "walking" | "bicycling";

export type TrafficLevel = "light" | "moderate" | "heavy";

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSec: number;
  maneuver?: string;
  streetName?: string;
};

export type RouteResult = {
  steps: RouteStep[];
  distanceMeters: number;
  durationSec: number;
  trafficLevel: TrafficLevel;
  alternatives: RouteResult[];
  /** Solo para modo driving. Litros estimados a 7 L/100km. */
  fuelEstimateLiters?: number;
  /** Solo para modo driving. Gramos de CO2 (fuelLiters * 2.3 kg/L * 1000). */
  co2Grams?: number;
};

// ─── Tipos internos del API de Google Maps Directions ─────────────────────────

type GmDistanceDuration = { value?: number; text?: string };

type GmStep = {
  html_instructions?: string;
  distance?: GmDistanceDuration;
  duration?: GmDistanceDuration;
  maneuver?: string;
  /** Nombre de la calle / vía del tramo (cuando está disponible). */
  name?: string;
};

type GmLeg = {
  distance?: GmDistanceDuration;
  duration?: GmDistanceDuration;
  /** Solo si se pidió `departure_time=now` y el modo es driving. */
  duration_in_traffic?: GmDistanceDuration;
  steps?: GmStep[];
};

type GmRoute = {
  legs?: GmLeg[];
  /** Resumen textual corto de la ruta (ej: "I-95 N"). Útil para alternatives. */
  summary?: string;
};

type GmDirectionsResponse = {
  status?: string;
  error_message?: string;
  routes?: GmRoute[];
};

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Consumo promedio: 7 L cada 100 km → 0.07 L por km. */
const LITERS_PER_KM = 0.07;

/** Factor de emisión de gasolina: 2.3 kg CO2 por litro. */
const CO2_KG_PER_LITER = 2.3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte el ratio `duration_in_traffic / duration` en un nivel de tráfico
 * legible. Si no hay `duration_in_traffic` (modo no-driving o API sin trafic),
 * asumimos "light".
 *
 * Umbrales:
 *   - ratio ≤ 1.10  → "light"    (sin demora o demora menor al 10%)
 *   - ratio ≤ 1.30  → "moderate" (demora entre 10% y 30%)
 *   - ratio >  1.30  → "heavy"    (demora mayor al 30%)
 */
function trafficLevelFromRatio(durationInTraffic?: number, duration?: number): TrafficLevel {
  if (!durationInTraffic || !duration || duration <= 0) return "light";
  const ratio = durationInTraffic / duration;
  if (ratio <= 1.10) return "light";
  if (ratio <= 1.30) return "moderate";
  return "heavy";
}

/**
 * Limpia el HTML de `html_instructions` que devuelve Google Maps
 * (ej: `Head <b>north</b> on <wbr/>Main St` → `Head north on Main St`).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<wbr\s*\/?>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza el maneuver de Google a un token estable que la UI pueda mapear
 * a un ícono (turn-left, roundabout-right, straight, merge, etc.). Si la API
 * no lo trae, devolvemos "straight" como default discreto.
 */
function normalizeManeuver(m?: string): string {
  if (!m) return "straight";
  return m.trim().toLowerCase();
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parsea UNA ruta de la respuesta de Google Maps a un `RouteResult`.
 * `includeAlternatives` controla si parsea también las rutas adicionales
 * (solo la ruta principal lo hace, para evitar recursión infinita).
 */
function parseRoute(route: GmRoute, mode: TravelMode, includeAlternatives: boolean, allRoutes: GmRoute[]): RouteResult {
  // Google Directions puede devolver múltiples legs para rutas con waypoints;
  // para uso simple de Koru (origen→destino) siempre es 1 leg. Sumamos por
  // si el caller enriquece con waypoints en el futuro.
  const legs = route.legs ?? [];
  const firstLeg = legs[0];

  const distanceMeters = legs.reduce((acc, leg) => acc + (leg.distance?.value ?? 0), 0);
  const durationSec = legs.reduce((acc, leg) => acc + (leg.duration?.value ?? 0), 0);
  // duration_in_traffic solo aparece en el primer leg real cuando se pide con
  // departure_time=now; usamos el del primer leg con dato.
  const durationInTraffic = legs.find((leg) => leg.duration_in_traffic?.value)?.duration_in_traffic?.value;

  const trafficLevel = mode === "driving"
    ? trafficLevelFromRatio(durationInTraffic, durationSec)
    : "light";

  // Aplanar steps de todos los legs en orden.
  const steps: RouteStep[] = [];
  for (const leg of legs) {
    for (const s of leg.steps ?? []) {
      steps.push({
        instruction: stripHtml(s.html_instructions ?? ""),
        distanceMeters: s.distance?.value ?? 0,
        durationSec: s.duration?.value ?? 0,
        maneuver: normalizeManeuver(s.maneuver),
        streetName: s.name?.trim() || undefined,
      });
    }
  }

  // Alternativas: las demás rutas del response, sin recursión.
  let alternatives: RouteResult[] = [];
  if (includeAlternatives && allRoutes.length > 1) {
    alternatives = allRoutes
      .filter((r) => r !== route)
      .map((r) => parseRoute(r, mode, false, allRoutes));
  }

  // Estimación de combustible y CO2 solo para driving.
  let fuelEstimateLiters: number | undefined;
  let co2Grams: number | undefined;
  if (mode === "driving" && distanceMeters > 0) {
    const km = distanceMeters / 1000;
    fuelEstimateLiters = Number((km * LITERS_PER_KM).toFixed(2));
    co2Grams = Math.round(fuelEstimateLiters * CO2_KG_PER_LITER * 1000);
  }

  return {
    steps,
    distanceMeters,
    durationSec,
    trafficLevel,
    alternatives,
    fuelEstimateLiters,
    co2Grams,
  };
}

// ─── fetchRoute — API pública ─────────────────────────────────────────────────

/**
 * Llama a Google Maps Directions API y devuelve un `RouteResult` con pasos,
 * distancia, duración, tráfico y (en driving) combustible y CO2.
 *
 * @param origin      Dirección o "lat,lng" de origen.
 * @param destination Dirección o "lat,lng" de destino.
 * @param mode        Modo de viaje (default: "driving").
 * @throws {Error} "Google Maps API key required" si no hay `GOOGLE_MAPS_KEY`.
 * @throws {Error} Si la API devuelve status != OK con el `error_message`.
 * @throws {Error} Si no se encuentra ninguna ruta.
 */
export async function fetchRoute(
  origin: string,
  destination: string,
  mode: TravelMode = "driving",
): Promise<RouteResult> {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key required");
  }

  const o = origin.trim();
  const d = destination.trim();
  if (!o || !d) {
    throw new Error("Origin and destination are required");
  }

  // Para driving pedimos `departure_time=now` para que la API devuelva
  // `duration_in_traffic` (necesario para calcular `trafficLevel`).
  const params = new URLSearchParams({
    origin: o,
    destination: d,
    mode,
    key: apiKey,
  });
  if (mode === "driving") {
    params.set("departure_time", "now");
    // alternatives=true pide rutas alternativas (solo válido para driving).
    params.set("alternatives", "true");
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;

  const res = await fetchJson<GmDirectionsResponse>(url, { timeoutMs: 15_000, retries: 1 });
  if (!res.ok || !res.data) {
    throw new Error(`Google Maps Directions request failed: ${res.error ?? `HTTP ${res.status}`}`);
  }

  const data = res.data;
  const status = data.status ?? "";
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Maps Directions error: ${status}${data.error_message ? ` — ${data.error_message}` : ""}`,
    );
  }

  const routes = data.routes ?? [];
  if (routes.length === 0) {
    throw new Error(`No route found between "${o}" and "${d}"`);
  }

  const primary = routes[0];
  return parseRoute(primary, mode, true, routes);
}

// ─── Helpers de formato (para que el caller arme el UiBlock sin duplicar lógica)

/**
 * Formatea una distancia en metros como string legible (km con 1 decimal, o m).
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/**
 * Formatea una duración en segundos como "Xh Ym" o "Ym" o "Zs".
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Etiqueta legible para un nivel de tráfico, en español.
 */
export function trafficLabel(level: TrafficLevel): string {
  switch (level) {
    case "light":
      return "Tráfico liviano";
    case "moderate":
      return "Tráfico moderado";
    case "heavy":
      return "Tráfico pesado";
  }
}
