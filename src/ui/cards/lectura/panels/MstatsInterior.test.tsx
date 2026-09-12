import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MstatsInterior } from "./MstatsInterior";

// MstatsInterior — bind real del block `match_stats`: stats reales, escudos
// por lookup con fallback a iniciales, posesión al track, veredicto derivado.

const mstatsBlock = {
  type: "match_stats" as const,
  title: "El clásico, en números",
  homeName: "Real Madrid",
  awayName: "Barcelona",
  homeColor: "#4ec99c",
  awayColor: "#9dbcf3",
  stats: [
    { label: "Posesión", home: "58", away: "42", width: "58%" },
    { label: "Remates al arco", home: "8", away: "5", width: "80%" },
    { label: "Córners", home: "7", away: "4", width: "56%" },
    { label: "Faltas", home: "9", away: "11", width: "36%" },
  ],
};

describe("MstatsInterior", () => {
  it("bindea home/away reales con escudos locales por nombre", () => {
    render(<MstatsInterior block={mstatsBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/real madrid/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/barcelona/i).length).toBeGreaterThan(0);
    const imgs = document.body.querySelectorAll(".du-teams img");
    expect(imgs[0]?.getAttribute("src")).toBe("/stitch/sports/real-madrid.png");
    expect(imgs[1]?.getAttribute("src")).toBe("/stitch/sports/barcelona.png");
  });

  it("la posesión real va al track con los colores del block", () => {
    render(<MstatsInterior block={mstatsBlock} onClose={vi.fn()} />);
    const track = document.body.querySelector(".du-pos .track");
    const l = track?.querySelector(".l");
    const r = track?.querySelector(".r");
    expect(l?.textContent).toBe("58");
    expect(r?.textContent).toBe("42");
    expect(l?.getAttribute("style")).toContain("58%");
    expect(l?.getAttribute("style")).toContain("rgb(78, 201, 156)");
    expect(r?.getAttribute("style")).toContain("42%");
  });

  it("los stats no-posesión van como barras gemelas con valores reales", () => {
    render(<MstatsInterior block={mstatsBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/remates al arco/i)).toBeInTheDocument();
    expect(screen.getByText(/córners/i)).toBeInTheDocument();
    expect(screen.getByText(/faltas/i)).toBeInTheDocument();
    const rows = document.body.querySelectorAll(".du-bars .db");
    expect(rows.length).toBe(3); // posesión va al track, no a du-bars
    expect(rows[0]?.textContent).toContain("8");
    expect(rows[0]?.textContent).toContain("5");
    expect(parseFloat(rows[0]?.querySelector("i")?.style.width || "0")).toBeCloseTo(8 / 13 * 100);

  });

  it("el veredicto se deriva de la posesión real (Real Madrid manda)", () => {
    render(<MstatsInterior block={mstatsBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/real madrid tuvo más posesión/i)).toBeInTheDocument();
    expect(screen.getByText(/posesión 58\/42/i)).toBeInTheDocument();
  });

  it("equipo sin escudo local degrada a iniciales (sin inventar)", () => {
    render(
      <MstatsInterior
        block={{
          type: "match_stats",
          homeName: "Getafe",
          awayName: "Alavés",
          stats: [{ label: "Posesión", home: "55", away: "45", width: "55%" }],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.querySelectorAll(".du-teams img").length).toBe(0);
    const badges = document.body.querySelectorAll(".du-tm .crestito");
    expect(badges[0]?.textContent).toBe("G");
    expect(badges[1]?.textContent).toBe("A");
  });

  it("sin stats degrada a header + equipos sin barras", () => {
    render(
      <MstatsInterior
        block={{ type: "match_stats", homeName: "Sevilla", awayName: "Betis" }}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.querySelector(".du-pos")).toBeNull();
    expect(document.body.querySelectorAll(".du-bars .db").length).toBe(0);
    expect(screen.getByText(/todavía no hay estadísticas disponibles/i)).toBeInTheDocument();
  });
});
