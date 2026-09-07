import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TravelInterior } from "./TravelInterior";

// TravelInterior — bind real del block `travel_plan`: días/activities/
// reservations/packing/budget reales, tabs seleccionables, foto solo
// para destino con asset conocido.

const travelBlock = {
  type: "travel_plan" as const,
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
        { time: "20:00", title: "Vermú + de paseo", detail: "La Latina a esta hora se camina sola." },
      ],
    },
    {
      day: 2,
      title: "Malasaña y Chamberí",
      activities: [
        { time: "11:00", title: "Mercado de Vallehermoso", detail: "Parada de tortilla en el puesto 14." },
        { time: "15:30", title: "Comida: Casa Mono", detail: "Reservada ya, afuera si el calor lo permite." },
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
    {
      provider: "Iberia",
      type: "Vuelo",
      detail: "IB 3421 · directo 2h 10m",
      status: "confirmada",
      deepLink: "https://iberia.com/checkin",
    },
    {
      provider: "Hotel Regente",
      type: "Hotel",
      detail: "3 noches · desayuno incluido",
      status: "confirmada",
    },
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

describe("TravelInterior", () => {
  it("bindea destino, fechas, viajeros y presupuesto real en el hero", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/madrid/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 días · septiembre/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 viajeros/i)).toBeInTheDocument();
    expect(screen.getAllByText(/360 €/i).length).toBeGreaterThan(0);
  });

  it("la foto del hero SOLO para destino con asset (Madrid)", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    const img = document.body.querySelector(".tv-hero img");
    expect(img?.getAttribute("src")).toBe("/stitch/outfits/travel-madrid.jpg");
    expect(screen.getByText(/Cibeles, Madrid/i)).toBeInTheDocument();
  });

  it("los 3 días reales como tabs; el día 1 activo por defecto", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    const tabs = document.body.querySelectorAll(".it-day");
    expect(tabs.length).toBe(3);
    expect(tabs[0]).toHaveClass("on");
    expect(screen.getByText("Centro y Austrias")).toBeInTheDocument();
    expect(screen.getByText(/café en el passatge/i)).toBeInTheDocument();
    expect(screen.getByText(/prado · 2 h quirúrgicas/i)).toBeInTheDocument();
    expect(screen.getByText(/vermú \+ de paseo/i)).toBeInTheDocument();
  });

  it("cambiar de tab muestra las activities del día 2", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    fireEvent.click(document.body.querySelectorAll(".it-day")[1]);
    expect(screen.getByText(/malasaña y chamberí/i)).toBeInTheDocument();
    expect(screen.getByText(/mercado de vallehermoso/i)).toBeInTheDocument();
    expect(screen.queryByText(/café en el passatge/i)).toBeNull();
  });

  it("las reservations reales con status y deep link", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Iberia")).toBeInTheDocument();
    expect(screen.getAllByText("confirmada").length).toBe(2);
    expect(screen.getByText(/hotel regente/i)).toBeInTheDocument();
    const link = screen.getByText(/abrir en iberia/i);
    expect(link.getAttribute("href")).toBe("https://iberia.com/checkin");
  });

  it("packing real con toggles locales y estado inicial del block", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    const chips = document.body.querySelectorAll('[aria-pressed]');
    const packChips = [...chips].filter((c) => /zapatillas|campera|adaptador/i.test(c.textContent ?? ""));
    expect(packChips.length).toBe(3);
    const campera = packChips.find((c) => /campera/i.test(c.textContent ?? ""));
    expect(campera?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(packChips[0] as HTMLElement);
    expect(packChips[0]?.getAttribute("aria-pressed")).toBe("true");
  });

  it("el budget real como barras proporcionales del total", () => {
    render(<TravelInterior block={travelBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/comida/i)).toBeInTheDocument();
    expect(screen.getAllByText(/180 €/i).length).toBeGreaterThan(0);
    const bars = document.body.querySelectorAll(".it-card span i");
    expect([...bars].some((b) => b.getAttribute("style")?.includes("width: 50%"))).toBe(true); // 180/360
  });

  it("guardar día despacha create_commitment con el día activo", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title, dueHint: d.dueHint });
    };
    window.addEventListener("koru-card-action", listener);
    render(<TravelInterior block={travelBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar día 1/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toBe("Día 1: Centro y Austrias");
    expect(events[0]?.dueHint).toBe("3 días · septiembre");
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener("koru-card-action", listener);
  });

  it("destino sin asset → hero tipográfico sin foto inventada", () => {
    render(
      <TravelInterior
        block={{ type: "travel_plan", destination: "Lisboa", days: travelBlock.days.slice(0, 1) }}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.querySelector(".tv-hero img")).toBeNull();
    expect(screen.getAllByText(/lisboa/i).length).toBeGreaterThan(0);
  });
});
