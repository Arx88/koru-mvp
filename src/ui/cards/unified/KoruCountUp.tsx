import { useEffect, useRef, useState } from "react";

// KoruCountUp — anima un valor numérico desde 0 hasta su target cuando el
// elemento entra en el viewport. Extrae la parte numérica con un regex y
// conserva el sufijo (ej. "23°" → anima 0→23 y mantiene el "°").
// Si el valor no contiene un número, se renderiza tal cual.

export type KoruCountUpProps = {
  /** Valor a renderizar (ej. "23°", "8", "2 - 1"). */
  value: string;
  /** Duración de la animación en ms (default 600). */
  duration?: number;
  /** Clase CSS opcional para el span contenedor. */
  className?: string;
};

const NUMBER_REGEX = /^(-?\d+(?:\.\d+)?)(.*)$/;

function formatNumber(n: number, isFloat: boolean): string {
  return isFloat ? n.toFixed(1) : Math.round(n).toString();
}

export function KoruCountUp({ value, duration = 600, className }: KoruCountUpProps) {
  const match = value.match(NUMBER_REGEX);
  const target: number | null = match ? parseFloat(match[1]) : null;
  const suffix: string = match ? match[2] : "";
  const isFloat: boolean = match ? match[1].includes(".") : false;

  const initial: string = target != null ? `${formatNumber(0, isFloat)}${suffix}` : value;
  const [display, setDisplay] = useState<string>(initial);
  const ref = useRef<HTMLSpanElement | null>(null);
  const animatedRef = useRef(false);

  // Reset when the value prop changes so a new number animates again.
  useEffect(() => {
    animatedRef.current = false;
    if (target == null) {
      setDisplay(value);
    } else {
      setDisplay(`${formatNumber(0, isFloat)}${suffix}`);
    }
  }, [value, target, suffix, isFloat]);

  useEffect(() => {
    if (target == null) return;

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // Sin observer disponible: mostrar el valor final.
      setDisplay(`${formatNumber(target, isFloat)}${suffix}`);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !animatedRef.current) {
            animatedRef.current = true;
            observer.disconnect();

            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              // ease-out cubic
              const eased = 1 - Math.pow(1 - t, 3);
              const current = target * eased;
              setDisplay(`${formatNumber(current, isFloat)}${suffix}`);
              if (t < 1) {
                requestAnimationFrame(tick);
              } else {
                setDisplay(`${formatNumber(target, isFloat)}${suffix}`);
              }
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration, target, suffix, isFloat]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
