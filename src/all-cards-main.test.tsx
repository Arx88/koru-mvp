import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AllCardsPage } from "./all-cards-main";

/**
 * all-cards-main — harness del archivo único (chat showcase + galería).
 * Verifica: switcher entre vistas, fondos por modo, contadores reales
 * derivados del catálogo e interceptación de links del harness original.
 */

describe("AllCardsPage (archivo único all-cards)", () => {
  afterEach(() => {
    cleanup();
    document.body.className = "";
    vi.restoreAllMocks();
    try {
      window.localStorage.clear();
    } catch {
      /* noop */
    }
  });

  it("renderiza la barra con contadores reales y arranca en el chat", () => {
    render(<AllCardsPage />);
    expect(screen.getByRole("tab", { name: /chat/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /interiores/i })).toHaveAttribute("aria-selected", "false");
    // contadores derivados del catálogo (no hardcodeados)
    expect(screen.getByText(/cards en el chat · \d+ interiores extensibles/)).toBeTruthy();
    // el stage del chat está montado
    expect(document.querySelector(".pv-stage")).toBeTruthy();
    expect(document.querySelector(".ac-bar")).toBeTruthy();
  });

  it("al cambiar a Interiores monta la galería completa y cambia el fondo del body", async () => {
    render(<AllCardsPage />);
    fireEvent.click(screen.getByRole("tab", { name: /interiores/i }));
    await waitFor(() => {
      expect(document.querySelector(".gal")).toBeTruthy();
    });
    // la galería lista TODOS los interiores del catálogo
    const minis = document.querySelectorAll(".gal-mini");
    expect(minis.length).toBeGreaterThanOrEqual(40);
    // fondo lavanda del catálogo en modo galería
    expect(document.body.classList.contains("ac-mode--gallery")).toBe(true);
    // el footer con links muertos del harness queda oculto en el archivo único
    expect(document.querySelector(".gal-foot")).toBeNull();
    // volver al chat restaura el fondo noche de la app
    fireEvent.click(screen.getByRole("tab", { name: /^chat$/i }));
    await waitFor(() => {
      expect(document.querySelector(".pv-stage")).toBeTruthy();
    });
    expect(document.body.classList.contains("ac-mode--chat")).toBe(true);
  });

  it("los links del harness (/lectura.html) se interceptan y cambian de vista sin navegar", async () => {
    render(<AllCardsPage />);
    // el welcome del showcase tiene un link a /lectura.html: en el archivo
    // único no existe esa ruta — el click debe switchear a la galería.
    const link = await screen.findAllByRole("link").then((links) =>
      links.find((a) => a.getAttribute("href") === "/lectura.html"),
    );
    expect(link).toBeTruthy();
    fireEvent.click(link!);
    await waitFor(() => {
      expect(document.querySelector(".gal")).toBeTruthy();
    });
    expect(document.body.classList.contains("ac-mode--gallery")).toBe(true);
  });
});
