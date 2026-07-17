// ============================================================================
// TypingDots — Tres puntos animados + label opcional.
// Kimi audit menciona "Lo estoy oliendo…" con typing dots como voz mágica
// para el estado "procesando". Reutiliza el keyframe `koru-typing-bounce`
// ya definido en style.css.
// ============================================================================

export interface TypingDotsProps {
  label?: string;
}

export function TypingDots({ label = "Lo estoy oliendo…" }: TypingDotsProps) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span style={{ display: "inline-flex", gap: 3 }} aria-hidden="true">
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--koru-purple, #8363f9)",
            animation: "koru-typing-bounce 1.4s ease-in-out infinite",
            animationDelay: "-0.32s",
          }}
        />
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--koru-purple, #8363f9)",
            animation: "koru-typing-bounce 1.4s ease-in-out infinite",
            animationDelay: "-0.16s",
          }}
        />
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--koru-purple, #8363f9)",
            animation: "koru-typing-bounce 1.4s ease-in-out infinite",
          }}
        />
      </span>
      {label ? (
        <span style={{ fontSize: 11, color: "var(--ink-faint, #a89ad7)" }}>{label}</span>
      ) : null}
    </span>
  );
}

export default TypingDots;
