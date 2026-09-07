/**
 * Ic — wrapper de iconos Lucide para el sistema Lectura Visual.
 *
 * Port fiel del patrón del catálogo (public/lectura-visual.html):
 * el icono se renderiza como <i class="ic ..."><svg lucide/></i> y en el
 * mount se setea pathLength=100 en todas las figuras para que la
 * animación de trazo (.ic-draw: stroke-dasharray/dashoffset 100→0)
 * funcione igual que con el bundle UMD del catálogo.
 *
 * Clases de idle del catálogo: .ic-spin (sol), .ic-sway (viento),
 * .ic-pulse (live), .ic-bob.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

export function Ic({
  i: Icon,
  className = "ic",
  style,
}: {
  i: LucideIcon;
  className?: string;
  style?: CSSProperties;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const shapes = svg.querySelectorAll("path, line, circle, polyline, rect");
    shapes.forEach((el) => el.setAttribute("pathLength", "100"));
  }, []);

  return (
    <i className={className} style={style} aria-hidden="true">
      <Icon ref={svgRef} />
    </i>
  );
}
