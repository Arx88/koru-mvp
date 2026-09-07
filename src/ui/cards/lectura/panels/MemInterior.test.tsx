import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemInterior } from "./MemInterior";

// MemInterior — bind real del block `memory`: items reales en cascada,
// NUEVO en el primero, confidence como tag, note al caption, foto solo
// por contenido reconocido.

const memBlock = {
  type: "memory" as const,
  title: "Tu archivo de este mes",
  items: [
    {
      domain: "viaje",
      title: "La ruta de Mallorca que armamos",
      detail: "Calas escondidas + alquiler de moto en Sóller · presupuesto €900",
      confidence: 0.91,
    },
    {
      domain: "regalo",
      title: "El regalo de Maru: el vinilo de Wos",
      detail: "Edición numerada · queda en Bar Aparte, Palermo",
      confidence: 0.74,
    },
    {
      domain: "servicio",
      title: "El técnico de wifi que te funcionó",
      confidence: 0.66,
    },
    {
      domain: "idea",
      title: "Idea: menú de cumple de Juan",
      detail: "parrilla + tarta de la abuela",
      confidence: 0.8,
    },
    {
      domain: "auto",
      title: "Auto: cambiar aceite a los 12.000",
      confidence: 0.55,
    },
  ],
  note: "Todo quedó asociado a tu historial de septiembre.",
};

describe("MemInterior", () => {
  it("los items reales apilan en cascada (c1 con NUEVO)", () => {
    render(<MemInterior block={memBlock} onClose={vi.fn()} />);
    const cards = document.body.querySelectorAll(".arc-stack .arc-card");
    expect(cards.length).toBe(3);
    expect(cards[0]).toHaveClass("c1");
    expect(screen.getByText("NUEVO")).toBeInTheDocument();
    expect(screen.getByText(/la ruta de mallorca que armamos/i)).toBeInTheDocument();
    expect(screen.getByText(/el regalo de maru/i)).toBeInTheDocument();
    expect(screen.getByText(/el t[eé]cnico de wifi/i)).toBeInTheDocument();
  });

  it("el domain real aparece como kicker del item destacado", () => {
    render(<MemInterior block={memBlock} onClose={vi.fn()} />);
    expect(screen.getByText("viaje")).toBeInTheDocument();
    expect(screen.getByText("regalo")).toBeInTheDocument();
  });

  it("la foto va SOLO si el contenido matchea asset conocido (Mallorca)", () => {
    render(<MemInterior block={memBlock} onClose={vi.fn()} />);
    const img = document.body.querySelector(".arc-card .aph img");
    expect(img?.getAttribute("src")).toBe("/stitch/outfits/mem-mallorca.jpg");
    expect(screen.getByText(/sa calobra · parada 3/i)).toBeInTheDocument();
  });

  it("los items 4+ van a búsqueda rápida con confidence real como tag", () => {
    render(<MemInterior block={memBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/idea: menú de cumple de juan/i)).toBeInTheDocument();
    expect(screen.getByText(/auto: cambiar aceite/i)).toBeInTheDocument();
    const tags = document.body.querySelectorAll(".arow .tag");
    expect(tags[0]?.textContent).toBe("80%");
    expect(tags[1]?.textContent).toBe("55%");
  });

  it("el note real del block va al caption del cerebro", () => {
    render(<MemInterior block={memBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/asociado a tu historial de septiembre/i)).toBeInTheDocument();
  });

  it("perfecto así despacha complete; sin items degrada honesto", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; blockType: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, blockType: d.blockType });
    };
    window.addEventListener("koru-card-action", listener);
    const { rerender } = render(<MemInterior block={memBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /perfecto así/i }));
    expect(events[0]).toEqual({ action: "complete", blockType: "memory" });
    expect(onClose).toHaveBeenCalled();

    rerender(<MemInterior block={{ type: "memory" }} onClose={vi.fn()} />);
    expect(screen.getByText(/todavía no hay nada nuevo/i)).toBeInTheDocument();
    expect(document.body.querySelector(".arc-stack")).toBeNull();
    expect(document.body.querySelector(".arc-cap")).toBeNull();
    window.removeEventListener("koru-card-action", listener);
  });
});
