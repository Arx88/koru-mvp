import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CryptoInterior } from "./CryptoInterior";
import { cryptoBlock } from "../fixtures";

// CryptoInterior — bind real del block `crypto_portfolio`: total,
// weekChange, sparkline→SVG, monedas con share % derivado, alerts.

describe("CryptoInterior", () => {
  it("bindea total, variación semanal y conteo de monedas", () => {
    render(<CryptoInterior block={cryptoBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/€4\.320/i).length).toBeGreaterThan(0);
    // texto compuesto por nodos (icono + signo + número): leer del DOM
    const pd = document.body.querySelector(".pf-hero .pd");
    expect(pd?.textContent ?? "").toContain("+4,5%");
    expect(screen.getAllByText(/2 monedas/i).length).toBeGreaterThan(0);
  });

  it("las monedas vienen del block con char, amount y share % derivado", () => {
    render(<CryptoInterior block={cryptoBlock} onClose={vi.fn()} />);
    const ctTexts = [...document.body.querySelectorAll(".pcoin .ct span")].map((el) => el.textContent ?? "");
    expect(ctTexts.some((t) => t.includes("0,052 BTC") && t.includes("74% del portfolio"))).toBe(true);
    expect(ctTexts.some((t) => t.includes("0,38 ETH") && t.includes("26% del portfolio"))).toBe(true);
    expect(screen.getByText("€3.182")).toBeInTheDocument();
    expect(screen.getByText("+2,4%")).toBeInTheDocument();
    expect(screen.getByText("−1,1%")).toBeInTheDocument();
  });

  it("el sparkline del block dibuja la curva del hero (path SVG real)", () => {
    const { container } = document.body;
    render(<CryptoInterior block={cryptoBlock} onClose={vi.fn()} />);
    const svg = document.body.querySelector(".pf-chart svg");
    expect(svg).toBeTruthy();
    const line = svg?.querySelector("path[fill='none']") as SVGPathElement;
    expect(line?.getAttribute("d")).toMatch(/^M8\./);
    expect((line?.getAttribute("d") ?? "").length).toBeGreaterThan(50);
    void container;
  });

  it("sin sparkline no se dibuja la curva (no se inventa)", () => {
    const { sparkline, ...rest } = cryptoBlock;
    void sparkline;
    render(<CryptoInterior block={rest} onClose={vi.fn()} />);
    expect(document.body.querySelector(".pf-chart svg")).toBeNull();
  });

  it("la nota de alertas usa los alerts reales del block", () => {
    render(<CryptoInterior block={cryptoBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/1 alerta activa/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC cruce al alza en €4\.500/i)).toBeInTheDocument();
  });

  it("guardar delega en onSave con total y título", () => {
    const onSave = vi.fn();
    render(<CryptoInterior block={cryptoBlock} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar portfolio/i }));
    expect(onSave).toHaveBeenCalledWith("Tu portfolio · cripto", "€4.320");
  });

  it("block mínimo real (1 moneda sin total) degrada sin inventar", () => {
    render(
      <CryptoInterior
        block={{
          type: "crypto_portfolio",
          items: [{ symbol: "BTC", name: "Bitcoin", price: "61400 USD", change: 2.4, color: "#f59e0b", bg: "#fffbeb", char: "₿" }],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/precios de hoy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/61400 USD/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/valor hoy/i)).toBeNull();
  });
});
