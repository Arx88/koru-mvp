import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MorningBriefCard } from "../ui/cards/MorningBriefCard";
import { WellbeingCard } from "../ui/cards/WellbeingCard";
import { WeatherCard } from "../ui/cards/WeatherCard";
import { PlanTimelineCard } from "../ui/cards/PlanTimelineCard";
import { ProductAnalysisCard } from "../ui/cards/ProductAnalysisCard";
import { SocialInteractionCard } from "../ui/cards/SocialInteractionCard";
import { LiveMatchCard } from "../ui/cards/LiveMatchCard";
import { ActivityTrackerCard } from "../ui/cards/ActivityTrackerCard";
import { GenerationCard } from "../ui/cards/GenerationCard";
import { TravelPlannerCard } from "../ui/cards/TravelPlannerCard";
import { ShoppingListCard } from "../ui/cards/ShoppingListCard";
import { ResourceBundleCard } from "../ui/cards/ResourceBundleCard";
import { MarketCard } from "../ui/cards/MarketCard";
import { DeliveryCard } from "../ui/cards/DeliveryCard";
import { HealthReminderCard } from "../ui/cards/HealthReminderCard";
import { UrgentNowCard } from "../ui/cards/UrgentNowCard";
import { RestaurantSynthesisCard } from "../ui/cards/RestaurantCard";

// ────────────────────────────────────────────────
// 1. MorningBriefCard
// ────────────────────────────────────────────────
describe("MorningBriefCard", () => {
  it("renders greeting and items without errors", () => {
    render(
      <MorningBriefCard
        block={{
          type: "morning_brief",
          greeting: "Buenos dias, Juan",
          items: [
            { icon: "wb_sunny", iconColor: "#F59E0B", label: "Clima", value: "22C soleado", variant: "highlight" },
            { icon: "calendar_today", iconColor: "#3B82F6", label: "Reuniones", value: "3 hoy" },
            { icon: "mail", iconColor: "#8B5CF6", label: "Emails", value: "12 sin leer" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Buenos dias, Juan")).toBeInTheDocument();
    expect(screen.getByText("22C soleado")).toBeInTheDocument();
    expect(screen.getByText("3 hoy")).toBeInTheDocument();
    expect(screen.getByText("12 sin leer")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 2. WellbeingCard
// ────────────────────────────────────────────────
describe("WellbeingCard", () => {
  it("renders sleep and suggestion sections without errors", () => {
    render(
      <WellbeingCard
        block={{
          type: "wellbeing",
          title: "Tu bienestar",
          emoji: "🧘‍♀️",
          sleep: { icon: "bedtime", value: "7h 20m", label: "Sueño óptimo" },
          suggestion: { icon: "directions_walk", value: "Salir a caminar", label: "Sugerencia tarde" },
        }}
      />,
    );
    expect(screen.getByText(/tu bienestar/i)).toBeInTheDocument();
    expect(screen.getByText("7h 20m")).toBeInTheDocument();
    expect(screen.getByText("Salir a caminar")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 3. WeatherCard
// ────────────────────────────────────────────────
describe("WeatherCard", () => {
  it("renders temperature and metrics without errors", () => {
    render(
      <WeatherCard
        block={{
          type: "weather",
          title: "Clima en Madrid",
          city: "Madrid",
          now: "22C",
          feel: "24C",
          condition: "Soleado",
          range: "18C - 26C",
          rain: "0%",
          wind: "12 km/h",
          humidity: "45%",
          uv: "Alto 6",
          advice: "Usa protector solar",
        }}
      />,
    );
    expect(screen.getByText("22C")).toBeInTheDocument();
    expect(screen.getByText("Soleado")).toBeInTheDocument();
    expect(screen.getByText("12 km/h")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 4. PlanTimelineCard
// ────────────────────────────────────────────────
describe("PlanTimelineCard", () => {
  it("renders timeline items without errors", () => {
    render(
      <PlanTimelineCard
        block={{
          type: "plan",
          title: "Plan de hoy",
          items: [
            { time: "09:00", title: "Revisión de emails", priority: "Alta", mode: "focus", durationMinutes: 30, rationale: "Priorizar los urgentes" },
            { time: "10:00", title: "Daily standup", priority: "Media", mode: "quick", durationMinutes: 15 },
            { time: "11:00", title: "Desarrollo feature", priority: "Alta", mode: "focus", durationMinutes: 120 },
          ],
          actionLabel: "Ver calendario completo",
          actionIcon: "calendar_month",
        }}
      />,
    );
    expect(screen.getByText("Plan de hoy")).toBeInTheDocument();
    expect(screen.getByText("Revisión de emails")).toBeInTheDocument();
    expect(screen.getByText("Daily standup")).toBeInTheDocument();
    expect(screen.getByText("Desarrollo feature")).toBeInTheDocument();
    expect(screen.getByText("Ver calendario completo")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 5. ProductAnalysisCard
// ────────────────────────────────────────────────
describe("ProductAnalysisCard", () => {
  it("renders product info and specs without errors", () => {
    render(
      <ProductAnalysisCard
        block={{
          type: "product_analysis",
          title: "Sony WH-1000XM5",
          subtitle: "Auriculares con cancelación de ruido líderes en el mercado",
          icon: "headphones",
          specs: [
            { label: "Autonomía", value: "30 horas" },
            { label: "Peso", value: "250g" },
            { label: "Bluetooth", value: "5.2" },
            { label: "Carga rápida", value: "3 min = 3h" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Sony WH-1000XM5")).toBeInTheDocument();
    expect(screen.getByText("30 horas")).toBeInTheDocument();
    expect(screen.getByText("250g")).toBeInTheDocument();
    expect(screen.getByText("Ver opciones")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 6. SocialInteractionCard
// ────────────────────────────────────────────────
describe("SocialInteractionCard", () => {
  it("renders title and gift suggestions without errors", () => {
    render(
      <SocialInteractionCard
        block={{
          type: "social_interaction",
          name: "María",
          date: "12 jul",
          age: "35 años",
          remaining: "Faltan 3 días",
          gifts: [
            { emoji: "🌹", title: "Ramo de rosas", detail: "Llega en 1h" },
            { emoji: "📚", title: "Libro firmado", detail: "Llega mañana" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Cumpleaños de María")).toBeInTheDocument();
    expect(screen.getByText("Ramo de rosas")).toBeInTheDocument();
    expect(screen.getByText("Libro firmado")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 7. LiveMatchCard
// ────────────────────────────────────────────────
describe("LiveMatchCard", () => {
  it("renders match info and stats without errors", () => {
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          minute: "78'",
          homeName: "Real Madrid",
          homeInitials: "RMA",
          homeScore: 2,
          awayName: "Barcelona",
          awayInitials: "BAR",
          awayScore: 1,
          globalAgg: "Global 3-3",
          homePossession: "58%",
          awayPossession: "42%",
          homeShots: "12",
          awayShots: "8",
        }}
      />,
    );
    expect(screen.getByText("Real Madrid")).toBeInTheDocument();
    expect(screen.getByText("Barcelona")).toBeInTheDocument();
    // Score text "2 - 1" is in a single parent span; check both teams and stats
    const scoreEl = screen.getByText((content, element) => element?.textContent === "2 - 1");
    expect(scoreEl).toBeInTheDocument();
    expect(screen.getByText("Possession")).toBeInTheDocument();
    expect(screen.getByText("Shots (On Target)")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 8. ActivityTrackerCard
// ────────────────────────────────────────────────
describe("ActivityTrackerCard", () => {
  it("renders metrics and progress ring without errors", () => {
    render(
      <ActivityTrackerCard
        block={{
          type: "activity_tracker",
          title: "¡Casi logras tu meta!",
          subtitle: "Te faltan 1,500 pasos",
          metrics: [
            { icon: "directions_walk", iconColor: "#10B981", label: "Pasos", value: "8,500", unit: "pasos", progress: 85, progressColor: "#10B981" },
            { icon: "local_fire_department", iconColor: "#F97316", label: "Calorías", value: "320", unit: "kcal", progress: 64 },
            { icon: "timer", iconColor: "#3B82F6", label: "Activo", value: "45", unit: "min", progress: 50 },
          ],
        }}
      />,
    );
    expect(screen.getByText("¡Casi logras tu meta!")).toBeInTheDocument();
    expect(screen.getByText("8,500")).toBeInTheDocument();
    expect(screen.getByText("Te faltan 1,500 pasos")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 9. GenerationCard
// ────────────────────────────────────────────────
describe("GenerationCard", () => {
  it("renders generation preview without errors", () => {
    render(
      <GenerationCard
        block={{
          type: "generation",
          title: "Propuesta generada",
          prompt: "Crear propuesta comercial",
          resultType: "text",
          preview: "# Propuesta Comercial\n\nReducción de costos en un 30%.",
          actionLabel: "Copiar contenido",
          actionIcon: "content_copy",
          filename: "propuesta.md",
        }}
      />,
    );
    expect(screen.getByText("propuesta.md")).toBeInTheDocument();
    expect(screen.getByText("# Propuesta Comercial")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 10. TravelPlannerCard
// ────────────────────────────────────────────────
describe("TravelPlannerCard", () => {
  it("renders travel itinerary without errors", () => {
    render(
      <TravelPlannerCard
        block={{
          type: "travel_planner",
          destination: "París",
          dates: "15-20 Junio 2025",
          steps: [
            { time: "08:00", label: "Vuelo MAD → CDG", detail: "Iberia IB3301", icon: "flight_takeoff" },
            { time: "11:30", label: "Check-in hotel", detail: "Le Marais Boutique", icon: "hotel" },
            { time: "14:00", label: "Tour guidado", detail: "Louvre + Eiffel", icon: "museum" },
          ],
          actionLabel: "Ver mapa completo",
        }}
      />,
    );
    expect(screen.getByText("París")).toBeInTheDocument();
    expect(screen.getByText("15-20 Junio 2025")).toBeInTheDocument();
    expect(screen.getByText("Vuelo MAD → CDG")).toBeInTheDocument();
    expect(screen.getByText("Check-in hotel")).toBeInTheDocument();
    expect(screen.getByText("Ver mapa completo")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 11. ShoppingListCard
// ────────────────────────────────────────────────
describe("ShoppingListCard", () => {
  it("renders shopping items without errors", () => {
    render(
      <ShoppingListCard
        block={{
          type: "shopping_list",
          title: "Lista del supermercado",
          items: ["Leche", "Huevos", "Pan", "Manzanas", "Aceite de oliva"],
          dueText: "Para hoy",
          note: "Comprar en Mercadona",
          quantities: { Leche: 2, Huevos: 12, Pan: 1, Manzanas: 6, "Aceite de oliva": 1 },
          checked: ["Pan"],
        }}
      />,
    );
    expect(screen.getByText("Lista del supermercado")).toBeInTheDocument();
    expect(screen.getByText("Leche")).toBeInTheDocument();
    expect(screen.getByText("Huevos")).toBeInTheDocument();
    expect(screen.getByText("Aceite de oliva")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 12. ResourceBundleCard
// ────────────────────────────────────────────────
describe("ResourceBundleCard", () => {
  it("renders file list without errors", () => {
    render(
      <ResourceBundleCard
        block={{
          type: "resource_bundle",
          title: "Archivos de proyecto",
          summary: "Documentos del proyecto Alpha",
          files: [
            { name: "propuesta.pdf", kind: "document", mimeType: "application/pdf", sizeLabel: "2.4 MB" },
            { name: "datos.csv", kind: "csv", mimeType: "text/csv", sizeLabel: "156 KB" },
            { name: "presentacion.pptx", kind: "presentation", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sizeLabel: "4.1 MB" },
          ],
        }}
      />,
    );
    expect(screen.getByText("propuesta.pdf")).toBeInTheDocument();
    expect(screen.getByText("datos.csv")).toBeInTheDocument();
    expect(screen.getByText("presentacion.pptx")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 13. MarketCard
// ────────────────────────────────────────────────
describe("MarketCard", () => {
  it("renders asset list without errors", () => {
    render(
      <MarketCard
        block={{
          type: "market",
          symbol: "AAPL",
          name: "Apple Inc.",
          pair: "AAPL/USD",
          price: "$189.50",
          change: 1.23,
          time: "1D",
        }}
      />,
    );
    expect(screen.getByText("AAPL/USD")).toBeInTheDocument();
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
            expect(screen.getByText("$189.50")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 14. DeliveryCard
// ────────────────────────────────────────────────
describe("DeliveryCard", () => {
  it("renders delivery tracking without errors", () => {
    render(
      <DeliveryCard
        block={{
          type: "delivery",
          title: "Pedido #48291",
          status: "En reparto",
          carrier: "SEUR",
          trackingId: "SE123456789ES",
          estimatedDate: "hoy antes de las 20:00",
          steps: [
            { label: "Pedido confirmado", done: true, time: "08:30" },
            { label: "En almacén", done: true, time: "10:15" },
            { label: "En reparto", done: true, time: "14:00" },
            { label: "Entregado", done: false },
          ],
        }}
      />,
    );
    expect(screen.getByText("Pedido #48291")).toBeInTheDocument();
    // Carrier text includes the estimated date in same node, use matcher function
    expect(screen.getByText((content) => content.includes("SEUR"))).toBeInTheDocument();
    expect(screen.getByText("Pedido confirmado")).toBeInTheDocument();
    expect(screen.getByText("Entregado")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 15. HealthReminderCard
// ────────────────────────────────────────────────
describe("HealthReminderCard", () => {
  it("renders reminder without errors", () => {
    render(
      <HealthReminderCard
        block={{
          type: "health_reminder",
          title: "Tomar medicación",
          icon: "medication",
          iconColor: "#F43F5E",
          reminder: "Ibuprofeno 600mg después de comer",
          actionLabel: "Marcar como tomado",
        }}
      />,
    );
    expect(screen.getByText("Tomar medicación")).toBeInTheDocument();
    expect(screen.getByText("Ibuprofeno 600mg después de comer")).toBeInTheDocument();
    expect(screen.getByText("Marcar como tomado")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 16. UrgentNowCard
// ────────────────────────────────────────────────
describe("UrgentNowCard", () => {
  it("renders urgent notice without errors", () => {
    render(
      <UrgentNowCard
        block={{
          type: "urgent_now",
          eyebrow: "URGENTE",
          icon: "warning",
          iconColor: "#EF4444",
          iconBg: "#FEF2F2",
          headline: "Reunión adelantada",
          description: "La reunión con el cliente se adelantó 30 minutos. Conectate ya.",
        }}
      />,
    );
    expect(screen.getByText("URGENTE")).toBeInTheDocument();
    expect(screen.getByText("Reunión adelantada")).toBeInTheDocument();
    expect(screen.getByText("La reunión con el cliente se adelantó 30 minutos. Conectate ya.")).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────
// 17. RestaurantSynthesisCard
// ────────────────────────────────────────────────
describe("RestaurantSynthesisCard", () => {
  it("renders restaurant comparison without errors", () => {
    render(
      <RestaurantSynthesisCard
        result={{
          type: "restaurant_synthesis",
          title: "Restaurantes en Madrid",
          query: "italiano romántico Madrid",
          mood: "Cena romántica",
          status: "ok",
          matches: [
            { name: "Trattoria Linda", sourcesMentioning: 5, quote: "Perfecto para cena romántica", rating: 4.7 },
            { name: "Osteria del Squero", sourcesMentioning: 3, rating: 4.5 },
            { name: "Il Pastaio", sourcesMentioning: 2, rating: 4.3 },
          ],
          topScore: "4.7/5",
          pros: ["Ambiente íntimo", "Servicio excelente", "Carta variada"],
          cons: ["Precio elevado", "Reserva necesaria"],
          synthesis: "La Trattoria Linda destaca por su ambiente íntimo y servicio personalizado.",
          labels: {
            cardTitle: "Restaurantes en Madrid",
            badge: "Síntesis",
            top3Label: "Top 3",
            topPickLabel: "Mejor opción",
            prosLabel: "Pros",
            consLabel: "Contras",
            chefLabel: "Nota del chef",
            navigateLabel: "Ver menú",
            callLabel: "Reservar mesa",
          },
        }}
      />,
    );
    expect(screen.getByText("Restaurantes en Madrid")).toBeInTheDocument();
    // Trattoria Linda appears twice (in list + breakdown), use getAllByText
    expect(screen.getAllByText("Trattoria Linda").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Osteria del Squero")).toBeInTheDocument();
    expect(screen.getByText("Reservar mesa")).toBeInTheDocument();
    expect(screen.getByText("Ver menú")).toBeInTheDocument();
  });
});
