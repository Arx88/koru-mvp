import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewScoreInterior } from "./ReviewScoreInterior";
import { reviewScoreBlock } from "../fixtures";

// ReviewScoreInterior — bind real del block `review_score`: aspectos con
// score real en barras, split derivado por umbral (≥70 aman, <40 critican).

describe("ReviewScoreInterior", () => {
  it("bindea título y todos los aspectos con su score real", () => {
    render(<ReviewScoreInterior block={reviewScoreBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/iphone 16: qué dice la gente/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/📷 cámara nocturna/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/🔋 batería/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/🔥 se calienta jugando/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/91%/i).length).toBeGreaterThan(0);
  });

  it("el ancho de cada barra se deriva del score (91% → 91px%)", () => {
    render(<ReviewScoreInterior block={reviewScoreBlock} onClose={vi.fn()} />);
    const bars = [...document.body.querySelectorAll(".hbars .htrack i")];
    expect(bars[0]).toHaveAttribute("style", expect.stringContaining("91%"));
    expect(bars[2]).toHaveAttribute("style", expect.stringContaining("33%"));
  });

  it("el split se deriva por umbral: 3 aman (91/78/72), 2 critican (33/27)", () => {
    render(<ReviewScoreInterior block={reviewScoreBlock} onClose={vi.fn()} />);
    const loved = [...document.body.querySelectorAll(".rs-col")][0];
    expect(loved.querySelectorAll("li").length).toBe(3);
    const criticized = [...document.body.querySelectorAll(".rs-col")][1];
    expect(criticized.querySelectorAll("li").length).toBe(2);
  });

  it("la primera estrella del header usa el primer score real", () => {
    render(<ReviewScoreInterior block={reviewScoreBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/cámara nocturna: 91%/i)).toBeInTheDocument();
  });

  it("buttonLabel real del block en la primaria", () => {
    render(<ReviewScoreInterior block={reviewScoreBlock} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /guardar reseña/i })).toBeInTheDocument();
  });

  it("sin items degrada honesto", () => {
    render(<ReviewScoreInterior block={{ type: "review_score", items: [] }} onClose={vi.fn()} />);
    expect(screen.getByText(/todavía sin aspectos puntuados/i)).toBeInTheDocument();
  });
});
