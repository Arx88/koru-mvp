import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchWeather,
  __clearWeatherCache,
  type WeatherResult,
} from "./weatherTool";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para construir respuestas fake de Open-Meteo
// ─────────────────────────────────────────────────────────────────────────────

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Construye un forecast fake válido con N horas futuras y 7 días. */
function makeForecastResponse(opts: {
  currentCode?: number;
  currentTemp?: number;
  hourlyCodes?: number[];
}): unknown {
  const currentCode = opts.currentCode ?? 0;
  const currentTemp = opts.currentTemp ?? 18;

  const hourlyCount = 10;
  const hourlyTimes = Array.from({ length: hourlyCount }, (_, i) =>
    // Empezamos 1 hora en el futuro para asegurar t >= now.
    isoFromNow((i + 1) * 3600 * 1000),
  );
  const defaultHourlyCodes = opts.hourlyCodes ?? Array(hourlyCount).fill(0);

  return {
    timezone: "Europe/Madrid",
    current: {
      time: isoFromNow(0),
      temperature_2m: currentTemp,
      weather_code: currentCode,
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: Array(hourlyCount).fill(20),
      precipitation_probability: Array(hourlyCount).fill(10),
      uv_index: Array(hourlyCount).fill(3),
      weathercode: defaultHourlyCodes,
    },
    daily: {
      time: Array.from({ length: 7 }, (_, i) => dateOffset(i)),
      weathercode: [0, 1, 2, 3, 45, 61, 71],
      temperature_2m_max: [25, 26, 27, 28, 24, 22, 20],
      temperature_2m_min: [10, 11, 12, 13, 9, 8, 7],
    },
  };
}

function makeGeoResponse(cityName: string): unknown {
  return {
    results: [
      {
        id: 1,
        name: cityName,
        latitude: 40.42,
        longitude: -3.7,
        country: "Spain",
        admin1: "Madrid",
        timezone: "Europe/Madrid",
      },
    ],
  };
}

function makeEmptyGeoResponse(): unknown {
  return { results: [] };
}

type FetchMock = ReturnType<typeof vi.fn>;

/** Instala un mock global de fetch que responde según la URL. */
function installFetchMock(handler: (url: string) => { json: unknown; status?: number }): FetchMock {
  const mock: FetchMock = vi.fn(async (url: string | URL) => {
    const urlStr = String(url);
    const { json, status = 200 } = handler(urlStr);
    return new Response(JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("weatherTool — fetchWeather", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    __clearWeatherCache();
    fetchMock = installFetchMock((url) => {
      if (url.includes("geocoding-api.open-meteo.com")) {
        return { json: makeGeoResponse("Madrid") };
      }
      if (url.includes("api.open-meteo.com/v1/forecast")) {
        return { json: makeForecastResponse({}) };
      }
      return { json: {}, status: 404 };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve la estructura correcta: now, condition, hourly (8), daily (7)", async () => {
    const result: WeatherResult = await fetchWeather("Madrid");

    expect(result).toBeDefined();
    expect(typeof result.now).toBe("string");
    expect(typeof result.condition).toBe("string");
    expect(typeof result.conditionIcon).toBe("string");
    expect(result.hourly).toHaveLength(8);
    expect(result.daily).toHaveLength(7);

    // Cada hourly item tiene la forma esperada.
    for (const h of result.hourly) {
      expect(typeof h.hour).toBe("string");
      expect(typeof h.temp).toBe("string");
      expect(typeof h.conditionIcon).toBe("string");
      expect(typeof h.rainPct).toBe("number");
      expect(typeof h.uv).toBe("number");
    }

    // Cada daily item tiene la forma esperada.
    for (const d of result.daily) {
      expect(typeof d.dayAbbrev).toBe("string");
      expect(typeof d.hi).toBe("string");
      expect(typeof d.lo).toBe("string");
      expect(typeof d.conditionIcon).toBe("string");
    }

    // city canónica queda registrada.
    expect(result.city).toBe("Madrid");

    // verifiedAt y freshnessLabel presentes.
    expect(typeof result.verifiedAt).toBe("string");
    expect(typeof result.freshnessLabel).toBe("string");

    // El mock fue llamado dos veces: geocode + forecast.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("weatherTool — WMO code mapping", () => {
  beforeEach(() => {
    __clearWeatherCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("code 0 → 'Despejado'", async () => {
    const mock = installFetchMock((url) => {
      if (url.includes("geocoding-api")) return { json: makeGeoResponse("Madrid") };
      return { json: makeForecastResponse({ currentCode: 0, currentTemp: 22 }) };
    });

    const result = await fetchWeather("Madrid");
    expect(result.condition).toBe("Despejado");
    expect(result.conditionIcon).toBe("wb_sunny");
    expect(mock).toHaveBeenCalled();
  });

  it("code 61 → 'Lluvia'", async () => {
    installFetchMock((url) => {
      if (url.includes("geocoding-api")) return { json: makeGeoResponse("Madrid") };
      return { json: makeForecastResponse({ currentCode: 61, currentTemp: 12 }) };
    });

    const result = await fetchWeather("Madrid");
    expect(result.condition).toBe("Lluvia");
    expect(result.conditionIcon).toBe("rainy");
  });

  it("code 71 → 'Nieve'", async () => {
    installFetchMock((url) => {
      if (url.includes("geocoding-api")) return { json: makeGeoResponse("Madrid") };
      return { json: makeForecastResponse({ currentCode: 71, currentTemp: -2 }) };
    });

    const result = await fetchWeather("Madrid");
    expect(result.condition).toBe("Nieve");
    expect(result.conditionIcon).toBe("ac_unit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("weatherTool — cache (30 min TTL)", () => {
  beforeEach(() => {
    __clearWeatherCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("la segunda llamada dentro de 30 min no vuelve a llamar a fetch", async () => {
    const mock = installFetchMock((url) => {
      if (url.includes("geocoding-api")) return { json: makeGeoResponse("Madrid") };
      return { json: makeForecastResponse({}) };
    });

    // Primera llamada: 2 fetches (geocode + forecast).
    const first = await fetchWeather("Madrid");
    expect(mock).toHaveBeenCalledTimes(2);
    expect(first.condition).toBe("Despejado");

    // Segunda llamada inmediata: debe usar cache (0 fetches adicionales).
    const second = await fetchWeather("Madrid");
    expect(mock).toHaveBeenCalledTimes(2);

    // El resultado cacheado sigue siendo válido.
    expect(second.condition).toBe("Despejado");
    expect(second.hourly).toHaveLength(8);
    expect(second.daily).toHaveLength(7);
  });

  it("consultar otra ciudad sí vuelve a llamar a fetch", async () => {
    const mock = installFetchMock((url) => {
      if (url.includes("geocoding-api")) {
        return { json: makeGeoResponse(url.includes("Barcelona") ? "Barcelona" : "Madrid") };
      }
      return { json: makeForecastResponse({}) };
    });

    await fetchWeather("Madrid");
    expect(mock).toHaveBeenCalledTimes(2);

    await fetchWeather("Barcelona");
    expect(mock).toHaveBeenCalledTimes(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("weatherTool — errores", () => {
  beforeEach(() => {
    __clearWeatherCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lanza Error cuando el geocoder no encuentra la ciudad", async () => {
    installFetchMock((url) => {
      if (url.includes("geocoding-api")) return { json: makeEmptyGeoResponse() };
      return { json: makeForecastResponse({}) };
    });

    await expect(fetchWeather("CiudadInexistenteXYZ")).rejects.toThrow(
      /Ciudad no encontrada/,
    );
  });

  it("lanza Error cuando la ciudad es string vacío", async () => {
    installFetchMock(() => ({ json: makeEmptyGeoResponse() }));
    await expect(fetchWeather("   ")).rejects.toThrow(/Ciudad no encontrada/);
  });
});
