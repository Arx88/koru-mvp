import { useEffect, useState } from "react";

type MemoryToastProps = {
  kind: string;
  text: string;
  onDismiss: () => void;
  /** 🔴 v2 — confirmación EN el toast (el momento de mayor atención del usuario).
   *  Si viene el id, el toast ofrece Guardar/Soltar y la confirmación deja
   *  de depender de encontrar la card RECUERDO en el scroll del chat. */
  memoryId?: string;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
};

const KIND_LABELS: Record<string, { label: string; icon: string }> = {
  preference: { label: "Preferencia", icon: "favorite" },
  routine: { label: "Rutina", icon: "schedule" },
  goal: { label: "Objetivo", icon: "flag" },
  profile: { label: "Perfil", icon: "person" },
  relationship: { label: "Relación", icon: "groups" },
  wellbeing: { label: "Bienestar", icon: "spa" },
  health: { label: "Salud", icon: "health_and_safety" },
  retail: { label: "Compra", icon: "shopping_bag" },
  boundary: { label: "Límite", icon: "block" },
  task: { label: "Tarea", icon: "task_alt" },
};

export function MemoryToast({ kind, text, onDismiss, memoryId, onConfirm, onReject }: MemoryToastProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit" | "confirmed" | "rejected">("enter");
  const kindInfo = KIND_LABELS[kind] ?? { label: "Memoria", icon: "neurology" };
  const canConfirm = Boolean(memoryId && onConfirm);
  const canReject = Boolean(memoryId && onReject);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 50);
    return () => clearTimeout(t1);
  }, []);

  const handleDismiss = () => {
    if (phase === "confirmed" || phase === "rejected") {
      onDismiss();
      return;
    }
    setPhase("exit");
    setTimeout(onDismiss, 300);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!memoryId || !onConfirm) return;
    if ("vibrate" in navigator) navigator.vibrate([12, 40, 18]);
    setPhase("confirmed");
    onConfirm(memoryId);
    // La confirmación queda visible 1.4s (microdetalle: el usuario VE que se
    // guardó antes de que el toast se retire).
    setTimeout(() => {
      setPhase("exit");
      setTimeout(onDismiss, 320);
    }, 1400);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!memoryId || !onReject) return;
    if ("vibrate" in navigator) navigator.vibrate(8);
    setPhase("rejected");
    onReject(memoryId);
    setTimeout(() => {
      setPhase("exit");
      setTimeout(onDismiss, 320);
    }, 1000);
  };

  return (
    <div
      className={`koru-memory-toast koru-memory-toast--${phase}`}
      role="status"
      aria-live="polite"
      onClick={handleDismiss}
    >
      <div className="koru-memory-toast-glow" aria-hidden="true" />
      <div className="koru-memory-toast-content">
        <div className="koru-memory-toast-icon">
          <span className="material-symbols-outlined">
            {phase === "confirmed" ? "check_circle" : phase === "rejected" ? "do_not_disturb_on" : kindInfo.icon}
          </span>
          <div className="koru-memory-toast-pulse" aria-hidden="true" />
        </div>
        <div className="koru-memory-toast-text">
          <div className="koru-memory-toast-label">
            <span className="koru-memory-toast-tag">{kindInfo.label}</span>
            <span className="koru-memory-toast-title">
              {phase === "confirmed"
                ? "Guardado en tu jardín"
                : phase === "rejected"
                  ? "Soltado"
                  : "Aprendí algo nuevo sobre vos"}
            </span>
          </div>
          <p className="koru-memory-toast-body">"{text}"</p>
          {(canConfirm || canReject) && phase !== "confirmed" && phase !== "rejected" && (
            <div className="koru-memory-toast-actions">
              {canConfirm && (
                <button
                  type="button"
                  className="koru-memory-toast-action is-confirm"
                  onClick={handleConfirm}
                >
                  <span className="material-symbols-outlined">check</span>
                  Guardar
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  className="koru-memory-toast-action is-reject"
                  onClick={handleReject}
                >
                  <span className="material-symbols-outlined">close</span>
                  Soltar
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="koru-memory-toast-close"
          aria-label="Cerrar"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="koru-memory-toast-progress" aria-hidden="true">
        <div className="koru-memory-toast-progress-bar" />
      </div>
    </div>
  );
}
