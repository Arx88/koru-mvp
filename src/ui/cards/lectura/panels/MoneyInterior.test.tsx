import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInterior } from "./MoneyInterior";
import { moneyBlock } from "../fixtures";

// MoneyInterior — bind real del block `money_summary`: total/currency,
// summaryItems con % derivado, recommendation como nota.

describe("MoneyInterior", () => {
  it("bindea título, total formateado y currency del block", () => {
    render(<MoneyInterior block={moneyBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/agosto · tus gastos/i).length).toBeGreaterThan(0);
    // jsdom corre sin ICU completa: "1.850 €" o "1850 €" según el runtime
    const tv = document.body.querySelector(".mo-total .tv");
    expect(tv?.textContent ?? "").toMatch(/1\.850 €|1850 €/);
    expect(screen.getAllByText(/5 rubros/i).length).toBeGreaterThan(0);
  });

  it("los rubros vienen del block con su value real", () => {
    render(<MoneyInterior block={moneyBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/casa y servicios/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/comida/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/€444/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/6 deliverys menos que julio/i)).toBeInTheDocument();
  });

  it("la nota es el recommendation real del block", () => {
    render(<MoneyInterior block={moneyBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/la baja viene de la comida/i)).toBeInTheDocument();
  });

  it("fijar tope despacha create_commitment con el total del block", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<MoneyInterior block={moneyBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /fijar un tope/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toBe("Tope Agosto · tus gastos");
    expect(events[0]?.dueHint).toMatch(/1\.850|1850/);
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("guardar delega en onSave con totalLabel", () => {
    const onSave = vi.fn();
    render(<MoneyInterior block={moneyBlock} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar resumen/i }));
    expect(onSave).toHaveBeenCalledWith("Agosto · tus gastos", expect.stringMatching(/1\.850 €|1850 €/));
  });

  it("sin items degrada sin inventar categorías", () => {
    render(<MoneyInterior block={{ type: "money_summary", title: "Resumen" }} onClose={vi.fn()} />);
    expect(screen.getByText(/todavía no hay desglose/i)).toBeInTheDocument();
  });
});
