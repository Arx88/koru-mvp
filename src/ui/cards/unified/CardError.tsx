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
      className="koru-plan-hero"
      data-ui-block="error"
      role="alert"
      aria-live="assertive"
      style={{
        overflow: "hidden",
        position: "relative",
        border: "1.5px dashed rgba(217, 119, 6, 0.45)",
        background: "rgba(254, 243, 199, 0.18)",
      }}
    >
      <div style={{ padding: "18px 20px 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={iconBoxStyle} aria-hidden="true">
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              cloud_off
            </span>
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                color: accent,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              No estoy seguro del dato
            </p>
            <h2
              style={{
                margin: "4px 0 6px",
                color: "#382b8c",
                fontFamily: FONT_HEADING,
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              {title ?? DEFAULT_TITLE}
            </h2>
            <p
              style={{
                margin: 0,
                color: "#6b5f8c",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {message ?? DEFAULT_MESSAGE}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="koru-plan-hero-action is-primary"
              style={{
                flex: "0 0 auto",
                padding: "10px 16px",
                background: accent,
                borderColor: accent,
                color: "#fff",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                refresh
              </span>
              <span>Reintentar ahora</span>
            </button>
          )}
          <span
            style={{
              color: "#a99bbe",
              fontSize: 12,
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
