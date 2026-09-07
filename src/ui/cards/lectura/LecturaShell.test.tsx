import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LecturaShell } from "./LecturaShell";
import { lecturaInteriorFor } from "./index";
import type { UiBlock } from "../../../domain/types";

// LecturaShell — chrome compartido de los interiores Lectura Visual:
// topnav (volver · chip · guardar), children renderizados, reveal
// visible sin IntersectionObserver (fallback para jsdom), callbacks.

describe("LecturaShell", () => {
  it("renderiza children, chip de dominio y dispara onClose/onBookmark", () => {
    const onClose = vi.fn();
    const onBookmark = vi.fn();
    render(
      <LecturaShell onClose={onClose} onBookmark={onBookmark} chip={{ label: "Clima" }}>
        <div className="lcr-panel" id="p-test">
          <div className="rv">Contenido de la card</div>
        </div>
      </LecturaShell>,
    );

    expect(screen.getByText("Contenido de la card")).toBeInTheDocument();
    expect(screen.getByText("Clima")).toBeInTheDocument();

    const back = screen.getByRole("button", { name: /volver/i });
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);

    const fav = screen.getByRole("button", { name: /guardar/i });
    fireEvent.click(fav);
    expect(onBookmark).toHaveBeenCalledTimes(1);
  });

  it("muestra el contenido revelado (fallback sin IntersectionObserver)", () => {
    render(
      <LecturaShell onClose={vi.fn()}>
        <div className="lcr-panel">
          <p className="rv">Texto revelado</p>
        </div>
      </LecturaShell>,
    );
    const el = screen.getByText("Texto revelado");
    expect(el.className).toContain("in");
  });

  it("sin onBookmark no renderiza el botón guardar (spacer en su lugar)", () => {
    render(
      <LecturaShell onClose={vi.fn()}>
        <div className="lcr-panel">x</div>
      </LecturaShell>,
    );
    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
    expect(document.querySelector(".lcr .fab-spacer")).not.toBeNull();
  });
});

describe("lecturaInteriorFor", () => {
  it("devuelve null para tipos sin interior registrado (cae al genérico)", () => {
    const block = { type: "tennis_match" } as UiBlock;
    expect(lecturaInteriorFor(block)).toBeNull();
  });
});
