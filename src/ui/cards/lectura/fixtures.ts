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

export const newsUrgentBlock: Extract<UiBlock, { type: "news_urgent" }> = {
  type: "news_urgent",
  headline: "La UE avanza con la batería de 2030: 30% más barata que la china",
  summary:
    "El nuevo estándar promete recargar al 80% en 12 minutos. Impacta directo en el auto eléctrico que venís mirando desde junio.",
  severity: "important",
  category: "Tech",
  lastUpdated: "16:20",
  timeline: [
    { time: "14:50", event: "Reuters publica el borrador filtrado del estándar", status: "done" },
    { time: "15:30", event: "La Comisión confirma la ronda de voto de octubre", status: "current" },
    { time: "—", event: "Respuesta esperada de los fabricantes chinos", status: "pending" },
  ],
  factChecks: [
    { claim: "30% más barata que la china", verdict: "Confirmado: proyección del propio borrador, no dato de mercado", source: "reuters" },
    { claim: "12 minutos al 80%", verdict: "Solo en estaciones de 800 V — la mayoría no lo tiene aún", source: "iea" },
  ],
  sources: [
    { title: "EU battery standard 2030 draft", url: "https://reuters.com/x", domain: "reuters.com", imageUrl: "/stitch/outfits/news-ev.jpg" },
    { title: "Brussels rounds of votes", url: "https://bloomberg.com/x", domain: "bloomberg.com" },
    { title: "CATL responde", url: "https://elpais.com/x", domain: "elpais.com" },
  ],
};

export const restaurantBlock: Extract<UiBlock, { type: "restaurant_synthesis" }> = {
  type: "restaurant_synthesis",
  title: "Parrillas Palermo",
  query: "parrilla palermo soho",
  mood: "La parrilla de hoy",
  status: "ok",
  matches: [
    {
      name: "Don Julio",
      sourcesMentioning: 3,
      rating: 4.6,
      ratingCount: 2400,
      priceLevel: 3,
      distanceFromUser: "12 min caminando",
      photos: ["/stitch/outfits/rest-steak.jpg"],
      menuHighlights: [
        { dish: "Ojo de bife", price: "€34" },
        { dish: "mollejas", price: "€19" },
      ],
      reserveUrl: "https://donjulio.com.ar/reserva",
    },
    { name: "La Cabrera", sourcesMentioning: 2, rating: 4.5, ratingCount: 3100, priceLevel: 3, distanceFromUser: "18 min" },
    { name: "Cabaña Las Lilas", sourcesMentioning: 2, rating: 4.4, ratingCount: 5200, priceLevel: 4, distanceFromUser: "25 min" },
  ],
  topScore: "9,2",
  logistics: { travelTime: "12 min caminando", parking: "valet €5", reservationTime: "19:15" },
  synthesis: "Don Julio gana por vacío y mollejas, pero a las 21 se hace eterno.",
  whyTonight: "A las 19:15 entramás directo — después de las 21 la fila dobla la manzana.",
};

export const recipeBlock: Extract<UiBlock, { type: "recipe" }> = {
  type: "recipe",
  title: "La carbonara de verdad",
  name: "Spaghetti alla carbonara",
  image: "/stitch/outfits/recipe-pasta.jpg",
  category: "Pasta",
  area: "Italiana",
  description: "Chequeada contra 11 recetas italianas: sin crema, sin cebolla, sin miedo al pecorino.",
  servings: 2,
  prepTime: "15",
  cookTime: "10",
  difficulty: "easy",
  ingredients: [
    { ingredient: "spaghetti nº5", measure: "200 g" },
    { ingredient: "guanciale", measure: "80 g" },
    { ingredient: "yemas + 1 huevo", measure: "2" },
    { ingredient: "pecorino romano", measure: "50 g" },
    { ingredient: "pimienta negra", measure: "al gusto" },
  ],
  steps: [
    { step: 1, title: "Dorado del guanciale", text: "Tiras gruesas, fuego medio, sin aceite: su grasa es el aceite. 6–7 min.", durationMinutes: 7 },
    { step: 2, title: "La crema falsa", text: "Yemas + huevo + pecorino + pimienta, batidos hasta pasta densa. Fuera del fuego.", durationMinutes: 3 },
    { step: 3, title: "El matrimonio", text: "Pasta al dente, mezclá con el guanciale APAGADO y agregá la crema + 3 cucharas de agua.", durationMinutes: 2 },
  ],
  tips: ["Si el huevo se te corta, fue temperatura: entibiá el bowl con el vapor de la pasta."],
  nutrition: { kcal: 386, protein: 16, carbs: 48, fat: 14 },
  source: { title: "Giallozafferano", url: "https://ricette.example", domain: "giallozafferano.it" },
};

export const movieBlock: Extract<UiBlock, { type: "movie_review" }> = {
  type: "movie_review",
  title: "Blade Runner 2049",
  poster: "/stitch/outfits/movie-neon.jpg",
  rating: 8.1,
  ratingCount: 214000,
  releaseDate: "2017-10-05",
  runtime: "2h 14min",
  director: "Denis Villeneuve",
  cast: ["Ryan Gosling", "Harrison Ford", "Ana de Armas"],
  genres: ["Ciencia ficción", "Drama"],
  overview: "Visualmente la peli más hermosa de la década: cada cuadro es un cuadro. La historia va lenta a propósito — cine contemplativo de domingo a la noche.",
  trailerUrl: "https://youtube.com/watch?v=gCcx85zbxzE",
  whereToWatch: ["HBO Max", "Alquilar Apple TV"],
  ratings: [
    { source: "críticos", score: 88, outOf: 100 },
    { source: "público", score: 81, outOf: 100 },
  ],
};

export const bookBlock: Extract<UiBlock, { type: "book_review" }> = {
  type: "book_review",
  title: "Los días del venado",
  cover: "/stitch/outfits/book-stack.jpg",
  author: "Nicolás Petrone",
  year: "2023",
  pages: 288,
  publisher: "Editorial Margen",
  genre: "Novela",
  rating: 4.6,
  synopsis: "La memoria no es un archivo: es un perro que duerme donde quiere. Una familia, un río y la vuelta de todo lo que se fue.",
  isbn: "978-987-000-000",
  previewUrl: "https://archive.org/embed/dias-venado",
};

export const alarmBlock: Extract<UiBlock, { type: "alarm" }> = {
  type: "alarm",
  title: "Gym de la mañana",
  time: "07:00",
  repeat: "lunes a viernes",
  note: "Te agendé el gym 30 min después de la alarma — así no tenés que pensarlo a las 7.",
};


export const checklistBlock: Extract<UiBlock, { type: "smart_checklist" }> = {
  type: "smart_checklist",
  title: "Lo que falta antes de comprar",
  progress: 50,
  items: [
    { label: "RAM 32 GB verificada", checked: true },
    { label: "Garantía internacional", checked: true },
    { label: "Precio por debajo de €1.200", checked: false },
    { label: "Teclado español físico", checked: false },
  ],
};


export const briefBlock: Extract<UiBlock, { type: "morning_brief" }> = {
  type: "morning_brief",
  greeting: "Buen domingo",
  items: [
    { icon: "bell", iconColor: "#e11d48", label: "Hoy no lo olvidés", value: "11:00", variant: "highlight" },
    { icon: "sports_soccer", iconColor: "#059669", label: "Real Madrid 2–1 Barcelona", value: "2–1" },
    { icon: "trending_up", iconColor: "#d97706", label: "Tu portfolio", value: "+1,8%" },
    { icon: "wb_sunny", iconColor: "#2563eb", label: "Amanece despejado", value: "16–29°" },
    { icon: "flight", iconColor: "#7c3aed", label: "Tu viaje a Madrid", value: "18 d" },
  ],
};


export const healthBlock: Extract<UiBlock, { type: "health_reminder" }> = {
  type: "health_reminder",
  title: "Vitamina D · 2000 UI",
  icon: "medication",
  iconColor: "#b45309",
  bgColor: "#fdf1dd",
  reminder: "1 comprimido con la cena — mejor absorción con grasas.",
  actionLabel: "Ya tomé la de hoy",
};

export const marketBlock: Extract<UiBlock, { type: "market" }> = {
  type: "market",
  title: "AAPL",
  assets: [
    {
      symbol: "AAPL",
      name: "Apple Inc",
      category: "NASDAQ",
      price: "231,40",
      change: "+1,8% hoy",
      changeUp: true,
      iconBg: "#e8f0fe",
      iconColor: "#2563eb",
      shape: "rounded",
    },
    {
      symbol: "MSFT",
      name: "Microsoft",
      category: "NASDAQ",
      price: "428,90",
      change: "+0,6% hoy",
      changeUp: true,
    },
    {
      symbol: "NVDA",
      name: "NVIDIA",
      category: "NASDAQ",
      price: "118,60",
      change: "−1,2% hoy",
      changeUp: false,
    },
  ],
};


export const cryptoBlock: Extract<UiBlock, { type: "crypto_portfolio" }> = {
  type: "crypto_portfolio",
  title: "Tu portfolio · cripto",
  totalValue: "€4.320",
  weekChange: 4.5,
  sparkline: [4020, 4050, 3990, 4080, 4110, 4060, 4150, 4180, 4140, 4210, 4180, 4240, 4280, 4250, 4300, 4320],
  items: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: "61.240 USD",
      change: 2.4,
      color: "#f59e0b",
      bg: "#fffbeb",
      char: "₿",
      amount: 0.052,
      value: "€3.182",
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      price: "2.980 USD",
      change: -1.1,
      color: "#6d4bf0",
      bg: "#f1ecfa",
      char: "Ξ",
      amount: 0.38,
      value: "€1.138",
    },
  ],
  alerts: [{ symbol: "BTC", target: "€4.500", direction: "above" }],
};


export const forexBlock: Extract<UiBlock, { type: "forex" }> = {
  type: "forex",
  title: "Dólar oficial · euro",
  items: [
    { pair: "USD/EUR", rate: "0,92", change: 0.1, flag: "US", positive: true },
    { pair: "EUR/ARS", rate: "1.105,0", change: 0.3, flag: "AR", positive: true },
    { pair: "USD/JPY", rate: "149,2", change: -0.2, flag: "JP", positive: false },
  ],
};


export const moneyBlock: Extract<UiBlock, { type: "money_summary" }> = {
  type: "money_summary",
  title: "Agosto · tus gastos",
  total: 1850,
  currency: "€",
  summaryItems: [
    { label: "Casa y servicios", value: "€611", detail: "alquiler + luz, igual que julio" },
    { label: "Comida", value: "€444", detail: "6 deliverys menos que julio" },
    { label: "Transporte", value: "€296", detail: "abono + 2 taxis" },
    { label: "Ocio", value: "€240", detail: "cine + una salida" },
    { label: "Otros", value: "€259", detail: "regalo de Maru y feria" },
  ],
  recommendation:
    "La baja viene de la comida: 6 menos deliverys que en julio (€182 de diferencia). No cambiaste de dieta, cambiaste de horario de cena.",
};


export const tickerBlock: Extract<UiBlock, { type: "data_ticker" }> = {
  type: "data_ticker",
  title: "Cupo · dólar · oficial",
  items: [
    { label: "US$ CUPO RESTANTE", value: "136", highlight: true },
    { label: "USD/EUR", value: "0,92" },
    { label: "EUR/ARS", value: "1.105,0" },
    { label: "OMIE POOL", value: "€84,2/MWh" },
    { label: "BITCOIN", value: "61.240" },
    { label: "ORO", value: "2.331" },
  ],
  alert: "Con lo que queda te sobra para los US$90 de Spotify anual y la suscripción de iCloud.",
};

export const routeTimelineBlock: Extract<UiBlock, { type: "route_timeline" }> = {
  type: "route_timeline",
  eta: "25 min",
  items: [
    { label: "Caminá 250 m", detail: "Por Callao hacia el sur, a la sombra de los plátanos.", color: "#2563eb" },
    { label: "Subte D · 5 paradas", detail: "Callao → Retiro. Andén de la mano derecha.", color: "#b45309" },
    { label: "Caminá 400 m", detail: "Salida Aduana, cruzás la avenida y entrás por Puerta de España.", color: "#2563eb" },
    { label: "Llegás al Retiro", detail: "La estación de lagos queda a la izquierda.", color: "#059669" },
  ],
};


export const routeMapBlock: Extract<UiBlock, { type: "route_map" }> = {
  type: "route_map",
  progress: 42,
  from: "Callao 220",
  to: "Parque del Retiro",
  distance: "6,2 km",
  remaining: "25 min",
  lat: -34.5837,
  lng: -58.4088,
  steps: [
    { instruction: "Girá a la derecha hacia Av. Santa Fe", distanceMeters: 250, maneuver: "turn-right" },
    { instruction: "Entrá al subte D en Callao", distanceMeters: 80, maneuver: "enter-station" },
  ],
  alternatives: [
    { mode: "Bus 10 + caminata", time: "41 min", traffic: "moderado" },
    { mode: "A pie por Callao", time: "58 min", traffic: "liviano" },
  ],
  trafficLevel: "liviano",
};


export const transportBlock: Extract<UiBlock, { type: "transport_compare" }> = {
  type: "transport_compare",
  items: [
    { mode: "Subte D", time: "25 min", icon: "directions_subway", active: true },
    { mode: "Bus 10 + caminata", time: "41 min", icon: "directions_bus", active: false },
    { mode: "A pie por Callao", time: "58 min", icon: "directions_walk", active: false },
  ],
};


export const deliveryBlock: Extract<UiBlock, { type: "delivery" }> = {
  type: "delivery",
  title: "El regalo de Maru viene en camino",
  status: "en reparto",
  carrier: "Correo Argentino",
  trackingId: "CA-88213904-AR",
  estimatedDate: "mañana antes de las 14",
  steps: [
    { label: "Etiqueta creada", done: true },
    { label: "Salió del centro logístico", done: true },
    { label: "Llegó a Buenos Aires", done: true },
    { label: "En reparto", done: false },
    { label: "Entregado", done: false },
  ],
};

export const bcalBlock: Extract<UiBlock, { type: "birthday_calendar" }> = {
  type: "birthday_calendar",
  month: "Septiembre",
  highlightedDay: 12,
  startDay: 1,
  daysInMonth: 30,
};


export const balarmBlock: Extract<UiBlock, { type: "birthday_alarm" }> = {
  type: "birthday_alarm",
  name: "Juan",
  date: "sábado 12 · 21:00",
  countdown: "5",
  unit: "días",
  eta: "el jueves 10 a las 10:00 te cae el primer aviso",
};


export const socialBlock: Extract<UiBlock, { type: "social_interaction" }> = {
  type: "social_interaction",
  name: "Juan",
  event: "cumple",
  date: "sábado 12 · 21:00",
  age: "34",
  remaining: "5 días",
  gifts: [
    { emoji: "💿", title: "Vinilo de Wos, edición numerada", detail: "quedan 2 · Bar Aparte, Palermo" },
    { emoji: "🛶", title: "Excursión de kayak", detail: "si el 12 se complicaba la logística" },
  ],
};

export const comparisonBlock: Extract<UiBlock, { type: "comparison" }> = {
  type: "comparison",
  title: "El duelo de los in-ear",
  criteria: ["cancelación", "batería", "llamadas", "compatibilidad", "precio"],
  items: [
    {
      title: "Sony XM5",
      price: "€189",
      vendor: "MediaMarkt",
      url: "https://tienda.example/sony-xm5",
      score: 92,
      details: [
        { label: "Cancelación", positive: true },
        { label: "Batería", positive: true },
        { label: "Llamadas", positive: false },
        { label: "Compatibilidad", positive: true },
      ],
    },
    {
      title: "Bose QC",
      price: "€199",
      vendor: "El Corte Inglés",
      score: 84,
      details: [
        { label: "Cancelación", positive: true },
        { label: "Batería", positive: false },
        { label: "Llamadas", positive: true },
        { label: "Compatibilidad", positive: true },
      ],
    },
    {
      title: "AirPods 4",
      price: "€149",
      vendor: "Apple Store",
      score: 71,
      details: [
        { label: "Cancelación", positive: false },
        { label: "Batería", positive: false },
        { label: "Llamadas", positive: true },
        { label: "Compatibilidad", positive: false },
      ],
    },
  ],
  recommendation:
    "El empate técnico era real: por tus llamadas diarias ganaba Bose. Ganó Sony por el combo batería + cancelación con tu teléfono.",
};


export const productBlock: Extract<UiBlock, { type: "product_analysis" }> = {
  type: "product_analysis",
  product: {
    name: "Cafetera De'Longhi Magnifica Evo",
    image: "/stitch/outfits/prod-espresso.jpg",
    icon: "coffee",
    rating: 8.7,
    reviewCount: "1.204",
    description: "La que recomiendo de las 14 que analicé para tu cocina y tu café de todos los días.",
  },
  specs: [
    { label: "Espresso", value: "9 bar" },
    { label: "Vapor", value: "sí, para latte" },
    { label: "Limpieza", value: "automática" },
    { label: "Ruido", value: "62 dB" },
  ],
  actionLabel: "Guardar para la compra",
};


export const reviewScoreBlock: Extract<UiBlock, { type: "review_score" }> = {
  type: "review_score",
  title: "iPhone 16: qué dice la gente",
  buttonLabel: "Guardar reseña",
  items: [
    { emoji: "📷", score: "91%", label: "Cámara nocturna", color: "#2f8f6d" },
    { emoji: "🔋", score: "78%", label: "Batería", color: "#2f8f6d" },
    { emoji: "🔥", score: "33%", label: "Se calienta jugando", color: "#d6497f" },
    { emoji: "📦", score: "27%", label: "Extraña el cargador", color: "#d6497f" },
    { emoji: "⚡", score: "72%", label: "Rapidez", color: "#2f8f6d" },
  ],
};

/* ===== Interiores del lote final (12 cards restantes del catálogo) ===== */

const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

export const travelPlanBlock: Extract<UiBlock, { type: "travel_plan" }> = {
  type: "travel_plan",
  destination: "Madrid",
  dates: "3 días · septiembre",
  travelers: 2,
  currency: "€",
  totalBudget: 360,
  days: [
    {
      day: 1,
      title: "Centro y Austrias",
      activities: [
        { time: "10:00", title: "Café en el Passatge", detail: "Churros antes de las 10:30 es tu ventana." },
        { time: "12:30", title: "Prado · 2 h quirúrgicas", detail: "Goya, Velázquez y la pieza que querías ver." },
        { time: "15:30", title: "Comida: Casa Mono", detail: "Reservada ya, afuera si el calor lo permite." },
        { time: "20:00", title: "Vermú + de paseo", detail: "La Latina a esta hora se camina sola." },
      ],
    },
    {
      day: 2,
      title: "Malasaña y Chamberí",
      activities: [
        { time: "11:00", title: "Mercado de Vallehermoso", detail: "Parada de tortilla en el puesto 14." },
        { time: "15:30", title: "Comida: Casa Mono", detail: "Reservada ya, sentados afuera." },
      ],
    },
    {
      day: 3,
      title: "Retiro y museos",
      activities: [
        { time: "09:30", title: "Retiro en bici", detail: "Alquiler al lado de la Puerta de Ángel." },
      ],
    },
  ],
  reservations: [
    { provider: "Iberia", type: "Vuelo", detail: "IB 3421 · directo 2h 10m", status: "confirmada", deepLink: "https://iberia.com/checkin" },
    { provider: "Hotel Regente", type: "Hotel", detail: "3 noches · desayuno incluido", status: "confirmada" },
  ],
  packing: [
    { item: "Zapatillas cómodas", checked: false },
    { item: "Campera liviana", checked: true },
    { item: "Adaptador EU", checked: false },
  ],
  budget: [
    { category: "Comida", amount: 180, currency: "€" },
    { category: "Museos", amount: 60, currency: "€" },
    { category: "Transporte", amount: 40, currency: "€" },
  ],
};


export const savedRecordBlock: Extract<UiBlock, { type: "saved_record" }> = {
  type: "saved_record",
  title: "Cena en Don Julio",
  records: [
    {
      domain: "interest",
      kind: "deadline",
      title: "Reservado para 2",
      value: "Patio · junto a la parra",
      person: "Vos",
      collection: "Reservas",
      dueHint: "sábado 7 · 21:15",
      url: "https://donjulio.com/reserva",
    },
  ],
};


export const vaultBlock: Extract<UiBlock, { type: "saved_record" }> = {
  type: "saved_record",
  title: "Bóveda de recuerdos",
  records: [
    { domain: "interest", kind: "idea", title: "Ruta de Mallorca", value: "calas + moto en Sóller · €900" },
    { domain: "relationship", kind: "gift", title: "Regalo de Maru", value: "vinilo de Wos · Bar Aparte" },
    { domain: "home", kind: "tool_link", title: "Técnico de wifi", value: "11-3422 · dejó todo andando" },
    { domain: "relationship", kind: "birthday", title: "Cumple de Maru", value: "12 de septiembre · vino naranja" },
    { domain: "money", kind: "expense", title: "Café doble", value: "4,20 € · todos los días" },
  ],
};


export const memoryBlock: Extract<UiBlock, { type: "memory" }> = {
  type: "memory",
  title: "Tu archivo de este mes",
  items: [
    {
      domain: "viaje",
      title: "La ruta de Mallorca que armamos",
      detail: "Calas escondidas + alquiler de moto en Sóller · presupuesto €900",
      confidence: 0.91,
    },
    { domain: "regalo", title: "El regalo de Maru: el vinilo de Wos", detail: "Edición numerada · Bar Aparte, Palermo", confidence: 0.74 },
    { domain: "servicio", title: "El técnico de wifi que te funcionó", confidence: 0.66 },
    { domain: "idea", title: "Idea: menú de cumple de Juan", detail: "parrilla + tarta de la abuela", confidence: 0.8 },
    { domain: "auto", title: "Auto: cambiar aceite a los 12.000", confidence: 0.55 },
  ],
  note: "Todo quedó asociado a tu historial de septiembre.",
};


export const researchSourcesBlock: Extract<UiBlock, { type: "research_sources" }> = {
  type: "research_sources",
  title: "La lectura pendiente",
  summary: "Lo que me pediste guardar para después, con preview real de cada página.",
  sources: [
    {
      title: "La carbonara de Roma que sí es carbonara",
      url: "https://lacucinaitaliana.it/carbonara",
      domain: "lacucinaitaliana.it",
      snippet: "La receta original sin crema: guanciale, pecorino y huevo.",
      imageUrl: "/stitch/outfits/recipe-pasta.jpg",
    },
    {
      title: "Por qué Europa apuesta fuerte a los chips propios",
      url: "https://eldiario.es/tecnologia/chips-europa",
      domain: "eldiario.es",
      snippet: "El plan de la UE para reducir dependencia de Asia en semiconductores.",
    },
    {
      title: "Magnifica Evo a €329 — histórico mínimo",
      url: "https://tucarro.com/magnifica-evo",
      domain: "tucarro.com",
      snippet: "Precio con descuento de temporada.",
      imageUrl: "/stitch/outfits/prod-espresso.jpg",
    },
    {
      title: "48 horas en Madrid: la guía sin trampas",
      url: "https://guianaima.com/madrid-48h",
      domain: "guianaima.com",
      snippet: "Barrios, horarios y los museos que sí valen la pena.",
      imageUrl: "/stitch/outfits/travel-madrid.jpg",
    },
  ],
  followUpQuestion: "¿Querés que te avise si baja de precio alguno?",
};


export const reviewDocumentBlock: Extract<UiBlock, { type: "review_document" }> = {
  type: "review_document",
  title: "Anotame esto",
  body:
    "Llamar a la abuela el sábado a las 11 — antes de que llegue Maru. Pedirle la receta del pionono que ella hace con la crema de lado.",
};


export const resourceBundleBlock: Extract<UiBlock, { type: "resource_bundle" }> = {
  type: "resource_bundle",
  title: "Archivos de tu chat",
  summary: "El PDF del boleto ya quedó vinculado a tu viaje a Madrid.",
  files: [
    {
      name: "boletos-madrid-sept.pdf",
      kind: "document",
      mimeType: "application/pdf",
      sizeLabel: "412 KB",
      content: "IBERIA 0932 · MAD 12:10 → CIBELES 19:42 · asiento 14A",
    },
    {
      name: "gastos-viaje.csv",
      kind: "csv",
      mimeType: "text/csv",
      sizeLabel: "3,4 KB",
      content: "concepto,monto\nvuelo,320\nhotel,540",
    },
    {
      name: "informe-solar.md",
      kind: "markdown",
      mimeType: "text/markdown",
      sizeLabel: "11 KB",
    },
  ],
};


export const electionResultsBlock: Extract<UiBlock, { type: "election_results" }> = {
  type: "election_results",
  title: "Así está la cuenta",
  status: "89% contado · mesas 34.312 de 38.540",
  items: [
    { name: "Partido A", percent: "34%", detail: "mejoró 2 pts en el sur", done: false, color: "#6d4bf0" },
    { name: "Partido B", percent: "29%", detail: "fuerte en la costa", done: false, color: "#5170d8" },
    { name: "Partido C", percent: "18%", done: false, color: "#b45309" },
    { name: "Partido D", percent: "12%", done: false, color: "#d6497f" },
    { name: "Otros", percent: "7%", done: false, color: "#9486c2" },
  ],
};


export const electionVoteBlock: Extract<UiBlock, { type: "election_vote" }> = {
  type: "election_vote",
  question: "¿Qué lente uso para ordenar esto?",
  subtitle: "Para la comparación de candidatos que me pediste: elijo una y armo el análisis desde ahí.",
  options: [
    { label: "Economía primero", sub: "empleo, inflación, impuestos — lo que mueve tu bolsillo" },
    { label: "Seguridad primero", sub: "crimen, justicia, defensa — la calle como prioridad" },
    { label: "Ambiente primero", sub: "energía, agua, transición — el plazo largo" },
  ],
};


export const matchTimelineBlock: Extract<UiBlock, { type: "match_timeline" }> = {
  type: "match_timeline",
  title: "Juega Boca, y conviene verlo",
  teamInfo: {
    name: "Boca Juniors",
    stadium: "La Bombonera",
    location: "Buenos Aires",
    league: "Liga Profesional",
    description:
      "Boca llega con tres victorias seguidas en casa y el clásico de la fecha 6 define la punta del torneo.",
  },
  nextMatch: {
    homeTeam: "Boca Juniors",
    awayTeam: "River Plate",
    date: in3Days,
    time: "21:30",
    league: "Liga Profesional",
  },
};


export const matchStatsBlock: Extract<UiBlock, { type: "match_stats" }> = {
  type: "match_stats",
  title: "El clásico, en números",
  homeName: "Real Madrid",
  awayName: "Barcelona",
  homeColor: "#4ec99c",
  awayColor: "#9dbcf3",
  stats: [
    { label: "Posesión", home: "58", away: "42", width: "58%" },
    { label: "Remates al arco", home: "8", away: "5", width: "80%" },
    { label: "Córners", home: "7", away: "4", width: "56%" },
    { label: "Faltas", home: "9", away: "11", width: "36%" },
  ],
};

