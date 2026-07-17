import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ============================================================================
// AnimatedIcon — adaptación del sistema de iconos animados (Kimi audit, págs.
// 25–28) al stack Koru. El audit propone Lucide-animated; nosotros usamos
// Material Symbols Outlined como lenguaje único. Se conserva la idea central:
// el icono es un componente con micro-movimiento pensado, disparado por
// interacción (hover/tap), por visibilidad (view) o continuo (loop).
// ============================================================================

export type IconAnimation = "draw" | "pulse" | "rotate" | "bounce" | "wiggle" | "none";
export type IconTrigger = "hover" | "view" | "loop" | "tap";

export interface AnimatedIconProps {
  /** Nombre del Material Symbol (ej. "wb_sunny", "alarm"). */
  name: string;
  /** Tamaño en píxeles. Default 24. */
  size?: number;
  /** Color. Default currentColor (hereda del padre). */
  color?: string;
  /** Relleno (FILL 1) — default false (outline). */
  fill?: boolean;
  /** Tipo de animación. Default "none". */
  animation?: IconAnimation;
  /** Cuándo se dispara. Default "hover". */
  trigger?: IconTrigger;
  className?: string;
  /** Título accesible (aria-label). Si se omite, el icono es aria-hidden. */
  label?: string;
}

// Clase CSS aplicada cuando la animación está activa. El orden de las
// declaraciones en style.css define cuál gana; todas tienen la misma
// especificidad (.koru-icon-anim.is-*) así que la última activa sobrevive.
const ANIM_CLASS: Record<Exclude<IconAnimation, "none">, string> = {
  draw: "is-drawing",
  pulse: "is-pulsing",
  rotate: "is-rotating",
  bounce: "is-bouncing",
  wiggle: "is-wiggling",
};

// Duración de cada animación en ms — se usa para quitar la clase de los
// one-shot (draw / wiggle) y dejar el icono listo para re-disparar.
const ANIM_DURATION_MS: Record<Exclude<IconAnimation, "none">, number> = {
  draw: 600,
  pulse: 2000,
  rotate: 4000,
  bounce: 2000,
  wiggle: 500,
};

const ONE_SHOT: ReadonlySet<Exclude<IconAnimation, "none">> = new Set(["draw", "wiggle"]);

export function AnimatedIcon({
  name,
  size = 24,
  color = "currentColor",
  fill = false,
  animation = "none",
  trigger = "hover",
  className = "",
  label,
}: AnimatedIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  // Si la animación es "none" pero el trigger es "view", igual queremos el
  // draw-on-scroll (es el efecto por defecto para iconos estáticos): el icono
  // se "dibuja" al entrar en viewport. Spec: "static, but draw on view".
  const resolvedAnimation: IconAnimation =
    animation === "none" && trigger === "view" ? "draw" : animation;

  // Disparadores "loop" y "view" son persistentes: una vez activos, se quedan.
  // "loop" arranca de inmediato; "view" espera al IntersectionObserver.
  useEffect(() => {
    if (resolvedAnimation === "none") return;

    if (trigger === "loop") {
      setActive(true);
      return;
    }

    if (trigger === "view") {
      const el = ref.current;
      if (!el) return;
      // Respeta prefers-reduced-motion: si el usuario la pidió, no animamos.
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) {
        setActive(true); // clase puesta pero la CSS la desactiva vía media query
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActive(true);
              io.disconnect();
              break;
            }
          }
        },
        { threshold: 0.4 },
      );
      io.observe(el);
      return () => io.disconnect();
    }
  }, [resolvedAnimation, trigger]);

  // Re-dispara una animación one-shot (hover / tap). Quita la clase, fuerza
  // reflow y vuelve a ponerla para que la CSS animation reinicie desde cero.
  const playOnce = () => {
    if (resolvedAnimation === "none") return;
    setActive(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setActive(true));
      const dur = ANIM_DURATION_MS[resolvedAnimation as Exclude<IconAnimation, "none">];
      if (ONE_SHOT.has(resolvedAnimation as Exclude<IconAnimation, "none">)) {
        window.setTimeout(() => setActive(false), dur + 40);
      }
    });
  };

  const handleMouseEnter = () => {
    if (trigger !== "hover") return;
    playOnce();
  };

  const handleClick = () => {
    if (trigger !== "tap") return;
    playOnce();
  };

  const animClass =
    active && resolvedAnimation !== "none"
      ? ANIM_CLASS[resolvedAnimation as Exclude<IconAnimation, "none">]
      : "";

  // Material Symbols declara el eje opsz en rango 20..48; clamp al tamaño
  // pedido para que el glyph se rinda con el peso óptico correcto.
  const opsz = Math.min(48, Math.max(20, size));

  const style: CSSProperties = {
    fontSize: `${size}px`,
    color,
    fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${opsz}`,
  };

  const composed = `material-symbols-outlined koru-icon-anim ${animClass} ${className}`.trim();

  return (
    <span
      ref={ref}
      className={composed}
      style={style}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}
