import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteInterior } from "./NoteInterior";

// NoteInterior — bind real del block `review_document`: body verbatim en el
// post-it, resaltados y tags derivados por detección determinista.

const noteBlock = {
  type: "review_document" as const,
  title: "Anotame esto",
  body:
    "Llamar a la abuela el sábado a las 11 — antes de que llegue Maru. Pedirle la receta del pionono que ella hace con la crema de lado.",
};

describe("NoteInterior", () => {
  it("muestra el body VERBATIM en el post-it", () => {
    render(<NoteInterior block={noteBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/llamar a la abuela/i)).toBeInTheDocument();
    expect(screen.getByText(/pionono que ella hace/i)).toBeInTheDocument();
  });

  it("el título real aparece en el header y el aria-label del dialog", () => {
    render(<NoteInterior block={noteBlock} onClose={vi.fn()} />);
    expect(document.body.querySelector('[aria-label="Anotame esto"]')).toBeTruthy();
    expect(screen.getByText("Anotame esto")).toBeInTheDocument();
  });

  it("resalta día y hora detectados y arma los tags derivados", () => {
    render(<NoteInterior block={noteBlock} onClose={vi.fn()} />);
    const em = document.body.querySelectorAll(".note .txt em");
    expect(em.length).toBeGreaterThanOrEqual(2); // "sábado" + "a las 11"
    expect([...em].some((e) => /sábado/i.test(e.textContent ?? ""))).toBe(true);
    // tags por keyword: llamada (llamar) + receta (receta) + día
    expect(screen.getByText("llamada")).toBeInTheDocument();
    expect(screen.getByText("receta")).toBeInTheDocument();
    expect(screen.getAllByText(/sábado/i).length).toBeGreaterThan(0);
  });

  it("chip de fecha detectada solo cuando hay día en el body", () => {
    render(<NoteInterior block={noteBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/fecha detectada/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sábado a las 11/i).length).toBeGreaterThan(0);
  });

  it("volverla recordatorio despacha create_commitment con dueHint derivado", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title, dueHint: d.dueHint });
    };
    window.addEventListener("koru-card-action", listener);
    render(<NoteInterior block={noteBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /volverla recordatorio/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toContain("Anotame esto");
    expect(events[0]?.dueHint).toMatch(/sábado/);
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin body degrada honesto (post-it vacío, sin tags inventados)", () => {
    render(<NoteInterior block={{ type: "review_document", title: "Nota" }} onClose={vi.fn()} />);
    expect(screen.getByText(/la nota está vacía/i)).toBeInTheDocument();
    expect(document.body.querySelector(".note .tags")).toBeNull();
    expect(screen.queryByText(/fecha detectada/i)).toBeNull();
  });

  it("body sin días ni keywords: sin chips de fecha ni tags", () => {
    render(
      <NoteInterior
        block={{ type: "review_document", body: "comprar tornillos de 4 mm" }}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.querySelector(".note .tags")).toBeNull();
    expect(screen.queryByText(/fecha detectada/i)).toBeNull();
    expect(screen.getByText(/comprar tornillos/i)).toBeInTheDocument();
  });
});
