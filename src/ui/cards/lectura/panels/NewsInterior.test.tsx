import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewsInterior } from "./NewsInterior";
import { newsUrgentBlock } from "../fixtures";

// NewsInterior — bind real del block `news_urgent`: titular/summary,
// foto de portada desde la primera fuente con og:image, timeline con
// status, factChecks verificados, fuentes reales, acción create_commitment.

describe("NewsInterior", () => {
  it("bindea titular, resumen y categoría", () => {
    render(<NewsInterior block={newsUrgentBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/batería de 2030/i)).toBeInTheDocument();
    expect(screen.getByText(/recargar al 80% en 12 minutos/i)).toBeInTheDocument();
    expect(screen.getByText(/^tech$/i)).toBeInTheDocument();
  });

  it("foto de portada desde la primera fuente con imageUrl", () => {
    render(<NewsInterior block={newsUrgentBlock} onClose={vi.fn()} />);
    expect(screen.getByAltText(/batería de 2030/i)).toHaveAttribute("src", "/stitch/outfits/news-ev.jpg");
  });

  it("timeline y factChecks del block en columnas", () => {
    render(<NewsInterior block={newsUrgentBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/14:50 · confirmado/i)).toBeInTheDocument();
    expect(screen.getByText(/reuters publica el borrador/i)).toBeInTheDocument();
    expect(screen.getByText(/solo en estaciones de 800 v/i)).toBeInTheDocument();
  });

  it("masthead cuenta las fuentes reales y marca verificado", () => {
    render(<NewsInterior block={newsUrgentBlock} onClose={vi.fn()} />);
    expect(screen.getByText("3 fuentes")).toBeInTheDocument();
    expect(screen.queryByText("VERIFICADO")).toBeNull();
    expect(screen.getByText("Qué dicen las verificaciones")).toBeInTheDocument();
  });

  it("seguir la historia despacha create_commitment", () => {
    const spy = vi.fn();
    window.addEventListener("koru-card-action", spy);
    render(<NewsInterior block={newsUrgentBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /seguir esta historia/i }));
    expect(spy.mock.calls[0][0].detail.action).toBe("create_commitment");
    expect(spy.mock.calls[0][0].detail.title).toContain("batería de 2030");
    window.removeEventListener("koru-card-action", spy);
  });

  it("sin fuentes ni timeline degrada sin inventar", () => {
    render(<NewsInterior block={{ type: "news_urgent", headline: "Corte de luz", summary: "edén metropolitano afectado" }} onClose={vi.fn()} />);
    expect(screen.queryByAltText(/noticia/i)).toBeNull();
    expect(screen.queryByText(/fuentes:/i)).toBeNull();
    expect(screen.getByText("Corte de luz")).toBeInTheDocument();
  });
});
