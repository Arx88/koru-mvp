import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RestaurantInterior } from "./RestaurantInterior";
import { restaurantBlock } from "../fixtures";

// RestaurantInterior — bind real: podio desde matches (rating×2, estrellas,
// distance), foto del plato desde photos[0] (Places), tips desde logistics/
// priceLevel/whyTonight, reservar dispara el handler real "reserve".

describe("RestaurantInterior", () => {
  it("podio con los 3 matches reales y rating escala 10", () => {
    render(<RestaurantInterior block={restaurantBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Don Julio")).toBeInTheDocument();
    expect(screen.getByText("La Cabrera")).toBeInTheDocument();
    expect(screen.getByText("Cabaña Las Lilas")).toBeInTheDocument();
    expect(screen.getByText("9,2")).toBeInTheDocument();
  });

  it("foto del plato desde photos[0] y highlights del menú", () => {
    render(<RestaurantInterior block={restaurantBlock} onClose={vi.fn()} />);
    expect(screen.getByAltText(/ojo de bife/i)).toHaveAttribute("src", "/stitch/outfits/rest-steak.jpg");
    expect(screen.getByText(/ojo de bife · don julio/i)).toBeInTheDocument();
  });

  it("tips reales: reserva 19:15 y por qué esta noche", () => {
    render(<RestaurantInterior block={restaurantBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/reservá para las 19:15/i)).toBeInTheDocument();
    expect(screen.getByText(/entramás directo/i)).toBeInTheDocument();
  });

  it("reservar despacha el handler real reserve con el block", () => {
    const spy = vi.fn();
    window.addEventListener("koru-card-action", spy);
    render(<RestaurantInterior block={restaurantBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /reservar don julio/i }));
    expect(spy.mock.calls[0][0].detail.action).toBe("reserve");
    expect(spy.mock.calls[0][0].detail.blockData).toEqual(restaurantBlock);
    window.removeEventListener("koru-card-action", spy);
  });

  it("sin matches ni foto degrada sin inventar", () => {
    render(<RestaurantInterior block={{ type: "restaurant_synthesis", status: "partial" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/nº/i)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
