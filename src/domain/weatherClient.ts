import type { WeatherCache } from "./types";

/** Resultado del fetch de clima para el Home. */
export type WeatherFetchResult =
  | { ok: true; cache: WeatherCache }
  | { ok: false; error: string };

/**
 * 🔴 FIX (2026-09-09): fetch REAL de clima para el HomeScreen.
 *
 * Antes "Actualizar" solo re-estampaba fetchedAt (el dato de hace horas se
 * mostraba como fresco) y "Traer clima" sin cache era un no-op total (ni
 * siquiera navegaba a configuración). Ahora ambos pegan al endpoint
 * /api/michi/weather, que usa el MISMO pipeline getWeather del agente
 * (wttr.in → open-meteo con geocoding) — datos reales sin pasar por el chat.
 */
export async function fetchWeatherForCity(city: string): Promise<WeatherFetchResult> {
  const clean = city.trim();
  if (!clean) return { ok: false, error: "Falta la ciudad." };
  try {
    const res = await fetch("/api/michi/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: clean }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: data.error ?? `Error ${res.status}` };
    }
    const data = await res.json() as {
      city?: string;
      now?: string;
      condition?: string;
      hourly?: WeatherCache["payload"]["hourly"];
      daily?: WeatherCache["payload"]["daily"];
      status?: string;
    };
    if (data.status === "need_city" || !data.now) {
      return { ok: false, error: "No pude obtener el clima de esa ciudad." };
    }
    const cache: WeatherCache = {
      city: String(data.city ?? clean),
      fetchedAt: new Date().toISOString(),
      payload: {
        now: String(data.now ?? ""),
        condition: String(data.condition ?? ""),
        hourly: Array.isArray(data.hourly) ? data.hourly : undefined,
        daily: Array.isArray(data.daily) ? data.daily : undefined,
      },
    };
    return { ok: true, cache };
  } catch {
    return { ok: false, error: "Sin conexión para traer el clima." };
  }
}
