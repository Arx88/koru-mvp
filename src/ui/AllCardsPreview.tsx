/**
 * Galería completa de todos los cards de Koru.
 * Renderiza cada card con datos de ejemplo para verificación estética.
 * Abrí: http://localhost:5200/all-cards-preview.html
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { KoruSemanticCard, type CardActionHandlers } from "./chatCards";
import type { KoruTurnItem } from "./KoruProvider";
import type { UiBlock, AssistantSource } from "../domain/types";
import { WebNavCardA } from "./chatCards";
import { RestaurantSynthesisCard } from "./cards/RestaurantCard";
import "../style.css";

const sources: AssistantSource[] = [
  { title: "Wikipedia", url: "https://es.wikipedia.org", domain: "wikipedia.org", snippet: "Artículo verificado" },
  { title: "La Nación", url: "https://lanacion.com.ar", domain: "lanacion.com.ar", snippet: "Noticia de hoy" },
  { title: "TripAdvisor", url: "https://tripadvisor.com", domain: "tripadvisor.com", snippet: "Top 10" },
];

const noopHandlers: CardActionHandlers = {
  onReview: () => {},
  onConfirmMemory: () => {},
  onPruneMemory: () => {},
  onCompleteCommitment: () => {},
  onSetWorldSignals: () => {},
};

function makeItem(overrides: Partial<KoruTurnItem> & { uiBlock?: UiBlock }): KoruTurnItem {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    kind: "action",
    tag: "test",
    text: "Ejemplo",
    status: "proposed",
    ...overrides,
  } as KoruTurnItem;
}

const CARDS: Array<{ label: string; items: KoruTurnItem[]; extra?: React.ReactNode }> = [
  {
    label: "restaurant_synthesis",
    items: [makeItem({ uiBlock: { type: "restaurant_synthesis", status: "ok", query: "parrilla en Palermo Buenos Aires", mood: "", topScore: "4/5", matches: [{ name: "Parrilla El Viejo Palermo", sourcesMentioning: 4, quote: "calificado 4.9 de 5 en Restaurant Guru" }], pros: ["Ofrecer una amplia variedad de opciones de parrilla", "Tener un ambiente acogedor"], cons: ["No hay cons mencionados"], synthesis: "Las parrillas en Palermo parecen ser un destino popular, con varias opciones disponibles.", sources, note: "Cruzadas 5 fuentes." } })],
  },
  {
    label: "weather",
    items: [makeItem({ uiBlock: { type: "weather", city: "Buenos Aires", now: "22°C Soleado", range: "18° - 26°", rain: "0%", wind: "12 km/h", advice: "Perfecto para salir", sources } })],
  },
  {
    label: "morning_brief",
    items: [makeItem({ uiBlock: { type: "morning_brief", greeting: "¡Hola! Aquí tienes tu resumen matutino 🌅", items: [
      { icon: "light_mode", iconColor: "#F2C94C", label: "Clima", value: "22°C Soleado" },
      { icon: "checkroom", iconColor: "#8676B1", label: "Ropa sugerida", value: "Blazer ligero" },
      { icon: "directions_car", iconColor: "#70B873", label: "Tráfico", value: "Ruta despejada" },
      { icon: "medication", iconColor: "#D9A05B", label: "Recordatorio", value: "Tomar vitamina", variant: "highlight" },
    ] } })],
  },
  {
    label: "wellbeing",
    items: [makeItem({ uiBlock: { type: "wellbeing", title: "Tu bienestar", emoji: "🧘‍♀️", sections: [
      { icon: "bedtime", iconColor: "#818cf8", bgColor: "#F8F9FA", value: "7h 20m", label: "Sueño óptimo" },
      { icon: "directions_walk", iconColor: "#a855f7", bgColor: "#f3f0ff", borderColor: "#e9d5ff", value: "Salir a caminar", label: "Sugerencia tarde" },
    ] } })],
  },
  {
    label: "plan (timeline)",
    items: [makeItem({ uiBlock: { type: "plan", title: "Logística de Actividad", id: "ID: PLAN-882", steps: [
      { time: "09:15 AM", label: "Check-in Punto A", description: "Sincronización de sensores y calibración de ruta base.", status: "done" as const, tags: [{ label: "Geo-tagging: ON" }, { label: "Nivel 4" }] },
      { time: "10:45 AM", label: "Intervención de Campo", description: "Muestreo sistemático (Intervalos de 15m). Precisión 98%.", status: "current" as const },
      { time: "13:30 PM", label: "Consolidación de Datos", description: "Cierre de sesión técnica y reporte de contingencia.", status: "pending" as const },
    ], actionLabel: "Ejecutar Protocolo", actionIcon: "verified" as const } })],
  },
  {
    label: "live_match",
    items: [makeItem({ uiBlock: { type: "live_match", league: "Champions League", time: "89 min", status: "Final", homeTeam: { name: "Real Madrid", abbrev: "RMA", score: 3 }, awayTeam: { name: "Man City", abbrev: "MCI", score: 2 }, stats: [
      { label: "Possession", leftPercent: 42, rightPercent: 58 },
      { label: "Shots", leftPercent: 60, rightPercent: 40, leftColor: "#f59e0b", rightColor: "#3b82f6" },
    ] } })],
  },
  {
    label: "urgent_now",
    items: [makeItem({ uiBlock: { type: "urgent_now", headline: "Acuerdo histórico en la cumbre climática", description: "Líderes mundiales firman un tratado vinculante para reducir emisiones en un 50% para 2030. Mercados de energía renovable reaccionan positivamente.", icon: "breaking_news_alt_1", iconColor: "#ef4444", iconBg: "#fef2f2" } })],
  },
  {
    label: "market",
    items: [makeItem({ uiBlock: { type: "market", title: "Mercados", assets: [
      { symbol: "₿", name: "Bitcoin", price: "$64,230", change: "+2.4%", changeUp: true, iconBg: "#fff7ed", iconColor: "#f97316" },
      { symbol: "Ξ", name: "Ethereum", price: "$3,450", change: "-0.8%", changeUp: false, iconBg: "#eff6ff", iconColor: "#3b82f6" },
      { symbol: "AAPL", name: "Apple Inc.", price: "$189.12", change: "+1.1%", changeUp: true, iconBg: "#111827", iconColor: "#ffffff", shape: "rounded" as const },
    ] } })],
  },
  {
    label: "health_reminder",
    items: [makeItem({ uiBlock: { type: "health_reminder", title: "Recordatorio de salud", reminder: "Tomar vitamina D y hacer 10 minutos de estiramientos antes de dormir.", actionLabel: "Marcar como hecho", icon: "favorite", iconColor: "#e11d48", bgColor: "#fff1f2" } })],
  },
  {
    label: "delivery",
    items: [makeItem({ uiBlock: { type: "delivery", title: "Envío en curso", status: "En tránsito", carrier: "Correo Argentino", trackingId: "TRK-88213491", estimatedDate: "26 de mayo", steps: [
      { label: "Paquete recibido", done: true },
      { label: "En tránsito", done: true },
      { label: "En distribución", done: false },
      { label: "Entregado", done: false },
    ] } })],
  },
  {
    label: "social_interaction",
    items: [makeItem({ uiBlock: { type: "social_interaction", title: "Cumpleaños de mamá", subtitle: "¡Es hoy! Llamar en la tarde", icon: "cake", iconColor: "#f97316", iconBg: "#fff7ed", actionLabel: "Recordar", actionIcon: "notifications_active" } })],
  },
  {
    label: "activity_tracker",
    items: [makeItem({ uiBlock: { type: "activity_tracker", title: "Actividad Física", subtitle: "Hoy", metrics: [
      { icon: "steps", iconColor: "#14b8a6", label: "Pasos", value: "8,432", unit: "pasos", progress: 68, progressColor: "#14b8a6" },
      { icon: "local_fire_department", iconColor: "#f97316", label: "Calorías", value: "342", unit: "kcal", progress: 45, progressColor: "#f97316" },
      { icon: "schedule", iconColor: "#3b82f6", label: "Activo", value: "45", unit: "min", progress: 60, progressColor: "#3b82f6" },
      { icon: "moving", iconColor: "#8b5cf6", label: "Distancia", value: "5.2", unit: "km", progress: 52, progressColor: "#8b5cf6" },
    ] } })],
  },
  {
    label: "product_analysis",
    items: [makeItem({ uiBlock: { type: "product_analysis", product: { name: "Sony Alpha a7 IV", icon: "photo_camera", rating: 4.8, reviewCount: "4.8/5 de 1.2k reviews", description: "Cámara mirrorless híbrida excelente para video y fotografía profesional." }, specs: [{ label: "Sensor", value: "33MP Full-Frame" }, { label: "Video", value: "4K 60p 10-bit" }, { label: "Autofocus", value: "Real-time Eye AF" }, { label: "Precio Info", value: "Buen momento para comprar" }], actionLabel: "Ver opciones de compra", actionIcon: "shopping_cart" } })],
  },
  {
    label: "travel_planner",
    items: [makeItem({ uiBlock: { type: "travel_planner", destination: "Madrid, España", dates: "15 - 22 Julio", steps: [{ time: "Vuelo IDA", label: "EZE → MAD", detail: "Iberia IB6845 · 12h 30m", icon: "flight_takeoff" }, { time: "Día 1", label: "Llegada y check-in", detail: "Hotel Gran Vía Central", icon: "hotel" }, { time: "Día 2", label: "Tour histórico", detail: "Palacio Real · Museo del Prado", icon: "museum" }, { time: "Vuelo VUELTA", label: "MAD → EZE", detail: "Iberia IB6846 · 13h 10m", icon: "flight_land" }], actionLabel: "Ver itinerario completo" } })],
  },
  {
    label: "plan",
    items: [makeItem({ uiBlock: { type: "plan", title: "Plan de viaje", items: [{ text: "Sacar pasaporte", status: "waiting" as const }, { text: "Reservar vuelo", status: "doing" as const }, { text: "Elegir hotel", status: "done" as const }], note: "3 pasos para el viaje a Madrid" } })],
  },
  {
    label: "research_sources",
    items: [makeItem({ uiBlock: { type: "research_sources", title: "DeepResearch: Cripto", summary: "Bitcoin sube un 3% tras anuncio de la Fed. Ethereum sigue estable.", mode: "research", sources, followUpQuestion: "¿Querés ver el precio actual?" } })],
  },
  {
    label: "data_card",
    items: [makeItem({ uiBlock: { type: "data_card", title: "Datos verificados", items: [{ label: "Precio BTC", value: "$62.559", detail: "CoinGecko", sourceDomain: "coingecko.com" }, { label: "Market Cap", value: "$1.24T", detail: "CoinMarketCap", sourceDomain: "coinmarketcap.com" }] } })],
  },
  {
    label: "money_summary",
    items: [makeItem({ uiBlock: { type: "money_summary", title: "Resumen de gastos", total: 1240.50, currency: "ARS", summaryItems: [{ label: "Comida", value: "$450" }, { label: "Transporte", value: "$280" }, { label: "Ocio", value: "$510.50" }], recommendation: "Gastaste un 15% más en ocio respecto al mes pasado." } })],
  },
  {
    label: "shopping_list",
    items: [makeItem({ uiBlock: { type: "shopping_list", title: "Por cierto, de camino a casa recuerda pasar por el súper. Tienes esto en tu lista: 🛒", items: ["Leche de almendras", "Aguacates", "Pan integral", "Café"], quantities: { "Leche de almendras": 1, "Aguacates": 3, "Pan integral": 1, "Café": 2 }, checked: ["Pan integral"], dueText: "Para hoy", note: "No olvidar el yogur griego" } })],
  },
  {
    label: "alarm",
    items: [makeItem({ uiBlock: { type: "alarm", title: "Despertador", time: "07:00", repeat: "Lun-Vie", note: "Gimnasio" } })],
  },
  {
    label: "reminder",
    items: [makeItem({ uiBlock: { type: "reminder", title: "Llamar a mamá", dueText: "Mañana 18:00", note: "Cumpleaños" } })],
  },
  {
    label: "comparison",
    items: [makeItem({ uiBlock: { type: "comparison", title: "Comparar notebooks", items: [{ name: "MacBook Air M3", price: "$1.200", features: "Chip M3, 16GB RAM", url: "https://apple.com" }, { name: "ThinkPad X1", price: "$1.150", features: "Intel Ultra 7, 32GB RAM", url: "https://lenovo.com" }], criteria: ["Precio", "RAM", "Portabilidad"], recommendation: "ThinkPad X1 ofrece más RAM por menos dinero.", sources } })],
  },
  {
    label: "activity_group",
    items: [makeItem({ uiBlock: { type: "activity_group", title: "Tu día", subtitle: "Miércoles 24 de junio", energy: { value: 72, label: "Energía" }, sections: [{ title: "Mañana", tone: "green" as const, tiles: [{ kind: "weather" as const, label: "Clima", value: "22°C" }, { kind: "work" as const, label: "Trabajo", value: "2 reuniones" }] }, { title: "Tarde", tone: "amber" as const, rows: [{ title: "Dentista", detail: "15:30", urgent: true }] }], note: "Día movido pero manejable." } })],
  },
  {
    label: "proactive_signal",
    items: [makeItem({ uiBlock: { type: "proactive_signal", category: "weather", severity: "important", title: "Tormenta a la tarde", body: "Se esperan lluvias intensas a partir de las 16:00 en Buenos Aires.", summaryItems: [{ label: "Probabilidad", value: "85%" }, { label: "Intensidad", value: "Alta" }], sources, followUpQuestion: "¿Querés que busque un refugio cerca?" } })],
  },
  {
    label: "saved_record",
    items: [makeItem({ uiBlock: { type: "saved_record", title: "Guardado", records: [{ id: "r1", domain: "morning" as const, kind: "idea" as const, title: "Tomo café solo por la mañana", value: "Evito azúcar", collection: "rutina", createdAt: new Date().toISOString() }] } })],
  },
  {
    label: "resource_bundle",
    items: [makeItem({ uiBlock: { type: "resource_bundle", title: "Recursos", files: [{ name: "guia.pdf", kind: "document" as const, mimeType: "application/pdf", sizeLabel: "1.2 MB" }] } })],
  },
  {
    label: "clarifying_question",
    items: [makeItem({ uiBlock: { type: "clarifying_question", question: "¿Te referís a Palermo de Buenos Aires o Palermo de Italia?", options: ["Buenos Aires", "Italia", "Otro"] } })],
  },
  {
    label: "decision_support",
    items: [makeItem({ actionKind: "decision_support" as const, text: "¿Debería aceptar la oferta de trabajo?", decisionVote: "go", decisionAssumption: "El salario es 20% superior y hay flexibilidad horaria." })],
  },
  {
    label: "memory",
    items: [{ id: "mem-1", kind: "memory" as const, tag: "memoria", text: "A Juan le gusta el café fuerte", status: "confirmed" as const } as KoruTurnItem],
  },
  {
    label: "web_nav (standalone)",
    items: [],
    extra: (
      <WebNavCardA block={{ type: "web_nav", status: "ok", query: "criptomonedas hoy", title: "Resultados web", url: "https://google.com", results: [{ title: "Bitcoin supera los 60k", url: "https://example.com/1", domain: "example.com", snippet: "BTC rompe resistencia" }, { title: "Ethereum 2.0", url: "https://example.com/2", domain: "example.com", snippet: "Shapella activado" }] }} />
    ),
  },
];

function Preview() {
  return (
    <div className="min-h-screen bg-[var(--koru-bg)] py-8 px-4">
      <div className="max-w-md mx-auto space-y-10">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-extrabold text-[var(--koru-text)]">Galería de Cards Koru</h1>
          <p className="text-xs text-[var(--koru-muted)] mt-1">Todos los tipos de card renderizados con datos de ejemplo</p>
          <p className="text-[10px] text-[var(--koru-muted)] mt-0.5">viewport simulado: 390×844 (mobile)</p>
        </header>

        {CARDS.map(({ label, items, extra }) => (
          <section key={label} className="space-y-2">
            <h2 className="text-[11px] font-extrabold text-[var(--koru-muted)] uppercase tracking-widest px-1">
              {label}
            </h2>
            {items.map((item) => (
              <div key={item.id} className="koru-message is-koru">
                <div className="koru-cards-row">
                  <KoruSemanticCard item={item} handlers={noopHandlers} />
                </div>
              </div>
            ))}
            {extra && (
              <div className="koru-message is-koru">
                <div className="koru-cards-row">{extra}</div>
              </div>
            )}
          </section>
        ))}

        <footer className="mt-12 text-center pb-8">
          <p className="text-[10px] text-[var(--koru-muted)]">
            Koru MVP — {CARDS.length} tipos de card verificados
          </p>
        </footer>
      </div>
    </div>
  );
}

const root = document.createElement("div");
root.id = "root";
document.body.appendChild(root);
createRoot(root).render(<Preview />);
