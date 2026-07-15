import { createPortal } from "react-dom";

// 🔴 ConfirmDialog — reemplaza window.confirm() con un modal custom
// que respeta el branding de Koru (gradient lila, radius, animación).

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="koru-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="koru-confirm-dialog">
        <h3 className="koru-confirm-title">{title}</h3>
        {message && <p className="koru-confirm-message">{message}</p>}
        <div className="koru-confirm-actions">
          <button
            type="button"
            className="koru-confirm-btn koru-confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={"koru-confirm-btn koru-confirm-accept" + (destructive ? " is-destructive" : "")}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
