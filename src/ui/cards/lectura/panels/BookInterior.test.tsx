import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookInterior } from "./BookInterior";
import { bookBlock } from "../fixtures";

// BookInterior — bind real del block `book_review`: cover/autor/año/páginas/
// editorial/ISBN/rating del block, vista previa abre previewUrl real.

describe("BookInterior", () => {
  it("bindea título, autor, año, páginas y editorial", () => {
    render(<BookInterior block={bookBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText("Los días del venado").length).toBeGreaterThan(0);
    expect(screen.getByText(/nicolás petrone · 2023 · 288 páginas/i)).toBeInTheDocument();
    expect(screen.getByText(/editorial margen · 2023/i)).toBeInTheDocument();
    expect(screen.getAllByText(/288 páginas/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/978-987-000-000/i)).toBeInTheDocument();
  });

  it("cover desde el block y rating 4,6", () => {
    render(<BookInterior block={bookBlock} onClose={vi.fn()} />);
    expect(screen.getByAltText("Los días del venado")).toHaveAttribute("src", "/stitch/outfits/book-stack.jpg");
    expect(screen.getByText("4,6")).toBeInTheDocument();
  });

  it("vista previa habilitada con previewUrl; guardar delega en onSave", () => {
    const onSave = vi.fn();
    render(<BookInterior block={bookBlock} onClose={vi.fn()} onSave={onSave} />);
    expect(screen.getByRole("button", { name: /leer vista previa/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /guardar para después/i }));
    expect(onSave).toHaveBeenCalledWith("Los días del venado", "Nicolás Petrone");
  });

  it("sin previewUrl ni rating degrada sin inventar", () => {
    render(<BookInterior block={{ type: "book_review", title: "Otro libro", author: "Alguien" }} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /sin vista previa/i })).toBeDisabled();
    expect(screen.queryByText(/4,/)).toBeNull();
  });
});
