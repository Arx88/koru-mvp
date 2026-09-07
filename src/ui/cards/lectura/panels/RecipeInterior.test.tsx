import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeInterior } from "./RecipeInterior";
import { recipeBlock } from "../fixtures";

// RecipeInterior — bind real del block `recipe`: ingredientes/pasos/tips del
// block, modo cocina REAL (CookingMode de la app), carrito → create_commitment.

describe("RecipeInterior", () => {
  it("bindea nombre, ingredientes con medida y pasos con duración", () => {
    render(<RecipeInterior block={recipeBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText("Spaghetti alla carbonara").length).toBeGreaterThan(0);
    expect(screen.getByText("200 g")).toBeInTheDocument();
    expect(screen.getByText("spaghetti nº5")).toBeInTheDocument();
    expect(screen.getByText("Dorado del guanciale")).toBeInTheDocument();
    expect(screen.getByText("7 min")).toBeInTheDocument();
    expect(screen.getByText(/5 ingredientes/i)).toBeInTheDocument();
  });

  it("truco desde tips[0] del block", () => {
    render(<RecipeInterior block={recipeBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/fue temperatura/i)).toBeInTheDocument();
  });

  it("modo cocina abre el CookingMode real de la app", () => {
    render(<RecipeInterior block={recipeBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cocinar en modo pantalla/i }));
    // CookingMode renderiza el paso 1 del block real
    expect(screen.getByText(/fuego medio, sin aceite/i)).toBeInTheDocument();
  });

  it("carrito despacha create_commitment con los ingredientes", () => {
    const spy = vi.fn();
    window.addEventListener("koru-card-action", spy);
    render(<RecipeInterior block={recipeBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /agregar al carrito/i }));
    expect(spy.mock.calls[0][0].detail.action).toBe("create_commitment");
    expect(spy.mock.calls[0][0].detail.title).toContain("carbonara");
    window.removeEventListener("koru-card-action", spy);
  });
});
