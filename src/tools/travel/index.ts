/**
 * Bloque Travel — barrel de 11 tools (exporta el array travelTools).
 * También re-exporta el planner de rutas (Google Maps) para que otras tools
 * puedan enriquecer el `route_map` UiBlock con steps y alternatives.
 *
 * `routePlanner` (travelPlanner.ts) envuelve `fetchRoute` con la Directions API
 * de Google y devuelve `type: "route_plan_search"` con steps + alternatives +
 * trafficLevel + fuelEstimate. Diferencia con `routePlan` (travel.ts, OSRM
 * sin API key): más rico, pero requiere `GOOGLE_MAPS_KEY`.
 */

import {
  flightSearch,
  flightTrack,
  hotelSearch,
  routePlan,
  transportNearby,
  currencyAtm,
  visaCheck,
  travelItinerary,
  weatherTravel,
  languagePhrase,
} from "./travel";
import { routePlanner } from "./travelPlanner";

export {
  fetchRoute,
  formatDistance,
  formatDuration,
  trafficLabel,
  routePlanner,
  type RouteResult,
  type RouteStep,
  type TravelMode,
  type TrafficLevel,
} from "./travelPlanner";

// 🔴 v4: currency converter (ECB / Frankfurter API, 24h cache).
export {
  convertCurrency,
  getCachedRate,
  getCachedRateDate,
  formatCurrency,
} from "./currencyConverter";

export const travelTools = [
  flightSearch,
  flightTrack,
  hotelSearch,
  routePlan,
  routePlanner,
  transportNearby,
  currencyAtm,
  visaCheck,
  travelItinerary,
  weatherTravel,
  languagePhrase,
];
