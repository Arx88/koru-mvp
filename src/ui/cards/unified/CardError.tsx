import type { CSSProperties } from "react";

// 🔴 KIMI AUDIT — "Error honesto: sin datos falsos, con reintento y promesa
// de aviso".
// Card visual con borde punteado ámbar, ícono en cuadrado de acento, título,
// mensaje honesto y botón de reintento. Aparece en lugar de la card real
// cuando el proveedor está saturado o la tool marca __forceHonestReply.
//
// La promesa "te aviso cuando vuelva 🌿" compromete a Koru a una acción
// futura (no es un error que se evapora): refuerza el contrato de honestidad.

const FONT_HEADING = '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';

const DEFAULT_TITLE = "Se nubló el dato";
const DEFAULT_MESSAGE =
  "El proveedor está saturado. No te muestro números viejos como si fueran de ahora.";

export type CardErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Color de acento del cuadrado del ícono + botón. Default: ámbar Koru. */
  accent?: string;
};

export function CardError({
  title,
  message,
  onRetry,
  accent = "#d97706",
}: CardErrorProps) {
  const iconBoxStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: `rgba(217, 119, 6, 0.14)`,
    color: accent,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
  };

  return (
    <div
      className="koru-plan-hero kc koru-card-error"
      data-ui-block="error"
      role="alert"
      aria-live="assertive"
      style={{
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ padding: "22px 18px 16px", textAlign: "center" }}>
        <div className="koru-card-error-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 16a4 4 0 0 1 0-8 6 6 0 0 1 11.5-2 4 4 0 0 1 1 8z" fill="currentColor" opacity="0.3" />
            <path d="M9 18l2-3 2 3" />
          </svg>
        </div>
          <p
            style={{
              margin: 0,
              color: accent,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            No estoy seguro del dato
          </p>
          <h3
            className="kc-title"
            style={{
              margin: "4px 0 6px",
              color: "var(--koru-purple-deep, #382b8c)",
              fontFamily: FONT_HEADING,
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {title ?? DEFAULT_TITLE}
          </h3>
          <p
            className="kc-desc"
            style={{
              margin: 0,
              color: "var(--ink2, #554a7d)",
              fontSize: 12,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            {message ?? DEFAULT_MESSAGE}
          </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 6,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="kc-cta"
              style={{
                flex: "0 0 auto",
                padding: "12px 18px",
                background: `linear-gradient(120deg, var(--brasa-1, #ff7d6b), ${accent})`,
                color: "#fff",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin-slow" style={{ animationDuration: "6s", animationPlayState: "paused" }}>
                <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
              </svg>
              <span>Reintentar ahora</span>
            </button>
          )}
          <span
            style={{
              color: "var(--ink-faint, #a99bbe)",
              fontSize: 11,
              fontStyle: "italic",
            }}
          >
            o te aviso cuando vuelva 🌿
          </span>
        </div>
      </div>
    </div>
  );
}

export default CardError;
