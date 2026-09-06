import type { UiBlock, AssistantPlanItem } from "./domain/types";

// ============================================================================
// PREVIEW DATA v4 — Catálogo de cards del sistema Koru (bloques reales).
// Los assets deportivos (escudos/fotos) son reales y viven en
// /public/stitch/sports/ y /public/stitch/sports/players/.
// ============================================================================

export type ChatEntry =
  | { kind: "user"; tag: string; text: string }
  | { kind: "text"; tag: string; text: string }
  | { kind: "card"; tag: string; intro?: string; block: UiBlock };

export type ChatCategory = { id: string; label: string; icon: string; count: number };

const S = "/stitch/sports";
const P = "/stitch/sports/players";

// ── DEPORTES: El Clásico en vivo (datos de muestra, escudos 100% reales) ──
const elClasico: UiBlock = {
  type: "live_match",
  league: "LaLiga EA Sports · Jornada 18",
  status: "2º Tiempo",
  minute: "78'",
  homeName: "Real Madrid",
  awayName: "Barcelona",
  homeScore: 2,
  awayScore: 1,
  homeLogo: `${S}/real-madrid.png`,
  awayLogo: `${S}/barcelona.png`,
  homeColor: "#0a2a6b",
  awayColor: "#a50044",
  venue: "Santiago Bernabéu",
  venueCity: "Madrid",
  attendance: 78297,
  goals: [
    { minute: "23'", team: "Barcelona", scorer: "Lamine Yamal", text: "Lamine Yamal (asistencia de Pedri)", photo: `${P}/yamal.jpg` },
    { minute: "41'", team: "Real Madrid", scorer: "Kylian Mbappé", text: "Kylian Mbappé, penal", photo: `${P}/mbappe.jpg` },
    { minute: "67'", team: "Real Madrid", scorer: "Vinícius Jr.", text: "Vinícius Júnior, contraataque", photo: `${P}/vinicius.jpg` },
  ],
  yellowCards: [
    { minute: "34'", team: "Real Madrid", player: "Tchouaméni" },
    { minute: "52'", team: "Barcelona", player: "Casadó" },
  ],
  substitutions: [
    { minute: "62'", team: "Real Madrid", playerIn: "Rodrygo", playerOut: "Bellingham" },
    { minute: "70'", team: "Barcelona", playerIn: "Ferran Torres", playerOut: "Raphinha" },
  ],
  detailedStats: [
    { label: "Posesión", home: 46, away: 54, isPercent: true },
    { label: "Tiros", home: 14, away: 11, isPercent: false },
    { label: "Tiros al arco", home: 7, away: 4, isPercent: false },
    { label: "Córners", home: 5, away: 8, isPercent: false },
    { label: "Faltas", home: 9, away: 12, isPercent: false },
    { label: "Pases precisos", home: 312, away: 415, isPercent: false },
  ],
  lineups: {
    "Real Madrid": {
      formation: "4-3-3",
      starters: [
        { number: "1", name: "Courtois", position: "POR" },
        { number: "17", name: "Alexander-Arnold", position: "LD" },
        { number: "3", name: "Militão", position: "DFC" },
        { number: "35", name: "Rüdiger", position: "DFC" },
        { number: "23", name: "Mendy", position: "LI" },
        { number: "8", name: "Valverde", position: "MC" },
        { number: "6", name: "Tchouaméni", position: "MC" },
        { number: "10", name: "Bellingham", position: "MCO" },
        { number: "7", name: "Vinícius Jr.", position: "EI" },
        { number: "9", name: "Mbappé", position: "DC" },
        { number: "11", name: "Rodrygo", position: "ED" },
      ],
      subs: [
        { number: "15", name: "Ceballos", position: "MC" },
        { number: "21", name: "Endrick", position: "DC" },
        { number: "18", name: "Baltasar", position: "MC" },
      ],
    },
    Barcelona: {
      formation: "4-2-3-1",
      starters: [
        { number: "13", name: "Iñaki Peña", position: "POR" },
        { number: "23", name: "Koundé", position: "LD" },
        { number: "2", name: "Cubarsí", position: "DFC" },
        { number: "5", name: "Iñigo Martínez", position: "DFC" },
        { number: "3", name: "Balde", position: "LI" },
        { number: "8", name: "Pedri", position: "MC" },
        { number: "16", name: "Casadó", position: "MC" },
        { number: "19", name: "Lamine Yamal", position: "ED" },
        { number: "6", name: "Gavi", position: "MCO" },
        { number: "11", name: "Raphinha", position: "EI" },
        { number: "9", name: "Lewandowski", position: "DC" },
      ],
      subs: [
        { number: "7", name: "Ferran Torres", position: "DC" },
        { number: "14", name: "Pablo Torre", position: "MC" },
        { number: "10", name: "Ansu Fati", position: "EI" },
      ],
    },
  },
};

// ── DEPORTES: Tenis (fotos reales de Alcaraz y Sinner) ──
const alcarazSinner: UiBlock = {
  type: "tennis_match",
  status: "live",
  players: {
    home: { name: "Carlos Alcaraz", country: "ESP", rank: 1, logo: `${P}/alcaraz.jpg` },
    away: { name: "Jannik Sinner", country: "ITA", rank: 2, logo: `${P}/sinner.jpg` },
  },
  tournament: { name: "US Open 2026", round: "Semifinal", surface: "Pista dura", category: "Grand Slam" },
  sets: [
    { homeGames: 6, awayGames: 4, winner: "home" },
    { homeGames: 3, awayGames: 6, winner: "away" },
    { homeGames: 7, awayGames: 6, winner: "home", tiebreak: { homePts: 7, awayPts: 3 } },
  ],
  currentSet: { gamesHome: 4, gamesAway: 5, server: "away" },
  currentPoint: "30-30",
  stats: {
    aces: { h: 8, a: 11 },
    doubleFaults: { h: 2, a: 3 },
    firstServePct: { h: 71, a: 68 },
    breakPointsWon: { h: 3, a: 2 },
    breakPointsFaced: { h: 4, a: 5 },
    returnGamesWon: { h: 28, a: 31 },
  },
  breakPoint: false,
  lastPoints: [
    { point: "30-15", outcome: "won" },
    { point: "30-30", outcome: "lost" },
  ],
  h2h: { record: "7-4", summary: "Alcaraz lidera el head-to-head", surfaceRecord: "3-1 en pista dura" },
};

// ── INFORME: Energía solar en España (el clásico del usuario) ──
const informeSolar: UiBlock = {
  type: "deliverable",
  status: "ready",
  kicker: "Tu Informe",
  title: "ENERGÍA SOLAR EN ESPAÑA",
  description: "Radiación, costos y el punto exacto en que la solar doméstica conviene frente a la red.",
  topic: "energía solar en españa",
  metrics: [
    { value: "2.800 h", label: "Sol/año" },
    { value: "€7.400", label: "Costo medio 3kWp" },
    { value: "6-8 años", label: "Recupero" },
  ],
  summary:
    "España es uno de los mejores países de Europa para autoconsumo solar: combinás 2.800 horas de sol al año con precios de red altísimos y el panel se paga solo en 6 a 8 años. El informe ordena los números por región, los costos reales de instalación y las trampas típicas del contrato.",
  sections: [
    {
      icon: "wb_sunny",
      kicker: "Radiación por zona",
      title: "Dónde pega más el sol",
      kind: "rows",
      items: [
        { title: "Andalucía", subtitle: "~1.750 kWh/kWp/año", badge: "Óptimo", icon: "wb_sunny" },
        { title: "Murcia y Levante", subtitle: "~1.700 kWh/kWp/año", badge: "Óptimo", icon: "wb_sunny" },
        { title: "Madrid (centro)", subtitle: "~1.600 kWh/kWp/año", badge: "Muy bueno", icon: "partly_cloudy_day" },
        { title: "Galicia y norte", subtitle: "~1.250 kWh/kWp/año", badge: "Aceptable", icon: "cloud" },
      ],
    },
    {
      icon: "payments",
      kicker: "Números de instalación",
      title: "Qué cuesta de verdad",
      kind: "grid",
      items: [
        { title: "3 kWp (casa típica)", subtitle: "€7.400 · 8 paneles" },
        { title: "5 kWp + batería", subtitle: "€12.900 · cubre el 90%" },
        { title: "Revisión boletín", subtitle: "€350-600 si el tablero es viejo" },
        { title: "Ahorro medio", subtitle: "€1.100/año con excedentes" },
      ],
    },
    {
      icon: "schedule",
      kicker: "El punto de quiebre",
      title: "Cuándo se recupera",
      kind: "timeline",
      items: [
        { title: "Año 1", subtitle: "Ahorro €1.100 + deducción IRPF pendiente" },
        { title: "Año 3", subtitle: "Precio de la red sube ~12% acumulado" },
        { title: "Año 6", subtitle: "Instalación 3 kWp recuperada" },
        { title: "Año 25", subtitle: "Fin de vida útil · utilidad neta restante" },
      ],
    },
    {
      icon: "gavel",
      kicker: "Cuidados",
      title: "Tres trampas del contrato",
      kind: "bullets",
      bullets: [
        "Precio por panel suelto: siempre pedir cotización por kWp instalado.",
        "Gestión de excedentes no incluida: verificar quién tramita la compensación.",
        "Garantía de producción escrita: si no la ponen en papel, no existe.",
      ],
    },
  ],
  sources: [
    { title: "IDAE — Autoconsumo solar", url: "https://www.idae.es", domain: "idae.es", snippet: "Datos oficiales de radiación y costos." },
    { title: "OMIE — Precio pool", url: "https://www.omie.es", domain: "omie.es", snippet: "Serie histórica del precio de la red." },
  ],
};

// ── CLIMA: Madrid ──
const weatherMadrid: UiBlock = {
  type: "weather",
  city: "Madrid",
  now: "26°",
  feel: "28°",
  condition: "Soleado",
  range: "16° / 31°",
  rain: "5%",
  wind: "11 km/h NE",
  humidity: "34%",
  uv: "7",
  advice: "Sol fuerte entre 13 y 16: gorra y protector si salís a la calle.",
  hourly: [
    { hour: "10h", temp: "23°", conditionIcon: "wb_sunny", rainPct: 0, uv: 4 },
    { hour: "11h", temp: "25°", conditionIcon: "wb_sunny", rainPct: 0, uv: 5 },
    { hour: "12h", temp: "27°", conditionIcon: "wb_sunny", rainPct: 0, uv: 6 },
    { hour: "13h", temp: "29°", conditionIcon: "clear_day", rainPct: 0, uv: 7 },
    { hour: "14h", temp: "30°", conditionIcon: "clear_day", rainPct: 0, uv: 7 },
    { hour: "15h", temp: "31°", conditionIcon: "clear_day", rainPct: 0, uv: 6 },
  ],
  daily: [
    { dayAbbrev: "LUN", hi: "31°", lo: "16°", conditionIcon: "wb_sunny" },
    { dayAbbrev: "MAR", hi: "30°", lo: "17°", conditionIcon: "partly_cloudy_day" },
    { dayAbbrev: "MIÉ", hi: "26°", lo: "15°", conditionIcon: "rainy" },
    { dayAbbrev: "JUE", hi: "24°", lo: "14°", conditionIcon: "rainy" },
    { dayAbbrev: "VIE", hi: "27°", lo: "15°", conditionIcon: "partly_cloudy_day" },
  ],
  freshnessLabel: "Hace 4 min",
  sourceStatus: "verified",
};

// ── PLAN: Tu día ──
const planDia: UiBlock = {
  type: "plan",
  title: "Tu día",
  items: [
    { time: "09:00", title: "Rutina de fuerza (tren superior)", priority: "Alta", icon: "move", durationMinutes: 50, mode: "focus", rationale: "Es la franja donde rinden mejor tus pesadas", detail: "4 series de press + remos" },
    { time: "10:30", title: "Bloque deep work: informe cliente", priority: "Alta", icon: "book", durationMinutes: 90, mode: "focus", detail: "Sin notificaciones" },
    { time: "13:00", title: "Almuerzo + caminata", priority: "Media", icon: "heart", durationMinutes: 45, mode: "recovery" },
    { time: "16:00", title: "Llamada con el estudio contable", priority: "Alta", icon: "message", durationMinutes: 30, mode: "admin" },
    { time: "18:30", title: "Supermercado semanal", priority: "Baja", icon: "home", durationMinutes: 40, mode: "quick" },
  ] as AssistantPlanItem[],
  note: "Dejé la ventana de 14 a 16 libre: es cuando más te cuesta concentrarte.",
};

// ── Script del chat ────────────────────────────────────────────────────────
export const CHAT_SCRIPT: ChatEntry[] = [
  { kind: "text", tag: "informes", text: "¡Hola, Arx! ¿Cómo va todo? Acá listo para lo que necesites." },
  { kind: "user", tag: "informes", text: "haceme un informe de energía solar en españa" },
  { kind: "card", tag: "informes", intro: "Listo, te lo armé con fuentes oficiales:", block: informeSolar },
  { kind: "user", tag: "clima", text: "qué tiempo hace en madrid?" },
  { kind: "card", tag: "clima", block: weatherMadrid },
  { kind: "user", tag: "dia", text: "planificame el día" },
  { kind: "card", tag: "dia", intro: "Te armé el día con tus energías en mente:", block: planDia },
  { kind: "user", tag: "deportes", text: "cómo va el clásico?" },
  { kind: "card", tag: "deportes", intro: "Lo sigo minuto a minuto, va 2-1:", block: elClasico },
  { kind: "user", tag: "deportes", text: "y el partido de alcaraz?" },
  { kind: "card", tag: "deportes", intro: "Semifinal apretada, va el 4º set:", block: alcarazSinner },
];

export const CHAT_CATALOG: ChatCategory[] = [
  { id: "all", label: "Todo", icon: "apps", count: CHAT_SCRIPT.length },
  { id: "informes", label: "Informes", icon: "description", count: 3 },
  { id: "deportes", label: "Deportes", icon: "sports_soccer", count: 4 },
  { id: "clima", label: "Clima", icon: "partly_cloudy_day", count: 2 },
  { id: "dia", label: "Día a día", icon: "today", count: 2 },
];
