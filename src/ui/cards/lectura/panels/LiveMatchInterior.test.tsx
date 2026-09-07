import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveMatchInterior } from "./LiveMatchInterior";
import { liveMatchBlock } from "../fixtures";

// LiveMatchInterior — bind real del block `live_match`: equipos/escudos,
// marcador, EN VIVO solo si está en juego, goles desde block.goals (con
// foto del tool), posesión desde homePossession, acción create_commitment.

describe("LiveMatchInterior", () => {
  it("bindea liga, equipos, marcador y escudos reales", () => {
    render(<LiveMatchInterior block={liveMatchBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/laliga · jornada 5/i)).toBeInTheDocument();
    expect(screen.getByText("Real Madrid")).toBeInTheDocument();
    expect(screen.getByText("Barcelona")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByAltText("Real Madrid")).toHaveAttribute("src", "/stitch/sports/real-madrid.png");
  });

  it("muestra EN VIVO con minute y barra de progreso", () => {
    render(<LiveMatchInterior block={liveMatchBlock} onClose={vi.fn()} />);
    expect(screen.getByText("EN VIVO")).toBeInTheDocument();
    expect(screen.getByText("78'")).toBeInTheDocument();
  });

  it("feed de goles desde block.goles (scorer + texto + foto)", () => {
    render(<LiveMatchInterior block={liveMatchBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Bellingham")).toBeInTheDocument();
    expect(screen.getByText(/cabezazo tras córner/i)).toBeInTheDocument();
    expect(screen.getByText("Mbappé")).toBeInTheDocument();
    expect(screen.getByAltText("Lamine Yamal")).toHaveAttribute("src", "/stitch/sports/players/yamal.jpg");
  });

  it("posesión y remates desde el block", () => {
    render(<LiveMatchInterior block={liveMatchBlock} onClose={vi.fn()} />);
    expect(screen.getByText("58%")).toBeInTheDocument();
    expect(screen.getByText(/remates 12 – 7/i)).toBeInTheDocument();
  });

  it("acción gol despacha create_commitment con los equipos", () => {
    const spy = vi.fn();
    window.addEventListener("koru-card-action", spy);
    render(<LiveMatchInterior block={liveMatchBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /avisame si hay gol/i }));
    expect(spy.mock.calls[0][0].detail.action).toBe("create_commitment");
    expect(spy.mock.calls[0][0].detail.title).toContain("Real Madrid vs Barcelona");
    window.removeEventListener("koru-card-action", spy);
  });

  it("partido finalizado NO muestra EN VIVO; sin datos de goles omite el feed", () => {
    render(
      <LiveMatchInterior
        block={{ type: "live_match", status: "final", homeName: "Racing", awayName: "Colón", homeScore: 1, awayScore: 0 }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText("EN VIVO")).toBeNull();
    expect(screen.getAllByText("final").length).toBeGreaterThan(0);
    expect(screen.queryByText(/cómo llegaron los goles/i)).toBeNull();
  });
});
