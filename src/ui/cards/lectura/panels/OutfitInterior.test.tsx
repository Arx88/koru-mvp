import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutfitInterior } from "./OutfitInterior";
import { outfitBlock } from "../fixtures";

// OutfitInterior — bind real del block `outfit`: título, chips de condición
// desde specs (Temp/Mínima/Viento/UV), notas honestas solo si el block las
// trae, buttonLabel, look editorial con fotos del paquete stitch.

describe("OutfitInterior", () => {
  it("bindea título y condición desde specs (26° / 19°)", () => {
    render(<OutfitInterior block={outfitBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/look para hoy · 26°/i)).toBeInTheDocument();
    expect(screen.getByText(/26° ahora · 19° a la noche/i)).toBeInTheDocument();
  });

  it("notas de viento/sol derivadas SOLO de specs presentes", () => {
    render(<OutfitInterior block={outfitBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/con 14 km\/h ne/i)).toBeInTheDocument();
    expect(screen.getByText(/índice 6/i)).toBeInTheDocument();
  });

  it("guardar usa buttonLabel del block y delega en onSave", () => {
    const onSave = vi.fn();
    render(<OutfitInterior block={outfitBlock} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar este look/i }));
    expect(onSave).toHaveBeenCalledWith("Lo que yo te pondría", "26°");
  });

  it("sin specs de viento/sol no inventa notas", () => {
    render(<OutfitInterior block={{ type: "outfit", title: "Look simple" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/km\/h/i)).toBeNull();
    expect(screen.queryByText(/índice/i)).toBeNull();
  });
});
