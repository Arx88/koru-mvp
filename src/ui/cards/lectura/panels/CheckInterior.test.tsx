import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckInterior } from "./CheckInterior";
import { checklistBlock } from "../fixtures";

// CheckInterior — bind real del block `smart_checklist`: progreso done/total,
// toggle despacha toggle_checklist con ids sintéticos del checklist durable.

describe("CheckInterior", () => {
  it("bindea título y conteo real de items completados", () => {
    render(<CheckInterior block={checklistBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/lo que falta antes de comprar/i).length).toBeGreaterThan(0);
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText(/2 de 4 completados/i)).toBeInTheDocument();
    expect(screen.getByText(/precio por debajo de €1\.200/i)).toBeInTheDocument();
  });

  it("anillo usa el progress del block (50%)", () => {
    render(<CheckInterior block={checklistBlock} onClose={vi.fn()} />);
    const pct = document.body.querySelector(".ck-btrack i");
    expect(pct).toHaveAttribute("style", expect.stringContaining("50%"));
  });

  it("toggle de item despacha toggle_checklist con checklistId/itemId sintéticos", () => {
    const events: Array<{ action: string; checklistId?: string; itemId?: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<CheckInterior block={checklistBlock} onClose={vi.fn()} />);
    const first = screen.getByText(/RAM 32 GB verificada/i).closest("button");
    expect(first).toBeTruthy();
    fireEvent.click(first as HTMLElement);
    expect(events[0]?.action).toBe("toggle_checklist");
    expect(events[0]?.checklistId).toBe("checklist_lo_que_falta_antes_de_comprar");
    expect(events[0]?.itemId).toBe("citem_ram_32_gb_verificada_0");
    expect(events[0]?.blockData?.type).toBe("smart_checklist");
    window.removeEventListener("koru-card-action", listener);
  });

  it("el toggle optimista marca/desmarca el item (aria-pressed)", () => {
    render(<CheckInterior block={checklistBlock} onClose={vi.fn()} />);
    const item = screen.getByText(/teclado español físico/i).closest("button") as HTMLElement;
    expect(item).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(item);
    expect(item).toHaveAttribute("aria-pressed", "true");
    // el conteo del anillo sube a 3/4 en el estado local
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
  });

  it("lista vacía degrada honesta sin inventar items", () => {
    render(<CheckInterior block={{ type: "smart_checklist", title: "Vacaciones" }} onClose={vi.fn()} />);
    expect(screen.getByText(/todavía no hay items/i)).toBeInTheDocument();
    expect(screen.getByText(/lista vacía/i)).toBeInTheDocument();
    expect(screen.queryByText(/\/ 4/i)).toBeNull();
  });
});
