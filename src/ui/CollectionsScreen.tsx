import { useEffect, useMemo } from "react";
import type { LifeRecord } from "../domain/types";
import { useKoru } from "./KoruProvider";

// Mis Colecciones — la promesa "Listo, guardado en Sitios de IA" cierra acá:
// TODO lo guardado, agrupado por colección, navegable en un tap. Misma
// estética Stitch del roadmap (fondo lila, magical-cards). Los enlaces abren
// en pestaña nueva; el resto muestra su valor/nota.

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

function recordIcon(record: LifeRecord): string {
  if (record.url) return "link";
  if (record.kind === "expense") return "payments";
  if (record.kind === "shopping_item") return "shopping_cart";
  if (record.kind === "birthday") return "cake";
  if (record.kind === "idea") return "lightbulb";
  if (record.kind === "recommendation") return "thumb_up";
  return "sticky_note_2";
}

export function CollectionsScreen({
  focusCollection,
  onClose,
}: {
  /** Colección a mostrar primero (la recién usada en "guardado en X"). */
  focusCollection?: string;
  onClose: () => void;
}) {
  const { records } = useKoru();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const groups = useMemo(() => {
    const map = new Map<string, LifeRecord[]>();
    for (const record of records) {
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
  }, [records, focusCollection]);

  return (
    <div className="koru-roadmap" role="dialog" aria-label="Mis colecciones">
      <div className="koru-roadmap-screen">
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

        <div className="koru-roadmap-modules">
          {groups.length === 0 && (
            <div className="koru-magical-card module-challenges">
              <p className="koru-collections-empty">
                Decime "guardame este enlace" o "anotá esto" y lo vas a encontrar acá, ordenado solo.
              </p>
            </div>
          )}

          {groups.map((group, idx) => (
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
                {group.items.slice(0, 12).map((record) =>
                  record.url ? (
                    <a
                      key={record.id}
                      className="koru-challenge-row koru-collection-link"
                      href={record.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="koru-challenge-lock">
                        <Mat>{recordIcon(record)}</Mat>
                      </div>
                      <div className="koru-collection-body">
                        <p className="koru-challenge-name">{record.title}</p>
                        <p className="koru-challenge-desc">
                          {record.notes || record.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                        </p>
                      </div>
                      <Mat className="koru-collection-open">open_in_new</Mat>
                    </a>
                  ) : (
                    <div key={record.id} className="koru-challenge-row">
                      <div className="koru-challenge-lock">
                        <Mat>{recordIcon(record)}</Mat>
                      </div>
                      <div className="koru-collection-body">
                        <p className="koru-challenge-name">{record.title}</p>
                        {(record.value && record.value !== record.title) || record.notes ? (
                          <p className="koru-challenge-desc">{record.notes || record.value}</p>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
