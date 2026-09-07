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

