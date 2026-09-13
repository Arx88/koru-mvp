import type { MichiActivityInvite, MichiActivityKind } from "../domain/types";

/**
 * 🔴 MICHI CONSCIENTE (2026-09-13) — card de la propuesta de Michi.
 *
 * Dos caminos y nada más: aceptar (abre la pantalla real) o "Más tarde" (que
 * queda registrado: la actividad no se vuelve a proponer por unas horas).
 *
 * La card NO decide nada: si se dibuja, es porque el dominio ya habilitó la
 * propuesta (michiActivities.ts). Acá solo se muestra y se avisa.
 */

const ACTIVITY_LABEL: Record<MichiActivityKind, string> = {
  school: "Michi School",
  ticTac: "Tic Tac Mich",
};

const ACTIVITY_EMOJI: Record<MichiActivityKind, string> = {
  school: "🎓",
  ticTac: "🐾",
};

export function ActivityInviteCard({
  invite,
  onPlay,
  onLater,
}: {
  invite: MichiActivityInvite;
  onPlay: (activity: MichiActivityKind) => void;
  onLater: (activity: MichiActivityKind) => void;
}) {
  // Aceptada: el usuario ya se fue a la pantalla — la card no aporta nada.
  if (invite.resolution === "accepted") return null;

  const emoji = ACTIVITY_EMOJI[invite.activity];
  const label = ACTIVITY_LABEL[invite.activity];
  const gentle = invite.tone === "gentle";
  const className = `koru-invite${gentle ? " is-gentle" : ""}`;

  if (invite.resolution === "later") {
    return (
      <div className={`${className} is-resolved`}>
        <p className="koru-invite-resolved">
          <span aria-hidden="true">{emoji}</span> Anotado: <b>{label}</b> queda para más tarde — no insisto por
          unas horas.
        </p>
      </div>
    );
  }

  return (
    <div className={className} role="group" aria-label={`Michi te propone ${label}`}>
      <div className="koru-invite-top">
        <span className="koru-invite-emoji" aria-hidden="true">
          {emoji}
        </span>
        <div className="koru-invite-copy">
          <p className="koru-invite-title">{invite.title}</p>
          <p className="koru-invite-body">{invite.body}</p>
        </div>
      </div>
      <div className="koru-invite-actions">
        <button type="button" className="koru-invite-play" onClick={() => onPlay(invite.activity)}>
          {invite.ctaLabel}
        </button>
        <button type="button" className="koru-invite-later" onClick={() => onLater(invite.activity)}>
          Más tarde
        </button>
      </div>
    </div>
  );
}
