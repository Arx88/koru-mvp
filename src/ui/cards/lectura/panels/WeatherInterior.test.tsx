import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeatherInterior } from "./WeatherInterior";
import { LecturaShell } from "../LecturaShell";
import { weatherBlock } from "../fixtures";

// WeatherInterior — bind real del block `weather`: city/now/feel/wind
// desde el block, curva generada desde hourly, semana desde daily,
// acciones legítimas (koru-card-action → create_commitment).

function renderCard() {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const utils = render(
    <WeatherInterior block={weatherBlock} onClose={onClose} onSave={onSave} />,
  );
  return { onClose, onSave, utils };
}

describe("WeatherInterior", () => {
  it("bindea los datos del block (ciudad, temp, sensación, viento)", () => {
    renderCard();
    expect(screen.getByText("Ahora en Madrid")).toBeInTheDocument();
    expect(screen.getByText("26°")).toBeInTheDocument();
    expect(screen.getByText(/sensación/i)).toBeInTheDocument();
    expect(screen.getByText(/viento 12 km\/h ne/i)).toBeInTheDocument();
  });

  it("muestra la fecha con formato es y la condición", () => {
    renderCard();
    // fecha formateada en español (día de la semana + hora)
    expect(screen.getByText(/, \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText("Parcial")).toBeInTheDocument();
  });

  it("genera la curva de temperatura desde hourly (pico etiquetado)", () => {
    renderCard();
    expect(screen.getByText("29° máx")).toBeInTheDocument(); // máximo del fixture
    expect(screen.getByText("Cómo viene la tarde")).toBeInTheDocument();
    // etiquetas horarias del block
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("muestra máx/mín desde range y la semana desde daily", () => {
    renderCard();
    expect(screen.getByText("29°")).toBeInTheDocument();
    expect(screen.getByText("19°")).toBeInTheDocument();
    expect(screen.getByText("Lun")).toBeInTheDocument();
    expect(screen.getByText("Dom")).toBeInTheDocument();
  });

  it("muestra el título de semana derivado de la tendencia real", () => {
    renderCard();
    // fixture: 28,26,23,22,24,27,25 → arranca alto, termina medio/alto → pareja o calmando
    expect(
      screen.getByText(/la semana (viene calmando|viene calentando|se mantiene pareja)/i),
    ).toBeInTheDocument();
  });

  it("acción primaria despacha koru-card-action create_commitment (alerta de lluvia)", () => {
    const spy = vi.fn();
    window.addEventListener("koru-card-action", spy);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /avisame si llueve/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    const detail = spy.mock.calls[0][0].detail;
    expect(detail.action).toBe("create_commitment");
    expect(detail.blockType).toBe("weather");
    expect(detail.blockData).toEqual(weatherBlock);
    expect(detail.title).toContain("Madrid");
    window.removeEventListener("koru-card-action", spy);
  });

  it("el botón guardar del shell delega en onSave con título de ciudad", () => {
    const { onSave } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith("Clima Madrid", "Parcial");
  });

  it("back del shell cierra", () => {
    const { onClose } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("degrada sin hourly ni daily (no rompe)", () => {
    const onClose = vi.fn();
    render(
      <WeatherInterior
        block={{ type: "weather", city: "Lisboa", now: "20°", condition: "Nublado" }}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Ahora en Lisboa")).toBeInTheDocument();
    expect(screen.getByText("20°")).toBeInTheDocument();
    expect(screen.queryByText("Cómo viene la tarde")).toBeNull();
    expect(screen.queryByText("Lun")).toBeNull();
  });

  it("LecturaShell expone role=dialog con aria-label de la card", async () => {
    renderCard();
    await waitFor(() => {
      expect(document.querySelector(".lcr[role='dialog']")).not.toBeNull();
    });
  });
});
