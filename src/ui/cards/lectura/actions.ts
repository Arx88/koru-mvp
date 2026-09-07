/**
 * dispatchCardAction — puente a la barra de eventos REAL de la app
 * (`koru-card-action` → KoruProvider.onCardAction). Los interiores
 * Lectura despachan acciones legítimas (create_commitment, reserve,
 * complete…) con el UiBlock como blockData, igual que las cards
 * compactas de KoruUnifiedCard.
 */
import type { UiBlock } from "../../../domain/types";

export function dispatchCardAction(
  action: string,
  block: UiBlock,
  payload?: Record<string, unknown>,
) {
  window.dispatchEvent(
    new CustomEvent("koru-card-action", {
      detail: { action, blockType: block.type, blockData: block, ...payload },
    }),
  );
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(15);
    } catch {
      // best-effort — algunos browsers lanzan sin interacción del usuario
    }
  }
}
