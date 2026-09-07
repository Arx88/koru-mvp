import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TickerInterior } from "./TickerInterior";
import { tickerBlock } from "../fixtures";

// TickerInterior — bind real del block `data_ticker`: items en la cinta,
// item highlight como stat principal, alert como nota.

describe("TickerInterior", () => {
  it("bindea título y stat principal (item con highlight)", () => {
    render(<TickerInterior block={tickerBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/cupo · dólar · oficial/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/US\$ CUPO RESTANTE/i).length).toBeGreaterThan(1); // cinta + stat
    expect(screen.getAllByText(/136/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/6 datos/i).length).toBeGreaterThan(0);
  });

  it("la cinta contiene los items reales duplicados para el loop", () => {
    render(<TickerInterior block={tickerBlock} onClose={vi.fn()} />);
    // USD/EUR aparece 2 veces (una por copia de la cinta)
    expect(screen.getAllByText(/EUR\/ARS/i).length).toBe(2);
    expect(screen.getAllByText(/OMIE POOL/i).length).toBe(2);
  });

  it("la nota es el alert real del block", () => {
    render(<TickerInterior block={tickerBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/spotify anual/i)).toBeInTheDocument();
  });

  it("avisame despacha create_commitment con dueHint del alert real", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<TickerInterior block={tickerBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /avisame si toca/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.dueHint).toContain("Spotify");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin items degrada honesto y deshabilita avisame", () => {
    render(<TickerInterior block={{ type: "data_ticker", items: [] }} onClose={vi.fn()} />);
    expect(screen.getByText(/sin datos en la cinta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /avisame si toca/i })).toBeDisabled();
  });
});
