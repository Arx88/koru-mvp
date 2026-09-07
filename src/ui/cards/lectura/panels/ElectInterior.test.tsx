import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElectInterior } from "./ElectInterior";

// ElectInterior — bind real del block `election_results`: status (anillo),
// items (barra + leyenda + bancas derivadas), aviso al 100%.

const electBlock = {
  type: "election_results" as const,
  title: "Así está la cuenta",
  status: "89% contado · mesas 34.312 de 38.540",
  items: [
    { name: "Partido A", percent: "34%", detail: "mejoró 2 pts en el sur", done: false, color: "#6d4bf0" },
    { name: "Partido B", percent: "29%", detail: "fuerte en la costa", done: false, color: "#5170d8" },
    { name: "Partido C", percent: "18%", done: false, color: "#b45309" },
    { name: "Partido D", percent: "12%", done: false, color: "#d6497f" },
  ],
};

describe("ElectInterior", () => {
  it("bindea título, status y el % del anillo (89% del status real)", () => {
    render(<ElectInterior block={electBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Así está la cuenta")).toBeInTheDocument();
    expect(screen.getAllByText(/89% contado/i).length).toBeGreaterThan(0);
    expect(screen.getByText("89%")).toBeInTheDocument();
    // el anillo usa strokeDashoffset derivado del 89%
    const ring = document.body.querySelector(".el-progress circle[stroke='#6d4bf0']");
    expect(ring?.getAttribute("stroke-dashoffset")).toBe(String(144.5 * (1 - 0.89)));
  });

  it("los items reales arman la barra con sus colores y percents", () => {
    render(<ElectInterior block={electBlock} onClose={vi.fn()} />);
    const bars = document.body.querySelectorAll(".el-bar i");
    expect(bars.length).toBe(4);
    expect(bars[0]).toHaveClass("lead");
    expect(bars[0]?.getAttribute("style")).toContain("width: 34%");
    expect(bars[0]?.getAttribute("style")).toContain("rgb(109, 75, 240)");
  });

  it("la leyenda muestra nombre, detalle real y percent; el líder va win", () => {
    render(<ElectInterior block={electBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Partido A")).toBeInTheDocument();
    expect(screen.getByText(/mejoró 2 pts en el sur/i)).toBeInTheDocument();
    expect(screen.getByText("Partido B")).toBeInTheDocument();
    expect(document.body.querySelectorAll(".el-legend small").length).toBe(6); // 2 detalles + 4 provisorio
    expect(document.body.querySelector(".el-row.win")?.textContent).toContain("Partido A");
  });

  it("las bancas se derivan del percent (34% → 6 cap; 12% → 2)", () => {
    render(<ElectInterior block={electBlock} onClose={vi.fn()} />);
    const rows = document.body.querySelectorAll(".el-row");
    expect(rows[0]?.querySelectorAll(".seats i").length).toBe(6);
    expect(rows[3]?.querySelectorAll(".seats i").length).toBe(2);
  });

  it("avísame al 100% despacha create_commitment", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title });
    };
    window.addEventListener("koru-card-action", listener);
    render(<ElectInterior block={electBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /avísame al 100%/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toMatch(/escrutinio al 100%/i);
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin status ni items degrada sin inventar", () => {
    render(<ElectInterior block={{ type: "election_results" }} onClose={vi.fn()} />);
    expect(document.body.querySelector(".el-progress")).toBeNull();
    expect(document.body.querySelector(".el-bar")).toBeNull();
    expect(screen.getByText(/con los datos oficiales que hay/i)).toBeInTheDocument();
    expect(screen.getByText(/resultado electoral/i)).toBeInTheDocument();
  });
});
