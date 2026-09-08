import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SocialInterior } from "./SocialInterior";
import { socialBlock } from "../fixtures";

// SocialInterior — bind real del block `social_interaction`: name/event/
// date/age/remaining/gifts reales, día del evento derivado de date.

describe("SocialInterior", () => {
  it("bindea name, event, date, age y remaining del block", () => {
    render(<SocialInterior block={socialBlock} onClose={vi.fn()} />);
    // h1 con <br/> parte el texto → verificar via aria-label del dialog
    expect(document.body.querySelector('[aria-label="El cumple de Juan"]')).toBeTruthy();
    expect(screen.getAllByText(/sábado 12 · 21:00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/faltan 4 días/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/34/i).length).toBeGreaterThan(0);
  });

  it("el día 12 del calendario se deriva de block.date", () => {
    render(<SocialInterior block={socialBlock} onClose={vi.fn()} />);
    const big = document.body.querySelector(".cal-grid .dd.big");
    expect(big?.textContent).toBe("12");
  });

  it("los gifts reales van como opciones (primera = ELEGIDO)", () => {
    render(<SocialInterior block={socialBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/vinilo de wos, edición numerada/i)).toBeInTheDocument();
    expect(screen.getByText(/excursión de kayak/i)).toBeInTheDocument();
    expect(screen.getByText("ELEGIDO")).toBeInTheDocument();
    expect(screen.getByText(/2 ideas de regalo/i)).toBeInTheDocument();
  });

  it("confirmo despacha complete con el block del evento", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<SocialInterior block={socialBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /confirmo que voy/i }));
    expect(events[0]?.action).toBe("complete");
    expect(events[0]?.blockData?.type).toBe("social_interaction");
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin gifts ni date degrada sin inventar", () => {
    render(<SocialInterior block={{ type: "social_interaction", name: "Maru", event: "cena" }} onClose={vi.fn()} />);
    expect(screen.getByText(/fecha por confirmar/i)).toBeInTheDocument();
    expect(screen.queryByText(/elegido/i)).toBeNull();
    expect(screen.getByText(/guardé el evento/i)).toBeInTheDocument();
  });
});
