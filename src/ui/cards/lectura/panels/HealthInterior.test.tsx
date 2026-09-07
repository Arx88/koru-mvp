import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthInterior } from "./HealthInterior";
import { healthBlock } from "../fixtures";

// HealthInterior — bind real del block `health_reminder`: title/reminder/
// iconColor/bgColor del block, actionLabel → complete, posponer → snooze.
// Sin organizador semanal ni stock: el domain no los trae, no se inventan.

describe("HealthInterior", () => {
  it("bindea título, reminder y actionLabel del block", () => {
    render(<HealthInterior block={healthBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/vitamina d · 2000 ui/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 comprimido con la cena/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /ya tomé la de hoy/i })).toBeInTheDocument();
  });

  it("chip del medicamento usa bgColor/iconColor reales del block", () => {
    render(<HealthInterior block={healthBlock} onClose={vi.fn()} />);
    const chip = document.body.querySelector(".po-top .cic2") as HTMLElement;
    // jsdom normaliza hex → rgb: verificamos el bgColor real del block
    expect(chip.getAttribute("style")).toContain("253, 241, 221");
  });

  it("primaria despacha complete con el block; posponer despacha snooze", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; minutes?: number; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<HealthInterior block={healthBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /ya tomé la de hoy/i }));
    expect(events[0]?.action).toBe("complete");
    expect(events[0]?.blockData?.type).toBe("health_reminder");
    fireEvent.click(screen.getByRole("button", { name: /posponer 10 min/i }));
    expect(events[1]?.action).toBe("snooze");
    expect(events[1]?.minutes).toBe(10);
    expect(onClose).toHaveBeenCalledTimes(2);
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin actionLabel cae al default 'Ya lo hice'", () => {
    render(
      <HealthInterior block={{ type: "health_reminder", reminder: "Estirar 10 min" }} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /ya lo hice/i })).toBeInTheDocument();
    expect(screen.getAllByText(/estirar 10 min/i).length).toBeGreaterThan(0);
  });
});
