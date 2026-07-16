/**
 * OSRM routing fallback — public OSRM demo server (no API key).
 *
 * Endpoint:
 *   https://router.project-osrm.org/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?steps=true
 *
 * Devuelve distancia (metros), duración (segundos) y pasos (instructions).
 *
 * Usado por travelPlanner.ts cuando GOOGLE_MAPS_KEY no está configurado.
 * Limitado a modo "driving" (el demo server público no soporta transit /
 * walking / bicycling con la misma calidad — walking funciona, lo aceptamos
 * como override del profile).
 */

import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

export type OsrmStep = {
  instruction: string;
  distanceMeters: number;
};

export type OsrmRoute = {
  distanceMeters: number;
  durationSec: number;
  steps: OsrmStep[];
};

type OsrmManeuver = {
  type?: string;
  modifier?: string;
  exit?: number;
};

type OsrmRouteStep = {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OsrmManeuver;
  mode?: string;
};

type OsrmApiRoute = {
  distance?: number;
  duration?: number;
  legs?: Array<{
    steps?: OsrmRouteStep[];
  }>;
};

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: OsrmApiRoute[];
};

const OSRM_DEMO_BASE = "https://router.project-osrm.org/route/v1";

/** Traduce un maneuver OSRM a una instrucción en español legible. */
function instructionForStep(step: OsrmRouteStep): string {
  const name = step.name?.trim();
  const street = name ? ` por ${name}` : "";
  const m = step.maneuver;
  if (!m) return `Continuar${street}`;
  switch (m.type) {
    case "depart":
      return `Salí${street}`;
    case "arrive":
      return `Llegás a destino${street}`;
    case "turn":
      switch (m.modifier) {
        case "left": return `Girá a la izquierda${street}`;
        case "right": return `Girá a la derecha${street}`;
        case "slight left": return `Girá levemente a la izquierda${street}`;
        case "slight right": return `Girá levemente a la derecha${street}`;
        case "sharp left": return `Girá fuerte a la izquierda${street}`;
        case "sharp right": return `Girá fuerte a la derecha${street}`;
        default: return `Girá${street}`;
      }
    case "new name":
      return `Continuá${street}`;
    case "merge":
      return `Incorporate${street}`;
    case "on ramp":
      return `Tomá la rampa${street}`;
    case "off ramp":
      return `Salí por la rampa${street}`;
    case "fork":
      return `En el bifurcación${street}`;
    case "end of road":
      return `Al final de la calle${street}`;
    case "continue":
      return `Continuá${street}`;
    case "roundabout":
    case "rotary":
      return `Tomá la rotonda${street}`;
    case "exit roundabout":
    case "exit rotary":
      return `Salí de la rotonda${street}`;
    default:
      return `Continuá${street}`;
  }
}

/**
 * Trae una ruta desde OSRM (demo server público, sin key).
 *
 * @param coords Coordenadas from/to en grados decimales.
 * @param profile "driving" (default), "walking" o "cycling". El demo server
 *                soporta los 3; "transit" NO está soportado.
 * @returns OsrmRoute o null si la API falla o no hay ruta.
 */
export async function fetchRouteOSRM(
  coords: { fromLat: number; fromLng: number; toLat: number; toLng: number },
  profile: "driving" | "walking" | "cycling" = "driving",
): Promise<OsrmRoute | null> {
  const { fromLat, fromLng, toLat, toLng } = coords;
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return null;
  }

  const cacheKey = `osrm:route:${profile}:${fromLng.toFixed(4)},${fromLat.toFixed(4)};${toLng.toFixed(4)},${toLat.toFixed(4)}`;
  return cached<OsrmRoute | null>(cacheKey, ttls.reference, async () => {
    await limiters.osrm.acquire();
    const url =
      `${OSRM_DEMO_BASE}/${profile}/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?steps=true&overview=false`;
    const res = await fetchJson<OsrmResponse>(url, { timeoutMs: 12_000 });
    if (!res.ok || !res.data) return null;
    if (res.data.code && res.data.code !== "Ok") return null;
    const route = res.data.routes?.[0];
    if (!route) return null;

    const steps: OsrmStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        steps.push({
          instruction: instructionForStep(s),
          distanceMeters: typeof s.distance === "number" ? s.distance : 0,
        });
      }
    }

    return {
      distanceMeters: typeof route.distance === "number" ? route.distance : 0,
      durationSec: typeof route.duration === "number" ? route.duration : 0,
      steps,
    };
  });
}
