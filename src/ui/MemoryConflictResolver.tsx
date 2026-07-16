import { useEffect, useState } from "react";
import { X, Sparkles, Check, GitCompareArrows } from "lucide-react";
import type { MemoryFact, MemoryKind } from "../domain/types";

// ─────────────────────────────────────────────────────────────────────────────
// MemoryConflictResolver — modal P2.
// Aparece cuando Koru detecta que una nueva memoria contradice una existente.
// Muestra ambas side-by-side con un divisor "VS" y deja al usuario elegir
// cuál conservar. El keeper queda "confirmed", el otro "superseded".
// "Ambas son correctas" deja ambas intactas (sin superseder).
//
// Estilo: `.koru-magical-card` con gradiente lila, consistente con el resto
// de los modals de Koru (SettingsScreen, MemoryToast, etc.).
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryConflictResolverProps {
  oldMemory: MemoryFact;
  newMemory: MemoryFact;
  onResolve: (keepId: string, supersedeId: string) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<MemoryKind, string> = {
  profile: "Perfil",
  routine: "Rutina",
  preference: "Preferencia",
  goal: "Objetivo",
  relationship: "Relación",
  boundary: "Límite",
  retail: "Compras",
  wellbeing: "Bienestar",
  task: "Tarea",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function confidencePct(c: number | undefined): number {
  return Math.round((c ?? 0) * 100);
}

function MemoryCard({
  memory,
  label,
  accent,
  selected,
  onSelect,
}: {
  memory: MemoryFact;
  label: string;
  accent: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const pct = confidencePct(memory.confidence);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${label}: ${memory.text.slice(0, 60)}`}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 16,
        border: selected
          ? `2px solid ${accent}`
          : "2px solid rgba(129, 39, 207, 0.12)",
        background: selected
          ? "rgba(255,255,255,0.92)"
          : "rgba(255,255,255,0.62)",
        boxShadow: selected ? `0 6px 18px ${accent}33` : "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {label}
        </span>
        {selected && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              borderRadius: 999,
              background: accent,
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Check size={10} /> Elegida
          </span>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.45,
          color: "#0b1c30",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {memory.text}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 6,
            background: "#ede9fe",
            color: "#7c3aed",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {KIND_LABEL[memory.kind]}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 6,
            background:
              pct >= 80 ? "#dcfce7" : pct >= 50 ? "#fef9c3" : "#fee2e2",
            color: pct >= 80 ? "#15803d" : pct >= 50 ? "#a16207" : "#b91c1c",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {pct}% confianza
        </span>
      </div>

      <span style={{ fontSize: 11, color: "#94a3b8" }}>
        {formatDate(memory.createdAt)}
      </span>
    </button>
  );
}

export function MemoryConflictResolver({
  oldMemory,
  newMemory,
  onResolve,
  onClose,
}: MemoryConflictResolverProps) {
  // null = sin selección · "old" · "new" · "both"
  const [selection, setSelection] = useState<"old" | "new" | "both" | null>(null);

  // Esc cierra el modal. Limpieza mínima — el handler del parent decide si
  // re-abre (sigue habiendo conflicto) o lo descarta.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleConfirm() {
    if (selection === "both") {
      // Ambas correctas → no hay supersede. Cerramos sin resolver.
      onClose();
      return;
    }
    if (selection === "old") {
      onResolve(oldMemory.id, newMemory.id);
      return;
    }
    if (selection === "new") {
      onResolve(newMemory.id, oldMemory.id);
      return;
    }
  }

  const canConfirm = selection !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conflicto de memoria detectado"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(11, 28, 48, 0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        className="koru-magical-card"
        style={{
          width: "100%",
          maxWidth: 540,
          padding: 22,
          borderRadius: 24,
          background:
            "linear-gradient(160deg, #f0dbff 0%, #f5e8ff 45%, #f8f9ff 100%)",
          boxShadow: "0 24px 60px rgba(129, 39, 207, 0.30)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 12,
                background: "#8127cf",
                color: "#ffffff",
                flexShrink: 0,
              }}
            >
              <GitCompareArrows size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#5b21b6",
                  letterSpacing: "-0.01em",
                }}
              >
                Conflicto de memoria
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "#6d28d9",
                  lineHeight: 1.4,
                }}
              >
                Koru aprendió algo que parece contradecir lo que ya sabía.
                Elegí cuál versión conservar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar conflicto"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid rgba(129, 39, 207, 0.2)",
              background: "rgba(255,255,255,0.7)",
              color: "#7c3aed",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Side-by-side comparison */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <MemoryCard
            memory={oldMemory}
            label="Memoria anterior"
            accent="#7c3aed"
            selected={selection === "old"}
            onSelect={() => setSelection(selection === "old" ? null : "old")}
          />

          {/* VS divider */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 28,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 999,
                background: "#8127cf",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.5,
                boxShadow: "0 2px 6px rgba(129, 39, 207, 0.4)",
              }}
            >
              VS
            </span>
          </div>

          <MemoryCard
            memory={newMemory}
            label="Memoria nueva"
            accent="#db2777"
            selected={selection === "new"}
            onSelect={() => setSelection(selection === "new" ? null : "new")}
          />
        </div>

        {/* "Ambas son correctas" option */}
        <button
          type="button"
          onClick={() => setSelection(selection === "both" ? null : "both")}
          aria-pressed={selection === "both"}
          aria-label="Ambas son correctas"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 14px",
            marginBottom: 14,
            borderRadius: 12,
            border:
              selection === "both"
                ? "2px solid #16a34a"
                : "1px solid rgba(22, 163, 74, 0.25)",
            background:
              selection === "both"
                ? "rgba(220, 252, 231, 0.85)"
                : "rgba(255,255,255,0.7)",
            color: "#15803d",
            cursor: "pointer",
            textAlign: "left",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Sparkles size={16} />
          <span style={{ flex: "1 1 auto" }}>
            Ambas son correctas
            <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "#475569" }}>
              Conservar las dos memorias sin superseder ninguna.
            </span>
          </span>
          {selection === "both" && <Check size={16} />}
        </button>

        {/* Footer actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(129, 39, 207, 0.2)",
              background: "transparent",
              color: "#6d28d9",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid #8127cf",
              background: canConfirm ? "#8127cf" : "rgba(129, 39, 207, 0.35)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 700,
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            <Check size={14} />
            {selection === "both" ? "Conservar ambas" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemoryConflictResolver;
