import type { UiBlock, AssistantPlanItem } from "./domain/types";
// ============================================================================
// PREVIEW DATA v5 — Catálogo COMPLETO del sistema Koru en un chat real.
//
// Cobertura: los 55 tipos renderizables de UiBlock aparecen al menos una vez
// en CHAT_SCRIPT (los ~40 con fixtures dedicados + 15 tipos que antes no
// tenían datos de preview: reminder, shopping_list, clarifying_question,
// activity_group, activity_tracker, data_card, decision_support,
// exercise_plan, proactive_signal, review_quote, travel_planner, urgent_now,
// web_nav, wellbeing, generation).
//
// Reglas de arquitectura:
//  1. Fuente única de verdad: los blocks con fixture dedicado se importan de
//     ui/cards/lectura/fixtures.ts (mismos datos que la galería /lectura.html
//     y los tests de interiores). CERO duplicación con fixtures.
//  2. Los 5 "momentos hero" del showcase (informe, clima, plan, clásico,
//     tenis) viven acá porque son variantes más ricas (lineups, secciones,
//     fuentes) que el fixture mínimo.
//  3. El catálogo de categorías se DERIVA del script (deriveCatalog) para que
//     los contadores nunca se desincronicen del contenido.
//  4. Cada tipo de block aparece exactamente una vez (excepción documentada:
//     saved_record aparece dos veces porque su interior es un ROUTER —
//     1 record → comprobante, N records → bóveda).
// ============================================================================

// Fixture imports — fuente única de verdad para estos 36 tipos.
import {
  outfitBlock,
  newsUrgentBlock,
  restaurantBlock,
  recipeBlock,
  movieBlock,
  bookBlock,
  alarmBlock,
  checklistBlock,
  briefBlock,
  healthBlock,
  marketBlock,
  cryptoBlock,
  forexBlock,
  moneyBlock,
  tickerBlock,
  routeTimelineBlock,
  routeMapBlock,
  transportBlock,
  deliveryBlock,
  bcalBlock,
  balarmBlock,
  socialBlock,
  comparisonBlock,
  productBlock,
  reviewScoreBlock,
  travelPlanBlock,
  savedRecordBlock,
  vaultBlock,
  memoryBlock,
  researchSourcesBlock,
  reviewDocumentBlock,
  resourceBundleBlock,
  electionResultsBlock,
  electionVoteBlock,
  matchTimelineBlock,
  matchStatsBlock,
} from "./ui/cards/lectura/fixtures";

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

// ── DÍA A DÍA ────────────────────────────────────────────────────────────

// clarifying_question: Koru pregunta antes de armar algo (turno conversacional)
const clarifyingFinde: UiBlock = {
  type: "clarifying_question",
  title: "Antes de armarte el plan",
  question: "¿Querés algo tranqui en casa o una escapada corta?",
  expectedSlot: "tipo de plan",
  options: ["Tranqui en casa", "Escapada de un día", "Finde completo afuera"],
};

// reminder: el recordatorio mínimo del sistema
const reminderDentista: UiBlock = {
  type: "reminder",
  title: "Llamar al dentista",
  dueText: "Hoy 16:00",
  note: "Confirmar el turno del viernes y preguntar por la limpieza semestral.",
};

// shopping_list: lista durable con cantidades y lo ya comprado
const superSemanal: UiBlock = {
  type: "shopping_list",
  title: "Super de la semana",
  items: ["Café en grano", "Leche descremada", "Huevos", "Palta", "Tomate", "Pechuga", "Yogur griego", "Pan integral"],
  quantities: { "Café en grano": 2, Huevos: 12, Pechuga: 3 },
  checked: ["Pan integral"],
  dueText: "antes del sábado",
  note: "Lo armé cruzando lo que falta con tus recetas guardadas de la semana.",
};

// activity_group: el panorama tipo Home Screen con tiles y filas
const panoramaSemana: UiBlock = {
  type: "activity_group",
  title: "Tu semana en un vistazo",
  subtitle: "Lunes a viernes · actualizado ahora",
  energy: { value: 72, label: "energía" },
  sections: [
    {
      id: "hoy",
      title: "Hoy",
      tone: "green",
      tiles: [
        { kind: "weather", label: "Tarde", value: "26°", detail: "Parcial · ideal para caminar" },
        { kind: "calendar", label: "Reunión", value: "16:00", detail: "Llamada con el estudio contable", urgent: true },
        { kind: "health", label: "Vitamina D", value: "Pendiente", detail: "Con el almuerzo" },
        { kind: "money", label: "Gasto hoy", value: "€14,20", detail: "Café + subte" },
      ],
    },
    {
      id: "rachas",
      title: "Rachas",
      tone: "blue",
      rows: [
        { title: "Gym · 4 días seguidos", meta: "racha viva", actionLabel: "Ver" },
        { title: "Lectura nocturna · 12 días", meta: "racha viva" },
        { title: "Journaling", meta: "cortada ayer", actionLabel: "Retomar" },
      ],
    },
    {
      id: "plata",
      title: "Plata",
      tone: "amber",
      rows: [
        { title: "Gasto semanal", meta: "−€182 · bajo tu media" },
        { title: "Suscripciones", meta: "€36/mes", actionLabel: "Revisar" },
      ],
    },
  ],
};

// activity_tracker: métricas del día con progreso real
const trackerHoy: UiBlock = {
  type: "activity_tracker",
  title: "Tu día en números",
  subtitle: "Hasta las 19:40",
  metrics: [
    { icon: "directions_walk", iconColor: "#0f9d76", label: "Pasos", value: "8.240", unit: "de 10.000", progress: 82, progressColor: "#0f9d76" },
    { icon: "local_fire_department", iconColor: "#e8714a", label: "Calorías", value: "1.780", unit: "kcal activas", progress: 64, progressColor: "#e8714a" },
    { icon: "fitness_center", iconColor: "#6b5fd4", label: "Fuerza", value: "Hecho", unit: "tren superior", progress: 100, progressColor: "#6b5fd4" },
    { icon: "water_drop", iconColor: "#3b8fd4", label: "Hidratación", value: "1,6 L", unit: "de 2,2 L", progress: 73, progressColor: "#3b8fd4" },
    { icon: "bedtime", iconColor: "#5b6bd6", label: "Sueño", value: "7h 12m", unit: "anoche", progress: 90, progressColor: "#5b6bd6" },
  ],
};

// wellbeing: tablero de bienestar con secciones + sugerencia
const bienestarHoy: UiBlock = {
  type: "wellbeing",
  title: "Tu bienestar hoy",
  emoji: "🌿",
  sections: [
    { icon: "bedtime", iconColor: "#5b6bd6", bgColor: "#eef0fb", value: "7h 12m", label: "Dormiste" },
    { icon: "self_improvement", iconColor: "#2e9e7b", bgColor: "#e8f6f0", value: "Bajo", label: "Estrés" },
    { icon: "favorite", iconColor: "#d65b6b", bgColor: "#fdeef0", value: "68 bpm", label: "Reposo" },
    { icon: "mood", iconColor: "#c98a2d", bgColor: "#fbf3e4", value: "8/10", label: "Ánimo" },
  ],
  sleep: { icon: "bedtime", value: "23:40 → 06:52", label: "5 ciclos completos" },
  suggestion: { icon: "wb_twilight", value: "15 min de sol", label: "antes de las 11 mejora tu ánimo de hoy" },
};

// proactive_signal: Koru avisa antes de que preguntes
const senalFrente: UiBlock = {
  type: "proactive_signal",
  category: "weather",
  severity: "useful",
  title: "Cambio de clima a la tarde",
  body: "A las 17 entra un frente: 60% de probabilidad de lluvia y baja 8 grados. Si salís a caminar, hacélo antes de las 16.",
  timestampLabel: "hace 12 min",
  sourceStatus: "verified",
  actionLabel: "Ajustar el plan",
  followUpQuestion: "¿Te muevo la caminata a la mañana?",
  sources: [{ title: "AEMET · Madrid", url: "https://www.aemet.es", domain: "aemet.es", snippet: "Aviso de frente húmedo vespertino." }],
  summaryItems: [
    { label: "Prob. lluvia", value: "60%", detail: "desde las 17" },
    { label: "Bajada", value: "−8°", detail: "pico 31° → 23°" },
  ],
};

// ── INFORMES / CONOCIMIENTO ───────────────────────────────────────────────

// data_card: datos concretos validados con cita y fuente por item
const datosLuz: UiBlock = {
  type: "data_card",
  title: "Precio de la luz hoy · datos verificados",
  sourceStatus: "verified",
  items: [
    { label: "Pico (19–22h)", value: "0,31 €/kWh", detail: "Máximo del día", quote: "El tramo punta cerró en 31 céntimos", sourceDomain: "omie.es", sourceUrl: "https://www.omie.es" },
    { label: "Valle (2–6h)", value: "0,09 €/kWh", detail: "El momento más barato para la lavadora", quote: "Mínimo nocturno de 9 céntimos", sourceDomain: "omie.es", sourceUrl: "https://www.omie.es" },
    { label: "Media de tu mes", value: "0,18 €/kWh", detail: "4% arriba del mes pasado", sourceDomain: "ree.es", sourceUrl: "https://www.ree.es" },
  ],
};

// web_nav: búsqueda web con hallazgos y resultados
const busquedaCafe: UiBlock = {
  type: "web_nav",
  title: "Búsqueda: cafés de especialidad en Madrid",
  status: "complete",
  query: "mejores cafeterías de especialidad Madrid",
  summary: "Tres fuentes coinciden: el specialty madrileño se concentra en Malasaña y Chueca, y el tueste local creció 30% este año.",
  findings: [
    "Hola Coffee y Magick se repiten como top 2 en las tres guías",
    "El tueste local madrileño creció 30% este año",
    "Casi todas cierran a las 19h — el espresso de tarde tiene horario",
  ],
  results: [
    { title: "Las 10 mejores cafeterías de Madrid", source: "El País", url: "https://elpais.com", type: "article", readTime: "6 min", snippet: "El café de especialidad se consolidó en Malasaña..." },
    { title: "Guía de café 2026", source: "Time Out Madrid", url: "https://timeout.com", type: "article", readTime: "4 min", snippet: "Magick, Hola Coffee y Nolla encabezan el ranking..." },
    { title: "Mapa del tueste local", source: "cafesdemadrid.es", url: "https://cafesdemadrid.es", type: "page", readTime: "2 min", snippet: "Directorio de tostadores de la ciudad..." },
  ],
};

// generation: resultado de generación (variante texto, honesta sin imágenes)
const generacionWallpaper: UiBlock = {
  type: "generation",
  title: "Tu concepto de wallpaper",
  prompt: "un amanecer minimalista sobre sierras suaves, paleta lavanda y durazno, sin texto",
  resultType: "text",
  preview: "Horizonte bajo con tres capas de sierras en degradé lavanda→durazno, sol como círculo plano color miel y grano sutil de película. Pensado para lock screen: el 60% inferior queda liso para que los íconos respiren.",
  actionLabel: "Ver variantes",
  actionIcon: "style",
  tips: [
    "Pedí paleta exacta: “usá #b8a9e8 y #f6c6a0” para clavar el tono",
    "Sumá “sin texto” para evitar tipografías raras",
    "Pedí series: “dame 3 con distinto peso de grano”",
  ],
  style: "minimal-flat",
  aspectRatio: "9:16",
};

// review_quote: cita textual de una fuente
const citaPedri: UiBlock = {
  type: "review_quote",
  sourceName: "Marca",
  sourceType: "Prensa deportiva",
  quote: "Pedri está jugando su mejor temporada: el mediocampo del Barça pasa por sus pies, y el clásico lo volvió a demostrar.",
  tags: ["Barcelona", "LaLiga", "análisis"],
  buttonLabel: "Leer la nota completa",
};

// ── DINERO / DECISIONES ────────────────────────────────────────────────────

// decision_support: opciones con probabilidad + factores + recomendación
const decisionAlquiler: UiBlock = {
  type: "decision_support",
  title: "¿Renovar el alquiler o cambiar de piso?",
  options: [
    { label: "Renegociar y quedarte", probability: 60 },
    { label: "Mudarte a Chamberí", probability: 30 },
    { label: "Esperar a marzo", probability: 10 },
  ],
  factors: [
    "El alquiler sube 8% al renovar en enero",
    "Chamberí te suma 25 min de viaje por día",
    "En marzo terminan dos obras ruidosas en tu cuadra",
  ],
  recommendation: "Renegociar: pedí congelar el precio 6 meses a cambio de firma anual — con tu historial de pagos lo tenés fácil.",
};

// ── CUERPO ────────────────────────────────────────────────────────────────

// exercise_plan: plan durable con sesiones + log histórico (habilita 1RM)
const planFuerza: UiBlock = {
  type: "exercise_plan",
  title: "Tu plan de fuerza",
  plan: {
    id: "plan-fuerza-8w",
    name: "Fuerza 8 semanas",
    weeksTotal: 8,
    currentSessionIdx: 10,
    createdAt: "2026-07-14T09:00:00.000Z",
    status: "active",
    sessions: [
      {
        id: "s1",
        dayLabel: "Lunes · Empuje",
        order: 0,
        exercises: [
          { exercise: "Press banca", sets: 4, reps: 8, weight: 72.5, restSec: 120 },
          { exercise: "Press militar", sets: 4, reps: 10, weight: 40, restSec: 90 },
          { exercise: "Fondos en paralelas", sets: 3, reps: 12, restSec: 75 },
        ],
      },
      {
        id: "s2",
        dayLabel: "Miércoles · Tirón",
        order: 1,
        exercises: [
          { exercise: "Dominadas", sets: 4, reps: 6, restSec: 120, notes: "Con banda si fallás la quinta" },
          { exercise: "Remo con barra", sets: 4, reps: 10, weight: 60, restSec: 90 },
          { exercise: "Curl bíceps", sets: 3, reps: 12, weight: 22.5, restSec: 60 },
        ],
      },
      {
        id: "s3",
        dayLabel: "Viernes · Piernas",
        order: 2,
        exercises: [
          { exercise: "Sentadilla", sets: 5, reps: 5, weight: 95, restSec: 150 },
          { exercise: "Peso muerto", sets: 3, reps: 8, weight: 110, restSec: 120 },
          { exercise: "Zancadas búlgaras", sets: 3, reps: 12, restSec: 60 },
        ],
      },
    ],
  },
  workoutLogs: [
    {
      id: "log-10",
      planId: "plan-fuerza-8w",
      sessionId: "s1",
      date: "2026-09-07",
      durationMin: 52,
      kcal: 410,
      exercises: [
        { exercise: "Press banca", sets: 4, reps: 8, weight: 72.5 },
        { exercise: "Press militar", sets: 4, reps: 10, weight: 40 },
        { exercise: "Fondos en paralelas", sets: 3, reps: 12 },
      ],
    },
  ],
  userWeightKg: 78,
};

// ── MEMORIA / URGENTES ────────────────────────────────────────────────────

// urgent_now: interrupción legítima mientras charlan
const urgentePaquete: UiBlock = {
  type: "urgent_now",
  eyebrow: "ahora mismo",
  icon: "local_shipping",
  iconColor: "#b3261e",
  iconBg: "#fdeceb",
  headline: "El repartidor está en el portón",
  description: "DHL intenta entregar tu paquete desde hace 4 minutos. Si no respondés, lo deja en el kiosco de la esquina y vuelve mañana.",
};

// ── VIAJES ──────────────────────────────────────────────────────────────

// travel_planner: itinerario de paradas (diferente del travel_plan completo)
const vueloMadrid: UiBlock = {
  type: "travel_planner",
  destination: "Madrid",
  dates: "12–15 de octubre",
  steps: [
    { time: "07:10", label: "Salida EZE", detail: "Vuelo IB6844 · puerta B12", icon: "flight_takeoff" },
    { time: "13:45", label: "Escala GRX", detail: "1h 50min · misma terminal", icon: "connecting_airports" },
    { time: "20:35", label: "Llegada MAD", detail: "Terminal 4 · metro directo al hotel", icon: "flight_land" },
    { time: "21:30", label: "Check-in", detail: "Hotel Lavapiés · confirmada", icon: "hotel" },
  ],
  actionLabel: "Ver el viaje completo",
};

// ── Script del chat: un día completo con Koru (55 tipos de block) ──────────
// El orden sigue el arco natural de un día: mañana → informes → memoria →
// dinero → deportes → mundo → comida/ocio → compras → viajes → rutas →
// personas. Cada pedido de usuario dispara el block correspondiente con
// datos reales del dominio.
export const CHAT_SCRIPT: ChatEntry[] = [
  // ── ARRANQUE ──
  { kind: "text", tag: "dia", text: "¡Hola, Arx! ¿Cómo va todo? Acá listo para lo que necesités." },
  { kind: "user", tag: "dia", text: "organizame algo para el finde" },
  { kind: "card", tag: "dia", block: clarifyingFinde },

  // ── MAÑANA ──
  { kind: "user", tag: "dia", text: "buen día koru" },
  { kind: "card", tag: "dia", intro: "Buen día, Arx. Acá va tu resumen:", block: briefBlock },
  { kind: "user", tag: "dia", text: "qué tiempo hace en madrid?" },
  { kind: "card", tag: "dia", block: weatherMadrid },
  { kind: "user", tag: "dia", text: "qué me pongo?" },
  { kind: "card", tag: "dia", intro: "Para hoy te armaría esto:", block: outfitBlock },
  { kind: "user", tag: "dia", text: "planificame el día" },
  { kind: "card", tag: "dia", intro: "Te armé el día con tus energías en mente:", block: planDia },
  { kind: "user", tag: "dia", text: "recordame llamar al dentista a las 16" },
  { kind: "card", tag: "dia", intro: "Anotado:", block: reminderDentista },
  { kind: "user", tag: "dia", text: "anotame: reunión con Marcos el jueves 10:30" },
  { kind: "card", tag: "dia", intro: "Lo dejé tal cual me lo dictaste:", block: reviewDocumentBlock },
  { kind: "user", tag: "dia", text: "armame la lista del super" },
  { kind: "card", tag: "dia", intro: "Con lo que falta de la semana:", block: superSemanal },
  { kind: "user", tag: "dia", text: "despertame mañana 6:30" },
  { kind: "card", tag: "dia", intro: "Alarma lista:", block: alarmBlock },
  { kind: "user", tag: "dia", text: "me tomé la vitamina hoy?" },
  { kind: "card", tag: "dia", intro: "Todavía no — te la debo:", block: healthBlock },
  { kind: "user", tag: "dia", text: "cómo vengo?" },
  { kind: "card", tag: "dia", intro: "Así venís hoy:", block: bienestarHoy },
  { kind: "text", tag: "dia", text: "Antes de que salgas, algo que te conviene saber:" },
  { kind: "card", tag: "dia", block: senalFrente },
  { kind: "user", tag: "dia", text: "cómo viene mi semana?" },
  { kind: "card", tag: "dia", intro: "Panorama completo:", block: panoramaSemana },
  { kind: "user", tag: "dia", text: "y mi actividad de hoy?" },
  { kind: "card", tag: "dia", block: trackerHoy },
  { kind: "user", tag: "dia", text: "cómo sigue mi plan de fuerza?" },
  { kind: "card", tag: "dia", intro: "Vas por la sesión 11 de 24:", block: planFuerza },
  { kind: "user", tag: "dia", text: "qué me queda pendiente del notebook?" },
  { kind: "card", tag: "dia", intro: "Tres cosas sueltas del notebook:", block: checklistBlock },

  // ── INFORMES ──
  { kind: "user", tag: "informes", text: "haceme un informe de energía solar en españa" },
  { kind: "card", tag: "informes", intro: "Listo, te lo armé con fuentes oficiales:", block: informeSolar },
  { kind: "user", tag: "informes", text: "pasame las fuentes del informe" },
  { kind: "card", tag: "informes", intro: "Acá está lo que usé:", block: researchSourcesBlock },
  { kind: "user", tag: "informes", text: "tirame datos duros del precio de la luz" },
  { kind: "card", tag: "informes", intro: "Verificados contra OMIE y REE:", block: datosLuz },
  { kind: "user", tag: "informes", text: "buscá cafés de especialidad en madrid" },
  { kind: "card", tag: "informes", intro: "Esto encontré:", block: busquedaCafe },
  { kind: "user", tag: "informes", text: "generame un concepto de wallpaper" },
  { kind: "card", tag: "informes", intro: "Mirá qué te preparé:", block: generacionWallpaper },

  // ── MEMORIA ──
  { kind: "user", tag: "memoria", text: "qué me guardaste hoy?" },
  { kind: "card", tag: "memoria", intro: "Tres cosas nuevas:", block: memoryBlock },
  { kind: "user", tag: "memoria", text: "guardame la carbonara en mi agenda" },
  { kind: "card", tag: "memoria", block: savedRecordBlock },
  { kind: "user", tag: "memoria", text: "qué tenés en la bóveda?" },
  { kind: "card", tag: "memoria", intro: "Esto guardé de vos:", block: vaultBlock },
  { kind: "user", tag: "memoria", text: "pasame los archivos del informe" },
  { kind: "card", tag: "memoria", block: resourceBundleBlock },
  { kind: "card", tag: "memoria", intro: "¡Arx, esto no espera:", block: urgentePaquete },

  // ── DINERO ──
  { kind: "user", tag: "dinero", text: "cuánto tengo en el banco?" },
  { kind: "card", tag: "dinero", intro: "Así está agosto:", block: moneyBlock },
  { kind: "user", tag: "dinero", text: "cómo sigue el portfolio?" },
  { kind: "card", tag: "dinero", block: cryptoBlock },
  { kind: "user", tag: "dinero", text: "a cuánto está el dólar?" },
  { kind: "card", tag: "dinero", block: forexBlock },
  { kind: "user", tag: "dinero", text: "cómo está el nasdaq?" },
  { kind: "card", tag: "dinero", block: marketBlock },
  { kind: "user", tag: "dinero", text: "tirame la cinta de datos" },
  { kind: "card", tag: "dinero", block: tickerBlock },
  { kind: "user", tag: "dinero", text: "me conviene renovar el alquiler?" },
  { kind: "card", tag: "dinero", intro: "Lo pensé con tus números:", block: decisionAlquiler },

  // ── DEPORTES ──
  { kind: "user", tag: "deportes", text: "cómo va el clásico?" },
  { kind: "card", tag: "deportes", intro: "Lo sigo minuto a minuto, va 2-1:", block: elClasico },
  { kind: "user", tag: "deportes", text: "y el partido de alcaraz?" },
  { kind: "card", tag: "deportes", intro: "Semifinal apretada, va el 4º set:", block: alcarazSinner },
  { kind: "user", tag: "deportes", text: "cuándo juega boca?" },
  { kind: "card", tag: "deportes", block: matchTimelineBlock },
  { kind: "user", tag: "deportes", text: "el clásico en números" },
  { kind: "card", tag: "deportes", block: matchStatsBlock },
  { kind: "user", tag: "deportes", text: "qué dicen de pedri?" },
  { kind: "card", tag: "deportes", intro: "La prensa lo pone así:", block: citaPedri },

  // ── MUNDO ──
  { kind: "user", tag: "mundo", text: "qué onda las elecciones?" },
  { kind: "card", tag: "mundo", block: electionResultsBlock },
  { kind: "user", tag: "mundo", text: "y con qué lente lo analizo?" },
  { kind: "card", tag: "mundo", block: electionVoteBlock },
  { kind: "user", tag: "mundo", text: "qué pasó hoy en el mundo?" },
  { kind: "card", tag: "mundo", block: newsUrgentBlock },

  // ── COMIDA ──
  { kind: "user", tag: "comida", text: "quiero cenar afuera" },
  { kind: "card", tag: "comida", intro: "Top 3 cerca tuyo:", block: restaurantBlock },
  { kind: "user", tag: "comida", text: "qué puedo cocinar con lo que tengo?" },
  { kind: "card", tag: "comida", intro: "Con lo de tu heladera, esto:", block: recipeBlock },

  // ── OCIO ──
  { kind: "user", tag: "ocio", text: "qué peli veo?" },
  { kind: "card", tag: "ocio", block: movieBlock },
  { kind: "user", tag: "ocio", text: "recomendame un libro" },
  { kind: "card", tag: "ocio", block: bookBlock },

  // ── COMPRAS ──
  { kind: "user", tag: "compras", text: "duelo de in-ear: cuál me compro?" },
  { kind: "card", tag: "compras", block: comparisonBlock },
  { kind: "user", tag: "compras", text: "está buena la cafetera evo?" },
  { kind: "card", tag: "compras", block: productBlock },
  { kind: "user", tag: "compras", text: "y el iphone 16?" },
  { kind: "card", tag: "compras", block: reviewScoreBlock },

  // ── VIAJES ──
  { kind: "user", tag: "viajes", text: "cuánto sale llegar a madrid en octubre?" },
  { kind: "card", tag: "viajes", intro: "La mejor combinación que encontré:", block: vueloMadrid },
  { kind: "user", tag: "viajes", text: "planeame 3 días en madrid" },
  { kind: "card", tag: "viajes", block: travelPlanBlock },

  // ── RUTAS ──
  { kind: "user", tag: "rutas", text: "cómo llego a la fac?" },
  { kind: "card", tag: "rutas", block: routeTimelineBlock },
  { kind: "user", tag: "rutas", text: "mostrame el mapa" },
  { kind: "card", tag: "rutas", block: routeMapBlock },
  { kind: "user", tag: "rutas", text: "colectivo o subte?" },
  { kind: "card", tag: "rutas", block: transportBlock },
  { kind: "user", tag: "rutas", text: "dónde está el paquete de maru?" },
  { kind: "card", tag: "rutas", block: deliveryBlock },

  // ── PERSONAS ──
  { kind: "user", tag: "personas", text: "cumples del mes?" },
  { kind: "card", tag: "personas", block: bcalBlock },
  { kind: "user", tag: "personas", text: "avsame del de juan" },
  { kind: "card", tag: "personas", block: balarmBlock },
  { kind: "user", tag: "personas", text: "qué le regalo a juan?" },
  { kind: "card", tag: "personas", block: socialBlock },
];

// ── Catálogo derivado (los contadores salen del script, nunca se hardcoded) ─
const CHAT_CATEGORY_DEFS: Array<{ id: string; label: string; icon: string }> = [
  { id: "dia", label: "Día a día", icon: "today" },
  { id: "informes", label: "Informes", icon: "description" },
  { id: "memoria", label: "Recuerdos", icon: "psychology" },
  { id: "dinero", label: "Dinero", icon: "wallet" },
  { id: "deportes", label: "Deportes", icon: "sports_soccer" },
  { id: "mundo", label: "Mundo", icon: "public" },
  { id: "comida", label: "Comida", icon: "restaurant" },
  { id: "ocio", label: "Ocio", icon: "movie" },
  { id: "compras", label: "Compras", icon: "shopping_bag" },
  { id: "viajes", label: "Viajes", icon: "flight" },
  { id: "rutas", label: "Rutas", icon: "route" },
  { id: "personas", label: "Personas", icon: "group" },
];

export function deriveCatalog(script: ChatEntry[]): ChatCategory[] {
  const counts = new Map<string, number>();
  for (const e of script) counts.set(e.tag, (counts.get(e.tag) ?? 0) + 1);
  return [
    { id: "all", label: "Todo", icon: "apps", count: script.length },
    ...CHAT_CATEGORY_DEFS.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })),
  ];
}

export const CHAT_CATALOG: ChatCategory[] = deriveCatalog(CHAT_SCRIPT);

// ── Helpers de consulta (usados por el preview y por los tests) ────────────

export function entriesForTag(script: ChatEntry[], tag: string | null): ChatEntry[] {
  if (!tag || tag === "all") return script;
  return script.filter((e) => e.tag === tag);
}

/** Tipos de block que cubre un script, en orden de aparición. */
export function blockTypes(script: ChatEntry[]): string[] {
  return script
    .filter((e): e is Extract<ChatEntry, { kind: "card" }> => e.kind === "card")
    .map((e) => (e.block as { type: string }).type);
}

/** Normaliza para búsqueda: minúsculas y sin acentos (dólar → dolar). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Texto de búsqueda de un block: strings propios hasta profundidad 3
 *  (cubre items[].detail, sections[].tiles[].label, steps[].detail, …). */
export function blockSearchText(block: UiBlock): string {
  const out: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 3) return;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
    else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach((x) => walk(x, depth + 1));
    }
  };
  walk(block, 0);
  return out.join(" ");
}

/** ¿El entry matchea la query? Busca en tag, texto/intro y dentro del block. */
export function matchEntry(e: ChatEntry, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const own = e.kind === "card" ? (e.intro ?? "") : e.text;
  if (norm(`${e.tag} ${own}`).includes(q)) return true;
  if (e.kind === "card") return norm(blockSearchText(e.block)).includes(q);
  return false;
}

export function searchScript(script: ChatEntry[], query: string): ChatEntry[] {
  return script.filter((e) => matchEntry(e, query));
}
