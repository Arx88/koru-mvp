// AUDITORÍA UNIVERSAL DE CARDS (temporal): para cada tipo de UiBlock construye
// un fixture REALISTA (datos completos como los que produce una tool exitosa),
// corre toPresentation y mide: ¿tiene extensión? ¿cuántas secciones? ¿densidad?
// Una card "sin datos en la extensión" = detail undefined o secciones vacías.
import { describe, it } from "vitest";
import { toPresentation } from "../ui/cards/unified/presentation";
import type { UiBlock } from "../domain/types";

const S = (title: string, detail: string) => [{ title, detail }];

// ─── FIXTURES REALISTAS (payload "feliz": la tool trajo todo) ───────────────
const FIXTURES: Array<{ type: string; block: any; note?: string }> = [
  {
    type: "deliverable",
    block: { type: "deliverable", status: "ready", kicker: "Tu Informe", title: "ERA ESPACIAL", description: "Panorama 2026", topic: "era espacial", summary: "Síntesis de 3 párrafos sobre la nueva era espacial comercial, con Musk, Bezos y la ESA.", sections: [{ title: "Contexto", kind: "text", paragraphs: ["p1", "p2"] }, { title: "Hallazgos", kind: "bullets", bullets: ["b1", "b2", "b3"] }], sources: [{ title: "NASA", url: "https://nasa.gov" }] },
  },
  { type: "weather", block: { type: "weather", city: "Madrid", now: "22°", feel: "20°", condition: "Despejado", range: "14°–28°", rain: "10%", wind: "12 km/h", humidity: "45%", uv: "6", advice: "Llevá anteojos de sol", hourly: [{ hour: "10", temp: "18°", conditionIcon: "wb_sunny", rainPct: 5, uv: 2 }, { hour: "11", temp: "20°", conditionIcon: "wb_sunny", rainPct: 5, uv: 3 }], daily: [{ dayAbbrev: "LUN", hi: "28°", lo: "14°", conditionIcon: "wb_sunny" }] } },
  { type: "live_match", block: { type: "live_match", homeName: "Real Madrid", awayName: "Barcelona", homeScore: 2, awayScore: 1, status: "Full Time", league: "La Liga", goals: [{ minute: "14'", scorer: "Mbappé", team: "Real Madrid" }, { minute: "77'", scorer: "Yamal", team: "Barcelona" }], detailedStats: [{ label: "Posesión", home: 55, away: 45, isPercent: true }, { label: "Tiros", home: 16, away: 21 }], lineups: { home: { formation: "4-3-3", players: ["Courtois", "Mbappé"] }, away: { formation: "4-2-3-1", players: ["Szczęsny", "Yamal"] } }, venue: "Santiago Bernabéu", venueCity: "Madrid" } },
  // ⚠️ caso REAL reproducido: partido SCHEDULED sin datos aún
  { type: "live_match", note: "SCHEDULED (programado, sin datos)", block: { type: "live_match", homeName: "Boca Juniors", awayName: "Central Córdoba", homeScore: 0, awayScore: 0, status: "Scheduled", league: "Primera División", venueCity: "Buenos Aires", stats: [{ label: "Posesión", leftPercent: 50, rightPercent: 50 }, { label: "Tiros", leftPercent: 50, rightPercent: 50 }] } },
  { type: "match_timeline", block: { type: "match_timeline", title: "Boca Juniors", items: [{ minute: "12/09", text: "Boca Juniors vs Central Córdoba", sub: "Primera División · 21:30", active: true }, { minute: "19/09", text: "River vs Boca", sub: "Primera División" }] } },
  // ⚠️ caso REAL: fixture VACÍO que igualmente genera card
  { type: "match_timeline", note: "VACÍO (0 items — bug doble card)", block: { type: "match_timeline", title: "españa", items: [] } },
  { type: "match_stats", block: { type: "match_stats", title: "Real Madrid vs Barcelona", stats: [{ label: "Posesión", home: 55, away: 45, isPercent: true }, { label: "Tiros", home: 16, away: 21 }] } },
  { type: "tennis_match", block: { type: "tennis_match", player1: "Sinner", player2: "Alcaraz", sets: [{ p1: 6, p2: 4 }, { p1: 3, p2: 6 }, { p1: 7, p2: 6 }], status: "Final", tournament: "Roland Garros", ranking1: 1, ranking2: 2 } },
  { type: "restaurant_synthesis", block: { type: "restaurant_synthesis", query: "pizza napoletana", matches: [{ name: "Lollo Cucina", rating: 4.7, reviews: 520, pros: ["masa perfecta"], cons: ["caro"] }, { name: "Quiqua", rating: 4.5, reviews: 300, pros: ["salsa"], cons: [] }], synthesis: "Lollo es la mejor opción para pizza napoletana según 3 fuentes.", sources: [{ title: "Google", url: "https://google.com" }] } },
  { type: "comparison", block: { type: "comparison", query: "notebooks", items: [{ name: "MacBook Air", price: "US$ 999", rating: 4.8, pros: ["batería"], cons: ["precio"] }, { name: "ThinkPad", price: "US$ 850", rating: 4.5, pros: ["teclado"], cons: ["peso"] }] } },
  { type: "product_analysis", block: { type: "product_analysis", product: { name: "iPhone 17", icon: "phone_iphone", rating: 9.2, reviewCount: "1.240 opiniones", description: "La cámara que redefine el segmento." }, specs: [{ label: "Cámara", value: "48 MP" }, { label: "Batería", value: "26 h" }] } },
  { type: "smart_checklist", block: { type: "smart_checklist", title: "Checklist notebook", progress: 40, items: [{ label: "Definir presupuesto", checked: true }, { label: "Comparar baterías", checked: false }] } },
  { type: "outfit", block: { type: "outfit", title: "Casamiento de día", specs: [{ emoji: "🧥", label: "Traje", value: "azul marino" }, { emoji: "👔", label: "Camisa", value: "blanca" }], buttonLabel: "Guardar look" } },
  { type: "review_score", block: { type: "review_score", title: "DJI Mini 5", items: [{ emoji: "📷", score: "9/10", label: "Cámara", color: "#6D52F8" }, { emoji: "🔋", score: "8/10", label: "Batería", color: "#2FC86E" }], buttonLabel: "Ver análisis" } },
  { type: "review_document", block: { type: "review_document", productName: "iPhone 17", body: "Análisis extenso del iPhone 17 con 6 párrafos de review de The Verve.", sources: [{ title: "The Verge", url: "https://theverge.com" }] } },
  { type: "review_quote", block: { type: "review_quote", productName: "iPhone 17", quote: "La mejor cámara en un iPhone jamás hecha", author: "The Verge", rating: 9 } },
  { type: "plan", block: { type: "plan", title: "Tu día", note: "3 momentos clave", items: [{ time: "09:00", title: "Gimnasio", detail: "tren superior", icon: "fitness_center" }, { time: "14:00", title: "Almuerzo con Marta", detail: "Café Orleans", icon: "restaurant" }] } },
  { type: "crypto_portfolio", block: { type: "crypto_portfolio", items: [{ name: "Bitcoin", symbol: "BTC", price: "US$ 68.500", change: 2.4, positive: true }, { name: "Ethereum", symbol: "ETH", price: "US$ 3.500", change: -1.2, positive: false }] } },
  { type: "market", block: { type: "market", title: "Mercados hoy", assets: [{ symbol: "AAPL", name: "Apple Inc.", category: "Acciones", price: "US$ 232,50", change: "+1,2%", changeUp: true }] } },
  { type: "forex", block: { type: "forex", items: [{ pair: "USD/ARS", rate: "1.010", change: 0.5, positive: true }] } },
  { type: "election_results", block: { type: "election_results", title: "Elecciones 2026", status: "87% escrutado", items: [{ name: "Candidata A", percent: "53,5%", detail: "18,2M votos", done: true, color: "#6D52F8" }, { name: "Candidato B", percent: "44,4%", detail: "15,1M votos", done: false, color: "#2FC86E" }] } },
  { type: "election_vote", block: { type: "election_vote", question: "¿Debería la ciudad invertir en tranvías?", options: [{ label: "Sí", pct: 62 }, { label: "No", pct: 38 }] } },
  { type: "data_ticker", block: { type: "data_ticker", items: [{ label: "Dólar blue", value: "1.015", change: 0.8, positive: true }, { label: "Dólar oficial", value: "1.010", change: 0.1, positive: true }] } },
  { type: "route_timeline", block: { type: "route_timeline", eta: "35 min", items: [{ time: "5 min", text: "Av. 9 de Julio", sub: "tráfico moderado", now: true }, { time: "30 min", text: "Llegada a Palermo" }] } },
  { type: "transport_compare", block: { type: "transport_compare", items: [{ mode: "Auto", time: "35 min", cost: "US$ 4", active: true }, { mode: "Subte", time: "28 min", cost: "US$ 0,75" }, { mode: "Bici", time: "45 min", cost: "US$ 0" }] } },
  { type: "route_map", block: { type: "route_map", progress: 75, from: "Casa", to: "Palermo", distance: "12 km", remaining: "35 min", steps: [{ instruction: "Seguí por Av. Corrientes", distance: "3 km", duration: "8 min" }] } },
  { type: "travel_planner", block: { type: "travel_planner", destination: "Bariloche", dates: "marzo · 4 días", steps: [{ time: "Día 1", label: "Centro Cívico", detail: "tarde", icon: "location_city" }, { time: "Día 2", label: "Cerro Catedral", detail: "día completo", icon: "downhill_skiing" }] } },
  { type: "travel_plan", block: { type: "travel_plan", destination: "Bariloche", summary: "4 días de montaña y lagos", days: [{ day: "Día 1", items: [{ time: "14:00", text: "Check-in", sub: "hotel centro" }] }] } },
  { type: "birthday_calendar", block: { type: "birthday_calendar", month: "septiembre", people: [{ name: "Marta", day: 15, relation: "amiga" }, { name: "Papá", day: 22, relation: "familia" }] } },
  { type: "birthday_alarm", block: { type: "birthday_alarm", person: "Marta", date: "15 sept", daysLeft: 4, age: 30 } },
  { type: "social_interaction", block: { type: "social_interaction", name: "Marta", event: "Cumpleaños", date: "15 sept", age: "30", remaining: "4 días", gifts: [{ emoji: "📚", title: "Libro", detail: "le encanta leer" }] } },
  { type: "money_summary", block: { type: "money_summary", title: "Resumen de septiembre", total: 2600, currency: "US$", summaryItems: [{ label: "Sueldo", value: "US$ 3.500", detail: "entró el 1º" }, { label: "Alquiler", value: "US$ 900", detail: "venció el 5" }], recommendation: "Vas bien, podés ahorrar 20%" } },
  { type: "memory", block: { type: "memory", items: [{ text: "Trabaja en Koru", kind: "work" }, { text: "Le gusta el tenis", kind: "interest" }] } },
  { type: "saved_record", block: { type: "saved_record", title: "Pasaporte", records: [{ kind: "document", label: "Pasaporte", value: "AA1234567", notes: "vence 2031" }] } },
  { type: "alarm", block: { type: "alarm", time: "07:00", label: "Gimnasio" } },
  { type: "reminder", block: { type: "reminder", time: "14:00", text: "Llamar al dentista" } },
  { type: "recipe", block: { type: "recipe", title: "Ñoquis de papa", name: "Ñoquis de papa", category: "Pastas", area: "Italia", description: "Ñoquis caseros de papa", instructions: "Herví las papas. Amasá con harina y huevo.", ingredients: [{ ingredient: "papas", measure: "1 kg" }, { ingredient: "harina", measure: "300 g" }], videoUrl: "https://youtube.com/x" } },
  { type: "movie_review", block: { type: "movie_review", title: "Dune 3", rating: 8.7, director: "Denis Villeneuve", runtime: "166 min", year: "2026", summary: "Cierra la saga con una batalla visual." } },
  { type: "book_review", block: { type: "book_review", title: "La House de los Espíritus", author: "Isabel Allende", year: "1982", summary: "Saga familiar chilena." } },
  { type: "news_urgent", block: { type: "news_urgent", items: [{ title: "Rescate en la cordillera", body: "3 andinistas fueron rescatados", source: "Clarín", minutesAgo: 12 }] } },
  { type: "data_card", block: { type: "data_card", title: "Everest", sourceStatus: "verified", items: [{ label: "Altura", value: "8.849 m", detail: "sobre el nivel del mar", quote: "Medición oficial de 2020", sourceUrl: "https://wikipedia.org", sourceDomain: "wikipedia.org" }] } },
  { type: "decision_support", block: { type: "decision_support", question: "¿MacBook o ThinkPad?", options: [{ label: "MacBook", score: 82, pros: ["batería 18h"], cons: ["precio"] }, { label: "ThinkPad", score: 76, pros: ["teclado"], cons: ["peso"] }] } },
  { type: "exercise_plan", block: { type: "exercise_plan", title: "Plan 5K", plan: { id: "p1", goal: "5K en 25 min", weeks: [{ week: 1, focus: "base", sessions: [{ day: "LUN", type: "trote suave", minutes: 30 }] }] } } },
  { type: "wellbeing", block: { type: "wellbeing", title: "Tu día de bienestar", emoji: "🌿", sections: [{ icon: "local_fire_department", iconColor: "#2FC86E", bgColor: "#EAFBF2", borderColor: "#C7F3DC", value: "5", label: "racha de días", sleep: { icon: "bedtime", value: "7,5 h", label: "dormido" }, suggestion: { icon: "water_drop", value: "2 vasos", label: "te faltan" } }] } },
  { type: "health_reminder", block: { type: "health_reminder", title: "Hidratación", icon: "water_drop", iconColor: "#2f80ed", bgColor: "#e8f1fd", reminder: "Tomá tu próximo vaso de agua", actionLabel: "Ya tomé" } },
  { type: "activity_tracker", block: { type: "activity_tracker", title: "Actividad", subtitle: "viernes", metrics: [{ icon: "directions_walk", label: "Pasos", value: "8.200", unit: "/ 10.000", progress: 82, progressColor: "#2FC86E" }] } },
  { type: "morning_brief", block: { type: "morning_brief", date: "viernes 11", items: [{ title: "Clima", detail: "22° despejado" }, { title: "Agenda", detail: "2 eventos" }] } },
  { type: "urgent_now", block: { type: "urgent_now", eyebrow: "AHORA", headline: "Reunión en 10 minutos", description: "Sala Júpiter · con el equipo de producto", icon: "bolt", iconColor: "#e63946", iconBg: "#fde8ec" } },
  { type: "generation", block: { type: "generation", title: "Haiku del río", prompt: "un haiku sobre el río", resultType: "text", preview: "Luna sobre el río —\nla voz del agua responde —\ncalla el corazón.", actionLabel: "Guardar" } },
  { type: "research_sources", block: { type: "research_sources", query: "era espacial", sources: [{ title: "NASA budget 2026", url: "https://nasa.gov", snippet: "..." }, { title: "SpaceX Starship", url: "https://spacex.com", snippet: "..." }] } },
  { type: "shopping_list", block: { type: "shopping_list", title: "Compra del sábado", items: ["café", "medialunas"], quantities: { café: 1, medialunas: 12 }, checked: ["medialunas"], dueText: "sábado 10:00" } },
  { type: "resource_bundle", block: { type: "resource_bundle", title: "Fuentes", summary: "3 archivos listos", files: [{ id: "f1", name: "Informe.pdf", url: "https://a.com/x.pdf", kind: "pdf", createdAt: new Date().toISOString(), sizeBytes: 120000 }] } },
  // ⚠️ NOTA: el tipo "article" NO existe como UiBlock en este repo (era del
  // koru viejo) — eliminado del audit. El fixture de match_timeline VACÍO se
  // mantiene documentado: ese block ya no se emite (guard en pushFixtureCard).
  { type: "web_nav", block: { type: "web_nav", title: "Buscar vuelos", status: "complete", query: "vuelos a Bariloche", url: "https://google.com", summary: "3 resultados listos", findings: ["Precios desde US$ 120"], results: [{ title: "Flybondi", source: "flybondi.com", url: "https://flybondi.com", type: "article", readTime: "2 min", snippet: "Vuelos desde US$ 120" }] } },
  { type: "activity_group", block: { type: "activity_group", title: "Hoy", subtitle: "3 momentos", energy: { value: 72, label: "energía" }, sections: [{ id: "s1", title: "Mañana", tone: "green", tiles: [{ kind: "weather", label: "Clima", value: "22°", detail: "despejado", actionLabel: "Ver" }] }] } },
  { type: "proactive_signal", block: { type: "proactive_signal", category: "weather", severity: "useful", title: "Lluvia a las 18", body: "Hay 70% de probabilidad de lluvia esta tarde.", timestampLabel: "ahora", sourceStatus: "verified", actionLabel: "Llevar paraguas", followUpQuestion: "¿Te aviso antes?", summaryItems: [{ label: "Probabilidad", value: "70%", detail: "18:00" }] } },
  { type: "delivery", block: { type: "delivery", service: "PedidosYa", status: "en camino", eta: "15 min", courier: "Carlos" } },
  { type: "clarifying_question", block: { type: "clarifying_question", question: "¿En qué ciudad querés el clima?", options: ["Madrid", "Barcelona"] } },
];

describe("audit: TODAS las cards — extensión y densidad", () => {
  it("audita fixtures", () => {
    console.log("\n═════════ AUDITORÍA DE EXTENSIONES ═════════");
    const rows: string[] = [];
    for (const f of FIXTURES) {
      let p: any;
      try { p = toPresentation(f.block as UiBlock); } catch (e: any) {
        rows.push(`❌ ${f.type}${f.note ? " [" + f.note + "]" : ""} → ERROR: ${e.message}`);
        continue;
      }
      const detail = p?.detail;
      const secs = detail?.sections ?? [];
      const density = secs.length ? JSON.stringify(secs).length : 0;
      const icon = !detail ? "🔴 SIN EXT" : secs.length === 0 ? "🔴 EXT VACÍA" : density < 400 ? "🟡 THIN" : "🟢 OK";
      rows.push(`${icon} ${f.type}${f.note ? " [" + f.note + "]" : ""} → ${detail ? `${secs.length} sec, ${density} chars, CTA="${p.cta?.label ?? "—"}"` : "no expandible, CTA=" + (p.cta?.label ?? "—")}`);
      if (detail && secs.length > 0) {
        secs.forEach((s: any) => {
          const n = s.kind === "timeline" ? (s.steps?.length ?? 0) : s.kind === "rows" ? (s.rows?.length ?? 0) : s.kind === "tiles" ? (s.tiles?.length ?? 0) : s.kind === "text" ? (s.body?.length ?? 0) : "?";
          rows.push(`      · ${s.kind} "${s.title}" (${n})`);
        });
      }
    }
    console.log(rows.join("\n"));
    console.log(`\nTOTAL: ${FIXTURES.length} fixtures auditados`);
  }, 60_000);
});
