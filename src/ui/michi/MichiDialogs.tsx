import { PERSONAL_AVATARS } from "./avatarCatalog";
import { useMichiProgress } from "./useMichiProgress";
import { useEffect, useRef } from "react";
/** Diálogos accesibles de progreso, paisajes y los 15 retratos personales. */

import { X, Star, LockKeyhole, Sun, MapPin, Sparkle } from "lucide-react";
import { art, MICHI_AVATARS, MICHI_AVATAR_SRC, MICHI_SCENERY, DEFAULT_USER_AVATAR } from "./v8Shared";

function DialogShell({
  title, description, onClose, children, locked = false,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children?: React.ReactNode;
  locked?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if(event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if(event.key !== "Tab") return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if(event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener("keydown", keydown);
    return () => { dialog?.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);
  return (
    <div className="mx-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`mx-dialog ${locked ? "locked" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="mx-dialog-close" aria-label="Cerrar" onClick={onClose}>
          <X size={15} />
        </button>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    </div>
  );
}

/* ---------- Progreso ---------- */
export function MichiProgressDialog({ onClose }: { onClose: () => void }) {
  const { next, level, inLevel, remaining } = useMichiProgress();
  return (
    <DialogShell
      title="Tu aventura, paso a paso"
      description="Cada pequeña aventura cuenta."
      onClose={onClose}
    >
      <div className="mx-progress-number">
        <Star /> Nivel {level}
      </div>
      <div
        className="mx-dialog-xp"
        role="progressbar"
        aria-valuenow={inLevel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Experiencia"
      >
        <span style={{ width: `${inLevel}%` }} />
      </div>
      <div className="mx-xp-detail">
        <strong>{inLevel} / 100 XP</strong>
        <span>{remaining} XP para el nivel {level + 1}</span>
      </div>
      {next && <div className="mx-next-unlock">
        <img src={MICHI_AVATAR_SRC(next.id)} alt={`${next.name}`} />
        <div>
          <strong>Tu próxima sorpresa</strong>
          <span>{next.name} · Nivel {next.level}</span>
        </div>
        <LockKeyhole size={19} />
      </div>}
      <p className="mw-progress-help">Cada 100 puntos de energía ganados en la app suman un nivel. Confirmar recuerdos y completar acciones aprobadas hace avanzar tu aventura.</p>
    </DialogShell>
  );
}

/* ---------- Avatar bloqueado ---------- */
export function MichiLockedDialog({ avatar, onClose }: { avatar: { id: string; name: string; level: number }; onClose: () => void }) {
  return (
    <DialogShell
      title="Un nuevo amigo te espera"
      description="Seguí sumando aventuras con Michi."
      onClose={onClose}
      locked
    >
      <img className="mx-dialog-art" src={MICHI_AVATAR_SRC(avatar.id)} alt={avatar.name} />
      <strong style={{ display: "block", fontSize: 18, fontWeight: 900, color: "#20117d" }}>{avatar.name}</strong>
      <div className="mx-locked-level">
        <LockKeyhole size={17} /> Se desbloquea en el nivel {avatar.level}
      </div>
      <button type="button" className="mx-dialog-primary" onClick={onClose}>
        ¡A seguir la aventura! <Sparkle size={15} fill="white" />
      </button>
    </DialogShell>
  );
}

/* ---------- Cambiar paisaje ---------- */
export function MichiLandscapeDialog({
  active, override, onChoose, onClose,
}: {
  active: number;
  override: number | null;
  onChoose: (n: number | null) => void;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title="Tu mundo, tu momento"
      description="Elegí el paisaje que va con vos."
      onClose={onClose}
    >
      <div className="mx-landscape-grid">
        {MICHI_SCENERY.map((scene) => (
          <button
            key={scene.art}
            type="button"
            className={`mx-landscape-choice ${override === scene.art ? "active" : ""}`}
            onClick={() => onChoose(scene.art)}
            aria-pressed={override === scene.art}
          >
            <img src={art(scene.art)} alt={scene.name} />
            <span>{scene.name}</span>
          </button>
        ))}
        <button
          type="button"
          className={`mx-landscape-choice ${override === null ? "active" : ""}`}
          onClick={() => onChoose(null)}
          aria-pressed={override === null}
        >
          <img src={art(active)} alt="Automático" />
          <span>Automático</span>
        </button>
      </div>
    </DialogShell>
  );
}

/* ---------- Avatar personal del usuario ---------- */
export const PERSONAL_AVATAR_OPTIONS = PERSONAL_AVATARS.map(a => a.src);

export function MichiUserAvatarDialog({
  userAvatar, onChoose, onClose,
}: {
  userAvatar: string;
  onChoose: (src: string) => void;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title="¿Con quién hablo hoy?"
      description="Elegí entre 15 retratos para acompañar tus mensajes."
      onClose={onClose}
    >
      <div className="mx-personal-grid">
        {PERSONAL_AVATAR_OPTIONS.map((src, i) => (
          <button
            key={src}
            type="button"
            className={userAvatar === src ? "active" : ""}
            onClick={() => { onChoose(src); onClose(); }}
            aria-label={`Elegir retrato ${i + 1}`}
            aria-pressed={userAvatar === src}
          >
            <img src={src} alt="" width={72} height={72} loading="lazy" />
            {userAvatar === src && (
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={3.5}>
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

/* ---------- Reset de conversación ---------- */
export function MichiResetDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <DialogShell
      title="¿Una nueva aventura?"
      description="Los mensajes que enviaste se borrarán. La conversación inicial se conserva."
      onClose={onClose}
    >
      <div className="mx-reset-actions">
        <button type="button" className="mx-dialog-secondary" onClick={onClose}>
          Me quedo acá
        </button>
        <button
          type="button"
          className="mx-dialog-primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Empezar de nuevo
        </button>
      </div>
    </DialogShell>
  );
}

/* ---------- Radar del clima hora por hora (datos reales del bloque) ---------- */
export function MichiHourlyDialog({
  city, now, condition, hourly, onClose,
}: {
  city: string;
  now?: string;
  condition?: string;
  hourly?: Array<{ hour: string; temp: string; conditionIcon: string; rainPct: number; uv: number }>;
  onClose: () => void;
}) {
  const rows = (hourly ?? []).slice(0, 8);
  return (
    <DialogShell title="Un día para salir ☀️" description="Valencia, hoy" onClose={onClose}>
      <div className="mx-weather-loc">
        <MapPin size={16} /> {city || "Tu ciudad"}{now ? ` · ${now} · ${condition ?? ""}` : ""}
      </div>
      {rows.length > 0 ? (
        <div className="mx-hourly-grid">
          {rows.map((h) => (
            <div className="mx-hourly-item" key={h.hour}>
              <span>{h.hour}</span>
              <Sun />
              <strong>{h.temp}</strong>
              <small>Lluvia {h.rainPct}%</small>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#7d7aa8" }}>
          Todavía no tengo el detalle hora por hora — pedime "¿cómo sigue el clima por hora?" y lo busco.
        </p>
      )}
      <button type="button" className="mx-dialog-primary" onClick={onClose}>
        ¡A disfrutar del sol! <Sun size={17} />
      </button>
    </DialogShell>
  );
}
