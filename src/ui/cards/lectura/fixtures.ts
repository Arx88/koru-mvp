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

export const planBlock: Extract<UiBlock, { type: "plan" }> = {
  type: "plan",
  title: "Tu día",
  note: "Te dejé la tarde con aire — el hueco grande no lo llené a propósito.",
  items: [
    {
      time: "08:00",
      title: "Desayuno tranquilo",
      detail: "Café + tostadas · 25 min antes de arrancar",
      icon: "home",
      mode: "recovery",
      durationMinutes: 25,
      done: true,
    },
    {
      time: "09:00",
      title: "Trabajo profundo",
      detail: "2 h sin notificaciones · después me contás",
      icon: "book",
      mode: "focus",
      durationMinutes: 120,
      done: true,
    },
    {
      time: "13:30",
      title: "Almuerzo con Sofi",
      detail: "Café Oui · reservado para 2 · son 6 cuadras",
      icon: "message",
      mode: "quick",
      durationMinutes: 90,
    },
    {
      time: "18:30",
      title: "Gym · piernas",
      detail: "1 h · llevalo liviano, venís del almuerzo largo",
      icon: "move",
      mode: "focus",
      durationMinutes: 60,
    },
    {
      time: "20:30",
      title: "Cine con Juan",
      detail: "El Rojo 20:45 · compré las entradas ya",
      icon: "flag",
      mode: "quick",
      durationMinutes: 140,
    },
  ],
};

export const outfitBlock: Extract<UiBlock, { type: "outfit" }> = {
  type: "outfit",
  title: "Lo que yo te pondría",
  buttonLabel: "Guardar este look",
  specs: [
    { emoji: "🌡️", label: "Temperatura", value: "26°" },
    { emoji: "🌡️", label: "Mínima noche", value: "19°" },
    { emoji: "💨", label: "Viento", value: "14 km/h NE" },
    { emoji: "☀️", label: "Índice UV", value: "6" },
    { emoji: "☕", label: "Ocasión", value: "café + paseo" },
  ],
};

export const liveMatchBlock: Extract<UiBlock, { type: "live_match" }> = {
  type: "live_match",
  league: "LaLiga · Jornada 5",
  status: "en vivo",
  minute: "78'",
  time: "domingo 21:00",
  homeName: "Real Madrid",
  awayName: "Barcelona",
  homeScore: 2,
  awayScore: 1,
  homeLogo: "/stitch/sports/real-madrid.png",
  awayLogo: "/stitch/sports/barcelona.png",
  venue: "Santiago Bernabéu",
  homePossession: "58%",
  awayPossession: "42%",
  homeShots: "12",
  awayShots: "7",
  goals: [
    { minute: "12'", team: "Real Madrid", scorer: "Bellingham", text: "cabezazo tras córner de Rodrygo", photo: "/stitch/sports/players/bellingham.jpg" },
    { minute: "34'", team: "Barcelona", scorer: "Lamine Yamal", text: "diagonal y definición cruzada", photo: "/stitch/sports/players/yamal.jpg" },
    { minute: "71'", team: "Real Madrid", scorer: "Mbappé", text: "contraataque en 3 toques, solo ante el arquero", photo: "/stitch/sports/players/mbappe.jpg" },
  ],
};
