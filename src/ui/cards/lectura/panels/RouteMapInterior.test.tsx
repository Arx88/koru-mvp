import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteMapInterior } from "./RouteMapInterior";
import { routeMapBlock } from "../fixtures";

// RouteMapInterior — bind real del block `route_map`: pins from/to,
// stats distance/remaining/traffic, siguiente paso, deep link nativo.

describe("RouteMapInterior", () => {
  it("bindea from/to/distance/remaining y progreso", () => {
    render(<RouteMapInterior block={routeMapBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/callao 220/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/parque del retiro/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6,2 km/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/te quedan 25 min/i)).toBeInTheDocument();
    expect(screen.getByText(/vas al 42%/i)).toBeInTheDocument();
  });

  it("el siguiente paso es el primer step real del block", () => {
    render(<RouteMapInterior block={routeMapBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/siguiente: girá a la derecha hacia av\. santa fe/i)).toBeInTheDocument();
    expect(screen.getByText(/250 m · turn-right/i)).toBeInTheDocument();
  });

  it("las alternativas reales van en la nota", () => {
    render(<RouteMapInterior block={routeMapBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/bus 10 \+ caminata \(41 min\)/i)).toBeInTheDocument();
    expect(screen.getByText(/a pie por callao \(58 min\)/i)).toBeInTheDocument();
  });

  it("guíame abre el deep link nativo con lat/lng del block (no iOS)", () => {
    const open = vi.fn();
    window.open = open;
    // UA de linux para forzar geo: (Android convention)
    Object.defineProperty(window.navigator, "userAgent", { value: "Mozilla/5.0 (X11; Linux)", configurable: true });
    render(<RouteMapInterior block={routeMapBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /guíame paso a paso/i }));
    expect(open).toHaveBeenCalledWith("geo:-34.5837,-58.4088", "_blank", "noopener,noreferrer");
  });

  it("sin lat/lng el botón de guía queda deshabilitado", () => {
    render(<RouteMapInterior block={{ type: "route_map", from: "A", to: "B" }} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /sin coordenadas/i })).toBeDisabled();
  });

  it("progreso 100 cambia el estado a completado", () => {
    render(<RouteMapInterior block={{ ...routeMapBlock, progress: 100, remaining: undefined }} onClose={vi.fn()} />);
    expect(screen.getByText(/llegaste al destino/i)).toBeInTheDocument();
    expect(screen.getAllByText(/completado|listo/i).length).toBeGreaterThan(0);
  });
});
