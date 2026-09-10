/**
 * KoruBackground — Sistema de fondos dinámicos
 *
 * 🐱 v7.5 — FONDOS POR MOMENTO DEL DÍA (pedido del usuario):
 * la cala fantástica cambia según la hora local del usuario:
 * - madrugada (00–06): luna y estrellas, azul profundo
 * - amanecer (06–08): sol bajo, tonos cálidos
 * - día (08–17): cielo azul vivo (ilustración completa del Drive)
 * - atardecer (17–20): cielo naranja/violeta
 * - anochecer (20–24): violeta oscuro con estrellas
 *
 * Crossfade 900ms entre momentos del día (re-evaluado cada minuto).
 * Los estados del agente (buscando/memoria/durmiendo) ahora aplican un
 * matiz sutil vía data-agent-state en el contenedor (capa v7.1 §12 de
 * style.css), encima del fondo activo del momento del día.
 */

import { memo, useEffect, useState } from "react";

export type KoruBgState =
  | "escuchando"
  | "trabajando"
  | "buscando"
  | "memoria"
  | "construyendo"
  | "habitos"
  | "productos"
  | "recetas"
  | "durmiendo";

export type TimeOfDay = "madrugada" | "amanecer" | "dia" | "atardecer" | "anochecer";

/** Momento del día según la hora LOCAL del dispositivo del usuario. */
export function timeOfDayFor(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h < 6) return "madrugada";
  if (h < 8) return "amanecer";
  if (h < 17) return "dia";
  if (h < 20) return "atardecer";
  return "anochecer";
}

/** Slot → asset + color de placeholder (pintado instantáneo antes de cargar la img). */
export const TIME_REGISTRY: Record<TimeOfDay, { src: string; tint: string }> = {
  madrugada: { src: "/michi/fondos/madrugada.jpg", tint: "#041055" },
  amanecer: { src: "/michi/fondos/amanecer.jpg", tint: "#1d7bee" },
  dia: { src: "/michi/fondos/dia.jpg", tint: "#046bfd" },
  atardecer: { src: "/michi/fondos/atardecer.jpg", tint: "#7541a2" },
  anochecer: { src: "/michi/fondos/anochecer.jpg", tint: "#0c1a7b" },
};

const TIME_ORDER: TimeOfDay[] = ["madrugada", "amanecer", "dia", "atardecer", "anochecer"];

/**
 * Tiempo de inactividad requerido antes de pasar a "durmiendo".
 * 5 minutos — no es inmediato. Solo si el usuario abandona la app.
 */
export const SLEEP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Mapa: estado del agente (AgentActivityKind) → estado visual de Koru.
 * Se invoca desde TalkOverlay cuando `activity` o `processing` cambian.
 *
 * Reglas de prioridad:
 * 1. Si está procesando → estado según activity.kind
 * 2. Si está escuchando voz → escuchando
 * 3. Si hay inactividad > 5 min → durmiendo (solo si NO hay chat previo activo)
 * 4. Topic detection del último mensaje → recetas/habitos/productos
 * 5. Default → escuchando
 */
export function activityToBgState(
  activityKind: string | undefined,
  processing: boolean,
  isListening: boolean,
  lastUserText: string | undefined,
  idleMs: number,
  hasChatStarted: boolean,
): KoruBgState {
  // 1) Procesando — depende del tipo de activity
  if (processing) {
    if (activityKind === "searching") return "buscando";
    if (activityKind === "saving") return "memoria";
    if (activityKind === "planning" || activityKind === "writing") return "construyendo";
    if (activityKind === "comparing") return "construyendo";
    if (activityKind === "asking") return "trabajando";
    return "trabajando";
  }

  // 2) Escuchando (grabando voz)
  if (isListening) return "escuchando";

  // 3) Idle LARGO (5 min) → durmiendo — solo si ya hubo chat previo
  // Si no hay chat previo, no nos dormimos (es la primera interacción)
  if (hasChatStarted && idleMs > SLEEP_THRESHOLD_MS) return "durmiendo";

  // 4) Topic detection del último mensaje (solo si hay mensaje)
  if (lastUserText) {
    const topic = detectTopic(lastUserText);
    if (topic) return topic;
  }

  // 5) Default — escuchando (esperando input, no dormido)
  return "escuchando";
}

/**
 * Detección de tópico por regex simple.
 * Devuelve el estado visual si hay match, sino null.
 */
function detectTopic(text: string): KoruBgState | null {
  const t = text.toLowerCase();
  if (/\b(receta|cocin|comida|ingredient|asado|pizza|hambre|almuerzo|cena|desayuno|gusto comer|queso|fideos|carne|pollo|ensalada)\b/.test(t)) return "recetas";
  if (/\b(gym|gimna|deporte|correr|peso|rutina|entren|futbol|basket|tenis|natacion|corrida|maraton|musculo|fitness)\b/.test(t)) return "habitos";
  if (/\b(compr|gasto|gaste|pague|mercado|precio|producto|plata|gastos|compras|carrito|supermercado|dinero)\b/.test(t)) return "productos";
  return null;
}

interface KoruBackgroundProps {
  state: KoruBgState;
}

/**
 * Renderiza las 5 capas de momento del día en absoluto.
 * Solo la capa del momento actual tiene opacity:1 — crossfade CSS 900ms.
 * El contenedor lleva data-agent-state para los matices sutiles (§12).
 */
export const KoruBackground = memo(function KoruBackground({ state }: KoruBackgroundProps) {
  // 🐱 v7.5 — re-evaluar el momento del día cada minuto (transiciones suaves
  // al cruzar los límites 6/8/17/20h). En SSR/jsdom new Date() funciona igual.
  const [tod, setTod] = useState<TimeOfDay>(() => timeOfDayFor(new Date()));

  useEffect(() => {
    const tick = () => {
      const next = timeOfDayFor(new Date());
      setTod((prev) => (prev === next ? prev : next));
    };
    const id = window.setInterval(tick, 60_000);
    // Re-alinear al minuto siguiente (para cruzar el límite justo)
    const now = new Date();
    const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    const alignId = window.setTimeout(() => {
      tick();
      // el interval ya sigue corriendo
    }, Math.max(1000, msToNextMinute));
    return () => {
      window.clearInterval(id);
      window.clearTimeout(alignId);
    };
  }, []);

  const active = TIME_REGISTRY[tod];

  return (
    <div
      className="koru-bg-stack"
      aria-hidden="true"
      data-agent-state={state}
      style={{ background: active.tint }}
    >
      {TIME_ORDER.map((slot) => {
        const asset = TIME_REGISTRY[slot];
        const isActive = slot === tod;
        return (
          <div
            key={slot}
            data-tod={slot}
            className={`koru-bg-layer${isActive ? " is-active" : ""}`}
          >
            <img
              src={asset.src}
              alt=""
              loading={isActive ? "eager" : "lazy"}
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
});
