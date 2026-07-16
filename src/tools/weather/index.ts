/**
 * Bloque Weather — barrel de tools.
 *
 * Registra la tool `weather_forecast` que envuelve a `fetchWeather` (Open-Meteo,
 * sin API key) y devuelve un `WeatherResult` normalizado listo para renderizar
 * como UiBlock de tipo `weather` (con hourly + daily + freshness).
 *
 * Política: solo lectura externa (open-meteo), sin aprobación del usuario.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchWeather, type WeatherResult } from "./weatherTool";

export const weatherForecast: ToolHandler = {
  definition: defineTool(
    "weather_forecast",
    "Obtiene el clima actual y pronóstico de 7 días para una ciudad. Úsala cuando el usuario diga 'clima en Madrid', '¿va a llover hoy en Bogotá?', 'cuánto calor hace en Lima', 'pronóstico para el finde en Córdoba'. Devuelve temperatura actual, condición, hourly (8h) y daily (7d).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        city: {
          type: "string",
          description: "Nombre de la ciudad (ej: 'Madrid', 'Buenos Aires', 'Ciudad de México').",
        },
      },
      required: ["city"],
    },
  ),
  policy: policies.readonly("Lee clima público desde Open-Meteo (sin API key)."),
  async run(args) {
    const city = String(args.city ?? "").trim();
    if (!city) {
      return { type: "weather_forecast", status: "failed", error: "Indicá una ciudad." };
    }
    try {
      const result: WeatherResult = await fetchWeather(city);
      return {
        type: "weather_forecast",
        status: "ok",
        ...result,
      };
    } catch (err) {
      return {
        type: "weather_forecast",
        status: "failed",
        error: err instanceof Error ? err.message : "No pude obtener el clima.",
        city,
      };
    }
  },
};

export const weatherTools: ToolHandler[] = [weatherForecast];
