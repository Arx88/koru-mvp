/**
 * KoruBackground — Fondos del design system del usuario (v8).
 *
 * 🐱 Los paisajes ilustrados del usuario (art-09 Amanecer / art-17 Día /
 * art-11 Atardecer / art-12 Crepúsculo / art-13 Noche):
 *   - Por defecto se eligen AUTOMÁTICAMENTE por franja horaria (pedido
 *     anterior del usuario: fondos por momento del día).
 *   - El usuario puede fijar uno desde "Cambiar paisaje" (se persiste en
 *     localStorage) — el override vive en TalkOverlay vía useMichiLandscape.
 *   - Crossfade 900ms entre capas (transición suave al cruzar una franja
 *     horaria o al cambiar el paisaje a mano).
 *
 * El estado del agente ya NO tiñe el fondo (v8: su diseño no lo hace).
 */

import { memo } from "react";
import { art, MICHI_SCENERY } from "./michi/v8Shared";

interface KoruBackgroundProps {
  activeArt: number;
}

export const KoruBackground = memo(function KoruBackground({ activeArt }: KoruBackgroundProps) {
  return (
    <div className="koru-bg-stack" aria-hidden="true">
      {MICHI_SCENERY.map((scene) => {
        const isActive = scene.art === activeArt;
        return (
          <div key={scene.art} className={`koru-bg-layer${isActive ? " is-active" : ""}`}>
            <img src={art(scene.art)} alt="" loading={isActive ? "eager" : "lazy"} draggable={false} />
          </div>
        );
      })}
    </div>
  );
});
