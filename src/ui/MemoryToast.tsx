import { useEffect, useRef, useState } from "react";
import { Check, FolderOpen, Heart, PawPrint, X } from "lucide-react";
import "./michi/michi-memory-toast.css";

type MemoryToastProps = {
  kind: string;
  text: string;
  onDismiss: () => void;
  memoryId?: string;
  confirmed?: boolean;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
  collection?: string;
  onOpenCollections?: (collection?: string) => void;
};

export function MemoryToast({ kind, text, onDismiss, memoryId, confirmed = false, onConfirm, onReject, collection, onOpenCollections }: MemoryToastProps) {
  const [phase, setPhase] = useState<"visible" | "confirmed" | "rejected" | "exit">("visible");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (callback: () => void, delay: number) => { timers.current.push(setTimeout(callback, delay)); };
  const dismiss = () => {
    timers.current.forEach(clearTimeout);
    setPhase("exit"); later(onDismiss, 200);
  };
  const savedRecord = kind === "saved";
  const savedMemory = confirmed || phase === "confirmed";
  const canConfirm = !savedRecord && !savedMemory && phase === "visible" && Boolean(memoryId && onConfirm);
  const canReject = !savedRecord && !savedMemory && phase === "visible" && Boolean(memoryId && onReject);
  const title = phase === "rejected" ? "Recuerdo soltado" : savedRecord ? "Guardado" : savedMemory ? "Recuerdo guardado" : canConfirm ? "¿Guardamos este recuerdo?" : "Un nuevo recuerdo";
  const complete = (action: "confirmed" | "rejected") => {
    if (!memoryId || phase !== "visible") return;
    setPhase(action);
    if (action === "confirmed") onConfirm?.(memoryId); else onReject?.(memoryId);
    later(dismiss, action === "confirmed" ? 1600 : 1200);
  };
  return <div className={`mt-memory-toast is-${phase}`} aria-label="Notificación de Michi">
    <div className="mt-heart-bubble" aria-hidden="true">{phase === "rejected" ? <X size={27} /> : savedRecord ? <Check size={28} /> : <Heart size={30} fill="#ff4e97" stroke="#ff7daf" strokeWidth={1.3} />}</div>
    <div className="mt-memory-copy">
      <div role="status" aria-live="polite" aria-atomic="true">
        <span className="mt-memory-label"><PawPrint size={16} fill="#ffe059" color="#ffe059" aria-hidden="true" />{title}</span>
        <p className="mt-memory-text">{text}</p>
      </div>
      {(canConfirm || canReject) && <div className="mt-memory-actions">
        {canConfirm && <button type="button" className="mt-memory-confirm" onClick={() => complete("confirmed")}><Check size={14} />Guardar</button>}
        {canReject && <button type="button" onClick={() => complete("rejected")}><X size={14} />Soltar</button>}
      </div>}
      {savedRecord && collection && onOpenCollections && <div className="mt-memory-actions"><button type="button" onClick={() => { onOpenCollections(collection); dismiss(); }}><FolderOpen size={15} />Ver</button></div>}
    </div>
    <img className="mt-memory-michi" src="/assets/michi-icons/memory-michi.webp" width="300" height="300" alt="" aria-hidden="true" />
    <button type="button" className="mt-memory-close" aria-label="Cerrar" onClick={dismiss}><X size={20} /></button>
  </div>;
}
