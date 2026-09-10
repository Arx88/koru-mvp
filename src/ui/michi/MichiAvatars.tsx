/**
 * MichiAvatarsPage — Pantalla de avatares desbloqueables del usuario
 * (porte 1:1 de su AvatarsPage.jsx + .avatars-page CSS).
 *
 * 🐱 Banner "Tu avatar actual · Playita ☀️" con fondo playita-banner.webp,
 * colección orgánica blanca (blob clip-path) con grilla 4×2 de avatares
 * (Playita "En uso" + 7 bloqueados por nivel), barra de encouragement
 * glassmorphism y back-button orgánico.
 *
 * Nivel 7/320 XP estáticos como en su referencia (gamificación pendiente).
 */

import { LockKeyhole, Star, ChevronRight, Check, Sparkle, ArrowLeft } from "lucide-react";
import { MICHI_AVATARS, MICHI_AVATAR_SRC } from "./v8Shared";
import { MichiCat } from "./v8Shared";
import { MichiLevel } from "./MichiHeaderV8";

export function MichiAvatarsPage({
  onProgress, onLocked, onBack,
}: {
  onProgress: () => void;
  onLocked: (avatar: { id: string; name: string; level: number }) => void;
  onBack: () => void;
}) {
  return (
    <main className="mx-avatars" aria-label="Colección de avatares">
      <section className="mx-banner">
        <span className="mx-banner-label">
          <LockKeyhole size={12} fill="white" /> Tu avatar actual
        </span>
        <h2>
          Playita <span className="mx-banner-sun">☀️</span>
        </h2>
        <p>
          Relájate, todo va a estar bien <Sparkle fill="white" size={14} />
        </p>
        <button type="button" onClick={onProgress} className="mx-banner-level">
          <Star fill="#ffe34e" className="mx-gold-star" /> Nivel 7 <ChevronRight size={21} />
        </button>
      </section>

      <section className="mx-collection">
        <div className="mx-collection-heading">
          <div>
            <h2>
              Colección de avatares <Sparkle size={16} fill="#6d96ff" color="#6d96ff" />
            </h2>
            <p>Desbloquealos subiendo de nivel cada día.</p>
          </div>
          <button type="button" className="mx-progress-link" onClick={onProgress}>
            <Star fill="#756aff" /> <span>Tu progreso</span> <ChevronRight size={15} />
          </button>
        </div>

        <div className="mx-grid">
          {MICHI_AVATARS.map((avatar, index) => {
            const inUse = index === 0;
            return (
              <button
                key={avatar.id}
                type="button"
                className={`mx-tile ${inUse ? "in-use" : ""}`}
                onClick={() =>
                  inUse ? undefined : onLocked({ id: avatar.id, name: avatar.name, level: avatar.level })
                }
                aria-label={`${avatar.name}, ${inUse ? "en uso" : `se desbloquea en el nivel ${avatar.level}`}`}
              >
                <img src={MICHI_AVATAR_SRC(avatar.id)} alt={avatar.name} draggable="false" />
                <strong>{avatar.name}</strong>
                <span className="mx-tile-state">
                  {inUse ? <Check size={16} strokeWidth={4} /> : <LockKeyhole size={12} fill="currentColor" />}
                  {inUse ? "En uso" : `Nivel ${avatar.level}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-encourage">
        <MichiCat sparkle />
        <div>
          <strong>¡Sigue usando la app cada día!</strong>
          <p>Subí de nivel y desbloqueá nuevos avatares.</p>
        </div>
        <MichiLevel compact onClick={onProgress} />
      </section>

      <button type="button" className="mx-back" onClick={onBack} aria-label="Volver al chat">
        <ArrowLeft />
      </button>
    </main>
  );
}

/* ---------- Pantalla completa (shell + fondo + header + modales) ---------- */
import { useState } from "react";
import { KoruBackground } from "../KoruBackground";
import { BubbleShapes, useMichiLandscape } from "./v8Shared";
import { MichiHeaderV8, type MichiMenuAction } from "./MichiHeaderV8";
import { MichiProgressDialog, MichiLockedDialog } from "./MichiDialogs";

export function MichiAvatarsScreen({
  onBack,
  onMenuAction,
}: {
  onBack: () => void;
  onMenuAction: (action: MichiMenuAction) => void;
}) {
  const { activeArt } = useMichiLandscape();
  const [modal, setModal] = useState<"progress" | { locked: { id: string; name: string; level: number } } | null>(null);

  return (
    <div className="koru-chat-shell" role="dialog" aria-modal="true" aria-label="Colección de avatares de Michi">
      <section className="koru-chat-screen" aria-label="Avatares de Michi">
        <BubbleShapes />
        <KoruBackground activeArt={activeArt} />
        <MichiHeaderV8
          onMenuAction={(action) => {
            if (action === "avatares") return; // ya estamos acá
            onMenuAction(action);
          }}
          onAvatares={onBack}
        />
        <MichiAvatarsPage
          onProgress={() => setModal("progress")}
          onLocked={(avatar) => setModal({ locked: avatar })}
          onBack={onBack}
        />
        {modal === "progress" && <MichiProgressDialog onClose={() => setModal(null)} />}
        {modal && typeof modal === "object" && "locked" in modal && (
          <MichiLockedDialog avatar={modal.locked} onClose={() => setModal(null)} />
        )}
      </section>
    </div>
  );
}
