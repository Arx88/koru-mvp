import { useState, useEffect } from "react";
import { Leaf, Scissors, Sprout, TreePine, X, Check, Lock, Sparkles } from "lucide-react";
import { useKoru, type Memory, type MemoryStatus } from "./KoruProvider";
import { cn } from "../lib/utils";

const STATUS_META: Record<MemoryStatus, { label: string; icon: typeof Leaf; tint: string; ring: string; glow: string; gradient: string }> = {
  reciente: {
    label: "Reciente",
    icon: Sprout,
    tint: "text-moss",
    ring: "border-sand",
    glow: "rgba(169, 155, 224, 0.15)",
    gradient: "linear-gradient(135deg, rgba(169, 155, 224, 0.12), rgba(196, 181, 253, 0.06))",
  },
  confirmada: {
    label: "Confirmada",
    icon: Leaf,
    tint: "text-forest",
    ring: "border-leaf",
    glow: "rgba(124, 92, 219, 0.18)",
    gradient: "linear-gradient(135deg, rgba(124, 92, 219, 0.10), rgba(201, 189, 245, 0.05))",
  },
  dudosa: {
    label: "Dudosa",
    icon: Sprout,
    tint: "text-stone",
    ring: "border-dashed border-stone",
    glow: "rgba(169, 155, 190, 0.10)",
    gradient: "linear-gradient(135deg, rgba(169, 155, 190, 0.08), rgba(228, 221, 247, 0.04))",
  },
  importante: {
    label: "Importante",
    icon: TreePine,
    tint: "text-forest",
    ring: "border-forest",
    glow: "rgba(124, 92, 219, 0.25)",
    gradient: "linear-gradient(135deg, rgba(124, 92, 219, 0.15), rgba(201, 189, 245, 0.08))",
  },
  sensible: {
    label: "Sensible",
    icon: Lock,
    tint: "text-[#b58a82]",
    ring: "border-blush",
    glow: "rgba(240, 217, 238, 0.18)",
    gradient: "linear-gradient(135deg, rgba(240, 217, 238, 0.12), rgba(228, 221, 247, 0.06))",
  },
};

export function MemoryScreen() {
  const { memories, roots, confirmMemory, pruneMemory, editMemory, toggleMemoryUse } = useKoru();
  const [selected, setSelected] = useState<Memory | null>(null);
  const [staggerIndex, setStaggerIndex] = useState(0);
  const needAttention = memories.filter((m) => m.status === "dudosa" || m.status === "reciente").length;

  // Stagger animation: cards appear one by one
  useEffect(() => {
    if (memories.length > 0 && staggerIndex < memories.length) {
      const timer = setTimeout(() => setStaggerIndex((i) => i + 1), 60);
      return () => clearTimeout(timer);
    }
  }, [memories.length, staggerIndex]);

  return (
    <div className="flex h-full flex-col px-6 pb-4 pt-8">
      {/* Animated header */}
      <header className="animate-rise relative">
        <div className="absolute -top-2 -left-2 h-20 w-20 rounded-full bg-forest/10 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-forest" />
            <h1 className="font-serif text-2xl text-bark">Mi jardín</h1>
          </div>
          <p className="mt-1 text-sm text-earth">
            {memories.length} plantas · {roots} raíces
            {needAttention > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blush/50 px-2 py-0.5 text-xs font-medium text-[#8a635c]">
                <Sprout className="h-3 w-3" /> {needAttention} necesitan atención
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Memory cards grid */}
      <div className="mt-6 grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto pb-4">
        {memories.map((m, idx) => {
          const meta = STATUS_META[m.status];
          const Icon = meta.icon;
          const isVisible = idx < staggerIndex;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className={cn(
                "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left cursor-pointer",
                "transition-all duration-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
                "hover:shadow-[0_8px_24px_var(--card-glow)] hover:-translate-y-0.5 active:scale-[0.97]",
                meta.ring,
              )}
              style={{
                background: meta.gradient,
                // @ts-ignore
                "--card-glow": meta.glow,
              }}
            >
              {/* Decorative glow */}
              <div
                className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)` }}
              />

              {/* Icon with pulse for recent */}
              <span
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-xl bg-warm-white/80 backdrop-blur-sm border border-white/40",
                  m.status === "reciente" && "animate-subtle-pulse",
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", meta.tint)} />
                {m.status === "reciente" && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-moss border-2 border-white" />
                )}
              </span>

              <span className="text-[13px] font-medium leading-snug text-bark line-clamp-3">{m.text}</span>

              <div className="flex items-center gap-1.5">
                <span className={cn("text-[11px] font-semibold", meta.tint)}>{meta.label}</span>
                {m.useForSuggestions && (
                  <Check className="h-3 w-3 text-forest/60" />
                )}
              </div>
            </button>
          );
        })}

        {/* Empty state */}
        {memories.length === 0 && (
          <div className="col-span-2 flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-forest/10 blur-2xl rounded-full" />
              <Sprout className="relative h-12 w-12 text-leaf" />
            </div>
            <p className="text-sm text-earth max-w-[200px]">
              Tu jardín está vacío. Contame algo sobre vos y lo plantaré aquí.
            </p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <MemoryDetail
          memory={selected}
          onClose={() => setSelected(null)}
          onConfirm={() => { confirmMemory(selected.id); setSelected(null); }}
          onPrune={() => { pruneMemory(selected.id); setSelected(null); }}
          onEdit={(text) => { editMemory(selected.id, text); setSelected((current) => current ? { ...current, text } : current); }}
          onToggleUse={() => { toggleMemoryUse(selected.id); setSelected((current) => current ? { ...current, useForSuggestions: !current.useForSuggestions } : current); }}
        />
      )}
    </div>
  );
}

function MemoryDetail({
  memory, onClose, onConfirm, onPrune, onEdit, onToggleUse,
}: {
  memory: Memory;
  onClose: () => void;
  onConfirm: () => void;
  onPrune: () => void;
  onEdit: (text: string) => void;
  onToggleUse: () => void;
}) {
  const meta = STATUS_META[memory.status];
  const [draft, setDraft] = useState(memory.text);
  const canConfirm = memory.status === "dudosa" || memory.status === "reciente" || memory.status === "sensible";
  const changed = draft.trim() && draft.trim() !== memory.text;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bark/40 backdrop-blur-sm p-0 animate-fade-in">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 cursor-pointer" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-3xl bg-card p-6 pb-8 animate-slide-up overflow-hidden"
        style={{ boxShadow: "0 -8px 40px rgba(46, 38, 80, 0.15)" }}
      >
        {/* Decorative gradient top */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: "linear-gradient(90deg, var(--color-leaf), var(--color-forest), var(--color-leaf))" }}
        />

        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-5 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-warm-white/80 backdrop-blur-sm text-earth cursor-pointer transition-all hover:bg-warm-white hover:scale-105 active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Status badge with icon */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn("flex h-7 w-7 items-center justify-center rounded-lg", "bg-warm-white/60 backdrop-blur-sm")}
          >
            <meta.icon className={cn("h-4 w-4", meta.tint)} />
          </span>
          <span className={cn("text-xs font-semibold uppercase tracking-wide", meta.tint)}>
            {meta.label} · {memory.category}
          </span>
        </div>

        {/* Editable text */}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Editar memoria"
          className="mt-2 min-h-24 w-full resize-none rounded-xl border border-sand bg-warm-white/50 backdrop-blur-sm p-3 font-serif text-xl leading-snug text-bark outline-none transition-all focus:border-forest focus:bg-warm-white"
        />

        {changed && (
          <button
            type="button"
            onClick={() => onEdit(draft.trim())}
            className="mt-3 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream transition-all active:scale-[0.97] cursor-pointer hover:shadow-lg hover:shadow-forest/30 animate-fade-in"
          >
            Guardar cambio
          </button>
        )}

        {/* Origin info */}
        <div className="mt-4 rounded-xl bg-warm-white/60 backdrop-blur-sm p-4 border border-sand/50">
          <p className="text-xs font-semibold text-earth flex items-center gap-1">
            <Sprout className="h-3 w-3" /> Ver raíces
          </p>
          <p className="mt-1 text-sm leading-relaxed text-earth">{memory.origin}</p>
          <p className="mt-2 text-xs text-stone">{memory.savedOn}</p>
        </div>

        {/* Sensitive warning */}
        {memory.status === "sensible" && (
          <p className="mt-4 rounded-lg bg-blush/40 px-3 py-2 text-xs text-[#8a635c] flex items-center gap-2">
            <Lock className="h-3 w-3 shrink-0" />
            Memoria protegida. No la uso para sugerencias sin tu permiso.
          </p>
        )}

        {/* Toggle switch */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-sand/50 bg-warm-white/40 backdrop-blur-sm px-4 py-3">
          <div>
            <p className="text-sm font-medium text-bark">Usarla para sugerencias</p>
            <p className="text-xs text-earth">Puedes guardarla sin que aparezca proactivamente.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={memory.useForSuggestions}
            aria-label="Usar memoria para sugerencias"
            onClick={onToggleUse}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer",
              memory.useForSuggestions ? "bg-forest" : "bg-sand",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-cream shadow-sm transition-transform duration-200",
                memory.useForSuggestions ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex gap-3">
          {canConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-forest py-3 text-sm font-semibold text-cream transition-all active:scale-[0.97] cursor-pointer hover:shadow-lg hover:shadow-forest/30"
            >
              <Check className="h-4 w-4" /> Regar (confirmar)
            </button>
          )}
          <button
            type="button"
            onClick={onPrune}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full border-2 border-sand py-3 text-sm font-medium text-earth transition-all hover:bg-warm-white hover:border-stone cursor-pointer active:scale-[0.97]",
              canConfirm ? "px-5" : "flex-1",
            )}
          >
            <Scissors className="h-4 w-4" /> Podar
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-stone">
          Podar borra el recuerdo sin drama. Koru no se marchita.
        </p>
      </div>
    </div>
  );
}
