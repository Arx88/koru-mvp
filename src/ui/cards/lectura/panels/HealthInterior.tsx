/**
 * HealthInterior — card "Recordatorio de salud" (#p-health), bind real del
 * block `health_reminder`.
 *
 * Medallón con el icon+iconColor+bgColor REALES del block, título y texto
 * del reminder. El domain no trae organizador semanal ni stock del frasco:
 * no se inventan — la card degrada honesta con lo que hay. Acciones
 * legítimas: primary (actionLabel → `complete`, marca el commitment como
 * tomado) y "Posponer 10 min" (`snooze` real del snoozeCommitment).
 */
import { Pill, BellRing, CheckCheck, AlarmClock } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-health.css";

type HealthBlock = Extract<UiBlock, { type: "health_reminder" }>;

export function HealthInterior({ block, onClose, onSave }: LecturaInteriorProps<HealthBlock>) {
  const title = block.title || "Recordatorio de salud";
  const reminder = block.reminder || "Sin detalles del recordatorio.";
  const chipBg = block.bgColor || "#fff";
  const chipColor = block.iconColor || "var(--honey-ink)";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, reminder.slice(0, 60)) : undefined}
      chip={{ label: "Salud", background: "linear-gradient(135deg,#FF9EBE,#FF5A60)" }}
      ariaLabel={title}
    >
      <div id="p-health" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--honey-ink)",
                marginBottom: "5px",
              }}
            >
              {title}
            </small>
            Tu recordatorio
            <br />
            de salud
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {reminder}
          </p>
        </div>

        <div className="po-hero rv">
          <div className="po-top">
            <div className="med">
              <div className="cic2" style={{ background: chipBg }}>
                <Ic i={Pill} className="ic" style={{ color: chipColor }} />
              </div>
              <div>
                <b>{title}</b>
                <small>{reminder}</small>
              </div>
            </div>
          </div>
          <div className="po-dose">
            <div className="dz">
              <Ic i={BellRing} className="ic" style={{ color: "var(--sky-ink)" }} />
              <div>
                <b>Recordatorio activo</b>
                <span>Koru te avisa cuando toque</span>
              </div>
            </div>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={CheckCheck} className="ic" />
            {block.actionLabel || "Ya lo hice"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              dispatchCardAction("snooze", block, { minutes: 10 });
              onClose();
            }}
          >
            <Ic i={AlarmClock} className="ic" />
            Posponer 10 min
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
