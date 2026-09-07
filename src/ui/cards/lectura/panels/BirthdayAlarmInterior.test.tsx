import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BirthdayAlarmInterior } from "./BirthdayAlarmInterior";
import { balarmBlock } from "../fixtures";

// BirthdayAlarmInterior — bind real del block `birthday_alarm`: countdown,
// unit, date, eta; arco derivado del countdown (ventana 30 días).

describe("BirthdayAlarmInterior", () => {
  it("bindea nombre, countdown, unit, fecha y eta del block", () => {
    render(<BirthdayAlarmInterior block={balarmBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/el cumple de juan/i).length).toBeGreaterThan(0);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("DÍAS")).toBeInTheDocument();
    expect(screen.getAllByText(/sábado 12 · 21:00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/jueves 10 a las 10:00/i)).toBeInTheDocument();
  });

  it("el arco del anillo se deriva del countdown (5/30 restante)", () => {
    render(<BirthdayAlarmInterior block={balarmBlock} onClose={vi.fn()} />);
    const ring = document.body.querySelector(".cd-ring circle:nth-of-type(2)") as SVGCircleElement;
    // progress = 1 - 5/30 ≈ 0.833 → offset ≈ 402 * 0.167 ≈ 67
    const offset = Number(ring.getAttribute("stroke-dashoffset"));
    expect(offset).toBeGreaterThan(55);
    expect(offset).toBeLessThan(85);
  });

  it("así está perfecto despacha complete con el block", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<BirthdayAlarmInterior block={balarmBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /así está perfecto/i }));
    expect(events[0]?.action).toBe("complete");
    expect(events[0]?.blockData?.type).toBe("birthday_alarm");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin countdown muestra guion y arco vacío (no inventa)", () => {
    render(<BirthdayAlarmInterior block={{ type: "birthday_alarm", name: "Sofi", date: "27" }} onClose={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    const ring = document.body.querySelector(".cd-ring circle:nth-of-type(2)") as SVGCircleElement;
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBeGreaterThan(395);
  });
});
