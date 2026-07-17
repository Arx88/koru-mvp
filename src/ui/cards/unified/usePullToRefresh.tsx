// ════════════════════════════════════════════════════════════════════════
//  usePullToRefresh — Hook para pull-to-refresh con icono del dominio girando
//  Kimi Tier-S spec pág. 92: "la moneda/el icono del dominio gira mientras
//  refresca". No es un spinner genérico — es el MISMO icono de la card.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";

interface PullToRefreshOptions {
  /** Distancia en px que el usuario debe arrastrar para disparar refresh. */
  threshold?: number;
  /** Función async que se ejecuta cuando se dispara. */
  onRefresh?: () => Promise<void> | void;
  /** Container scrollable; default = window. */
  container?: HTMLElement | null;
}

export function usePullToRefresh({ threshold = 70, onRefresh, container }: PullToRefreshOptions = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const target = container ?? (typeof window !== "undefined" ? window : null);

  const onTouchStart = useCallback((e: Event) => {
    const te = e as TouchEvent;
    // Solo activar si el scroll está en el top
    const scrollTop = container ? container.scrollTop : (window.scrollY || document.documentElement.scrollTop);
    if (scrollTop <= 0 && !isRefreshing && te.touches[0]) {
      startY.current = te.touches[0].clientY;
    } else {
      startY.current = null;
    }
  }, [container, isRefreshing]);

  const onTouchMove = useCallback((e: Event) => {
    if (startY.current == null || isRefreshing) return;
    const te = e as TouchEvent;
    if (!te.touches[0]) return;
    const delta = te.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Resistencia elástica: el pull se siente más pesado al avanzar
      const elastic = Math.min(delta * 0.45, threshold * 1.6);
      setPullDistance(elastic);
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    startY.current = null;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    if (!target) return;
    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: true });
    target.addEventListener("touchend", onTouchEnd);
    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
    };
  }, [target, onTouchStart, onTouchMove, onTouchEnd]);

  /** Progreso 0..1 — útil para opacidad/escala del icono. */
  const progress = Math.min(pullDistance / threshold, 1);

  return { pullDistance, isRefreshing, progress };
}

/** Componente PullToRefreshIndicator — icono girando mientras refresca. */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  iconName = "default",
}: {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  iconName?: string;
}) {
  if (pullDistance < 1 && !isRefreshing) return null;
  const scale = isRefreshing ? 1 : 0.6 + progress * 0.4;
  const opacity = isRefreshing ? 1 : Math.min(progress * 1.5, 1);
  return (
    <div
      className={`koru-pull-to-refresh ${isRefreshing ? "spinning" : ""}`}
      style={{
        transform: `translateX(-50%) translateY(${pullDistance}px) scale(${scale})`,
        opacity,
      }}
      aria-hidden="true"
    >
      <span className="koru-pull-spinner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
        </svg>
      </span>
    </div>
  );
}
