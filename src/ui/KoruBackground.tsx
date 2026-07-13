/**
 * KoruBackground — Sistema de fondos dinámicos por estado
 *
 * El fondo del chat cambia según lo que Koru esté haciendo:
 * - escuchando: idle, esperando input
 * - trabajando: generando respuesta simple
 * - buscando: usando tools (weather, sports, search)
 * - memoria: guardando gasto, recordatorio, etc.
 * - construyendo: armando respuesta larga (plan, informe)
 * - habitos: charla de gym/deportes
 * - productos: charla de compras/gastos
 * - recetas: charla de cocina/comida
 * - durmiendo: idle largo (+2 min)
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
export const STATE_REGISTRY: Record<KoruBgState, StateAsset> = {
  escuchando: { type: "video", src: "/koru-states/estado-durmiendo.mp4" },
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
 * Mapa: estado del agente (AgentActivityKind) → estado visual de Koru.
 * Se invoca desde TalkOverlay cuando `activity` o `processing` cambian.
 */
export function activityToBgState(
  activityKind: string | undefined,
  processing: boolean,
  isListening: boolean,
  lastUserText: string | undefined,
  idleMs: number,
): KoruBgState {
  // 1) Idle largo → durmiendo
  if (idleMs > 120_000 && !processing && !isListening) return "durmiendo";

  // 2) Escuchando (grabando voz)
  if (isListening) return "escuchando";

  // 3) Procesando — depende del tipo de activity
  if (processing) {
    if (activityKind === "searching") return "buscando";
    if (activityKind === "saving") return "memoria";
    if (activityKind === "planning" || activityKind === "writing") return "construyendo";
    if (activityKind === "comparing") return "construyendo";
    if (activityKind === "asking") return "trabajando";
    return "trabajando";
  }

  // 4) Idle corto — topic detection del último mensaje
  if (lastUserText) {
    const topic = detectTopic(lastUserText);
    if (topic) return topic;
  }

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
 */
export const KoruBackground = memo(function KoruBackground({ state }: KoruBackgroundProps) {
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    // Pausa todos los videos excepto el activo
    Object.entries(videoRefs.current).forEach(([s, v]) => {
      if (!v) return;
      if (s === state) {
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
                poster={asset.poster}
              />
            ) : (
              <img src={asset.src} alt="" loading="lazy" />
            )}
          </div>
        );
      })}
    </div>
  );
});
