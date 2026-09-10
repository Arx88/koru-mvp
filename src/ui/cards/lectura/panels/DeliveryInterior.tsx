/**
 * DeliveryInterior — card "Ticket de seguimiento" (#p-saved), bind real del
 * block `delivery` (status/carrier/trackingId/estimatedDate/steps).
 *
 * Ticket con carrier + status + estimatedDate reales; los pasos del
 * seguimiento como filas del ticket con estado done REAL del block
 * (check o círculo). El código de barras es decorativo (barras), el
 * trackingId es el texto REAL debajo. Acción: complete (marca el
 * compromiso como entregado si matchea) + compartir seguimiento
 * (navigator.share/clipboard con el trackingId).
 */
import { Check, BellRing, Share2, Truck } from "lucide-react";
import { useState } from "react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-saved.css";

type DeliveryBlock = Extract<UiBlock, { type: "delivery" }>;
type Step = NonNullable<DeliveryBlock["steps"]>[number];

const BAR_HEIGHTS = [12, 22, 8, 28, 16, 24, 10, 30, 14, 20, 26, 8, 18, 28, 12, 22, 16, 30, 10, 24];

export function DeliveryInterior({ block, onClose, onSave }: LecturaInteriorProps<DeliveryBlock>) {
  const steps = block.steps ?? [];
  // "Ya llegó" local (marca el último paso) + copiar tracking con feedback.
  const [arrived, setArrived] = useState(false);
  const [copiedTrack, setCopiedTrack] = useState(false);
  const doneCount = steps.filter((s) => s.done).length + (arrived ? 1 : 0);
  const allDone = steps.length > 0 && doneCount >= steps.length;

  const shareTracking = async () => {
    const text = `Seguimiento ${block.carrier ?? "del envío"}: ${block.trackingId ?? "sin código"}${block.estimatedDate ? ` · llega ${block.estimatedDate}` : ""}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Seguimiento", text });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // cancelado
    }
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`Envío ${block.carrier ?? ""}`.trim(), block.trackingId) : undefined}
      chip={{ label: "Envío", background: "linear-gradient(135deg,#4BDD8C,#22B35F)" }}
      ariaLabel={block.title ?? "Seguimiento del envío"}
    >
      <div id="p-saved" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--mint-ink)",
                marginBottom: "5px",
              }}
            >
              {block.carrier ?? "Tu envío"} · {block.status}
            </small>
            {block.estimatedDate ? `Llega ${block.estimatedDate}` : "En camino"}
            <br />
            {steps.length ? `${doneCount} de ${steps.length} pasos` : "seguimiento activo"}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {block.title ?? "El seguimiento del envío, como comprobante — sin pasos extra."}
          </p>
        </div>

        <div className="tkk-hero rv">
          <span className="cutl" />
          <span className="cutr" />
          <div className="tkk-top">
            <div className="ok">
              <Ic i={allDone ? Check : Truck} className="ic" />
            </div>
            <div className="tq">{block.status}</div>
            <div className="ts">
              {block.carrier ?? "Carrier"}
              {block.estimatedDate ? ` · llega ${block.estimatedDate}` : ""}
            </div>
          </div>
          <span className="tkk-stamp">{allDone ? "ENTREGADO" : block.status.toUpperCase()}</span>

          <div className="tkk-lines">
            {steps.map((s: Step, i) => (
              <div className={`trow${i === steps.length - 1 ? " total" : ""}`} key={`step_${i}_${s.label}`}>
                <span className="tn">
                  {s.done ? "✓ " : "○ "}
                  {s.label}
                </span>
                <span className="dots" />
                <span className="tv">{s.done ? "LISTO" : "PENDIENTE"}</span>
              </div>
            ))}
            <div className="trow total">
              <span className="tn">Estado</span>
              <span className="dots" />
              <span className="tv">{allDone ? "ENTREGADO" : "EN CAMINO"}</span>
            </div>
          </div>

          <div className="tkk-code">
            <div className="bars" aria-hidden="true">
              {BAR_HEIGHTS.map((h, i) => (
                <i key={`bar_${i}`} style={{ height: `${h}px` }} />
              ))}
            </div>
            <div className="cn">{block.trackingId ?? "SIN CÓDIGO"}</div>
          </div>
        </div>

        <div className="tkk-note rv">
          <Ic i={BellRing} className="ic" />
          <p>
            {allDone
              ? "Este envío ya llegó — te dejo el ticket como comprobante por si lo necesitás."
              : `Te aviso cuando cambie el estado${block.estimatedDate ? ` — estimado ${block.estimatedDate}` : ""}. El código de seguimiento no cambia.`}
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            aria-pressed={arrived}
            onClick={() => {
              const next = !arrived;
              setArrived(next);
              if (next) dispatchCardAction("complete", block);
            }}
          >
            <Ic i={Check} className="ic" />
            {arrived ? "Recibido — pedido cerrado" : allDone ? "Ya lo recibí" : "Marcar como llegó"}
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-pressed={copiedTrack}
            onClick={() => {
              if (block.trackingId) {
                setCopiedTrack(true);
                try {
                  void navigator.clipboard?.writeText(block.trackingId);
                } catch {
                  /* clipboard best-effort */
                }
                setTimeout(() => setCopiedTrack(false), 1600);
              } else {
                void shareTracking();
              }
            }}
          >
            <Ic i={copiedTrack ? Check : Share2} className="ic" />
            {copiedTrack
              ? `Copiado: ${block.trackingId}`
              : block.trackingId
                ? "Copiar código de seguimiento"
                : "Compartir seguimiento"}
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
