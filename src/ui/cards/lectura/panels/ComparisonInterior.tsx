/**
 * ComparisonInterior — card "El duelo" (#p-comp), bind real del block
 * `comparison` (items: comparisonItems + criteria + recommendation).
 *
 * Contendientes REALES del block: score → TU MATCH (mayor score gana),
 * tally derivado de los details con positive. Tabla: una columna por
 * contendiente con sus details (✓/✗ de positive REAL). criteria como
 * chips de lo comparado. La nota es block.recommendation — solo si
 * existe. Foto flat-lay eliminada: el block no trae imágenes (nada
 * random). Añadir al carrito → abre la url REAL del ganador.
 */
import { Trophy, Brain, ShoppingCart, Swords, Check, X, ListFilter, Package } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-comp.css";

type CompBlock = Extract<UiBlock, { type: "comparison" }>;
type Item = CompBlock["items"][number];

const SOFT = ["var(--mint-soft)", "var(--sky-soft)", "var(--paper3)"];
const INK = ["var(--mint-ink)", "var(--sky-ink)", "var(--ink-dim)"];

export function ComparisonInterior({ block, onClose, onSave }: LecturaInteriorProps<CompBlock>) {
  const items = block.items ?? [];
  const criteria = block.criteria ?? [];
  const winner = items.reduce<Item | null>(
    (best, it) => (best == null || (it.score ?? -1) > (best.score ?? -1) ? it : best),
    null,
  );
  const winnerUrl = winner?.url;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Comparativa", winner?.title) : undefined}
      chip={{ label: "Duelo", background: "linear-gradient(135deg,#c4b5fd,#8b5cf6)" }}
      ariaLabel={block.title || "Comparativa"}
    >
      <div id="p-comp" className="lcr-panel">
        <div className="vs-head rv">
          <h1>
            <small>
              {items.length > 1 ? `${items.length} opciones · un ganador` : "Tu comparativa"}
            </small>
            {block.title || "El duelo"}
          </h1>
          <p>
            {criteria.length
              ? `Comparé por ${criteria.slice(0, 4).join(", ")}${criteria.length > 4 ? " y el resto" : ""}.`
              : "Los contendientes y sus puntos reales, lado a lado."}
          </p>
        </div>

        {items.length > 0 && (
          <div className="duel rv">
            <span className="vs-badge">VS</span>
            <div className="duel-sides">
              {items.slice(0, 3).map((it, i) => {
                const details = it.details ?? [];
                const wins = details.filter((d) => d.positive).length;
                const isWin = winner != null && it === winner;
                return (
                  <div className={`dside${isWin ? " win" : ""}`} key={`duel_${i}_${it.title}`}>
                    <div className="dph" style={{ background: SOFT[i % 3] }}>
                      <Ic i={Package} className="ic" style={{ color: INK[i % 3] }} />
                    </div>
                    <div className="dnm">
                      <b>{it.title}</b>
                      {it.vendor ? <small>{it.vendor}</small> : null}
                    </div>
                    {details.length > 0 && (
                      <>
                        <div className="dsc">
                          ganó {wins} de {details.length}
                          {it.price ? ` · ${it.price}` : ""}
                        </div>
                        <div className="tally">
                          {details.map((d, j) => (
                            <i key={`t_${j}`} className={d.positive ? "w" : undefined} />
                          ))}
                        </div>
                      </>
                    )}
                    {it.score != null && (
                      <div className="dsc">
                        score {it.score}
                        {it.price ? ` · ${it.price}` : ""}
                      </div>
                    )}
                    {isWin && (
                      <div className="crown">
                        <Ic i={Trophy} className="ic" style={{ fontSize: "11px" }} />
                        TU MATCH
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {criteria.length > 0 && (
          <div className="vs-note rv" style={{ background: "var(--paper2)", borderColor: "#d9cff2" }}>
            <Ic i={ListFilter} className="ic" />
            <p>
              Criterios de tu comparativa: <b>{criteria.join(" · ")}</b>.
            </p>
          </div>
        )}

        {/* Tabla: filas = details del contendiente más rico; celdas por
            match EXACTO de label (— cuando un item no lo evaluó). */}
        {(() => {
          const richest = items.reduce<Item | null>(
            (best, it) => ((it.details?.length ?? 0) > (best?.details?.length ?? 0) ? it : best),
            null,
          );
          const baseDetails = richest?.details ?? [];
          if (!baseDetails.length || !items.length) return null;
          const findMatch = (it: Item, label: string) => it.details?.find((d) => d.label === label);
          return (
            <div className="vs-table rv">
              <div className="vt-head">
                <span>Criterio</span>
                {items.slice(0, 3).map((it, i) => (
                  <span key={`h_${i}_${it.title}`}>{it.title}</span>
                ))}
              </div>
              {baseDetails.map((d) => (
                <div className="vt-row" key={`row_${d.label}`}>
                  <span className="vt-k">{d.label}</span>
                  {items.slice(0, 3).map((it, j) => {
                    const m = findMatch(it, d.label);
                    return (
                      <span key={`c_${j}_${it.title}`} className={m?.positive ? "best" : undefined}>
                        {m ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {m.positive ? <Ic i={Check} className="ic" style={{ fontSize: 11 }} /> : <Ic i={X} className="ic" style={{ fontSize: 11 }} />}
                            {m.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}
              <div className="vt-row final">
                <span className="vt-k">Veredicto</span>
                {items.slice(0, 3).map((it, j) => (
                  <span key={`v_${j}_${it.title}`} className={winner === it ? "best" : undefined}>
                    {winner === it ? "GANA" : it.price ?? (it.score != null ? `score ${it.score}` : "—")}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {block.recommendation && (
          <div className="vs-note rv">
            <Ic i={Brain} className="ic" />
            <p>{block.recommendation}</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!winnerUrl}
            onClick={() => {
              if (winnerUrl) window.open(winnerUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <Ic i={ShoppingCart} className="ic" />
            {winnerUrl ? `Abrir ${winner?.title ?? "ganador"}` : "Sin enlace del ganador"}
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(block.title || "Comparativa", winner?.title) : onClose())}>
            <Ic i={Swords} className="ic" />
            Guardar duelo
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
