import { useMichiProgress } from "./useMichiProgress";
/** La colección usa la energía real y conserva el Michi equipado. */

import { LockKeyhole, Star, ChevronRight, Check, Sparkle, ArrowLeft } from "lucide-react";
import { MICHI_AVATARS, MICHI_AVATAR_SRC } from "./v8Shared";
import { MichiCat } from "./v8Shared";
import { MichiLevel } from "./MichiHeaderV8";

export function MichiAvatarsPage({
  onProgress, onLocked, onBack, userAvatar, onPersonalAvatar,
}: {
  onProgress: () => void;
  onLocked: (avatar: { id: string; name: string; level: number }) => void;
  onBack: () => void;
  userAvatar: string;
  onPersonalAvatar: () => void;
}) {
  const { active, level, choose } = useMichiProgress();
  return (
    <main className="mx-avatars mw-avatar-collection" aria-label="Colección de avatares">
      <button type="button" className="mx-back mw-avatar-back" onClick={onBack} aria-label="Volver al chat"><ArrowLeft size={18} /> Volver al chat</button>
      <section className={`mx-banner mw-companion-banner ${active.id === "playita" ? "is-playita" : ""}`}>
        <img className="mw-equipped" src={MICHI_AVATAR_SRC(active.id)} alt={active.name} />
        <span className="mx-banner-label">
          <LockKeyhole size={12} fill="white" /> Tu avatar actual
        </span>
        <h2>
          {active.name}
        </h2>
        <p>
          Siempre con vos <Sparkle fill="white" size={14} />
        </p>
        <button type="button" onClick={onProgress} className="mx-banner-level">
          <Star fill="#ffe34e" className="mx-gold-star" /> Nivel {level} <ChevronRight size={21} />
        </button>
      </section>

      <button type="button" className="mx-personal-entry" onClick={onPersonalAvatar}>
        <img src={userAvatar} alt="" width={52} height={52} />
        <span><strong>Tu avatar de conversación</strong><small>15 retratos para tus mensajes</small></span>
        <ChevronRight size={20} />
      </button>

      <section className="mx-collection">
        <div className="mx-collection-heading">
          <div>
            <h2>
              28 formas de ser Michi <Sparkle size={16} fill="#6d96ff" color="#6d96ff" />
            </h2>
            <p>Desbloquealos subiendo de nivel cada día.</p>
          </div>
          <button type="button" className="mx-progress-link" onClick={onProgress}>
            <Star fill="#756aff" /> <span>Tu progreso</span> <ChevronRight size={15} />
          </button>
        </div>

        <div className="mx-grid">
          {MICHI_AVATARS.map((avatar) => {
            const inUse = active.id === avatar.id;
            const unlocked = avatar.level <= level;
            return (
              <button
                key={avatar.id}
                type="button"
                className={`mx-tile ${inUse ? "in-use" : ""}`}
                onClick={() =>
                  unlocked ? choose(avatar.id) : onLocked({ id: avatar.id, name: avatar.name, level: avatar.level })
                }
                aria-pressed={inUse}
                aria-label={`${avatar.name}, ${inUse ? "en uso" : unlocked ? "disponible para equipar" : `se desbloquea en el nivel ${avatar.level}`}`}
              >
                <img src={MICHI_AVATAR_SRC(avatar.id)} alt={avatar.name} draggable="false" loading="lazy" />
                <strong>{avatar.name}</strong>
                <span className="mx-tile-state">
                  {inUse ? <Check size={16} strokeWidth={4} /> : unlocked ? <Sparkle size={12} /> : <LockKeyhole size={12} fill="currentColor" />}
                  {inUse ? "En uso" : unlocked ? "Equipar" : `Nivel ${avatar.level}`}
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

    </main>
  );
}

/* ---------- Pantalla completa (shell + fondo + header + modales) ---------- */
import { useState } from "react";
import { KoruBackground } from "../KoruBackground";
import { BubbleShapes, useMichiLandscape, useMichiUserAvatar } from "./v8Shared";
import { MichiHeaderV8, type MichiMenuAction } from "./MichiHeaderV8";
import { MichiProgressDialog, MichiLockedDialog, MichiUserAvatarDialog } from "./MichiDialogs";

export function MichiAvatarsScreen({
  onBack,
  onMenuAction,
}: {
  onBack: () => void;
  onMenuAction: (action: MichiMenuAction) => void;
}) {
  const { activeArt } = useMichiLandscape();
  const { userAvatar, chooseUserAvatar } = useMichiUserAvatar();
  const [modal, setModal] = useState<"progress" | "personal" | { locked: { id: string; name: string; level: number } } | null>(null);

  return (
    <div className="koru-chat-shell" role="dialog" aria-modal="true" aria-label="Colección de avatares de Michi">
      <section className="koru-chat-screen mw-avatar-screen" aria-label="Avatares de Michi">
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
          userAvatar={userAvatar}
          onPersonalAvatar={() => setModal("personal")}
        />
        {modal === "personal" && <MichiUserAvatarDialog userAvatar={userAvatar} onChoose={chooseUserAvatar} onClose={() => setModal(null)} />}
        {modal === "progress" && <MichiProgressDialog onClose={() => setModal(null)} />}
        {modal && typeof modal === "object" && "locked" in modal && (
          <MichiLockedDialog avatar={modal.locked} onClose={() => setModal(null)} />
        )}
      </section>
    </div>
  );
}
