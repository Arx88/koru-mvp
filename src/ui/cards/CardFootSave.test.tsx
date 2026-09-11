/**
 * 🔴 FIX BOTÓN MUERTO — CardFoot "Guardar" estaba desconectado: despachaba
 * `koru-card-foot-action`, un evento que NADIE escucha. Ahora despacha
 * `koru-save-record` (el handler REAL de KoruProvider → record + persistencia
 * + toast + analytics). Estos tests verifican el wiring desde el DOM.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KoruProvider } from "../KoruProvider";
import { KoruUnifiedCard } from "./unified/KoruUnifiedCard";
import type { UiBlock } from "../../domain/types";

const researchBlock: UiBlock = {
  type: "research_sources",
  title: "Sushi sin gluten en Buenos Aires",
  summary: "Fuentes con lugares aptos para celíacos.",
  sources: [
    { title: "Neko 100% sin TACC", url: "https://ejemplo.com/neko", domain: "ejemplo.com" },
  ],
} as UiBlock;

function mountCard(block: UiBlock) {
  return render(
    <KoruProvider>
      <KoruUnifiedCard block={block} />
    </KoruProvider>,
  );
}

describe("CardFoot · Guardar / Compartir / Abrir conectados", () => {
  it("el botón Guardar despacha koru-save-record con el título del block", async () => {
    const user = userEvent.setup();
    const heard: CustomEvent[] = [];
    const listener = (e: Event) => heard.push(e as CustomEvent);
    window.addEventListener("koru-save-record", listener);
    try {
      mountCard(researchBlock);
      const saveBtn = screen.getByRole("button", { name: "Guardar" });
      expect(saveBtn).toBeInTheDocument();
      await user.click(saveBtn);
      expect(heard.length).toBe(1);
      const detail = (heard[0] as CustomEvent).detail;
      expect(detail.title).toContain("Sushi sin gluten");
      expect(detail.blockData?.type).toBe("research_sources");
      expect(detail.collection).toContain("Michi ·");
    } finally {
      window.removeEventListener("koru-save-record", listener);
    }
  });

  it("el handler real de KoruProvider crea el record (persistencia end-to-end)", async () => {
    const user = userEvent.setup();
    mountCard(researchBlock);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    // El listener de KoruProvider escribe en localStorage (legacy cache)
    // → verificamos que el record quedó guardado con el título del block.
    await waitFor(() => {
      const stored = localStorage.getItem("michi.mvp.state.v1");
      expect(stored).toBeTruthy();
      const state = JSON.parse(stored!);
      const saved = (state.records ?? []).find((r: any) =>
        String(r.title ?? "").includes("Sushi sin gluten"),
      );
      expect(saved).toBeTruthy();
    });
  });

  it("Compartir usa Web Share API si está disponible", async () => {
    const user = userEvent.setup();
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    (navigator as any).share = shareSpy;
    try {
      mountCard(researchBlock);
      await user.click(screen.getByRole("button", { name: "Compartir" }));
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy.mock.calls[0][0].url).toBe("https://ejemplo.com/neko");
    } finally {
      delete (navigator as any).share;
    }
  });

  it("Abrir navega a la primera fuente (window.open)", async () => {
    const user = userEvent.setup();
    const openSpy = vi.fn();
    const originalOpen = window.open;
    window.open = openSpy as any;
    try {
      mountCard(researchBlock);
      await user.click(screen.getByRole("button", { name: "Abrir" }));
      expect(openSpy).toHaveBeenCalledWith(
        "https://ejemplo.com/neko",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      window.open = originalOpen;
    }
  });
});
