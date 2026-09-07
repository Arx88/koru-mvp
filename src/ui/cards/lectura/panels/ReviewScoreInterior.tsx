/**
 * ReviewScoreInterior — card "Qué dice la gente" (#p-rev), bind real del
 * block `review_score` (items: {emoji, score, label, color} + title +
 * buttonLabel).
 *
 * Cada item es un ASPECTO con su score real: barra con ancho = score
 * (parseado, escala % o 0-10), color del block. Split aman/critican
 * DERIVADO del score (≥70 aman · <40 critican — umbral explícito, no
 * inventado). Promedio y citas NO están en el domain → no se renderizan.
 * Acción primaria con buttonLabel real.
 */
import { ThumbsUp, ThumbsDown, Star, ShoppingCart, MessageSquareQuote, Check, TriangleAlert } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-rev.css";

type RevBlock = Extract<UiBlock, { type: "review_score" }>;
type Aspect = NonNullable<RevBlock["items"]>[number];

/** "71%" | "4,6" | "8.7" | 71 → {n, pct} (escala % o 0-10) */
function parseScore(score: string): { n: string; pct: number } | null {
  const cleaned = score.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  const pct = n > 10 ? Math.min(100, n) : Math.min(100, n * 10);
  return { n: score, pct };
}

export function ReviewScoreInterior({ block, onClose, onSave }: LecturaInteriorProps<RevBlock>) {
  const aspects = block.items ?? [];
  const parsed = aspects.map((a) => parseScore(a.score));
  const loved = aspects.filter((_, i) => (parsed[i]?.pct ?? 0) >= 70);
  const criticized = aspects.filter((_, i) => (parsed[i]?.pct ?? 50) < 40);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Reputación", aspects[0]?.label) : undefined}
      chip={{ label: "Reputación", background: "linear-gradient(135deg,#c4b5fd,#8b5cf6)" }}
      ariaLabel={block.title || "Reputación"}
    >
      <div id="p-rev" className="lcr-panel">
        <div className="rh-head rv">
          <h1>
            <small>{aspects.length} aspectos puntuados</small>
            {block.title || "Qué dice la gente"}
          </h1>
          <p>
            {aspects.length
              ? "Los puntajes por aspecto vienen del análisis de reseñas — la barra es el score real."
              : "Todavía sin aspectos puntuados."}
          </p>
        </div>

        <div className="rh-hist rv">
          <div className="rh-top">
            <div className="rh-avg">
              <b>{parsed[0]?.n ?? "—"}</b>
              <div className="st">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ic key={`st_${i}`} i={Star} className={`ic${(parsed[0]?.pct ?? 0) < (i + 1) * 20 ? " off" : ""}`} />
                ))}
              </div>
            </div>
            <div className="rh-sum">
              <span className="pct">
                <Ic i={ThumbsUp} className="ic" style={{ fontSize: "12px" }} />
                {parsed[0] ? `${aspects[0].label}: ${aspects[0].score}` : "tu reseña"}
              </span>
              <br />
              {aspects.length} aspectos de la reputación, puntuados uno por uno.
            </div>
          </div>
          <div className="hbars">
            {aspects.map((a, i) => {
              const p = parsed[i];
              return (
                <div className={`hb${(p?.pct ?? 0) < 50 ? " dim" : ""}`} key={`hb_${i}_${a.label}`}>
                  <span className="hs">
                    {a.emoji} {a.label}
                  </span>
                  <div className="htrack">
                    <i style={{ width: `${p?.pct ?? 0}%`, background: a.color || undefined }} />
                  </div>
                  <span className="hn">{a.score}</span>
                </div>
              );
            })}
          </div>
        </div>

        {(loved.length > 0 || criticized.length > 0) && (
          <div className="rh-split rv">
            <div className="rs-col" style={{ background: "var(--mint-soft)", border: "1px solid #c9edda" }}>
              <h4 style={{ color: "var(--mint-ink)" }}>Lo que más valoran</h4>
              {loved.map((a, i) => (
                <li key={`love_${i}_${a.label}`}>
                  <Ic i={Check} className="ic" style={{ color: "var(--mint-ink)" }} />
                  <span>
                    {a.emoji} {a.label} — {a.score}
                  </span>
                </li>
              ))}
            </div>
            <div className="rs-col" style={{ background: "#fdecee", border: "1px solid #f7ccd4" }}>
              <h4 style={{ color: "var(--rose-ink)" }}>Lo que se critica</h4>
              {criticized.map((a, i) => (
                <li key={`crit_${i}_${a.label}`}>
                  <Ic i={TriangleAlert} className="ic" style={{ color: "var(--rose-ink)" }} />
                  <span>
                    {a.emoji} {a.label} — {a.score}
                  </span>
                </li>
              ))}
            </div>
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn primary" onClick={() => (onSave ? onSave(block.title || "Reputación", aspects[0]?.label) : onClose())}>
            <Ic i={ShoppingCart} className="ic" />
            {block.buttonLabel || "Guardar reseña"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            <Ic i={MessageSquareQuote} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
