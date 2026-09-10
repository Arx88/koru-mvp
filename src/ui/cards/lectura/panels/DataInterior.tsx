/**
 * DataInterior — card "Datos verificados" (#p-data), bind real del block
 * `data_card`: los datos concretos que el extractor validó contra citas
 * literales de fuentes web (precios, specs, cifras, horarios).
 *
 * Es el block MÁS frecuente del chat real (web_search, deep_research,
 * shopping_compare y wikipedia_lookup lo emiten) y hasta ahora su "Ver más"
 * caía al render genérico de secciones de KoruDetailScreen (estética vieja).
 *
 * Todo lo que se muestra viene del block: label, value, detail, quote y
 * fuente por item. Nada se inventa: sin items no se renderiza la card.
 * Acciones: abrir la primera fuente · volver al chat.
 */
import { BadgeCheck, ExternalLink, ArrowLeft } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-data.css";

type DataCardBlock = Extract<UiBlock, { type: "data_card" }>;

type DataItem = NonNullable<DataCardBlock["items"]>[number];

/** Primer item con fuente válida (para el botón "Abrir fuente"). */
function firstSourcedItem(items: DataItem[]): DataItem | undefined {
  return items.find((it) => {
    const url = String(it.sourceUrl ?? "").trim();
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });
}

export function DataInterior({ block, onClose, onSave }: LecturaInteriorProps<DataCardBlock>) {
  const items = (block.items ?? []).filter((it) => it && String(it.label ?? "").trim().length > 0);
  const title = String(block.title ?? "").trim() || "Datos verificados";
  const verified = block.sourceStatus === "verified" || items.some((it) => (it.quote ?? "").trim().length > 0);
  const sourceItem = firstSourcedItem(items);
  const domains = Array.from(
    new Set(items.map((it) => String(it.sourceDomain ?? "").trim()).filter(Boolean)),
  ).slice(0, 4);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, undefined) : undefined}
      chip={{ label: "Datos", background: "linear-gradient(135deg,#4BDD8C,#2FC86E)" }}
      ariaLabel={title}
    >
      <div id="p-data" className="lcr-panel">
        <div className="dt-head rv">
          <h1>
            <small>{verified ? "Datos verificados" : "Datos encontrados"}</small>
            {title.length > 46 ? title.slice(0, 44).trimEnd() + "…" : title}
          </h1>
          <p>
            {verified
              ? "Cada cifra está respaldada por una cita literal de su fuente. Tocá cualquier fila para ver el respaldo."
              : `${items.length} dato${items.length === 1 ? "" : "s"} de lo que encontré en la web.`}
            {domains.length > 0 && (
              <>
                {" "}
                Fuente{domains.length === 1 ? "" : "s"}: {domains.join(" · ")}.
              </>
            )}
          </p>
        </div>

        <div className="dt-list rv">
          {items.map((it, idx) => {
            const quote = String(it.quote ?? "").trim();
            const domain = String(it.sourceDomain ?? "").trim();
            const url = String(it.sourceUrl ?? "").trim();
            const sourceOk = /^https?:\/\//i.test(url);
            return (
              <div className="dt-row" key={`dt_${idx}_${String(it.label).slice(0, 24)}`}>
                <div className="dt-line">
                  <span className="dt-label">{String(it.label)}</span>
                  <span className="dt-value">{String(it.value ?? "—")}</span>
                </div>
                {String(it.detail ?? "").trim() && <p className="dt-detail">{String(it.detail).trim()}</p>}
                {(quote || domain) && (
                  <div className="dt-quote">
                    {quote && <p>“{quote}”</p>}
                    {domain && (sourceOk ? (
                      <a
                        className="dt-src"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir fuente ${domain}`}
                      >
                        <Ic i={ExternalLink} className="ic" />
                        {domain}
                      </a>
                    ) : (
                      <span className="dt-src is-plain">
                        <Ic i={BadgeCheck} className="ic" />
                        {domain}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="actions">
          {sourceItem ? (
            <a
              className="btn primary"
              href={String(sourceItem.sourceUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Ic i={ExternalLink} className="ic" />
              Abrir la fuente
            </a>
          ) : (
            <button type="button" className="btn primary" onClick={() => onClose()}>
              <Ic i={BadgeCheck} className="ic" />
              Listo, entendido
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={ArrowLeft} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
