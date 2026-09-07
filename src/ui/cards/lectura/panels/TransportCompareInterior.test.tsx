import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransportCompareInterior } from "./TransportCompareInterior";
import { transportBlock } from "../fixtures";

// TransportCompareInterior — bind real del block `transport_compare`:
// items como filas, active → destacada + GANA.

describe("TransportCompareInterior", () => {
  it("bindea todas las opciones del block con su tiempo", () => {
    render(<TransportCompareInterior block={transportBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/subte d/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/bus 10 \+ caminata/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/a pie por callao/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/25 min/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/41 min/i).length).toBeGreaterThan(0);
  });

  it("la opción activa lleva el badge GANA y la fila destacada", () => {
    render(<TransportCompareInterior block={transportBlock} onClose={vi.fn()} />);
    expect(screen.getByText("GANA")).toBeInTheDocument();
    expect(document.body.querySelectorAll(".db-row.next").length).toBe(1);
    expect(document.body.querySelectorAll(".cmp-row.best").length).toBe(1);
  });

  it("el consejo usa la mejor opción real (Subte D, 25 min)", () => {
    render(<TransportCompareInterior block={transportBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/el de 25 min es el tuyo: subte d/i)).toBeInTheDocument();
  });

  it("sin items degrada honesto", () => {
    render(<TransportCompareInterior block={{ type: "transport_compare", items: [] }} onClose={vi.fn()} />);
    expect(screen.getByText(/sin opciones para comparar/i)).toBeInTheDocument();
  });
});
