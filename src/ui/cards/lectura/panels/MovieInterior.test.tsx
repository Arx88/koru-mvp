import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MovieInterior } from "./MovieInterior";
import { movieBlock } from "../fixtures";

// MovieInterior — bind real del block `movie_review`: título/póster/rating→
// estrellas/géneros/streaming/duración/director, tráiler abre trailerUrl.

describe("MovieInterior", () => {
  it("bindea título, géneros y rating con coma es", () => {
    render(<MovieInterior block={movieBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText("Blade Runner 2049").length).toBeGreaterThan(0);
    expect(screen.getByText("CIENCIA FICCIÓN")).toBeInTheDocument();
    expect(screen.getByText("8,1")).toBeInTheDocument();
  });

  it("póster, duración y dónde verla desde el block", () => {
    render(<MovieInterior block={movieBlock} onClose={vi.fn()} />);
    expect(screen.getByAltText("Blade Runner 2049")).toHaveAttribute("src", "/stitch/outfits/movie-neon.jpg");
    expect(screen.getByText("2h 14min")).toBeInTheDocument();
    expect(screen.getByText(/hbo max/i)).toBeInTheDocument();
    expect(screen.getByText("Denis Villeneuve")).toBeInTheDocument();
  });

  it("guardar para el finde delega en onSave con el género", () => {
    const onSave = vi.fn();
    render(<MovieInterior block={movieBlock} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar para el finde/i }));
    expect(onSave).toHaveBeenCalledWith("Blade Runner 2049", "Ciencia ficción");
  });

  it("sin rating ni tráiler degrada sin inventar", () => {
    render(<MovieInterior block={{ type: "movie_review", title: "Otra peli" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/estrellas/i)).toBeNull();
    expect(screen.getByRole("button", { name: /sin tráiler/i })).toBeDisabled();
  });
});
