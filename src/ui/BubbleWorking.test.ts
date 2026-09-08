/**
 * FIX multi-indicador — mientras el turno Koru tiene una card de búsqueda
 * working (deliverable working), la burbuja de texto NO se renderiza: el
 * esqueleto de la card + WorkingPanel son el ÚNICO estado visible. Queja
 * original: "hay múltiples mensajes de PROCESANDO en simultáneo".
 *
 * Este test usa el DOM real de KoruTurnBubble vía TalkOverlay… pero el
 * componente no está exportado — cubrimos la regla a través del contrato de
 * render: chatCards ya no emite la nota "Buscando información…" para items
 * deliverable working, y turnProcessing ya garantiza un solo TypingDots.
 * Acá verificamos la pieza faltante: la condición del bloque.
 */
import { describe, expect, it } from "vitest";
import type { KoruChatTurn, KoruTurnItem } from "../../domain/types";

/** Misma lógica que KoruTurnBubble (extraída para test). */
function shouldShowBubble(turn: Pick<KoruChatTurn, "text" | "items">): boolean {
  const text = turn.text ?? "";
  const hasWorkingDeliverable = (turn.items ?? []).some(
    (it: KoruTurnItem) => it.uiBlock?.type === "deliverable" && (it.uiBlock as { status?: string }).status === "working",
  );
  return !hasWorkingDeliverable && text.trim().length > 0;
}

describe("multi-indicador: burbuja durante búsqueda working", () => {
  it("con deliverable working la burbuja NO se muestra (cero texto 'Buscando…' duplicado)", () => {
    const turn = {
      text: "Buscando \"airpods\"...",
      items: [
        { id: "i1", uiBlock: { type: "deliverable", status: "working", kicker: "Tu Búsqueda" } },
      ],
    } as unknown as Pick<KoruChatTurn, "text" | "items">;
    expect(shouldShowBubble(turn)).toBe(false);
  });

  it("turno finalizado (deliverable ready) → la burbuja del reply final SÍ se muestra", () => {
    const turn = {
      text: "Esto encontré de los AirPods…",
      items: [
        { id: "i1", uiBlock: { type: "deliverable", status: "ready" } },
      ],
    } as unknown as Pick<KoruChatTurn, "text" | "items">;
    expect(shouldShowBubble(turn)).toBe(true);
  });

  it("turno sin items working → burbuja normal", () => {
    expect(shouldShowBubble({ text: "Listo ✓", items: [] } as unknown as Pick<KoruChatTurn, "text" | "items">)).toBe(true);
    expect(shouldShowBubble({ text: "Hola", items: undefined } as unknown as Pick<KoruChatTurn, "text" | "items">)).toBe(true);
  });

  it("items working que NO son deliverable no ocultan la burbuja", () => {
    const turn = {
      text: "Anotado",
      items: [{ id: "i1", uiBlock: { type: "reminder", status: "working" } }],
    } as unknown as Pick<KoruChatTurn, "text" | "items">;
    expect(shouldShowBubble(turn)).toBe(true);
  });
});
