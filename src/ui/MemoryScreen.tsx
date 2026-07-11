import { useState } from "react";
import { Leaf, Scissors, Sprout, TreePine, X, Check, Lock } from "lucide-react";
import { useKoru, type Memory, type MemoryStatus } from "./KoruProvider";
import { cn } from "../lib/utils";

const STATUS_META: Record<MemoryStatus, { label: string; icon: typeof Leaf; tint: string; ring: string }> = {
  reciente: { label: "Reciente", icon: Sprout, tint: "text-sage", ring: "border-sand" },
  confirmada: { label: "Confirmada", icon: Leaf, tint: "text-moss", ring: "border-leaf" },
  dudosa: { label: "Dudosa", icon: Sprout, tint: "text-stone", ring: "border-dashed border-stone" },
  importante: { label: "Importante", icon: TreePine, tint: "text-forest", ring: "border-forest" },
  sensible: { label: "Sensible", icon: Lock, tint: "text-[#b58a82]", ring: "border-blush" },
};

export function MemoryScreen() {
  const { memories, roots, confirmMemory, pruneMemory, editMemory, toggleMemoryUse } = useKoru();
  const [selected, setSelected] = useState<Memory | null>(null);
  const needAttention = memories.filter((m) => m.status === "dudosa" || m.status === "reciente").length;

  return (
    <div className="flex h-full flex-col px-6 pb-4 pt-8">
      <header className="animate-rise">
        <h1 className="font-serif text-2xl text-bark">Mi jardín</h1>
        <p className="mt-1 text-sm text-earth">
          {memories.length} plantas · {roots} raíces
          {needAttention > 0 && ` · ${needAttention} necesitan atención`}
        </p>
      </header>

      <div className="mt-6 grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto">
        {memories.map((m) => {
          const meta = STATUS_META[m.status];
          const Icon = meta.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:shadow-[0_4px_14px_rgba(92,122,95,0.1)] active:scale-[0.98] cursor-pointer",
                meta.ring,
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-white">
                <Icon className={cn("h-5 w-5", meta.tint)} />
              </span>
              <span className="text-[13px] font-medium leading-snug text-bark">{m.text}</span>
              <span className={cn("text-[11px] font-semibold", meta.tint)}>{meta.label}</span>
            </button>
          );
        })}
      </div>

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bark/30 p-0">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl bg-card p-6 pb-8 animate-rise">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-warm-white text-earth cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <span className={cn("text-xs font-semibold uppercase", meta.tint)}>
          {meta.label} · {memory.category}
        </span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Editar memoria"
          className="mt-2 min-h-24 w-full resize-none rounded-xl border border-sand bg-warm-white p-3 font-serif text-xl leading-snug text-bark outline-none transition-colors focus:border-forest"
        />

        {changed && (
          <button
            type="button"
            onClick={() => onEdit(draft.trim())}
            className="mt-3 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream transition-transform active:scale-[0.97] cursor-pointer"
          >
            Guardar cambio
          </button>
        )}

        <div className="mt-4 rounded-xl bg-warm-white p-4">
          <p className="text-xs font-semibold text-earth">Ver raíces</p>
          <p className="mt-1 text-sm leading-relaxed text-earth">{memory.origin}</p>
          <p className="mt-2 text-xs text-stone">{memory.savedOn}</p>
        </div>

        {memory.status === "sensible" && (
          <p className="mt-4 rounded-lg bg-blush/40 px-3 py-2 text-xs text-[#8a635c]">
            Memoria protegida. No la uso para sugerencias sin tu permiso.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between rounded-xl border border-sand bg-card px-4 py-3">
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
                "absolute top-1 h-5 w-5 rounded-full bg-cream shadow-sm transition-transform",
                memory.useForSuggestions ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          {canConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-forest py-3 text-sm font-semibold text-cream transition-transform active:scale-[0.97] cursor-pointer"
            >
              <Check className="h-4 w-4" /> Regar (confirmar)
            </button>
          )}
          <button
            type="button"
            onClick={onPrune}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full border-2 border-sand py-3 text-sm font-medium text-earth transition-colors hover:bg-warm-white cursor-pointer",
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
