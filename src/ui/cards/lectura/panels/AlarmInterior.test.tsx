import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlarmInterior } from "./AlarmInterior";
import { alarmBlock } from "../fixtures";

// AlarmInterior — bind real del block `alarm`: reloj derivado de block.time,
// días desde block.repeat, nota solo si block.note, acciones complete/snooze.

describe("AlarmInterior", () => {
  it("bindea título, hora derivada y repetición", () => {
    render(<AlarmInterior block={alarmBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/gym de la mañana/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/suena a las 7:00/i)).toBeInTheDocument();
    expect(screen.getByText(/repite: lunes a viernes/i)).toBeInTheDocument();
  });

  it("reloj con aria-label de la hora y am/pm derivados", () => {
    render(<AlarmInterior block={alarmBlock} onClose={vi.fn()} />);
    expect(screen.getByRole("img", { name: /reloj marcando las 7:00/i })).toBeInTheDocument();
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("lunes a viernes enciende exactamente 5 días (L M X J V)", () => {
    render(<AlarmInterior block={alarmBlock} onClose={vi.fn()} />);
    const on = document.body.querySelectorAll(".cl-days span.on");
    expect(on.length).toBe(5);
    expect([...on].map((el) => el.textContent)).toEqual(["L", "M", "X", "J", "V"]);
  });

  it("nota de Koru solo cuando block.note existe", () => {
    const { rerender } = render(<AlarmInterior block={alarmBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/te agendé el gym 30 min/i)).toBeInTheDocument();
    rerender(<AlarmInterior block={{ type: "alarm", title: "Pilates", time: "18:30" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/la nota de koru/i)).toBeNull();
  });

  it("perfecto despacha complete y cierra; dormir despacha snooze con 10 min", async () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; minutes?: number; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<AlarmInterior block={alarmBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /perfecto, ya sonó/i }));
    await waitFor(() => expect(events[0]?.action).toBe("complete"));
    expect(events[0]?.blockData?.type).toBe("alarm");
    fireEvent.click(screen.getByRole("button", { name: /dormir 10 min más/i }));
    await waitFor(() => expect(events[1]?.action).toBe("snooze"));
    expect(events[1]?.minutes).toBe(10);
    expect(onClose).toHaveBeenCalledTimes(2);
    window.removeEventListener("koru-card-action", listener);
  });

  it("hora pm se parsea a 12h correcto (18:30 → 6:30 PM)", () => {
    render(<AlarmInterior block={{ type: "alarm", title: "Pilates", time: "18:30" }} onClose={vi.fn()} />);
    expect(screen.getByText(/suena a las 6:30/i)).toBeInTheDocument();
    expect(screen.getByText("PM")).toBeInTheDocument();
  });
});
