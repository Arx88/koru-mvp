/**
 * RestaurantInterior — card "Parrillas" (#p-rest), bind real del block
 * `restaurant_synthesis` (Google Places enriquecido).
 *
 * Podio desde matches (rating real → escala 10 + estrellas), foto del plato
 * desde matches[0].photos (Places), tips desde logistics/priceLevel/synthesis,
 * reservar dispara el handler REAL "reserve" (abre reserveUrl del provider).
 */
import { Award, Clock, PiggyBank, Radar, Route, Star, Utensils, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-rest.css";

type RestBlock = Extract<UiBlock, { type: "restaurant_synthesis" }>;
type Match = NonNullable<RestBlock["matches"]>[number];

const rate10 = (r?: number) => (r != null ? (r * 2).toFixed(1).replace(".", ",") : "—");
const stars = (r?: number) => (r != null ? Math.max(1, Math.round(r)) : 3);

export function RestaurantInterior({ block, onClose, onSave }: LecturaInteriorProps<RestBlock>) {
  const matches = (block.matches ?? []).slice(0, 3);
  const top = matches[0];
  const others = matches.slice(1, 3);
  const StarIcon: LucideIcon = Star;
  const topPhoto = top?.photos?.[0];
  const topDish = top?.menuHighlights?.[0];
  const logistics = block.logistics;
  const priceTag = top?.priceLevel != null ? "€".repeat(Math.max(1, Math.min(4, top.priceLevel))) : null;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(top ? top.name : (block.title ?? "Restaurantes"), block.query) : undefined}
      chip={{ label: "Dónde comer", background: "linear-gradient(135deg,#FFD75E,#FDC533)" }}
      ariaLabel={block.title ?? block.query ?? "Restaurantes"}
    >
      <div id="p-rest" className="lcr-panel">
        <div className="pod-head rv">
          <h1>
            <small>{block.mood ?? block.query ?? "La opción de hoy"}</small>
            Tres que no fallan, una que ganó
          </h1>
          <p>
            {top?.ratingCount
              ? `Puntaje promedio de ${top.ratingCount.toLocaleString("es")} reseñas reales.`
              : (block.synthesis ?? "Cruzado con tu historial de gustos.")}
          </p>
        </div>

        {top && (
          <div className="pod rv">
            <div className="pod-l1">
              <div className="medal"><span className="mno">Nº</span><b>1</b></div>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{top.name}</div>
                <div className="sc">
                  <b>{rate10(top.rating)}</b>
                  {Array.from({ length: stars(top.rating) }).map((_, i) => <Ic key={i} i={StarIcon} className="ic" />)}
                </div>
                <div className="meta">
                  {[
                    top.distanceFromUser,
                    logistics?.travelTime,
                    top.menuHighlights?.slice(0, 2).map((m) => m.dish).join(" y "),
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="wait">
                <b>{logistics?.reservationTime ?? top.sourcesMentioning}</b>
                <span>{logistics?.reservationTime ? "mesa" : "fuentes"}</span>
              </div>
            </div>
            {others.length > 0 && (
              <div className="pod-others">
                {others.map((m, i) => (
                  <div className="pod-o" key={i}>
                    <div className="rank"><Ic i={Award} className="ic" style={{ fontSize: "13px", color: "#cd9d5e" }} />{i + 2}</div>
                    <div className="nm">{m.name}</div>
                    <div className="sc">{rate10(m.rating)} <small>{m.distanceFromUser ?? ""}</small></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {topPhoto && (
          <div className="dish rv" style={{ marginTop: "14px" }}>
            <div className="dish-ph">
              <img src={topPhoto} alt={topDish?.dish ?? "plato destacado"} />
              <span className="dish-tag"><Ic i={Utensils} className="ic" />el plato de la noche</span>
              <div className="dish-cap">
                <b>{topDish ? `${topDish.dish} · ${top.name}` : top.name}</b>
                <span>{topDish?.price ? `${topDish.price} · recomendado del lugar` : "el favorito del house"}</span>
              </div>
            </div>
          </div>
        )}

        {(logistics?.reservationTime || block.synthesis || priceTag) && (
          <div className="rv" style={{ marginTop: "14px" }}>
            <h3 style={{ font: "800 15px var(--disp)", marginBottom: "9px" }}>Lo que nadie te dice</h3>
            <div className="pod-tips">
              {logistics?.reservationTime && (
                <div className="prow">
                  <div className="pic" style={{ background: "var(--honey-soft)", color: "var(--honey-ink)" }}><Ic i={Clock} className="ic" /></div>
                  <div className="pt"><b>Reservá para las {logistics.reservationTime}</b><span>{logistics.parking ? `${logistics.parking} · ` : ""}horario con mesa libre ahora.</span></div>
                  <span className="chip" style={{ background: "var(--mint-soft)", color: "var(--mint-ink)" }}>TIP</span>
                </div>
              )}
              {priceTag && (
                <div className="prow">
                  <div className="pic" style={{ background: "var(--violet-soft)", color: "var(--violet-ink)" }}><Ic i={PiggyBank} className="ic" /></div>
                  <div className="pt"><b>{top?.name} rinde {priceTag}</b><span>{top?.menuHighlights?.slice(0, 2).map((m) => `${m.dish}${m.price ? ` ${m.price}` : ""}`).join(" · ") ?? "los clásicos no fallan"}</span></div>
                  <span className="chip" style={{ background: "var(--violet-soft)", color: "var(--violet-ink)" }}>{priceTag}</span>
                </div>
              )}
              {block.synthesis && (
                <div className="prow">
                  <div className="pic" style={{ background: "var(--rose-ink)", color: "#fff" }}><Ic i={Radar} className="ic" /></div>
                  <div className="pt"><b>Por qué esta noche</b><span>{block.whyTonight ?? block.synthesis}</span></div>
                  <span className="chip" style={{ background: "#fdecee", color: "var(--rose-ink)" }}>AHORA</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => dispatchCardAction("reserve", block)}
          >
            <Ic i={Utensils} className="ic" />Reservar{top ? ` ${top.name}` : ""}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            <Ic i={Route} className="ic" />Ver otras
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
