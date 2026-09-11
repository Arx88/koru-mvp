/**
 * UniversalInterior (#p-univ) — el interior Lectura Visual de respaldo.
 *
 * Cubre los tipos de baja frecuencia que no tienen (todavía) un interior a
 * medida — decision_support, travel_planner, wellbeing, activity_tracker,
 * urgent_now, exercise_plan — y a futuro cualquier tipo nuevo que se
 * registre acá: su "Ver más" nunca más cae al render genérico Kimi oscuro.
 *
 * Renderiza el `detail` que presentation.ts construye para el block
 * (secciones text/tiles/rows/chips/timeline/scroller/sources) con el
 * lenguaje visual de Lectura. Los toggles de filas/steps (plan_step,
 * shopping_item, checklist_item) despachan la misma acción que el render
 * viejo — cero pérdida de función.
 */
import {
  FileText,
  LayoutGrid,
  ListChecks,
  CalendarDays,
  Route,
  Link2,
  ArrowLeft,
  CheckCheck,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import type { Detail, DetailSection } from "../../unified/presentation";
import "./p-univ.css";

export function UniversalInterior({ block, detail, onClose, onSave }: LecturaInteriorProps) {
  const sections = (detail?.sections ?? []).filter(Boolean);
  const title = String(detail?.title ?? blockTitle(block) ?? "Detalle").trim();
  const subtitle = detail?.subtitle?.trim();

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, subtitle) : undefined}
      chip={{ label: "Detalle", background: "linear-gradient(135deg,#8B6DFF,#6D52F8)" }}
      ariaLabel={title}
    >
      <div id="p-univ" className="lcr-panel">
        <div className="un-head rv">
          <h1>
            <small>Detalle</small>
            {title.length > 46 ? title.slice(0, 44).trimEnd() + "…" : title}
          </h1>
          {subtitle && <p>{subtitle.length > 90 ? subtitle.slice(0, 88).trimEnd() + "…" : subtitle}</p>}
        </div>

        {sections.map((sec, i) => (
          <SectionBlock key={`un_${i}`} section={sec} index={i} block={block} />
        ))}

        {sections.length === 0 && (
          <div className="un-empty rv">
            <Ic i={FileText} className="ic" />
            <p>Esta card no trae secciones extendidas — lo esencial ya está en el chat.</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => (onSave ? onSave(title, subtitle) : onClose())}
          >
            <Ic i={Bookmark} className="ic" />
            Guardar
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

/** Título razonable del block para tipos sin detail. */
function blockTitle(block: UiBlock): string | undefined {
  const b = block as { title?: unknown; destination?: unknown; headline?: unknown };
  for (const key of ["title", "destination", "headline"]) {
    const v = b[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function SectionBlock({ section, index, block }: { section: DetailSection; index: number; block: UiBlock }) {
  const accent = section.accent?.color ?? "#6D52F8";
  const head = (
    <div className="un-sub" style={{ color: accent }}>
      <span className="dot" style={{ background: accent }} aria-hidden="true" />
      {String(section.title ?? "")}
    </div>
  );

  switch (section.kind) {
    case "text":
      return (
        <div className="un-card rv" style={{ borderColor: `${accent}33` }}>
          {section.title && head}
          <p className="un-text">{String(section.body ?? "")}</p>
        </div>
      );

    case "tiles":
      return (
        <div className="un-block rv">
          {section.title && head}
          <div className="un-tiles">
            {section.tiles.map((t, i) => (
              <div key={`ut_${index}_${i}`} className="un-tile">
                <span className="lbl">{String(t.label ?? "")}</span>
                <b className="val" style={{ color: t.color ?? "var(--ink)" }}>
                  {String(t.value ?? "—")}
                </b>
              </div>
            ))}
          </div>
        </div>
      );

    case "rows":
      return (
        <div className="un-block rv">
          {section.title && head}
          <div className="un-rows">
            {section.rows.map((r, i) => {
              const tappable = Boolean(r.toggle);
              const cls = `un-row${tappable ? " tap" : ""}${r.badgeTone === "urgent" ? " urgent" : ""}`;
              const onRowClick = r.toggle
                ? () => {
                    if (r.toggle?.kind === "shopping_item") {
                      dispatchCardAction("toggle_shopping", block, { listId: r.toggle.listId, itemId: r.toggle.itemId });
                    } else if (r.toggle?.kind === "checklist_item") {
                      dispatchCardAction("toggle_checklist", block, { checklistId: r.toggle.checklistId, itemId: r.toggle.itemId });
                    }
                  }
                : undefined;
              const content = (
                <>
                  <div className="rw-t">
                    <b>{String(r.title ?? "")}</b>
                    {r.detail && <span>{String(r.detail)}</span>}
                  </div>
                  <div className="rw-side">
                    {r.meta && <em>{String(r.meta)}</em>}
                    {r.badge && (
                      <span className={`un-badge tone-${r.badgeTone ?? "pending"}`}>
                        {r.badgeTone === "done" && <Ic i={CheckCheck} className="ic" />}
                        {String(r.badge)}
                      </span>
                    )}
                    {tappable && <Ic i={ChevronRight} className="ic" />}
                  </div>
                </>
              );
              return tappable ? (
                <button key={`ur_${index}_${i}`} type="button" className={cls} onClick={onRowClick}>
                  {content}
                </button>
              ) : (
                <div key={`ur_${index}_${i}`} className={cls}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "chips":
    case "calendar": {
      const chipList = (section.kind === "chips" ? section.chips : section.days) ?? [];
      // Chips con texto largo (frases completas, ej. factores de una decisión)
      // se renderizan como filas anchas — pill compacta solo para etiquetas.
      const allLong = chipList.length > 0 && chipList.every((c) => String(c.label ?? "").length > 22);
      return (
        <div className="un-block rv">
          {section.title && head}
          <div className={`un-chips${allLong ? " wide" : ""}`}>
            {chipList.map((c, i) => (
              <span key={`uc_${index}_${i}`} className="un-chip" style={c.color && !allLong ? { color: c.color, borderColor: `${c.color}55` } : undefined}>
                <b>{String(c.label ?? "")}</b>
                {c.sub && <em>{String(c.sub)}</em>}
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "scroller":
      return (
        <div className="un-block rv">
          {section.title && head}
          <div className="un-scroll">
            {section.cards.map((c, i) => (
              <div key={`us_${index}_${i}`} className="un-scard">
                {c.image && <img src={String(c.image)} alt="" loading="lazy" />}
                <div className="usc-t">
                  <b>{String(c.title ?? "")}</b>
                  {c.detail && <span>{String(c.detail)}</span>}
                  {c.metrics && c.metrics.length > 0 && (
                    <em className="usc-m">{c.metrics.slice(0, 3).join(" · ")}</em>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="un-block rv">
          {section.title && head}
          <div className="un-timeline">
            {section.steps.map((s, i) => {
              const tappable = Boolean(s.toggle);
              const cls = `un-step status-${s.status ?? "pending"}${tappable ? " tap" : ""}`;
              const onStepClick = s.toggle
                ? () => dispatchCardAction("toggle_step", block, { planId: s.toggle?.planId, stepId: s.toggle?.stepId })
                : undefined;
              const inner = (
                <>
                  <span className="node">
                    {s.status === "done" ? <Ic i={CheckCheck} className="ic" /> : String(i + 1)}
                  </span>
                  <div className="stm-t">
                    <b>{String(s.title ?? "")}</b>
                    {s.detail && <span>{String(s.detail)}</span>}
                  </div>
                </>
              );
              return tappable ? (
                <button key={`utm_${index}_${i}`} type="button" className={cls} onClick={onStepClick}>
                  {inner}
                </button>
              ) : (
                <div key={`utm_${index}_${i}`} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "sources":
      return (
        <div className="un-block rv">
          {section.title && head}
          <div className="un-sources">
            {section.sources.map((s, i) => {
              const url = String(s.url ?? "");
              const ok = /^https?:\/\//i.test(url);
              return ok ? (
                <a key={`usrc_${index}_${i}`} className="un-src" href={url} target="_blank" rel="noopener noreferrer">
                  <Ic i={Link2} className="ic" />
                  {String(s.domain ?? s.title ?? "fuente")}
                </a>
              ) : (
                <span key={`usrc_${index}_${i}`} className="un-src is-plain">
                  <Ic i={FileText} className="ic" />
                  {String(s.title ?? "fuente")}
                </span>
              );
            })}
          </div>
        </div>
      );

    // pitch nunca llega acá (live_match/tennis_match tienen interior propio).
    default:
      return null;
  }
}

/** Export auxiliar para registrar con tipos concretos. */
export function universalFor(_block: UiBlock, detail?: Detail): Detail | undefined {
  return detail;
}

/* Iconos referenciados para tree-shaking estable de los usados arriba. */
export const UNIVERSAL_ICONS = { FileText, LayoutGrid, ListChecks, CalendarDays, Route, Link2 };
