/**
 * InfoInterior — card informe (#p-info), bind real del block `deliverable`
 * (status/kicker/title/description/metrics/summary/sections/sources).
 *
 * El informe completo se arma con datos REALES: kicker+topic en la pestaña
 * superior, título y bajada del block, la primera métrica como número
 * gigante (rep-count), el resto como datasheet, y cada section con su
 * kind real (text → párrafos, bullets → cláusulas numeradas, timeline →
 * hitos, grid → barras comparativas, rows → datasheet). El tiempo de
 * lectura se DERIVA del contenido real (palabras ÷ 200 ppm). status
 * "working" muestra el progreso y phaseLabel reales. Las sources cierran
 * como notas al pie con su dominio.
 */
import {
  Sun,
  Banknote,
  BadgeCheck,
  Download,
  CircleHelp,
  Sparkles,
  ListOrdered,
  Clock,
  BarChart3,
  Table2,
  FileText,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-info.css";

type InfoBlock = Extract<UiBlock, { type: "deliverable" }>;
type Section = NonNullable<InfoBlock["sections"]>[number];
type Metric = NonNullable<InfoBlock["metrics"]>[number];

const SECTION_ICONS: Array<{ re: RegExp; Icon: LucideIcon }> = [
  { re: /cost|precio|econ|dinero|presupuesto|€|\$/i, Icon: Banknote },
  { re: /sol|radiac|energ|clima|producc/i, Icon: Sun },
  { re: /trampa|ojo|cuidado|alerta|riesgo/i, Icon: AlertTriangle },
  { re: /paso|paso|crono|timeline|hito/i, Icon: ListOrdered },
  { re: /compar|versus|vs|ranking|ranking/i, Icon: BarChart3 },
  { re: /tabla|datasheet|spec|detalle/i, Icon: Table2 },
];

function sectionIcon(s: Section): LucideIcon {
  return SECTION_ICONS.find((k) => k.re.test(s.title))?.Icon ?? FileText;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** Tiempo de lectura derivado del contenido real (200 ppm). */
function readingMinutes(block: InfoBlock): number {
  const words = [
    ...(block.description?.split(/\s+/) ?? []),
    ...(block.summary?.split(/\s+/) ?? []),
    ...(block.sections ?? []).flatMap((s) => [
      ...(s.paragraphs ?? []).flatMap((p) => p.split(/\s+/)),
      ...(s.bullets ?? []).flatMap((b) => b.split(/\s+/)),
      ...(s.items ?? []).flatMap((it) => `${it.title} ${it.subtitle ?? ""}`.split(/\s+/)),
    ]),
  ].filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function SectionView({ s }: { s: Section }) {
  const Icon = sectionIcon(s);

  if (s.kind === "text") {
    return (
      <div className="rep-chart rv" style={{ marginTop: "12px" }}>
        <h3>
          <Ic i={Icon} className="ic" />
          {s.title}
        </h3>
        {(s.paragraphs ?? []).map((p, i) => (
          <p
            key={`p_${i}`}
            style={{ font: "500 12.5px/1.65 var(--sans)", color: "var(--ink-soft)", margin: "8px 0" }}
          >
            {p}
          </p>
        ))}
      </div>
    );
  }

  if (s.kind === "bullets") {
    return (
      <div className="rv" style={{ marginTop: "14px" }}>
        <h3 style={{ font: "800 15px var(--disp)", marginBottom: "9px", display: "flex", gap: "8px", alignItems: "center" }}>
          <Ic i={Icon} className="ic" style={{ fontSize: 16, color: "var(--honey-ink)" }} />
          {s.title}
        </h3>
        <div className="rep-traps">
          {(s.bullets ?? []).map((b, i) => (
            <div className="trap" key={`trap_${i}`}>
              <span className="tn">{ROMAN[i] ?? i + 1}</span>
              <div>
                {s.kicker && i === 0 && <h5>{s.kicker}</h5>}
                <p>{b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (s.kind === "timeline") {
    return (
      <div className="it-card rv" style={{ marginTop: "12px" }}>
        <h3 style={{ font: "800 14px var(--disp)", marginBottom: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
          <Ic i={Icon} className="ic" style={{ fontSize: 16, color: "var(--honey-ink)" }} />
          {s.title}
        </h3>
        {(s.items ?? []).map((it, i) => (
          <div className="mom" key={`tl_${i}`} style={i === 0 ? { borderTop: "0" } : undefined}>
            <span className="mk">
              <b>{i + 1}</b>
              {it.badge ?? ""}
            </span>
            <div className="mc">
              <span className="t">
                <Ic i={Clock} className="ic" />
                {it.title}
              </span>
              {it.subtitle && <p>{it.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (s.kind === "grid") {
    const items = s.items ?? [];
    const max = items.reduce((m, it) => {
      const n = parseInt(it.badge ?? "", 10);
      return Number.isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return (
      <div className="rep-chart rv" style={{ marginTop: "12px" }}>
        <h3>
          <Ic i={Icon} className="ic" />
          {s.title}
        </h3>
        {s.kicker && <div className="cnote">{s.kicker}</div>}
        {items.map((it, i) => {
          const n = parseInt(it.badge ?? "", 10);
          const pct = Number.isNaN(n) || max === 0 ? 0 : Math.round((n / max) * 100);
          return (
            <div className="rrow" key={`grid_${i}`}>
              <div className="rn">{it.title}</div>
              <div className="rtrack">
                <i style={{ width: `${Math.max(pct, 3)}%` }} />
              </div>
              <div className="rval">
                {it.badge ?? ""}
                <small>{it.subtitle ?? ""}</small>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // kind === "rows" → datasheet
  return (
    <div className="rep-sheet rv" style={{ marginTop: "12px" }}>
      <h3>
        <Ic i={Icon} className="ic" />
        {s.title}
      </h3>
      {(s.items ?? []).map((it, i) => (
        <div className="ds-row" key={`row_${i}`}>
          <span className="dn">{it.title}</span>
          <span className="dots"></span>
          <span className="dv">
            {it.subtitle ?? ""}
            {it.badge && <em>{it.badge}</em>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function InfoInterior({ block, onClose, onSave }: LecturaInteriorProps<InfoBlock>) {
  const metrics = block.metrics ?? [];
  const sections = block.sections ?? [];
  const sources = block.sources ?? [];
  const hero = metrics[0];
  const working = block.status === "working";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title, block.topic) : undefined}
      chip={{ label: block.kicker || "Informe", background: "linear-gradient(135deg,#8B6DFF,#6D52F8)" }}
      ariaLabel={block.title}
    >
      <div id="p-info" className="lcr-panel">
        <div className="rep-head rv">
          <div className="rep-meta">
            <span>
              {block.kicker || "Informe"} {block.topic ? <b>· {block.topic}</b> : null}
            </span>
            <span>{readingMinutes(block)} min de lectura</span>
          </div>
          <h1>
            {block.title.split(" ").slice(0, 2).join(" ")}
            <br />
            {block.title.split(" ").slice(2).join(" ") || ""}
          </h1>
          {block.description && <p className="rep-lede">{block.description}</p>}
        </div>

        {working && (
          <div className="rep-count rv" aria-label={`Progreso ${block.progress ?? 0}%`}>
            <span className="rc-label">{block.phaseLabel ?? "Armando tu informe…"}</span>
            <div
              style={{
                height: "10px",
                borderRadius: "6px",
                background: "var(--paper2)",
                overflow: "hidden",
                marginTop: "10px",
              }}
            >
              <i
                style={{
                  display: "block",
                  height: "100%",
                  width: `${Math.min(block.progress ?? 0, 100)}%`,
                  background: "linear-gradient(90deg,#8B6DFF,#6D52F8)",
                  borderRadius: "6px",
                  transition: "width .4s var(--ease)",
                }}
              />
            </div>
            <div className="rc-sub" style={{ marginTop: "6px" }}>
              {Math.min(block.progress ?? 0, 100)}% listo
            </div>
          </div>
        )}

        {hero && !working && (
          <div className="rep-count rv">
            <span className="rc-label">{hero.label}</span>
            <div className="rc-big">
              {hero.value.split(" ")[0]}
              <small>{hero.value.includes(" ") ? hero.value.split(" ").slice(1).join(" ") : ""}</small>
            </div>
            {block.summary && <div className="rc-sub">{block.summary.slice(0, 120)}{block.summary.length > 120 ? "…" : ""}</div>}
            {metrics.length > 1 && (
              <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #C9D8F2" }}>
                {metrics.slice(1).map((m) => (
                  <div className="ds-row" key={`metric_${m.label}`}>
                    <span className="dn">{m.label}</span>
                    <span className="dots"></span>
                    <span className="dv">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sections.map((s, i) => (
          <SectionView s={s} key={`sec_${i}_${s.title}`} />
        ))}

        {sources.length > 0 && (
          <div className="rep-foot rv">
            <div className="fk">
              <Ic i={BadgeCheck} className="ic" />
              Fuentes verificadas de este informe
            </div>
            {sources.map((src, i) => (
              <div className="fnote" key={`fn_${i}`}>
                <b>{i + 1}</b>
                <span>
                  {src.domain} — {src.title}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={working}
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: `${block.kicker || "Informe"}: ${block.title}`,
                dueHint: block.topic ?? "guardado en tu historial",
              });
              onClose();
            }}
          >
            <Ic i={working ? Sparkles : Download} className="ic" />
            {working ? "Se está armando…" : "Guardar informe"}
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={CircleHelp} className="ic" />
            Preguntarme más
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
