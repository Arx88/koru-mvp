import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteTimelineInterior } from "./RouteTimelineInterior";
import { routeTimelineBlock } from "../fixtures";

// RouteTimelineInterior — bind real del block `route_timeline`: legs con
// label/detail/color, eta, heurística de iconos por contenido.

describe("RouteTimelineInterior", () => {
  it("bindea eta, conteo de tramos y labels reales", () => {
    render(<RouteTimelineInterior block={routeTimelineBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/25 min/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4 tramos/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Caminá 250 m")).toBeInTheDocument();
    expect(screen.getByText("Subte D · 5 paradas")).toBeInTheDocument();
    expect(screen.getAllByText("Llegás al Retiro").length).toBeGreaterThan(0);
  });

  it("los detalles reales van como nota de cada leg", () => {
    render(<RouteTimelineInterior block={routeTimelineBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/a la sombra de los plátanos/i)).toBeInTheDocument();
    expect(screen.getByText(/andén de la mano derecha/i)).toBeInTheDocument();
  });

  it("la caja de llegada usa el último tramo real", () => {
    render(<RouteTimelineInterior block={routeTimelineBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/llegás al retiro/i).length).toBeGreaterThan(0);
  });

  it("guardar delega en onSave con primer label y eta", () => {
    const onSave = vi.fn();
    render(<RouteTimelineInterior block={routeTimelineBlock} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar ruta/i }));
    expect(onSave).toHaveBeenCalledWith("Caminá 250 m", "25 min");
  });

  it("sin items degrada honesto", () => {
    render(<RouteTimelineInterior block={{ type: "route_timeline" }} onClose={vi.fn()} />);
    expect(screen.getByText(/todavía no armé la ruta/i)).toBeInTheDocument();
    expect(screen.getByText(/sin ruta calculada/i)).toBeInTheDocument();
  });
});
