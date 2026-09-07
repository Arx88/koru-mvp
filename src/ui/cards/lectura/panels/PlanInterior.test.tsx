import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanInterior } from "./PlanInterior";
import { planBlock } from "../fixtures";

// PlanInterior — bind real del block `plan`: timeline desde items,
// AHORA según hora (inyectable para tests), toggle de pasos vía
// koru-card-action toggle_step (convention step_${slug}_${i}),
// hueco más grande derivado de horas consecutivas.

const NOW = new Date("2026-09-07T09:41:00");

function renderCard() {
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(<PlanInterior block={planBlock} onClose={onClose} onSave={onSave} now={NOW} />);
  return { onClose, onSave };
}

describe("PlanInterior", () => {
  it("bindea título, nota y todos los eventos del plan", () => {
    renderCard();
    expect(screen.getByText("Desayuno tranquilo")).toBeInTheDocument();
    expect(screen.getByText("Trabajo profundo")).toBeInTheDocument();
    expect(screen.getByText("Almuerzo con Sofi")).toBeInTheDocument();
    expect(screen.getByText("Gym · piernas")).toBeInTheDocument();
    expect(screen.getByText("Cine con Juan")).toBeInTheDocument();
    expect(screen.getByText(/hueco grande no lo llené a propósito/i)).toBeInTheDocument();
  });

  it("marca AHORA en la posición real según la hora y SIGUE al próximo", () => {
    renderCard();
    expect(screen.getByText("AHORA")).toBeInTheDocument();
    expect(screen.getByText("09:41")).toBeInTheDocument();
    expect(screen.getByText("SIGUE")).toBeInTheDocument();
  });

  it("detecta el hueco real entre eventos (13:30 → 18:30)", () => {
    renderCard();
    expect(screen.getByText("El hueco de 13:30 a 18:30 es tuyo")).toBeInTheDocument();
    expect(screen.getByText(/5 h libres/i)).toBeInTheDocument();
  });

  it("toggle de un evento: visual done + evento real toggle_step con ids sintéticos", () => {
    const spy = vi.fn();
    window.addEventListener("koru-card-action", spy);
    renderCard();
    const gym = screen.getByRole("button", { name: /marcar gym · piernas/i });
    fireEvent.click(gym);
    expect(spy).toHaveBeenCalledTimes(1);
    const detail = spy.mock.calls[0][0].detail;
    expect(detail.action).toBe("toggle_step");
    expect(detail.blockType).toBe("plan");
    expect(detail.planId).toBe("plan_tu_dia");
    expect(detail.stepId).toBe("step_gym_piernas_3");
    // feedback visual optimista
    expect(gym.getAttribute("aria-pressed")).toBe("true");
    window.removeEventListener("koru-card-action", spy);
  });

  it("acción principal guarda (onSave) y volver cierra", () => {
    const { onClose, onSave } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /se ve bien/i }));
    expect(onSave).toHaveBeenCalledWith("Tu día", "5 momentos");
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("degrada con plan vacío sin romper", () => {
    render(<PlanInterior block={{ type: "plan", title: "Tu día", items: [] }} onClose={vi.fn()} now={NOW} />);
    expect(screen.getAllByText("Tu día").length).toBeGreaterThan(0);
    expect(screen.queryByText("AHORA")).toBeNull();
  });
});
