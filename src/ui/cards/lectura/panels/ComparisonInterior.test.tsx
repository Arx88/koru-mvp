import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComparisonInterior } from "./ComparisonInterior";
import { comparisonBlock } from "../fixtures";

// ComparisonInterior — bind real del block `comparison`: items con score/
// details, ganador derivado, tabla con match de labels, recommendation.

describe("ComparisonInterior", () => {
  it("bindea los 3 contendientes reales con precios y vendors", () => {
    render(<ComparisonInterior block={comparisonBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/Sony XM5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bose QC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AirPods 4/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/€189/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MediaMarkt/i)).toBeInTheDocument();
  });

  it("el ganador por score lleva TU MATCH y GANA en la tabla", () => {
    render(<ComparisonInterior block={comparisonBlock} onClose={vi.fn()} />);
    expect(screen.getByText("TU MATCH")).toBeInTheDocument();
    expect(screen.getByText("GANA")).toBeInTheDocument();
    expect(document.body.querySelectorAll(".dside.win").length).toBe(1);
  });

  it("el tally muestra los details con positive real (Sony 3 de 4, Bose 3 de 4, AirPods 1 de 4)", () => {
    render(<ComparisonInterior block={comparisonBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/ganó 3 de 4/i).length).toBe(2);
    expect(screen.getAllByText(/ganó 1 de 4/i).length).toBe(1);
  });

  it("criteria y recommendation reales del block", () => {
    render(<ComparisonInterior block={comparisonBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/cancelación · batería · llamadas · compatibilidad/i)).toBeInTheDocument();
    expect(screen.getByText(/ganó sony por el combo/i)).toBeInTheDocument();
  });

  it("abrir ganador usa la url real del item ganador", () => {
    const open = vi.fn();
    window.open = open;
    render(<ComparisonInterior block={comparisonBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /abrir sony xm5/i }));
    expect(open).toHaveBeenCalledWith("https://tienda.example/sony-xm5", "_blank", "noopener,noreferrer");
  });

  it("sin urls el botón primario queda deshabilitado", () => {
    render(
      <ComparisonInterior
        block={{ type: "comparison", items: [{ title: "A", score: 1 }, { title: "B", score: 0 }] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /sin enlace del ganador/i })).toBeDisabled();
  });
});
