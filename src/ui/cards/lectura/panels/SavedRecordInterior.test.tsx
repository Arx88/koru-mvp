import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SavedRecordInterior } from "./SavedRecordInterior";
import { SavedInterior } from "./SavedInterior";
import { VaultInterior } from "./VaultInterior";

// Router saved_record: 1 record → comprobante (#p-saved), N → bóveda (#p-vault).
// Ambos interiores bindean los campos reales del LifeRecord.

const singleBlock = {
  type: "saved_record" as const,
  title: "Cena en Don Julio",
  records: [
    {
      domain: "interest" as const,
      kind: "deadline" as const,
      title: "Reservado para 2",
      value: "Patio · junto a la parra",
      person: "Vos",
      collection: "Reservas",
      dueHint: "sábado 7 · 21:15",
      url: "https://donjulio.com/reserva",
    },
  ],
};

const vaultBlock = {
  type: "saved_record" as const,
  title: "Todo lo que sé",
  records: [
    { domain: "interest" as const, kind: "idea" as const, title: "Ruta de Mallorca", value: "calas + moto en Sóller · €900" },
    { domain: "relationship" as const, kind: "gift" as const, title: "Regalo de Maru", value: "vinilo de Wos" },
    { domain: "home" as const, kind: "tool_link" as const, title: "Técnico de wifi", value: "11-3422" },
    { domain: "relationship" as const, kind: "birthday" as const, title: "Cumple de Maru", value: "12 de septiembre" },
  ],
};

describe("SavedRecordInterior (router)", () => {
  it("con 1 record renderiza el comprobante (#p-saved)", () => {
    const { unmount } = render(<SavedRecordInterior block={singleBlock} onClose={vi.fn()} />);
    expect(document.body.querySelector("#p-saved")).toBeTruthy();
    expect(document.body.querySelector("#p-vault")).toBeNull();
    unmount();
  });

  it("con N records renderiza la bóveda (#p-vault)", () => {
    const { unmount } = render(<SavedRecordInterior block={vaultBlock} onClose={vi.fn()} />);
    expect(document.body.querySelector("#p-vault")).toBeTruthy();
    expect(document.body.querySelector("#p-saved")).toBeNull();
    unmount();
  });

  it("sin records también cae al comprobante (título del block)", () => {
    const { unmount } = render(
      <SavedRecordInterior block={{ type: "saved_record", title: "Guardado" }} onClose={vi.fn()} />,
    );
    expect(document.body.querySelector("#p-saved")).toBeTruthy();
    unmount();
  });
});

describe("SavedInterior (comprobante)", () => {
  it("bindea título, colección y los campos reales del record", () => {
    render(<SavedInterior block={singleBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Reservado para 2")).toBeInTheDocument();
    expect(screen.getByText(/guardado en reservas/i)).toBeInTheDocument();
    expect(screen.getByText("Patio · junto a la parra")).toBeInTheDocument();
    expect(screen.getAllByText("sábado 7 · 21:15").length).toBe(2); // row + nota
    expect(screen.getByText("donjulio.com")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMADO")).toBeInTheDocument();
  });

  it("solo muestra rows de campos presentes (sin inventar)", () => {
    render(
      <SavedInterior
        block={{
          type: "saved_record",
          records: [{ domain: "home", kind: "idea", title: "Idea suelta" }],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/coleccion/i)).toBeNull();
    expect(screen.queryByText(/persona/i)).toBeNull();
    expect(screen.queryByText(/cuándo/i)).toBeNull();
    expect(screen.getByText("Idea suelta")).toBeInTheDocument();
  });

  it("la nota de aviso SOLO con dueHint real", () => {
    const { rerender } = render(<SavedInterior block={singleBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/te lo recuerdo para/i)).toBeInTheDocument();
    rerender(
      <SavedInterior
        block={{
          type: "saved_record",
          records: [{ domain: "home", kind: "idea", title: "Idea suelta" }],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/te lo recuerdo para/i)).toBeNull();
  });

  it("perfecto despacha complete con el block", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; blockType: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, blockType: d.blockType });
    };
    window.addEventListener("koru-card-action", listener);
    render(<SavedInterior block={singleBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /perfecto, gracias/i }));
    expect(events[0]).toEqual({ action: "complete", blockType: "saved_record" });
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener("koru-card-action", listener);
  });

  it("el código del comprobante es determinista (mismo input → mismo código)", () => {
    const { rerender } = render(<SavedInterior block={singleBlock} onClose={vi.fn()} />);
    const first = document.body.querySelector(".tkk-code .cn")?.textContent;
    rerender(<SavedInterior block={singleBlock} onClose={vi.fn()} />);
    const second = document.body.querySelector(".tkk-code .cn")?.textContent;
    expect(first).toBeTruthy();
    expect(first).toBe(second);
    expect(document.body.querySelectorAll(".tkk-code .bars i").length).toBeGreaterThan(6);
  });
});

describe("VaultInterior (bóveda)", () => {
  it("bindea el conteo real y los dominios distintos", () => {
    render(<VaultInterior block={vaultBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/4 recuerdos/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 dominios/i)).toBeInTheDocument();
    expect(document.body.querySelector(".vt-stat b")?.textContent).toBe("4"); // stat guardados
  });

  it("los records reales van a la grilla con su kind como categoría", () => {
    render(<VaultInterior block={vaultBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/ruta de mallorca/i)).toBeInTheDocument();
    expect(screen.getByText(/regalo de maru/i)).toBeInTheDocument();
    expect(screen.getByText("idea")).toBeInTheDocument();
    expect(screen.getByText("gift")).toBeInTheDocument();
    expect(screen.getByText("birthday")).toBeInTheDocument();
  });

  it("la búsqueda REAL filtra la grilla por título", () => {
    render(<VaultInterior block={vaultBlock} onClose={vi.fn()} />);
    const input = document.body.querySelector<HTMLInputElement>('#p-vault .vt-search input');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, { target: { value: "mallorca" } });
    expect(screen.getByText(/ruta de mallorca/i)).toBeInTheDocument();
    expect(screen.queryByText(/técnico de wifi/i)).toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { value: "zzz" } });
    expect(screen.getByText(/nada con “zzz”/i)).toBeInTheDocument();
  });

  it("sin attachments no inventa fotos (variante no-ph con icono)", () => {
    render(<VaultInterior block={vaultBlock} onClose={vi.fn()} />);
    expect(document.body.querySelectorAll(".vt-grid img").length).toBe(0);
    expect(document.body.querySelectorAll(".vt-mem.no-ph").length).toBe(4);
    expect(document.body.querySelectorAll(".mi2").length).toBe(4);
  });
});
