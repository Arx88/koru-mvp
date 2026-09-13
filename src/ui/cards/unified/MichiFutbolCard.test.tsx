import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MichiFutbol } from "./MichiLayouts";
import { toPresentation } from "./presentation";
import type { UiBlock } from "../../../domain/types";

afterEach(cleanup);

/**
 * 🔴 REGRESIÓN (card de partido, medido en producción 2026-09-13)
 *
 *  1. `<Mat>soccer</Mat>` usaba un nombre de Material Icons LEGACY, sin ligadura
 *     en Material Symbols Outlined → se renderizaba el TEXTO "soccer" (81px)
 *     desbordando el badge de 20px y pisando el goleador.
 *  2. El estado del partido venía del proveedor en inglés
 *     ("Final Score - After Extra Time") y se mostraba tal cual.
 *  3. La liga se mostraba DOS veces: en la píldora sobre el arte y en el
 *     eyebrow del panel.
 */
const MATCH = {
  type: "live_match",
  homeName: "Spain",
  awayName: "Argentina",
  homeScore: 1,
  awayScore: 0,
  league: "FIFA World Cup / International Friendlies",
  status: "Final Score - After Extra Time",
  goals: [{ scorer: "Ferran Torres", minute: "106" }],
  stats: [{ label: "Tiros", home: 20, away: 2, leftPercent: 91, rightPercent: 9 }],
} as unknown as UiBlock;

function renderCard(block: UiBlock) {
  const { hero } = toPresentation(block);
  return render(
    <MichiFutbol
      block={block}
      hero={hero}
      isTappable
      handleClick={vi.fn()}
      handleKeyDown={vi.fn()}
      overlay={null}
    />,
  );
}

describe("MichiFutbol — card de partido (variante live_match)", () => {
  it("no filtra el nombre crudo de la ligadura del icono", () => {
    const { container } = renderCard(MATCH);
    // Los íconos Material Symbols viven como texto de ligadura en el DOM
    // (`sports_soccer` es válido: el navegador lo dibuja como glifo). El bug era
    // `soccer`, un nombre LEGACY que NO existe como ligadura en Material Symbols
    // Outlined → se pintaba el texto. Buscamos ese caso exacto.
    const leaked = [...container.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && el.textContent?.trim() === "soccer",
    );
    expect(leaked).toHaveLength(0);
  });

  it("no muestra el estado en inglés del proveedor", () => {
    const { container } = renderCard(MATCH);
    expect(container.textContent).not.toMatch(/final score/i);
    expect(container.textContent).toMatch(/final · alargue/i);
  });

  it("no repite la liga dos veces", () => {
    renderCard(MATCH);
    expect(screen.getAllByText(/FIFA World Cup/i)).toHaveLength(1);
  });

  it("muestra el nombre completo del visitante (antes se recortaba a 'Arg…')", () => {
    renderCard(MATCH);
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Spain")).toBeTruthy();
  });

  it("traduce un estado en vivo", () => {
    const live = renderCard({ ...MATCH, status: "In Progress", state: "in" } as unknown as UiBlock);
    expect(live.container.textContent).not.toMatch(/in progress/i);
    expect(live.container.textContent).toMatch(/EN JUEGO/);
  });

  it("traduce un partido programado", () => {
    const pre = renderCard({ ...MATCH, status: "Scheduled", state: "pre" } as unknown as UiBlock);
    expect(pre.container.textContent).not.toMatch(/scheduled/i);
    expect(pre.container.textContent).toMatch(/PRÓXIMO/);
  });

  it("deja pasar un estado que no conoce, en mayúsculas (no inventa traducción)", () => {
    const weird = renderCard({ ...MATCH, status: "Suspended by weather" } as unknown as UiBlock);
    expect(weird.container.textContent).toMatch(/SUSPENDED BY WEATHER/);
  });
});
