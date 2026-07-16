import { useCallback } from "react";
import type { MouseEvent } from "react";

// useTapRipple — hook que añade un efecto ripple a cualquier elemento
// tappable. Devuelve un callback que debe conectarse al onClick del elemento.
//
// El callback:
//   1. Crea un <span class="koru-tap-ripple"> en la posición del click.
//   2. La animación CSS (definida en style.css) lo escala de 0 a 4.
//   3. Lo elimina del DOM tras 400ms.
//   4. Dispara navigator.vibrate(15) si está disponible (feedback háptico).
//
// El elemento receptor debe tener `position: relative` y `overflow: hidden`
// para que el ripple quede recortado a sus bordes.

export function useTapRipple(): (e: MouseEvent<HTMLElement>) => void {
  return useCallback((e: MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement("span");
    ripple.className = "koru-tap-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    target.appendChild(ripple);

    if ("vibrate" in navigator) {
      navigator.vibrate(15);
    }

    window.setTimeout(() => {
      ripple.remove();
    }, 400);
  }, []);
}
