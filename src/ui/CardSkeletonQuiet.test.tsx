/**
 * 🔴 FIX INDICADOR ÚNICO — pieza CardSkeleton (2026-09-09).
 *
 * El esqueleto de card (placeholder mientras web_nav loading / deliverable
 * working) se renderiza SIEMPRE junto al WorkingPanel para búsquedas. Su
 * footer decía "Procesando…" + dots → un SEGUNDO mensaje de progreso
 * simultáneo con "Sumergiéndome en tu búsqueda…" (la queja del usuario de
 * múltiples PROCESANDO). Regla nueva: el esqueleto es visual (shimmer +
 * latido de dots SIN texto); el WorkingPanel es el único que comunica.
 *
 * Este test renderiza el componente real y verifica el contrato.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardSkeleton } from "./cards/unified/CardSkeleton";

describe("CardSkeleton: esqueleto silencioso (indicador único)", () => {
  it("NO muestra el texto 'Procesando…' (el WorkingPanel es el único mensaje de progreso)", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.textContent ?? "").not.toContain("Procesando");
  });

  it("mantiene el latido visual (dots) y el placeholder con shimmer", () => {
    const { container } = render(<CardSkeleton />);
    // estructura del esqueleto: líneas shimmer + tiles
    expect(container.querySelectorAll(".koru-shimmer-line").length).toBeGreaterThanOrEqual(4);
    // el footer sigue existiendo como latido (icono + dots, aria-hidden)
    const foot = container.querySelector(".kc-foot");
    expect(foot).not.toBeNull();
    expect(foot?.getAttribute("aria-hidden")).toBe("true");
  });

  it("accesible como región busy sin duplicar anuncios de progreso", () => {
    render(<CardSkeleton />);
    // aria-busy + label descriptivo único (para lectores de pantalla, invisible visualmente)
    const root = screen.getByLabelText("Cargando respuesta");
    expect(root.getAttribute("aria-busy")).toBe("true");
  });
});
