// ════════════════════════════════════════════════════════════════════════
//  KoruMicrodetails — Componente que monta los microdetalles Kimi globales:
//  - KoruLeafConfetti (racha 21 días)
//  - PullToRefreshIndicator (sobre el container scrollable)
//  - Escucha eventos `koru-card-action` y `koru-streak-milestone`
//
//  Se monta una sola vez en App.tsx (o KoruProvider). No rompe nada: si los
//  eventos no se disparan, los componentes no se renderizan.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { KoruLeafConfetti } from "./KoruLeafConfetti";
import { usePullToRefresh, PullToRefreshIndicator } from "./usePullToRefresh";

export function KoruMicrodetails({ onRefresh }: { onRefresh?: () => Promise<void> | void }) {
  const [streakActive, setStreakActive] = useState(false);
  const { pullDistance, isRefreshing, progress } = usePullToRefresh({
    threshold: 70,
    onRefresh,
  });

  // Escuchar milestone de racha (lo dispara KoruProvider cuando llega a 21 días)
  useEffect(() => {
    const onStreak = () => {
      setStreakActive(true);
      setTimeout(() => setStreakActive(false), 3000);
    };
    window.addEventListener("koru-streak-milestone", onStreak as EventListener);
    return () => window.removeEventListener("koru-streak-milestone", onStreak as EventListener);
  }, []);

  return (
    <>
      <KoruLeafConfetti active={streakActive} count={28} duration={2800} />
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />
    </>
  );
}

/**
 * Helper para disparar el confetti de racha desde cualquier parte.
 * Ej: `fireStreakMilestone()` cuando el usuario llega a 21 días de racha.
 */
export function fireStreakMilestone() {
  window.dispatchEvent(new CustomEvent("koru-streak-milestone", { detail: { days: 21 } }));
}

/**
 * Helper para disparar refresh manualmente (botón o gesture custom).
 */
export function fireRefresh() {
  window.dispatchEvent(new CustomEvent("koru-trigger-refresh"));
}

/** Hook para usar refresh externo (botón en UI). */
export function useExternalRefresh() {
  return useCallback(() => fireRefresh(), []);
}
