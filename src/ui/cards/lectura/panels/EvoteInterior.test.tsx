import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvoteInterior } from "./EvoteInterior";

// EvoteInterior — bind real del block `election_vote`: question/subtitle/
// options reales, selección del usuario, confirm → create_commitment.

const evoteBlock = {
  type: "election_vote" as const,
  question: "¿Qué lente uso para ordenar esto?",
  subtitle: "Para la comparación que me pediste: elijo una y armo el análisis desde ahí.",
  options: [
    { label: "Economía primero", sub: "empleo, inflación, impuestos" },
    { label: "Seguridad primero", sub: "crimen, justicia, defensa" },
    { label: "Ambiente primero", sub: "energía, agua, transición" },
  ],
};

describe("EvoteInterior", () => {
  it("bindea question, subtitle y las options reales", () => {
    render(<EvoteInterior block={evoteBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/¿qué lente uso para ordenar esto\?/i)).toBeInTheDocument();
    expect(screen.getByText(/para la comparación que me pediste/i)).toBeInTheDocument();
    expect(screen.getByText("Economía primero")).toBeInTheDocument();
    expect(screen.getByText("Seguridad primero")).toBeInTheDocument();
    expect(screen.getByText("Ambiente primero")).toBeInTheDocument();
    expect(screen.getByText(/empleo, inflación, impuestos/i)).toBeInTheDocument();
  });

  it("sin preselección: el primario arranca deshabilitado", () => {
    render(<EvoteInterior block={evoteBlock} onClose={vi.fn()} />);
    const primary = screen.getByRole("button", { name: /elegí una opción/i });
    expect(primary).toBeDisabled();
  });

  it("elegir una opción la marca como sel y habilita el primario", () => {
    render(<EvoteInterior block={evoteBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /seguridad primero/i }));
    const sel = document.body.querySelector(".pr-card.sel");
    expect(sel?.textContent).toContain("Seguridad primero");
    expect(screen.getByRole("button", { name: /usar: seguridad primero/i })).toBeEnabled();
  });

  it("confirmar despacha create_commitment con la opción elegida", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string; dueHint?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title, dueHint: d.dueHint });
    };
    window.addEventListener("koru-card-action", listener);
    render(<EvoteInterior block={evoteBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /ambiente primero/i }));
    fireEvent.click(screen.getByRole("button", { name: /usar: ambiente primero/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toBe("Tu lente: Ambiente primero");
    expect(events[0]?.dueHint).toMatch(/energía, agua, transición/);
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener("koru-card-action", listener);
  });

  it("más balanceado confirma la lente balanceada sin elegir", () => {
    const events: Array<{ action: string; title?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title });
    };
    window.addEventListener("koru-card-action", listener);
    render(<EvoteInterior block={evoteBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /más balanceado/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toBe("Tu lente: Balanceada");
    window.removeEventListener("koru-card-action", listener);
  });

  it("sin options degrada: pregunta + texto de fallback, sin cards", () => {
    render(
      <EvoteInterior
        block={{ type: "election_vote", question: "¿Dulce o salado?" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/¿dulce o salado\?/i)).toBeInTheDocument();
    expect(screen.getByText(/elegí una opción y arma el análisis/i)).toBeInTheDocument();
    expect(document.body.querySelector(".pr-card")).toBeNull();
    expect(screen.getByRole("button", { name: /elegí una opción/i })).toBeDisabled();
  });
});
