import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BirthdayCalendarInterior } from "./BirthdayCalendarInterior";
import { bcalBlock } from "../fixtures";

// BirthdayCalendarInterior — bind real del block `birthday_calendar`:
// grilla derivada (daysInMonth/startDay), día marcado, aviso → commitment.

describe("BirthdayCalendarInterior", () => {
  it("construye la grilla real: 30 días, empieza lunes, 12 marcado", () => {
    render(<BirthdayCalendarInterior block={bcalBlock} onClose={vi.fn()} />);
    const days = document.body.querySelectorAll(".cal2-grid .day");
    expect(days.length).toBe(30);
    expect(days[0].textContent).toBe("1"); // lunes 1
    const bday = document.body.querySelector(".cal2-grid .day.bday");
    expect(bday?.textContent).toContain("12");
    expect(screen.getAllByText(/septiembre/i).length).toBeGreaterThan(0);
  });

  it("la leyenda muestra el día marcado del block", () => {
    render(<BirthdayCalendarInterior block={bcalBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/el 12 de septiembre/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 cumple/i)).toBeInTheDocument();
  });

  it("activar aviso despacha create_commitment con el día y mes reales", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<BirthdayCalendarInterior block={bcalBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /activar el aviso/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.dueHint).toContain("12 de septiembre");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin día marcado degrada y deshabilita el aviso", () => {
    render(<BirthdayCalendarInterior block={{ type: "birthday_calendar", month: "Marzo", daysInMonth: 31, startDay: 6 }} onClose={vi.fn()} />);
    expect(screen.getByText(/mes sin fechas marcadas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activar el aviso/i })).toBeDisabled();
  });
});
