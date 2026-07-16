// ============================================================================
// Weather Tool — Open-Meteo integration (free, no API key needed)
// ============================================================================
// Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=CITY&count=1
// Forecast:  https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y
//            &hourly=temperature_2m,precipitation_probability,uv_index,weathercode
//            &daily=weathercode,temperature_2m_max,temperature_2m_min
//            &timezone=auto&forecast_days=7
// ============================================================================

/** Hourly forecast item (next 8 hours). */
export type WeatherHourlyItem = {
  hour: string;
  temp: string;
  conditionIcon: string;
  rainPct: number;
  uv: number;
};

/** Daily forecast item (next 7 days). */
export type WeatherDailyItem = {
  dayAbbrev: string;
  hi: string;
  lo: string;
  conditionIcon: string;
};

/** Normalized weather result returned by fetchWeather. */
export type WeatherResult = {
  now: string;
  condition: string;
  conditionIcon: string;
  hourly: WeatherHourlyItem[];
  daily: WeatherDailyItem[];
  verifiedAt: string;
  freshnessLabel: string;
  /** Ciudad canónica devuelta por el geocoder (útil para UI / logs). */
  city?: string;
};

// ---- Open-Meteo response shapes --------------------------------------------

type GeoResult = {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    timezone?: string;
  }>;
};

type ForecastResponse = {
  timezone?: string;
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    uv_index: number[];
    weathercode: number[];
  };
  daily?: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
};

// ---- WMO weather code → Spanish label + Material Symbol icon ----------------

type WmoMapping = { label: string; icon: string };

function mapWmo(code: number): WmoMapping {
  if (code === 0) return { label: "Despejado", icon: "wb_sunny" };
  if (code >= 1 && code <= 3) return { label: "Parcialmente nublado", icon: "partly_cloudy_day" };
  if (code >= 45 && code <= 48) return { label: "Niebla", icon: "foggy" };
  if (code >= 51 && code <= 67) return { label: "Lluvia", icon: "rainy" };
  if (code >= 71 && code <= 77) return { label: "Nieve", icon: "ac_unit" };
  if (code >= 80 && code <= 82) return { label: "Chubascos", icon: "rainy" };
  if (code >= 95 && code <= 99) return { label: "Tormenta", icon: "thunderstorm" };
  // Fallback razonable para códigos no cubiertos.
  return { label: "Nublado", icon: "cloud" };
}

// ---- Spanish day abbreviations ----------------------------------------------

const DAY_ABBREVS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Open-Meteo devuelve `time` en formato ISO (YYYY-MM-DD) para daily.

function dayAbbrevFromDate(iso: string): string {
  // iso: "2025-01-15" → Date interpreta como UTC medianoche.
  const d = new Date(`${iso}T00:00:00Z`);
  const idx = d.getUTCDay(); // 0 = Domingo
  return DAY_ABBREVS[idx] ?? "—";
}

// ---- Helpers de formato ------------------------------------------------------

function formatTemp(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}°`;
}

function formatHour(iso: string): string {
  // iso: "2025-01-15T14:00" (local) — extraemos la hora en tz local del sitio.
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return "—";
  return `${match[1]}h`;
}

function formatFreshness(verifiedAt: number): string {
  const diffMs = Date.now() - verifiedAt;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return `Hace ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `Hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Hace ${hr} h`;
  const days = Math.round(hr / 24);
  return `Hace ${days} d`;
}

// ---- Module-level cache (30 min) -------------------------------------------

type CacheEntry = {
  result: WeatherResult;
  verifiedAtMs: number;
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const cache = new Map<string, CacheEntry>();

/** Invalida el cache (útil para tests). */
export function __clearWeatherCache(): void {
  cache.clear();
}

// ---- Fetch con timeout vía AbortController (9s) -----------------------------

const FETCH_TIMEOUT_MS = 9_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// ---- Geocoding ---------------------------------------------------------------

async function geocodeCity(city: string): Promise<{ lat: number; lng: number; canonical: string }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`;
  let data: GeoResult;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Geocoding HTTP ${res.status}`);
    }
    data = (await res.json()) as GeoResult;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al geocodificar la ciudad.");
    }
    throw err;
  }

  const hit = data.results?.[0];
  if (!hit) {
    throw new Error("Ciudad no encontrada");
  }
  return { lat: hit.latitude, lng: hit.longitude, canonical: hit.name };
}

// ---- Forecast ----------------------------------------------------------------

async function fetchForecast(lat: number, lng: number): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "temperature_2m,precipitation_probability,uv_index,weathercode",
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "7",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  let data: ForecastResponse;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Forecast HTTP ${res.status}`);
    }
    data = (await res.json()) as ForecastResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al obtener el pronóstico.");
    }
    throw err;
  }
  return data;
}

// ---- Normalización a WeatherResult ------------------------------------------

function buildHourly(fx: ForecastResponse): WeatherHourlyItem[] {
  const hourly = fx.hourly;
  if (!hourly || !hourly.time?.length) return [];
  // Encontrar el índice de la primera hora futura (>= ahora en tz local del sitio).
  const nowMs = Date.now();
  let startIdx = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (!Number.isNaN(t) && t >= nowMs) {
      startIdx = i;
      break;
    }
  }
  const items: WeatherHourlyItem[] = [];
  for (let i = startIdx; i < hourly.time.length && items.length < 8; i++) {
    const code = hourly.weathercode?.[i] ?? 0;
    const mapping = mapWmo(code);
    const rainPctRaw = hourly.precipitation_probability?.[i];
    const uvRaw = hourly.uv_index?.[i];
    items.push({
      hour: formatHour(hourly.time[i]),
      temp: formatTemp(hourly.temperature_2m?.[i]),
      conditionIcon: mapping.icon,
      rainPct: typeof rainPctRaw === "number" && Number.isFinite(rainPctRaw) ? Math.round(rainPctRaw) : 0,
      uv: typeof uvRaw === "number" && Number.isFinite(uvRaw) ? Math.round(uvRaw) : 0,
    });
  }
  return items;
}

function buildDaily(fx: ForecastResponse): WeatherDailyItem[] {
  const daily = fx.daily;
  if (!daily || !daily.time?.length) return [];
  const items: WeatherDailyItem[] = [];
  for (let i = 0; i < daily.time.length && items.length < 7; i++) {
    const code = daily.weathercode?.[i] ?? 0;
    const mapping = mapWmo(code);
    items.push({
      dayAbbrev: dayAbbrevFromDate(daily.time[i]),
      hi: formatTemp(daily.temperature_2m_max?.[i]),
      lo: formatTemp(daily.temperature_2m_min?.[i]),
      conditionIcon: mapping.icon,
    });
  }
  return items;
}

function buildCurrent(fx: ForecastResponse): { now: string; condition: string; conditionIcon: string } {
  // Preferimos `current` cuando está disponible; si no, caemos a la primer hora del hourly.
  const cur = fx.current;
  if (cur && typeof cur.temperature_2m === "number") {
    const m = mapWmo(cur.weather_code ?? 0);
    return {
      now: formatTemp(cur.temperature_2m),
      condition: m.label,
      conditionIcon: m.icon,
    };
  }
  if (fx.hourly?.time?.length) {
    const i = 0;
    const m = mapWmo(fx.hourly.weathercode?.[i] ?? 0);
    return {
      now: formatTemp(fx.hourly.temperature_2m?.[i]),
      condition: m.label,
      conditionIcon: m.icon,
    };
  }
  return { now: "—", condition: "Sin datos", conditionIcon: "cloud" };
}

// ---- API pública -------------------------------------------------------------

/**
 * Geocodifica la ciudad, obtiene el pronóstico de Open-Meteo y devuelve
 * un resultado normalizado listo para renderizar como UiBlock de weather.
 *
 * - Cachea 30 minutos a nivel módulo.
 * - Timeout total: 9s por request vía AbortController.
 * - Lanza `Error("Ciudad no encontrada")` si el geocoder no resuelve la ciudad.
 */
export async function fetchWeather(city: string): Promise<WeatherResult> {
  const key = city.trim().toLowerCase();
  if (!key) throw new Error("Ciudad no encontrada");

  const cachedEntry = cache.get(key);
  const nowMs = Date.now();
  if (cachedEntry && nowMs - cachedEntry.verifiedAtMs < CACHE_TTL_MS) {
    // Refrescamos el freshnessLabel en cada lectura para que refleje la antigüedad real.
    return {
      ...cachedEntry.result,
      freshnessLabel: formatFreshness(cachedEntry.verifiedAtMs),
    };
  }

  const geo = await geocodeCity(city);
  const fx = await fetchForecast(geo.lat, geo.lng);

  const current = buildCurrent(fx);
  const hourly = buildHourly(fx);
  const daily = buildDaily(fx);

  const verifiedAtMs = nowMs;
  const result: WeatherResult = {
    now: current.now,
    condition: current.condition,
    conditionIcon: current.conditionIcon,
    hourly,
    daily,
    verifiedAt: new Date(verifiedAtMs).toISOString(),
    freshnessLabel: formatFreshness(verifiedAtMs),
    city: geo.canonical,
  };

  cache.set(key, { result, verifiedAtMs });
  return result;
}
