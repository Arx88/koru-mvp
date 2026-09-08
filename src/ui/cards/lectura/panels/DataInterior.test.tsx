import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataInterior } from "./DataInterior";
import { lecturaInteriorFor } from "../index";
import type { UiBlock } from "../../../../domain/types";

// DataInterior — bind real del block `data_card` (el más frecuente del chat:
// web_search / deep_research / shopping_compare / wikipedia_lookup).
// Hasta ahora su "Ver más" caía al render genérico viejo de KoruDetailScreen.

const luzBlock: Extract<UiBlock, { type: "data_card" }> = {
  type: "data_card",
  title: "Precio de la luz hoy · datos verificados",
  sourceStatus: "verified",
  items: [
    {
      label: "Pico (19–22h)",
      value: "0,31 €/kWh",
      detail: "Máximo del día",
      quote: "El tramo punta cerró en 31 céntimos",
      sourceDomain: "omie.es",
      sourceUrl: "https://www.omie.es",
    },
    {
      label: "Valle (2–6h)",
      value: "0,09 €/kWh",
      detail: "El momento más barato para la lavadora",
      quote: "Mínimo nocturno de 9 céntimos",
      sourceDomain: "omie.es",
      sourceUrl: "https://www.omie.es",
    },
    {
      label: "Media del mes",
      value: "0,18 €/kWh",
      sourceDomain: "ree.es",
      sourceUrl: "https://www.ree.es",
    },
  ],
};

describe("DataInterior", () => {
  it("renderiza el panel #p-data con los items reales del block", () => {
    const { unmount } = render(<DataInterior block={luzBlock} onClose={vi.fn()} />);
    expect(document.body.querySelector("#p-data")).toBeTruthy();
    expect(screen.getByText("Pico (19–22h)")).toBeTruthy();
    expect(screen.getByText("0,31 €/kWh")).toBeTruthy();
    expect(screen.getByText("0,09 €/kWh")).toBeTruthy();
    unmount();
  });

  it("muestra las citas literales y las fuentes con enlace", () => {
    const { unmount } = render(<DataInterior block={luzBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/El tramo punta cerró en 31 céntimos/)).toBeTruthy();
    const omie = screen.getAllByText("omie.es");
    expect(omie.length).toBeGreaterThan(0);
    const link = omie.find((el) => el.tagName === "A") as HTMLAnchorElement | undefined;
    expect(link?.href).toBe("https://www.omie.es/");
    unmount();
  });

  it("el kicker refleja el estado verificado solo cuando hay citas o status", () => {
    const { unmount } = render(<DataInterior block={luzBlock} onClose={vi.fn()} />);
    // sourceStatus verified + quotes → lenguaje de verificación.
    expect(screen.getByText(/respaldada por una cita literal/)).toBeTruthy();
    unmount();

    const plain: Extract<UiBlock, { type: "data_card" }> = {
      type: "data_card",
      title: "Datos sueltos",
      items: [{ label: "A", value: "1" }],
    };
    const { unmount: u2 } = render(<DataInterior block={plain} onClose={vi.fn()} />);
    expect(screen.getByText(/1 dato de lo que encontré/)).toBeTruthy();
    expect(screen.queryByText(/respaldada por una cita literal/)).toBeNull();
    u2();
  });

  it("el botón primario abre la primera fuente cuando existe", () => {
    const { unmount } = render(<DataInterior block={luzBlock} onClose={vi.fn()} />);
    const open = screen.getByText("Abrir la fuente");
    expect(open.closest("a")?.href).toBe("https://www.omie.es/");
    unmount();
  });

  it("cierra con el botón volver", () => {
    const onClose = vi.fn();
    const { unmount } = render(<DataInterior block={luzBlock} onClose={onClose} />);
    fireEvent.click(screen.getByText("Volver al chat"));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("sin items no crashea (estado honesto)", () => {
    const { unmount } = render(
      <DataInterior block={{ type: "data_card", title: "Vacío" }} onClose={vi.fn()} />,
    );
    expect(screen.getByText("Listo, entendido")).toBeTruthy();
    unmount();
  });
});

describe("REGISTRY lectura — data_card registrado", () => {
  it("lecturaInteriorFor(block data_card) devuelve DataInterior (Ver más con estética nueva)", () => {
    const interior = lecturaInteriorFor(luzBlock);
    expect(interior).toBe(DataInterior);
  });
});
