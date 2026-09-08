import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BriefInterior } from "./BriefInterior";
import { briefBlock } from "../fixtures";

// BriefInterior — bind real del block `morning_brief`: greeting en header,
// items reales con tint de iconColor, variant highlight → urgent, TTS
// mediante koruVoice (no-op en jsdom), complete al marcar leído.

describe("BriefInterior", () => {
  it("bindea greeting y todos los items del block", () => {
    render(<BriefInterior block={briefBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/mientras dormías/i)).toBeInTheDocument();
    expect(screen.getAllByText(/buen martes/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/el clásico anoche/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1,8%/i)).toBeInTheDocument();
    expect(screen.getByText(/tu viaje a madrid/i)).toBeInTheDocument();
    expect(screen.getByText(/5 items de tu día/i)).toBeInTheDocument();
  });

  it("item variant=highlight se renderiza urgent", () => {
    render(<BriefInterior block={briefBlock} onClose={vi.fn()} />);
    expect(document.body.querySelectorAll(".bf-item.urgent").length).toBe(1);
  });

  it("los items de clima alimentan el hero (chip con valor real)", () => {
    render(<BriefInterior block={briefBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/16–29°/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/amanece despejado/i).length).toBeGreaterThanOrEqual(1);
  });

  it("botón escuchar está disponible y no rompe sin speechSynthesis (jsdom)", () => {
    render(<BriefInterior block={briefBlock} onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /escucharlo/i });
    expect(btn).toBeEnabled();
    expect(() => fireEvent.click(btn)).not.toThrow();
  });

  it("brief leído despacha complete con el block y cierra", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<BriefInterior block={briefBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /brief leído/i }));
    expect(events[0]?.action).toBe("complete");
    expect(events[0]?.blockData?.type).toBe("morning_brief");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin items ni greeting degrada sin inventar contenido", () => {
    render(<BriefInterior block={{ type: "morning_brief", items: [] }} onClose={vi.fn()} />);
    expect(screen.getByText(/todavía no hay nada para contarte/i)).toBeInTheDocument();
    expect(screen.queryByText(/buen martes/i)).toBeNull();
  });
});
