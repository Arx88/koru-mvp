/**
 * Fixtures de UiBlocks para los interiores Lectura Visual.
 *
 * Datos representativos del dominio real (contrato de src/domain/types.ts)
 * para tests y para la galería de verificación visual. Cada card integrada
 * agrega su fixture acá.
 */
import type { UiBlock } from "../../../domain/types";

export const weatherBlock: Extract<UiBlock, { type: "weather" }> = {
  type: "weather",
  title: "Clima Madrid",
  city: "Madrid",
  now: "26°",
  feel: "27°",
  condition: "Parcial",
  range: "19°–29°",
  rain: "10%",
  wind: "12 km/h NE",
  humidity: "38%",
  uv: "6",
  advice: "Ligero para la tarde, algo abrigado para la noche.",
  hourly: [
    { hour: "15", temp: "26°", conditionIcon: "partly_cloudy_day", rainPct: 5, uv: 5 },
    { hour: "16", temp: "27°", conditionIcon: "partly_cloudy_day", rainPct: 5, uv: 5 },
    { hour: "17", temp: "28°", conditionIcon: "clear_day", rainPct: 0, uv: 4 },
    { hour: "18", temp: "29°", conditionIcon: "clear_day", rainPct: 0, uv: 3 },
    { hour: "19", temp: "27°", conditionIcon: "partly_cloudy_day", rainPct: 10, uv: 2 },
    { hour: "20", temp: "24°", conditionIcon: "cloudy", rainPct: 15, uv: 1 },
    { hour: "21", temp: "22°", conditionIcon: "cloudy", rainPct: 20, uv: 0 },
    { hour: "22", temp: "20°", conditionIcon: "partly_cloudy_night", rainPct: 20, uv: 0 },
  ],
  daily: [
    { dayAbbrev: "Lun", hi: "28°", lo: "18°", conditionIcon: "clear_day" },
    { dayAbbrev: "Mar", hi: "26°", lo: "17°", conditionIcon: "partly_cloudy_day" },
    { dayAbbrev: "Mié", hi: "23°", lo: "16°", conditionIcon: "rainy" },
    { dayAbbrev: "Jue", hi: "22°", lo: "15°", conditionIcon: "cloudy" },
    { dayAbbrev: "Vie", hi: "24°", lo: "15°", conditionIcon: "partly_cloudy_day" },
    { dayAbbrev: "Sáb", hi: "27°", lo: "17°", conditionIcon: "clear_day" },
    { dayAbbrev: "Dom", hi: "25°", lo: "16°", conditionIcon: "partly_cloudy_day" },
  ],
  freshnessLabel: "Hace 4 min",
};
