/**
 * Bloque Travel — barrel de 10 tools (exporta el array travelTools).
 * También re-exporta el planner de rutas (Google Maps) para que otras tools
 * puedan enriquecer el `route_map` UiBlock con steps y alternatives.
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

export {
  fetchRoute,
  formatDistance,
  formatDuration,
  trafficLabel,
  type RouteResult,
  type RouteStep,
  type TravelMode,
  type TrafficLevel,
} from "./travelPlanner";

export const travelTools = [
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
];
