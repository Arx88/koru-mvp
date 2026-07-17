// ════════════════════════════════════════════════════════════════════════
//  KoruLeafConfetti — Confetti de hojitas Koru para logro de racha
//  Kimi Tier-S spec pág. 93: "Logro racha 21 días: confetti de hojitas koru
//  (no papelitos genéricos)". Las hojas caen con rotación + translateX.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

interface LeafConfettiProps {
  /** Disparar el confetti (true = activo). */
  active: boolean;
  /** Número de hojitas. Default 24. */
  count?: number;
  /** Duración en ms. Default 2600. */
  duration?: number;
  /** Callback al terminar. */
  onComplete?: () => void;
}

export function KoruLeafConfetti({ active, count = 24, duration = 2600, onComplete }: LeafConfettiProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (active) {
      setShow(true);
      const id = setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(id);
    }
  }, [active, duration, onComplete]);

  if (!show) return null;

  const leaves = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 600;
    const scale = 0.7 + Math.random() * 0.8;
    const hue = Math.random() > 0.5 ? "var(--leaf, #7ed491)" : "var(--miel-1, #f6bd6d)";
    return (
      <i
        key={i}
        style={{
          left: `${left}%`,
          animationDelay: `${delay}ms`,
          transform: `scale(${scale})`,
          background: hue,
        }}
      />
    );
  });

  return (
    <div className="koru-leaf-confetti" aria-hidden="true">
      {leaves}
    </div>
  );
}
