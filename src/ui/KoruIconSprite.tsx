import type { ReactElement } from "react";

/**
 * KoruIconSprite — Kimi W2: SVG sprite con 20 iconos como <symbol>.
 *
 * Se renderiza UNA sola vez en el root de la app (oculto, aria-hidden).
 * Cualquier componente puede referenciar un icono con:
 *
 *   <svg className="..."><use href="#koru-icon-wb_sunny" /></svg>
 *
 * Los paths son simple SVG (24x24 viewBox, stroke=currentColor o fill=currentColor)
 * pensados para convivir con Material Symbols y Lucide.
 */

const ICON_PATHS: Record<string, ReactElement> = {
  wb_sunny: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  cloud: (
    <path d="M19.35 10.04A7.5 7.5 0 0 0 5.07 8.18 5.5 5.5 0 0 0 6 19h12.5a4.5 4.5 0 0 0 .85-8.96z" />
  ),
  rainy: (
    <>
      <path d="M19.35 10.04A7.5 7.5 0 0 0 5.07 8.18 5.5 5.5 0 0 0 6 19h12.5a4.5 4.5 0 0 0 .85-8.96z" />
      <path d="M8 19v3M12 19v3M16 19v3" />
    </>
  ),
  sports_soccer: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l4 3-1.5 5h-5L8 10z M12 3v4M5.3 7.7l3 2M18.7 7.7l-3 2M5.3 16.3l3-2M18.7 16.3l-3-2M12 21v-4" />
    </>
  ),
  sports_tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M4.5 19.5L15 9" />
    </>
  ),
  restaurant: (
    <path d="M11 9V3a1 1 0 0 0-2 0v6H7V3a1 1 0 0 0-2 0v6a3 3 0 0 0 3 3v9a1 1 0 0 0 2 0v-9a3 3 0 0 0 3-3V3a1 1 0 0 0-2 0zM18 3a3 3 0 0 0-3 3v6a3 3 0 0 0 2 2.83V21a1 1 0 0 0 2 0v-9.17A3 3 0 0 0 21 12V6a3 3 0 0 0-3-3z" />
  ),
  movie: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 8h16M4 16h16M8 4v16M16 4v16" />
    </>
  ),
  menu_book: (
    <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
  ),
  payments: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  currency_bitcoin: (
    <path d="M9 4v2H7v2h2v8H7v2h2v2h2v-2h2v2h2v-2c1.66 0 3-1.34 3-3 0-1.3-.83-2.41-2-2.83.62-.71 1-1.63 1-2.67 0-1.66-1.34-3-3-3V4h-2v2h-2V4H9zm2 4h3a1 1 0 0 1 0 2h-3V8zm0 4h3.5a1 1 0 0 1 0 2H11v-2z" />
  ),
  alarm: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M5 3L2 6M19 3l3 3" />
    </>
  ),
  notifications: (
    <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zM18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" />
  ),
  favorite: (
    <path d="M12 21s-7.5-4.9-10-9.5C.5 8.3 2.4 5 5.5 5c2 0 3.5 1.2 4.5 2.7C11 6.2 12.5 5 14.5 5 17.6 5 19.5 8.3 22 11.5 19.5 16.1 12 21 12 21z" />
  ),
  psychology: (
    <>
      <path d="M14 4a6 6 0 0 0-6 6c0 2 .9 3.8 2.5 5 .8.6 1.5 1.6 1.5 2.7V20a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-1.3c0-1 .4-2 1.2-2.6A6 6 0 0 0 14 4z" />
      <path d="M10 14h4M11 11h2" />
    </>
  ),
  checklist: (
    <>
      <path d="M3 5h11M3 12h11M3 19h11" />
      <path d="M18 4l2 2 3-3M18 11l2 2 3-3M18 18l2 2 3-3" />
    </>
  ),
  repeat: (
    <path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
  ),
  fitness_center: (
    <path d="M20.57 14.86l-1.41 1.41-2.83-2.83 1.41-1.41 2.83 2.83zM17.74 6.34l-2.83 2.83 1.41 1.41 2.83-2.83-1.41-1.41zM5.43 9.14l1.41-1.41 2.83 2.83-1.41 1.41-2.83-2.83zM3.43 17.66l2.83-2.83 1.41 1.41-2.83 2.83-1.41-1.41zM14 6.34l-1.41-1.41-7.07 7.07 1.41 1.41 7.07-7.07zM16.59 9.93l-6.36 6.36 1.41 1.41 6.36-6.36-1.41-1.41z" />
  ),
  shopping_cart: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </>
  ),
  travel_explore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
    </>
  ),
  map: (
    <>
      <path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z" />
      <path d="M9 6v14M15 4v14" />
    </>
  ),
};

const ICON_NAMES = Object.keys(ICON_PATHS) as (keyof typeof ICON_PATHS)[];

/**
 * Sprite SVG oculto con los 20 iconos como <symbol>.
 * Renderizar UNA vez en el root (App.tsx, dentro de KoruProvider).
 */
export function KoruIconSprite() {
  return (
    <svg
      aria-hidden="true"
      data-koru-icon-sprite
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {ICON_NAMES.map((name) => (
          <symbol
            key={name}
            id={`koru-icon-${name}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICON_PATHS[name]}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/** Lista de nombres de iconos expuestos por el sprite (para tests/docs). */
export const KORU_SPRITE_ICONS: readonly string[] = ICON_NAMES;
