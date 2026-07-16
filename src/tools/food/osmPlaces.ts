/**
 * OSM Places fallback — Nominatim search sin API key.
 *
 * Nominatim (OpenStreetMap) es el reemplazo gratuito de Google Places para
 * geocoding / place search. Sin key, con User-Agent propio y rate-limit
 * estricto (1 req/s por política oficial).
 *
 * Endpoint:
 *   https://nominatim.openstreetmap.org/search?q={QUERY}&format=json&limit=5
 *
 * Devuelve: name, lat, lng, type (OSM category), address parts.
 *
 * Cuando GOOGLE_PLACES_KEY no está configurado, restaurants.ts cae a este
 * módulo para no romper la búsqueda de restaurantes.
 */

import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

export type OsmPlace = {
  name: string;
  lat: number;
  lng: number;
  type: string;
};

type NominatimResult = {
  place_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  category?: string;
  address?: {
    restaurant?: string;
    amenity?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

/**
 * Busca lugares en Nominatim (OpenStreetMap) sin API key.
 *
 * @param query Texto de búsqueda (ej: "parrilla en Palermo", "sushi Madrid").
 * @returns Hasta 5 lugares con name, lat, lng, type.
 */
export async function searchPlacesOSM(
  query: string,
): Promise<OsmPlace[]> {
  const q = (query ?? "").trim();
  if (!q) return [];

  const cacheKey = `osm:places:${q.toLowerCase()}`;
  return cached<OsmPlace[]>(cacheKey, ttls.geocode, async () => {
    await limiters.nominatim.acquire();
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
      `&format=json&limit=5&addressdetails=1`;
    // Nominatim requiere User-Agent identificable — fetcher.ts ya lo manda
    // ("KoruLocal/1.0 (+local-first assistant)"), pero reforzamos con header
    // adicional Accept-Language para resultados en español.
    const res = await fetchJson<NominatimResult[]>(url, {
      timeoutMs: 10_000,
      headers: { "Accept-Language": "es,en;q=0.8" },
    });
    if (!res.ok || !Array.isArray(res.data)) return [];

    return res.data
      .map((r): OsmPlace | null => {
        const lat = parseFloat(r.lat ?? "");
        const lng = parseFloat(r.lon ?? "");
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        // name priorizado: name → address.restaurant → address.amenity →
        // primera línea de display_name.
        const name =
          r.name?.trim() ||
          r.address?.restaurant?.trim() ||
          r.address?.amenity?.trim() ||
          (r.display_name ?? "").split(",")[0]?.trim() ||
          "(lugar sin nombre)";
        const type = r.type || r.class || r.category || "unknown";
        return { name, lat, lng, type };
      })
      .filter((p): p is OsmPlace => p !== null);
  });
}
