import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketInterior } from "./MarketInterior";
import { marketBlock } from "../fixtures";

// MarketInterior — bind real del block `market`: assets del block, live
// price sobre el base (useLivePrice de la app), change chip changeUp,
// alerta → create_commitment durable.

describe("MarketInterior", () => {
  it("bindea el primer asset como hero (symbol, name, price, change)", () => {
    render(<MarketInterior block={marketBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/AAPL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Apple Inc/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nasdaq/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+1,8% hoy/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 activos/i)).toBeInTheDocument();
  });

  it("el precio latiente parte del price real del block", () => {
    vi.useFakeTimers();
    try {
      render(<MarketInterior block={marketBlock} onClose={vi.fn()} />);
      expect(screen.getByText("231,40")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("el tablero lista el resto de los assets con su dirección real", () => {
    render(<MarketInterior block={marketBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/Microsoft · MSFT/i)).toBeInTheDocument();
    expect(screen.getByText(/NVIDIA · NVDA/i)).toBeInTheDocument();
    expect(screen.getByText(/428,90 · \+0,6% hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/118,60 · −1,2% hoy/i)).toBeInTheDocument();
  });

  it("alerta de precio despacha create_commitment con symbol y price reales", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<MarketInterior block={marketBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /alerta de precio/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toBe("Alerta AAPL");
    expect(events[0]?.dueHint).toMatch(/precio cruza/);
    expect(events[0]?.blockData?.type).toBe("market");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin assets degrada honesto y deshabilita la alerta", () => {
    render(<MarketInterior block={{ type: "market", title: "X", assets: [] }} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /alerta de precio/i })).toBeDisabled();
    expect(screen.getByText(/sin pares|tu consulta/i)).toBeTruthy();
  });
});
