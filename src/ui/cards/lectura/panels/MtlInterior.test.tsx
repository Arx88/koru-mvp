import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MtlInterior } from "./MtlInterior";

// MtlInterior — bind real del block `match_timeline`: nextMatch con escudos
// por lookup, meta desde teamInfo, extracto real a la nota, items en vivo.

const iso = "2026-09-11"; // fija: el test del countdown usa su propia fecha

const mtlBlock = {
  type: "match_timeline" as const,
  title: "Juega Boca, y conviene verlo",
  teamInfo: {
    name: "Boca Juniors",
    stadium: "La Bombonera",
    location: "Buenos Aires",
    league: "Liga Profesional",
    description:
      "Boca llega con tres victorias seguidas en casa y el clásico de la fecha 6 define la punta del torneo.",
  },
  nextMatch: {
    homeTeam: "Boca Juniors",
    awayTeam: "River Plate",
    date: iso,
    time: "21:30",
    league: "Liga Profesional",
  },
};

describe("MtlInterior", () => {
  it("bindea los equipos reales con escudos locales y la hora del block", () => {
    render(<MtlInterior block={mtlBlock} onClose={vi.fn()} />);
    const imgs = document.body.querySelectorAll(".fx2-teams img");
    expect(imgs[0]?.getAttribute("src")).toBe("/stitch/sports/boca-juniors.png");
    expect(imgs[1]?.getAttribute("src")).toBe("/stitch/sports/river-plate.png");
    expect(screen.getByText("21:30")).toBeInTheDocument();
    expect(screen.getByText("VS")).toBeInTheDocument();
  });

  it("el countdown se deriva de la fecha ISO (3 días)", () => {
    // 🔴 Fake system time → determinista: now = 5 sep 2026 12:00, partido
    // 8 sep 21:30 → diff 3.39 días → "en 3 días". Antes el test dependía
    // de la hora real de ejecución (2/3/4 según el momento del día).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 12, 0, 0));
    try {
      render(
        <MtlInterior
          block={{ ...mtlBlock, nextMatch: { ...mtlBlock.nextMatch, date: "2026-09-08" } }}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText(/en 3 días/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("la meta usa estadio y sede REALES del teamInfo", () => {
    render(<MtlInterior block={mtlBlock} onClose={vi.fn()} />);
    expect(screen.getByText("La Bombonera")).toBeInTheDocument();
    expect(screen.getByText("Buenos Aires")).toBeInTheDocument();
    expect(screen.getAllByText(/estadio/i).length).toBeGreaterThanOrEqual(2);
  });

  it("el extracto real del teamInfo va a la nota", () => {
    render(<MtlInterior block={mtlBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/tres victorias seguidas en casa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", {name:/recordarme antes/i})).toBeInTheDocument();
  });

  it("recordarme despacha create_commitment con fecha real", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title, dueHint: d.dueHint });
    };
    window.addEventListener("koru-card-action", listener);
    render(<MtlInterior block={mtlBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /recordarme antes/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toContain("Juega Boca");
    expect(events[0]?.dueHint).toContain(iso);
    // v2: el toggle de follow mantiene la card abierta (no cierra)
    window.removeEventListener("koru-card-action", listener);
  });

  it("items en vivo se listan al final; sin nextMatch degrada a teamInfo", () => {
    const { rerender } = render(<MtlInterior block={mtlBlock} onClose={vi.fn()} />);
    rerender(
      <MtlInterior
        block={{
          type: "match_timeline",
          items: [
            { minute: "45+2", text: "Gol de Boca", sub: "cabeza", now: true },
            { minute: "61", text: "Roja para el visitante" },
          ],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Gol de Boca")).toBeInTheDocument();
    expect(screen.getByText("Roja para el visitante")).toBeInTheDocument();
    expect(screen.getByText("cabeza")).toBeInTheDocument();
    // 🔴 v2: con items presentes y sin nextMatch, el subtítulo describe los
    // partidos de la ventana (antes: "cuando haya fecha confirmada").
    expect(screen.getByText(/partidos de la ventana de espn/i)).toBeInTheDocument();
    expect(document.body.querySelector(".fx2-teams")).toBeNull();
  });
});
