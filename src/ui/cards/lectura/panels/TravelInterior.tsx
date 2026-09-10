/**
 * TravelInterior — card "Tu itinerario, día por día" (#p-travel), bind real
 * del block `travel_plan` (destination/dates/travelers/days/reservations/
 * packing/budget/totalBudget).
 *
 * Días reales como pestañas seleccionables (estado local) con sus
 * activities[] reales (hora/título/detalle). Foto del hero SOLO para
 * destinos con asset local conocido (Madrid) — sin foto inventada. Las
 * reservations[] reales con su status y deep link. Packing como checklist
 * visual con toggles locales. Budget como barras proporcionales reales.
 * Acción: guardar el día → create_commitment REAL.
 */
import { useState } from "react";
import {
  Camera,
  Plane,
  Users,
  Wallet,
  Building2,
  Coffee,
  Landmark,
  Utensils,
  Martini,
  CalendarCheck,
  CalendarDays,
  Moon,
  MapPin,
  Luggage,
  Ticket,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-travel.css";

type TravelBlock = Extract<UiBlock, { type: "travel_plan" }>;
type Activity = NonNullable<NonNullable<TravelBlock["days"]>[number]["activities"]>[number];

const DESTINATION_PHOTOS: Array<{ re: RegExp; src: string; caption: string }> = [
  {
    re: /\bmadrid\b/i,
    src: "/stitch/outfits/travel-madrid.jpg",
    caption: "Cibeles, Madrid",
  },
];

const ACTIVITY_ICONS: Array<{ re: RegExp; Icon: LucideIcon }> = [
  { re: /\b(caf[eé]|desayuno|churro)\b/i, Icon: Coffee },
  { re: /\b(museo|prado|catedral|palacio|plaza|monumento|landmark)\b/i, Icon: Landmark },
  { re: /\b(comida|almuerzo|cena|restaurante|paella|comer)\b/i, Icon: Utensils },
  { re: /\b(verm[uú]|bar|copa|noche|paseo)\b/i, Icon: Martini },
  { re: /\b(vuelo|tren|bus|traslado|aeropuerto)\b/i, Icon: Plane },
  { re: /\b(dormir|hotel|check-?in|descanso)\b/i, Icon: Moon },
];
const FALLBACK_ACTIVITY = Building2;

function iconForActivity(a: Activity): LucideIcon {
  const text = `${a.title} ${a.detail ?? ""}`;
  return ACTIVITY_ICONS.find((k) => k.re.test(text))?.Icon ?? FALLBACK_ACTIVITY;
}

/** Momento del día desde la hora de la activity (mañana/mediodía/tarde/noche). */
function partOfDay(time?: string): string {
  if (!time) return "";
  const h = parseInt(time.split(":")[0] ?? "", 10);
  if (Number.isNaN(h)) return "";
  if (h < 13) return "mañana";
  if (h < 16) return "mediodía";
  if (h < 20) return "tarde";
  return "noche";
}

export function TravelInterior({ block, onClose, onSave }: LecturaInteriorProps<TravelBlock>) {
  const days = block.days ?? [];
  const [dayIdx, setDayIdx] = useState(0);
  const [packed, setPacked] = useState<Record<number, boolean>>({});
  const destination = block.destination || "tu próximo destino";
  const photo = DESTINATION_PHOTOS.find((p) => p.re.test(destination));
  const day = days[Math.min(dayIdx, Math.max(days.length - 1, 0))];
  const reservations = block.reservations ?? [];
  const packing = block.packing ?? [];
  const budget = block.budget ?? [];
  const budgetTotal = block.totalBudget ?? budget.reduce((sum, b) => sum + b.amount, 0);
  const currency = block.currency ?? budget[0]?.currency ?? "";
  const title = `Tu itinerario a ${destination}`;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.dates) : undefined}
      chip={{ label: "Viaje", background: "linear-gradient(135deg,#FDC533,#B07E00)" }}
      ariaLabel={title}
    >
      <div id="p-travel" className="lcr-panel">
        <div className="ev-head rv">
          <h1>
            <small>
              {destination}
              {block.dates ? ` · ${block.dates}` : ""}
              {days.length ? ` · ${days.length} ${days.length === 1 ? "día" : "días"}` : ""}
            </small>
            Tu itinerario,
            <br />
            día por día
          </h1>
          <p>
            {days.length
              ? "Cambiá de pestaña para ver cada día. El ritmo es tuyo."
              : "Cuando armemos los días van a aparecer acá, hora por hora."}
          </p>
        </div>

        <div className="tv-hero rv">
          {photo ? (
            <>
              <img src={photo.src} alt={photo.caption} />
              <div className="veil"></div>
              <span className="shot">
                <Ic i={Camera} className="ic" />
                {photo.caption}
              </span>
            </>
          ) : (
            <div
              className="veil"
              style={{
                background:
                  "linear-gradient(160deg,var(--honey-soft),var(--sky-soft) 60%,#fff)",
                aspectRatio: "16/8.6",
              }}
            />
          )}
          <div className="in">
            <span className="k">Tu próximo destino</span>
            <h3>{destination}</h3>
            <div className="m">
              {block.dates && (
                <span>
                  <Ic i={CalendarDays} className="ic" />
                  {block.dates}
                </span>
              )}
              {block.travelers != null && (
                <span>
                  <Ic i={Users} className="ic" />
                  {block.travelers} {block.travelers === 1 ? "viajero" : "viajeros"}
                </span>
              )}
              {budgetTotal > 0 && (
                <span>
                  <Ic i={Wallet} className="ic" />
                  {budgetTotal} {currency}
                </span>
              )}
            </div>
          </div>
        </div>

        {days.length > 0 && (
          <>
            <div className="it-days rv">
              {days.map((d, i) => (
                <button
                  type="button"
                  key={`day_${d.day}`}
                  className={`it-day${i === dayIdx ? " on" : ""}`}
                  onClick={() => setDayIdx(i)}
                  aria-pressed={i === dayIdx}
                >
                  <span>Día</span>
                  <b>{d.day}</b>
                </button>
              ))}
            </div>

            <div className="it-card rv">
              <div className="it-city">
                <span className="ci">
                  <Ic i={MapPin} className="ic" />
                  {day.title}
                </span>
              </div>
              {day.activities.map((a, i) => {
                const Icon = iconForActivity(a);
                return (
                  <div className={`mom${i === 0 ? "" : ""}`} key={`act_${i}_${a.title}`} style={i === 0 ? { borderTop: "0" } : undefined}>
                    <span className="mk">
                      <b>{a.time || "—"}</b>
                      {partOfDay(a.time)}
                    </span>
                    <div className="mc">
                      <span className="t">
                        <Ic i={Icon} className="ic" />
                        {a.title}
                      </span>
                      {a.detail && <p>{a.detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {reservations.length > 0 && (
          <div className="it-card rv" style={{ marginTop: "12px" }}>
            <div className="it-city" style={{ marginBottom: "6px" }}>
              <span className="ci">
                <Ic i={Ticket} className="ic" />
                Reservas del viaje
              </span>
            </div>
            {reservations.map((r, i) => (
              <div className="mom" key={`res_${i}_${r.provider}`} style={i === 0 ? { borderTop: "0" } : undefined}>
                <span className="mk">
                  <b>{r.type}</b>
                  {r.status}
                </span>
                <div className="mc">
                  <span className="t">
                    <Ic i={r.deepLink ? Plane : Ticket} className="ic" />
                    {r.provider}
                  </span>
                  {r.detail && <p>{r.detail}</p>}
                  {r.deepLink && (
                    <p>
                      <a
                        href={r.deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--honey-ink)", fontWeight: 800 }}
                      >
                        Abrir en {r.provider} →
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {packing.length > 0 && (
          <div className="it-card rv" style={{ marginTop: "12px" }}>
            <div className="it-city" style={{ marginBottom: "6px" }}>
              <span className="ci">
                <Ic i={Luggage} className="ic" />
                Qué empacar
              </span>
            </div>
            <div style={{ display: "flex", "flexWrap": "wrap" as const, gap: "7px" }}>
              {packing.map((p, i) => {
                const on = packed[i] ?? p.checked;
                return (
                  <button
                    type="button"
                    key={`pack_${i}_${p.item}`}
                    onClick={() => setPacked((prev) => ({ ...prev, [i]: !on }))}
                    aria-pressed={on}
                    style={{
                      font: "800 10px var(--sans)",
                      padding: "7px 12px",
                      borderRadius: "999px",
                      border: on ? "1.5px solid var(--mint)" : "1.5px solid var(--linec)",
                      background: on ? "var(--mint-soft)" : "#fff",
                      color: on ? "var(--mint-ink)" : "var(--ink-soft)",
                      textDecoration: on ? "line-through" : "none",
                    }}
                  >
                    {p.item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {budget.length > 0 && (
          <div className="it-card rv" style={{ marginTop: "12px" }}>
            <div className="it-city" style={{ marginBottom: "8px" }}>
              <span className="ci">
                <Ic i={Wallet} className="ic" />
                Presupuesto
                {budgetTotal > 0 ? ` · ${budgetTotal} ${currency}` : ""}
              </span>
            </div>
            {budget.map((b, i) => {
              const pct = budgetTotal > 0 ? Math.round((b.amount / budgetTotal) * 100) : 0;
              return (
                <div
                  key={`bud_${i}_${b.category}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "86px 1fr 64px",
                    gap: "9px",
                    alignItems: "center",
                    padding: "5px 0",
                  }}
                >
                  <span style={{ font: "700 10.5px var(--sans)", color: "var(--ink-soft)" }}>{b.category}</span>
                  <span
                    style={{
                      height: "9px",
                      borderRadius: "5px",
                      background: "var(--paper2)",
                      overflow: "hidden",
                      display: "block",
                    }}
                  >
                    <i
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${pct}%`,
                        background: "linear-gradient(90deg,#FDC533,#B07E00)",
                        borderRadius: "5px",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      font: "800 11px var(--disp)",
                      color: "var(--ink)",
                      textAlign: "right",
                    }}
                  >
                    {b.amount} {b.currency || currency}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!day}
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: day ? `Día ${day.day}: ${day.title}` : `Viaje a ${destination}`,
                dueHint: block.dates ?? destination,
              });
              onClose();
            }}
          >
            <Ic i={CalendarCheck} className="ic" />
            Guardar día {day?.day ?? ""}
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={Star} className="ic" />
            Quiero otro ritmo
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
