import { useMemo, useState } from "react";
import { AnimatedIcon, type IconAnimation, type IconTrigger } from "./AnimatedIcon";

// ============================================================================
// IconGallery — Herramienta de referencia/desarrollador (Kimi audit).
// Renderiza un overlay fullscreen que muestra TODOS los iconos animados del
// sistema en 3 filas:
//   1) Draw-on-view  — iconos estáticos que se "dibujan" al entrar en viewport
//   2) Loop          — animaciones continuas (pulse, rotate, bounce)
//   3) Hover-trigger — animaciones one-shot disparadas por hover
// Cada tile muestra el nombre del Material Symbol debajo, y toda la galería
// es buscable por nombre.
//
// Accesible vía:
//   - URL: ?icons=1  (App.tsx lo intercepta y renderiza solo esta galería)
//   - Settings → "Ver galería de iconos" (navega a ?icons=1)
// ============================================================================

interface GalleryItem {
  name: string;
  animation: IconAnimation;
  trigger: IconTrigger;
  fill?: boolean;
}

const DRAW_ON_VIEW: GalleryItem[] = [
  { name: "wb_sunny", animation: "draw", trigger: "view" },
  { name: "cloud", animation: "draw", trigger: "view" },
  { name: "restaurant", animation: "draw", trigger: "view" },
  { name: "movie", animation: "draw", trigger: "view" },
  { name: "menu_book", animation: "draw", trigger: "view" },
  { name: "travel_explore", animation: "draw", trigger: "view" },
  { name: "fitness_center", animation: "draw", trigger: "view" },
  { name: "calendar_month", animation: "draw", trigger: "view" },
];

const LOOP: GalleryItem[] = [
  { name: "sports_soccer", animation: "pulse", trigger: "loop" },
  { name: "refresh", animation: "rotate", trigger: "loop" },
  { name: "trending_up", animation: "bounce", trigger: "loop" },
  { name: "favorite", animation: "pulse", trigger: "loop", fill: true },
  { name: "notifications", animation: "bounce", trigger: "loop" },
  { name: "sync", animation: "rotate", trigger: "loop" },
  { name: "autorenew", animation: "rotate", trigger: "loop" },
];

const HOVER_TRIGGERED: GalleryItem[] = [
  { name: "bookmark", animation: "wiggle", trigger: "hover" },
  { name: "check_circle", animation: "wiggle", trigger: "hover" },
  { name: "share", animation: "wiggle", trigger: "hover" },
  { name: "download", animation: "wiggle", trigger: "hover" },
  { name: "edit", animation: "wiggle", trigger: "hover" },
  { name: "delete", animation: "wiggle", trigger: "hover" },
  { name: "save", animation: "wiggle", trigger: "hover" },
  { name: "send", animation: "wiggle", trigger: "hover" },
];

interface RowDef {
  label: string;
  items: GalleryItem[];
}

const ROWS: RowDef[] = [
  { label: "Draw on view · se dibujan al entrar al viewport", items: DRAW_ON_VIEW },
  { label: "Loop · animaciones continuas", items: LOOP },
  { label: "Hover triggered · pasá el mouse para re-disparar", items: HOVER_TRIGGERED },
];

function matchesSearch(item: GalleryItem, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    item.name.toLowerCase().includes(needle) ||
    item.animation.toLowerCase().includes(needle) ||
    item.trigger.toLowerCase().includes(needle)
  );
}

function closeGallery() {
  // Vuelve a la URL base sin el query param `?icons=1`.
  const url = new URL(window.location.href);
  url.searchParams.delete("icons");
  window.location.href = url.toString();
}

export function IconGallery() {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    return ROWS.map((row) => ({
      ...row,
      items: row.items.filter((item) => matchesSearch(item, query)),
    })).filter((row) => row.items.length > 0);
  }, [query]);

  const totalCount = useMemo(
    () => ROWS.reduce((sum, row) => sum + row.items.length, 0),
    [],
  );

  return (
    <div
      className="koru-icon-gallery"
      role="dialog"
      aria-label="Galería de iconos animados"
      aria-modal="true"
    >
      <header className="koru-icon-gallery-header">
        <div style={{ minWidth: 0 }}>
          <h2 className="koru-icon-gallery-title">Galería de iconos · Kimi audit</h2>
          <p className="koru-icon-gallery-subtitle">
            {totalCount} iconos animados · Material Symbols + .koru-icon-anim
          </p>
        </div>
        <input
          type="search"
          className="koru-icon-gallery-search"
          placeholder="Buscar icono, animación o trigger…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar iconos"
        />
        <button
          type="button"
          className="koru-icon-gallery-close"
          onClick={closeGallery}
          aria-label="Cerrar galería de iconos"
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20 }}>
            close
          </span>
        </button>
      </header>

      <div className="koru-icon-gallery-body">
        {filteredRows.length === 0 ? (
          <p className="koru-icon-gallery-empty">
            No hay iconos que coincidan con “{query}”.
          </p>
        ) : (
          filteredRows.map((row) => (
            <section key={row.label} className="koru-icon-gallery-row">
              <h3 className="koru-icon-gallery-row-label">{row.label}</h3>
              <div className="koru-icon-gallery-grid">
                {row.items.map((item) => (
                  <div
                    key={`${row.label}-${item.name}`}
                    className="koru-icon-gallery-tile"
                    title={`${item.name} · ${item.animation} · ${item.trigger}`}
                  >
                    <AnimatedIcon
                      name={item.name}
                      size={32}
                      animation={item.animation}
                      trigger={item.trigger}
                      fill={item.fill}
                      className="koru-icon-gallery-tile-icon"
                    />
                    <span className="koru-icon-gallery-tile-name">{item.name}</span>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default IconGallery;
