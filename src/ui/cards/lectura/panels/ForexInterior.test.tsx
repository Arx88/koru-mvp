import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ForexInterior } from "./ForexInterior";
import { forexBlock } from "../fixtures";

// ForexInterior — bind real del block `forex`: pares/rates/changes del
// block, conversión 500×rate derivada, avisame → create_commitment.

describe("ForexInterior", () => {
  it("bindea el primer par: split from/to, rate y dirección", () => {
    render(<ForexInterior block={forexBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/USD/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/hacia EUR/i)).toBeInTheDocument();
    expect(screen.getByText(/0,92/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pares/i)).toBeInTheDocument();
  });

  it("la ventanilla lista el resto de los pares con change real", () => {
    render(<ForexInterior block={forexBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/EUR\/ARS/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.105,0/i)).toBeInTheDocument();
    expect(screen.getByText(/USD\/JPY/i)).toBeInTheDocument();
    expect(screen.getByText(/−0,2%/i)).toBeInTheDocument();
  });

  it("la conversión se deriva del rate real (500 × 0,92 = 460)", () => {
    render(<ForexInterior block={forexBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/cambiando 500 USD hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/→ 460 EUR/i)).toBeInTheDocument();
  });

  it("avisame despacha create_commitment con el par y rate del block", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<ForexInterior block={forexBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /avisame si se mueve/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toBe("Aviso USD/EUR");
    expect(events[0]?.dueHint).toContain("0,92");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("un solo par muestra variación en la ventanilla (sin tabla extra)", () => {
    render(
      <ForexInterior
        block={{ type: "forex", items: [{ pair: "USD/EUR", rate: "0,92", change: 0.1, flag: "US", positive: true }] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/AL ALZA/i)).toBeInTheDocument();
    expect(screen.getByText(/\+0,1%/i)).toBeInTheDocument();
    expect(screen.queryByText(/EUR\/ARS/i)).toBeNull();
  });

  it("sin items degrada honesto", () => {
    render(<ForexInterior block={{ type: "forex", items: [] }} onClose={vi.fn()} />);
    expect(screen.getByText(/sin pares en este block/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /avisame si se mueve/i })).toBeDisabled();
  });
});
