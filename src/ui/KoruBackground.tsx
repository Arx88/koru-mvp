/**
 * KoruBackground — Sistema de fondos dinámicos por estado
 *
 * El fondo del chat cambia según lo que Koru esté haciendo:
 * - escuchando: idle, esperando input del usuario (video trabajando en loop suave)
 * - trabajando: generando respuesta simple
 * - buscando: usando tools (weather, sports, search)
 * - memoria: guardando gasto, recordatorio, etc.
 * - construyendo: armando respuesta larga (plan, informe)
 * - habitos: charla de gym/deportes
 * - productos: charla de compras/gastos
 * - recetas: charla de cocina/comida
 * - durmiendo: idle LARGO (5 min sin actividad) — NO inmediatamente después de contestar
 *
 * Los videos se reproducen en loop. Solo el activo tiene opacity:1.
 * Crossfade CSS 800ms — sin re-mounts.
 */

import { memo, useEffect, useRef } from "react";

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

interface StateAsset {
  type: "video" | "image";
  src: string;
  poster?: string;
}

// Single source of truth: estado → asset
// "escuchando" usa el video de "trabajando" en loop suave — NO el de "durmiendo".
// El de "durmiendo" solo se activa tras 5 min de inactividad real.
export const STATE_REGISTRY: Record<KoruBgState, StateAsset> = {
  escuchando: { type: "video", src: "/koru-states/estado-trabajando.mp4" },
  trabajando: { type: "video", src: "/koru-states/estado-trabajando.mp4" },
  buscando: { type: "video", src: "/koru-states/estado-buscando.mp4" },
  memoria: { type: "video", src: "/koru-states/estado-memoria.mp4" },
  construyendo: { type: "image", src: "/koru-states/estado-construyendo.png" },
  habitos: { type: "image", src: "/koru-states/estado-habitos.png" },
  productos: { type: "image", src: "/koru-states/estado-productos.png" },
  recetas: { type: "image", src: "/koru-states/estado-recetas.png" },
  durmiendo: { type: "video", src: "/koru-states/estado-durmiendo.mp4" },
};

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
 * 5. Default → escuchando (video trabajando suave)
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
 * Renderiza TODOS los assets en capas absolutas.
 * Solo el activo tiene opacity:1. Crossfade CSS.
 * Los videos se pausan cuando no están activos (perf).
 *
 * Videos: muted + playsInline + preload auto para autoplay en mobile.
 * Sin atributo controls — puramente decorativo.
 */
export const KoruBackground = memo(function KoruBackground({ state }: KoruBackgroundProps) {
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    // Pausa todos los videos excepto el activo
    Object.entries(videoRefs.current).forEach(([s, v]) => {
      if (!v) return;
      if (s === state) {
        // Reset playback to start when becoming active (avoid drift)
        v.currentTime = 0;
        v.play().catch(() => { /* autoplay puede fallar sin gesture */ });
      } else {
        v.pause();
      }
    });
  }, [state]);

  return (
    <div className="koru-bg-stack" aria-hidden="true">
      {Object.entries(STATE_REGISTRY).map(([s, asset]) => {
        const isActive = s === state;
        return (
          <div
            key={s}
            className={`koru-bg-layer${isActive ? " is-active" : ""}`}
          >
            {asset.type === "video" ? (
              <video
                ref={(el) => { videoRefs.current[s] = el; }}
                src={asset.src}
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                disableRemotePlayback
                // @ts-expect-error — non-standard but supported
                controlslist="nodownload nofullscreen noremoteplayback"
                poster={asset.poster}
              />
            ) : (
              <img src={asset.src} alt="" loading="lazy" draggable={false} />
            )}
          </div>
        );
      })}
    </div>
  );
});
