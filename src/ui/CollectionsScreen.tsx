import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LifeRecord, LifeRecordKind } from "../domain/types";
import { useKoru } from "./KoruProvider";
import { ConfirmDialog } from "./ConfirmDialog";

// Mis Colecciones — la promesa "Listo, guardado en Sitios de IA" cierra acá:
// TODO lo guardado, agrupado por colección, navegable en un tap. Misma
// estética Stitch del roadmap (fondo lila, magical-cards). Los enlaces abren
// en pestaña nueva; el resto muestra su valor/nota.
//
// 🔴 FIX UX v2: se renderiza via createPortal en document.body para garantizar
// pantalla completa (z-index superior al chat) + backdrop oscuro detrás.
// 🔴 FIX UX v2: las filas son TAPPABLE — si el record tiene sourceBlock, reabre
// el detail screen original; si no, abre un editor inline. Long-press / botón
// more_vert abre menú con Editar / Eliminar.
//
// 🔴 FIX UX v3 (audit):
//  • Iconos con color de acento por kind (gradient tile, icono blanco).
//  • Search bar sticky (filtra por título, notas, tags; case-insensitive).
//  • FAB "+" (violet→pink gradient, koru-breathe, safe-area-aware).
//  • "Ver N más" pagination per-group (no global, no silent slice).
//  • Menú more_vert via portal (no clipping por overflow:hidden del card).
//  • Notes con markdown (mismo renderer que CreateScreen).
//  • Tags como chips bajo el título.

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

const MODULE_CLASSES = ["module-challenges", "module-core", "module-nutrition", "module-morning", "module-habits"];

const COLLECTION_ICONS: Array<[RegExp, string]> = [
  [/\bia\b|inteligencia/i, "smart_toy"],
  [/video/i, "play_circle"],
  [/receta/i, "restaurant"],
  [/dev|herramienta/i, "terminal"],
  [/compra/i, "shopping_bag"],
  [/noticia/i, "newspaper"],
  [/lectura/i, "menu_book"],
  [/m[uú]sica/i, "music_note"],
  [/viaje/i, "flight"],
  [/enlace/i, "link"],
];

function collectionIcon(name: string): string {
  for (const [pattern, icon] of COLLECTION_ICONS) {
    if (pattern.test(name)) return icon;
  }
  return "bookmark";
}

// 🔴 FIX v3 #1: cada kind tiene su color de acento + ícono (igual que CreateScreen).
type RecordVisual = { icon: string; accent: string };

const RECORD_VISUALS: Partial<Record<LifeRecordKind, RecordVisual>> = {
  expense: { icon: "payments", accent: "#d97706" },
  shopping_item: { icon: "shopping_cart", accent: "#ec4899" },
  idea: { icon: "sticky_note_2", accent: "#8363f9" },
  tool_link: { icon: "link", accent: "#3b82f6" },
  recommendation: { icon: "restaurant", accent: "#059669" },
  decision: { icon: "psychology_alt", accent: "#8127cf" },
  birthday: { icon: "cake", accent: "#ec4899" },
};

const DEFAULT_VISUAL: RecordVisual = { icon: "bookmark", accent: "#8363f9" };

function recordVisual(record: LifeRecord): RecordVisual {
  // Si el record tiene URL pero NO es tool_link, igualmente usamos el visual
  // del kind (no forzamos azul). tool_link ya mapea a azul/link por sí solo.
  return RECORD_VISUALS[record.kind] ?? DEFAULT_VISUAL;
}

function iconTileStyle(accent: string): CSSProperties {
  // Gradient con el accent; icono blanco (definido en CSS .koru-collection-icon-tile).
  return {
    background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
  };
}

// ---------------------------------------------------------------------------
// Markdown helpers (regex-based, sin deps externos) — mismos que CreateScreen.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s: string): string {
  // s ya está escapado
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

function renderMarkdown(text: string): string {
  if (!text.trim()) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) {
      out.push(`<p>${para.map((p) => inlineMd(escapeHtml(p))).join("<br />")}</p>`);
      para = [];
    }
  };
  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      flushPara();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineMd(escapeHtml(listMatch[1]))}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    para.push(line);
  }
  flushPara();
  if (inList) out.push("</ul>");
  return out.join("");
}

// 🔴 FIX v3 #6: si la nota tiene marcadores markdown, renderiza como HTML.
function hasMarkdown(text: string): boolean {
  return /(\*\*|\*|^\s*-\s|\[[^\]]+\]\([^)]+\))/m.test(text);
}

// Limpieza del input de búsqueda: case-insensitive, trim.
function matchesQuery(record: LifeRecord, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (record.title.toLowerCase().includes(needle)) return true;
  if (record.notes && record.notes.toLowerCase().includes(needle)) return true;
  if (record.tags && record.tags.some((t) => t.toLowerCase().includes(needle))) return true;
  return false;
}

const PAGE_SIZE = 5;

export function CollectionsScreen({
  focusCollection,
  onClose,
  onCreate,
}: {
  /** Colección a mostrar primero (la recién usada en "guardado en X"). */
  focusCollection?: string;
  onClose: () => void;
  /** 🔴 FIX v3 #3: callback del FAB "+". Si no se pasa, no se renderiza. */
  onCreate?: () => void;
}) {
  const { records, deleteRecord, reopenRecord, updateRecord } = useKoru();
  // 🔴 FIX v3 #5: el menú ahora guarda el rect del botón ancla (para portal fixed).
  const [menuFor, setMenuFor] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [editing, setEditing] = useState<LifeRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LifeRecord | null>(null);
  // 🔴 FIX v3 #2: estado del search bar.
  const [query, setQuery] = useState("");
  // 🔴 FIX v3 #4: expansión per-group (no global). Set de nombres de colección.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Cerrar el menú popover si se scrollea el contenedor (sino queda flotando en Y viejo).
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuFor(null);
        setEditing(null);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Cerrar el popover ante cualquier scroll/resize del viewport.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    const el = scrollRef.current;
    el?.addEventListener("scroll", close);
    window.addEventListener("resize", close);
    return () => {
      el?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [menuFor]);

  const filteredRecords = useMemo(() => {
    const q = query.trim();
    if (!q) return records;
    return records.filter((r) => matchesQuery(r, q));
  }, [records, query]);

  const groups = useMemo(() => {
    const map = new Map<string, LifeRecord[]>();
    for (const record of filteredRecords) {
      const key = (record.collection ?? "").trim() || "Guardados";
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    }
    const entries = [...map.entries()].map(([name, items]) => ({
      name,
      items: [...items].reverse(), // lo más nuevo primero
    }));
    // La colección enfocada va primero; el resto por tamaño.
    entries.sort((a, b) => {
      if (focusCollection) {
        if (a.name === focusCollection) return -1;
        if (b.name === focusCollection) return 1;
      }
      return b.items.length - a.items.length;
    });
    return entries;
  }, [filteredRecords, focusCollection]);

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const totalFiltered = filteredRecords.length;

  return createPortal(
    <div className="koru-roadmap koru-collections-overlay" role="dialog" aria-label="Mis colecciones">
      <div className="koru-roadmap-screen koru-collections-screen" ref={scrollRef}>
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        <button type="button" aria-label="Volver" className="koru-roadmap-back" onClick={onClose}>
          <Mat>arrow_back_ios_new</Mat>
        </button>

        <div className="koru-roadmap-header">
          <h1 className="koru-roadmap-title">Mis Colecciones</h1>
          <p className="koru-roadmap-subtitle">
            {records.length ? `${records.length} cosas guardadas, siempre a mano` : "Todavía no guardaste nada"}
          </p>
        </div>

        {/* 🔴 FIX v3 #2: search bar sticky */}
        <div className="koru-collection-search" role="search">
          <Mat className="koru-collection-search-icon">search</Mat>
          <input
            type="search"
            inputMode="search"
            className="koru-collection-search-input"
            placeholder="Buscar por título, nota o tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en colecciones"
          />
          {query ? (
            <button
              type="button"
              className="koru-collection-search-clear"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery("")}
            >
              <Mat>close</Mat>
            </button>
          ) : null}
          <span className="koru-collection-search-count" aria-live="polite">
            {query ? `${totalFiltered} resultado${totalFiltered === 1 ? "" : "s"}` : `${totalFiltered}`}
          </span>
        </div>

        <div className="koru-roadmap-modules">
          {groups.length === 0 && (
            <div className="koru-magical-card module-challenges">
              <p className="koru-collections-empty">
                {query.trim()
                  ? "Nada coincide con tu búsqueda. Probá con otra palabra."
                  : "Decime \"guardame este enlace\" o \"anotá esto\" y lo vas a encontrar acá, ordenado solo."}
              </p>
            </div>
          )}

          {groups.map((group, idx) => {
            const isExpanded = expandedGroups.has(group.name);
            const visibleItems = isExpanded ? group.items : group.items.slice(0, PAGE_SIZE);
            const hiddenCount = group.items.length - visibleItems.length;

            return (
              <div key={group.name} className={`koru-magical-card ${MODULE_CLASSES[idx % MODULE_CLASSES.length]}`}>
                <div className="koru-module-head">
                  <div className="koru-module-id">
                    <div className="koru-module-icon">
                      <Mat>{collectionIcon(group.name)}</Mat>
                    </div>
                    <div>
                      <h3 className="koru-module-title">{group.name}</h3>
                      <p className="koru-module-kicker">
                        {group.items.length} {group.items.length === 1 ? "GUARDADO" : "GUARDADOS"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="koru-challenge-list">
                  {visibleItems.map((record) => {
                    const visual = recordVisual(record);
                    const tileStyle = iconTileStyle(visual.accent);
                    return record.url ? (
                      <a
                        key={record.id}
                        className="koru-challenge-row koru-collection-link"
                        href={record.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div className="koru-challenge-lock koru-collection-icon-tile" style={tileStyle}>
                          <Mat>{visual.icon}</Mat>
                        </div>
                        <div className="koru-collection-body">
                          <p className="koru-challenge-name">{record.title}</p>
                          {/* 🔴 FIX v3 #7: tags como chips */}
                          {record.tags && record.tags.length > 0 ? (
                            <div className="koru-collection-tags">
                              {record.tags.map((t) => (
                                <span key={t} className="koru-collection-tag">#{t}</span>
                              ))}
                            </div>
                          ) : null}
                          {/* 🔴 FIX v3 #6: markdown para notas */}
                          {record.notes && hasMarkdown(record.notes) ? (
                            <div
                              className="koru-challenge-desc koru-collection-md"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(record.notes) }}
                            />
                          ) : (
                            <p className="koru-challenge-desc">
                              {record.notes || record.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </p>
                          )}
                        </div>
                        <Mat className="koru-collection-open">open_in_new</Mat>
                      </a>
                    ) : (
                      <div
                        key={record.id}
                        className="koru-challenge-row koru-collection-row-tappable"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          // 🔴 FIX: si tiene sourceBlock, reabre el detail screen original
                          if (record.sourceBlock) {
                            reopenRecord(record);
                          } else {
                            setEditing(record);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (record.sourceBlock) reopenRecord(record);
                            else setEditing(record);
                          }
                        }}
                      >
                        <div className="koru-challenge-lock koru-collection-icon-tile" style={tileStyle}>
                          <Mat>{visual.icon}</Mat>
                        </div>
                        <div className="koru-collection-body">
                          <p className="koru-challenge-name">{record.title}</p>
                          {/* 🔴 FIX v3 #7: tags como chips */}
                          {record.tags && record.tags.length > 0 ? (
                            <div className="koru-collection-tags">
                              {record.tags.map((t) => (
                                <span key={t} className="koru-collection-tag">#{t}</span>
                              ))}
                            </div>
                          ) : null}
                          {/* 🔴 FIX v3 #6: markdown si la nota lo pide */}
                          {(record.value && record.value !== record.title) || record.notes ? (
                            record.notes && hasMarkdown(record.notes) ? (
                              <div
                                className="koru-challenge-desc koru-collection-md"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(record.notes) }}
                              />
                            ) : (
                              <p className="koru-challenge-desc">{record.notes || record.value}</p>
                            )
                          ) : null}
                        </div>
                        {/* 🔴 Icono indicador: open_in_full si tiene sourceBlock (reabre), edit si no */}
                        <Mat className="koru-collection-open">
                          {record.sourceBlock ? "open_in_full" : "edit"}
                        </Mat>
                        {/* 🔴 Menú more_vert para Editar / Eliminar */}
                        <button
                          type="button"
                          className="koru-collection-row-menu"
                          aria-label="Más opciones"
                          aria-haspopup="menu"
                          aria-expanded={menuFor?.id === record.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const btn = e.currentTarget;
                            const rect = btn.getBoundingClientRect();
                            setMenuFor((prev) =>
                              prev?.id === record.id ? null : { id: record.id, rect },
                            );
                          }}
                        >
                          <Mat>more_vert</Mat>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* 🔴 FIX v3 #4: "Ver N más" pagination per-group */}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    className="koru-collection-show-more"
                    onClick={() => toggleGroup(group.name)}
                  >
                    Ver {hiddenCount} más
                    <Mat>expand_more</Mat>
                  </button>
                ) : isExpanded && group.items.length > PAGE_SIZE ? (
                  <button
                    type="button"
                    className="koru-collection-show-more"
                    onClick={() => toggleGroup(group.name)}
                  >
                    Ver menos
                    <Mat>expand_less</Mat>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔴 FIX v3 #3: FAB "+" — gradient violet→pink, koru-breathe, safe-area-aware */}
      {onCreate ? (
        <button
          type="button"
          className="koru-collection-fab"
          aria-label="Nuevo registro"
          onClick={onCreate}
        >
          <Mat>add</Mat>
        </button>
      ) : null}

      {/* 🔴 FIX v3 #5: popover via portal (no clipping por overflow:hidden del card) */}
      {menuFor
        ? createPortal(
            <>
              <div
                className="koru-collection-menu-backdrop"
                onClick={() => setMenuFor(null)}
                aria-hidden="true"
              />
              <div
                className="koru-collection-menu-popover koru-collection-menu-popover-portal"
                role="menu"
                style={{
                  position: "fixed",
                  top: `${menuFor.rect.bottom + 4}px`,
                  left: `${Math.max(8, menuFor.rect.left - 140 + menuFor.rect.width)}px`,
                  right: "auto",
                  margin: 0,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rec = filteredRecords.find((r) => r.id === menuFor.id);
                    setMenuFor(null);
                    if (rec) setEditing(rec);
                  }}
                >
                  <Mat>edit</Mat> Editar
                </button>
                <button
                  type="button"
                  className="koru-collection-menu-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rec = filteredRecords.find((r) => r.id === menuFor.id);
                    setMenuFor(null);
                    if (rec) setConfirmDelete(rec);
                  }}
                >
                  <Mat>delete</Mat> Eliminar
                </button>
              </div>
            </>,
            document.body,
          )
        : null}

      {/* 🔴 v2: Editor inline para records sin sourceBlock (notas, listas, gastos creados manualmente) */}
      {editing && (
        <div className="koru-collection-editor" role="dialog" aria-label="Editar registro">
          <div className="koru-collection-editor-content">
            <div className="koru-collection-editor-header">
              <h3>Editar</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Cerrar">
                <Mat>close</Mat>
              </button>
            </div>
            <label className="koru-collection-editor-field">
              <span>Título</span>
              <input
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="koru-collection-editor-field">
              <span>Colección</span>
              <input
                type="text"
                value={editing.collection ?? ""}
                onChange={(e) => setEditing({ ...editing, collection: e.target.value })}
              />
            </label>
            {(editing.notes != null || editing.kind === "idea" || editing.kind === "shopping_item") && (
              <label className="koru-collection-editor-field">
                <span>Notas</span>
                <textarea
                  rows={4}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </label>
            )}
            <div className="koru-collection-editor-actions">
              <button
                type="button"
                className="koru-collection-editor-btn koru-collection-editor-save"
                onClick={() => {
                  updateRecord(editing.id, {
                    title: editing.title,
                    collection: editing.collection,
                    notes: editing.notes,
                  });
                  setEditing(null);
                }}
              >
                <Mat>check</Mat> Guardar
              </button>
              <button
                type="button"
                className="koru-collection-editor-btn koru-collection-editor-delete"
                onClick={() => setConfirmDelete(editing)}
              >
                <Mat>delete</Mat> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 v2: ConfirmDialog custom para eliminar (reemplaza window.confirm) */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="¿Eliminar?"
        message={confirmDelete ? `"${confirmDelete.title}" se va a borrar permanentemente.` : ""}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => {
          if (confirmDelete) {
            deleteRecord(confirmDelete.id);
            if (editing?.id === confirmDelete.id) setEditing(null);
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>,
    document.body,
  );
}

// 🔴 Default export para React.lazy (KoruUnifiedCard carga CollectionsScreen
// bajo demanda cuando el usuario tap "Ver colección").
export default CollectionsScreen;
