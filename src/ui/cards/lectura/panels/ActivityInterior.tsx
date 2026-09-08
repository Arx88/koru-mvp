/**
 * ActivityInterior — card "Panorama" (#p-act), bind real del block
 * `activity_group` (title + subtitle + energy + sections con tiles/rows).
 *
 * El vistazo tipo Home Screen en lenguaje Lectura Visual: energía como
 * anillo real (valor/100), cada sección con su tono y tiles como mini
 * fichas label→value, rows como filas con meta. Todo del block.
 */
import { Battery, ChevronRight, ArrowLeft, LayoutGrid } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-act.css";

type ActBlock = Extract<UiBlock, { type: "activity_group" }>;

type Section = NonNullable<ActBlock["sections"]>[number];
type Tile = NonNullable<Section["tiles"]>[number];
type Row = NonNullable<Section["rows"]>[number];

const TONE_COLOR: Record<string, { ink: string; soft: string; line: string }> = {
  green: { ink: "var(--mint-ink)", soft: "var(--mint-soft)", line: "#c9ecdc" },
  blue: { ink: "var(--sky-ink)", soft: "var(--sky-soft)", line: "#ccdcff" },
  amber: { ink: "var(--honey-ink)", soft: "var(--honey-soft)", line: "#f3e2c4" },
  purple: { ink: "var(--violet-ink)", soft: "var(--violet-soft)", line: "#e0d5f8" },
  red: { ink: "var(--rose-ink)", soft: "#fdeef0", line: "#f9d3da" },
  neutral: { ink: "var(--ink-dim)", soft: "var(--paper2)", line: "var(--linec)" },
};

const RING_CIRC = 2 * Math.PI * 44;

export function ActivityInterior({ block, onClose, onSave }: LecturaInteriorProps<ActBlock>) {
  const sections = (block.sections ?? []).filter(Boolean);
  const energy = block.energy;
  const energyPct = energy ? Math.max(0, Math.min(100, Math.round(energy.value))) : null;
  const title = String(block.title ?? "").trim() || "Tu panorama";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.subtitle) : undefined}
      chip={{ label: "Panorama", background: "linear-gradient(135deg,#c4b5fd,#8b5cf6)" }}
      ariaLabel={title}
    >
      <div id="p-act" className="lcr-panel">
        <div className="ac-head rv">
          <h1>
            <small>Panorama</small>
            {title}
          </h1>
          {block.subtitle && <p>{String(block.subtitle)}</p>}
        </div>

        {energy && (
          <div className="ac-energy rv">
            <div className="ac-ring">
              <svg viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="44" fill="none" stroke="#eee8f8" strokeWidth="10" />
                <circle
                  cx="55"
                  cy="55"
                  r="44"
                  fill="none"
                  stroke="url(#acG)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC * (1 - (energyPct ?? 0) / 100)}
                  style={{ transition: "stroke-dashoffset .5s var(--ease)" }}
                />
                <defs>
                  <linearGradient id="acG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f6bd6d" />
                    <stop offset="1" stopColor="#e8714a" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="ac-ring-val">
                <b>{energyPct ?? "—"}</b>
                <span>{String(energy.label ?? "energía")}</span>
              </div>
            </div>
            <div className="ac-energy-txt">
              <div className="fk">
                <Ic i={Battery} className="ic" />
                Cómo venís
              </div>
              <div className="fnm">{energyPct != null ? (energyPct >= 70 ? "Con pilas para rato" : energyPct >= 40 ? "En ritmo de cruce" : "Al limite — andá suave") : "Sin lectura"}</div>
            </div>
          </div>
        )}

        {sections.map((sec, si) => {
          const tone = TONE_COLOR[sec.tone ?? "neutral"] ?? TONE_COLOR.neutral;
          const tiles = (sec.tiles ?? []).filter(Boolean);
          const rows = (sec.rows ?? []).filter(Boolean);
          return (
            <div key={`sec_${si}`} className="ac-sec rv">
              <div className="ac-sec-title" style={{ color: tone.ink }}>
                <span className="dot" style={{ background: tone.ink }} aria-hidden="true" />
                {String(sec.title ?? "Sección")}
              </div>
              {tiles.length > 0 && (
                <div className="ac-tiles">
                  {tiles.map((t: Tile, i) => (
                    <div key={`tl_${si}_${i}`} className={`ac-tile${t.urgent ? " urgent" : ""}`} style={{ borderColor: t.urgent ? "var(--rose-ink)" : undefined }}>
                      <span className="lbl">{String(t.label ?? "")}</span>
                      <b className="val">{String(t.value ?? "—")}</b>
                      {t.detail && <em>{String(t.detail)}</em>}
                    </div>
                  ))}
                </div>
              )}
              {rows.length > 0 && (
                <div className="ac-rows">
                  {rows.map((r: Row, i) => (
                    <div key={`rw_${si}_${i}`} className="ac-row">
                      <div className="rw-t">
                        <b>{String(r.title ?? "")}</b>
                        {r.meta && <span>{String(r.meta)}</span>}
                      </div>
                      {r.actionLabel && (
                        <span className="rw-go">
                          {String(r.actionLabel)}
                          <Ic i={ChevronRight} className="ic" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="ac-empty rv">
            <Ic i={LayoutGrid} className="ic" />
            <p>Sin secciones todavía — cuando haya actividad, aparece acá.</p>
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn primary" onClick={() => onClose()}>
            <Ic i={LayoutGrid} className="ic" />
            Ya lo vi
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={ArrowLeft} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
