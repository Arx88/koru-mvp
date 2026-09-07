import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductInterior } from "./ProductInterior";
import { productBlock } from "../fixtures";

// ProductInterior — bind real del block `product_analysis`: name/image/
// rating/reviewCount/description + specs + actionLabel.

describe("ProductInterior", () => {
  it("bindea nombre, descripción y reviewCount del product", () => {
    render(<ProductInterior block={productBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/cafetera de'longhi magnifica evo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/la que recomiendo de las 14/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.204/i).length).toBeGreaterThan(0);
  });

  it("la foto del producto viene de product.image (no random)", () => {
    render(<ProductInterior block={productBlock} onClose={vi.fn()} />);
    expect(screen.getByAltText(/cafetera de'longhi magnifica evo/i)).toHaveAttribute(
      "src",
      "/stitch/outfits/prod-espresso.jpg",
    );
  });

  it("el dial usa el rating real (8,7 → arco 87%)", () => {
    render(<ProductInterior block={productBlock} onClose={vi.fn()} />);
    // v2: el rating ahora muestra la escala explícita (8,7/10)
    expect(screen.getByText("8,7/10")).toBeInTheDocument();
    const ring = document.body.querySelector(".prs-dial circle:nth-of-type(2)") as SVGCircleElement;
    const offset = Number(ring.getAttribute("stroke-dashoffset"));
    expect(offset).toBeGreaterThan(30); // 327 * 0.13 ≈ 42
    expect(offset).toBeLessThan(55);
  });

  it("los specs reales van al grid label/value", () => {
    render(<ProductInterior block={productBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Espresso")).toBeInTheDocument();
    expect(screen.getByText("9 bar")).toBeInTheDocument();
    expect(screen.getByText("Vapor")).toBeInTheDocument();
    expect(screen.getByText("automática")).toBeInTheDocument();
  });

  it("sin image no se renderiza foto (no inventa)", () => {
    render(
      <ProductInterior
        block={{
          type: "product_analysis",
          product: { name: "Otra cosa", rating: 7 },
          specs: [{ label: "Peso", value: "2 kg" }],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.querySelector(".prs-photo")).toBeNull();
    expect(screen.getByText("2 kg")).toBeInTheDocument();
  });

  it("actionLabel real del block en la primaria", () => {
    render(<ProductInterior block={productBlock} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /guardar para la compra/i })).toBeInTheDocument();
  });
});
