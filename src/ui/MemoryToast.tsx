import { useEffect, useState } from "react";

type MemoryToastProps = {
  kind: string;
  text: string;
  onDismiss: () => void;
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

export function MemoryToast({ kind, text, onDismiss }: MemoryToastProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const kindInfo = KIND_LABELS[kind] ?? { label: "Memoria", icon: "neurology" };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 50);
    return () => clearTimeout(t1);
  }, []);

  const handleDismiss = () => {
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
          <span className="material-symbols-outlined">{kindInfo.icon}</span>
          <div className="koru-memory-toast-pulse" aria-hidden="true" />
        </div>
        <div className="koru-memory-toast-text">
          <div className="koru-memory-toast-label">
            <span className="koru-memory-toast-tag">{kindInfo.label}</span>
            <span className="koru-memory-toast-title">Aprendí algo nuevo sobre vos</span>
          </div>
          <p className="koru-memory-toast-body">"{text}"</p>
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
