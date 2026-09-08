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
  /** 🔴 v3 — para kind="saved": abre Mis Colecciones en la colección donde
   *  quedó lo guardado (cierra el ciclo Crear → toast "Ver" → colección). */
  collection?: string;
  onOpenCollections?: (collection?: string) => void;
};

const KIND_LABELS: Record<string, { label: string; icon: string }> = {
  saved: { label: "Guardado", icon: "bookmark_added" },
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

export function MemoryToast({
  kind,
  text,
  onDismiss,
  memoryId,
  onConfirm,
  onReject,
  collection,
  onOpenCollections,
}: MemoryToastProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit" | "confirmed" | "rejected">("enter");
  const isSaved = kind === "saved";
  const kindInfo = KIND_LABELS[kind] ?? { label: "Memoria", icon: "neurology" };
  // Guardar/Soltar son acciones de MEMORIA — nunca para guardados (kind=saved).
  const canConfirm = !isSaved && Boolean(memoryId && onConfirm);
  const canReject = !isSaved && Boolean(memoryId && onReject);
  // "Ver" solo para guardados con colección real (no para "Listo ✓" genéricos)
  const canView = isSaved && Boolean(collection && onOpenCollections);

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

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOpenCollections) return;
    if ("vibrate" in navigator) navigator.vibrate(12);
    onOpenCollections(collection);
    setPhase("exit");
    setTimeout(onDismiss, 300);
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
                  : isSaved
                    ? "Listo, quedó guardado"
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
          {canView && phase !== "confirmed" && phase !== "rejected" && (
            <div className="koru-memory-toast-actions">
              <button
                type="button"
                className="koru-memory-toast-action is-view"
                onClick={handleView}
              >
                <span className="material-symbols-outlined">folder_open</span>
                Ver
              </button>
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
