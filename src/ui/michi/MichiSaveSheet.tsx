import { useEffect, useRef, useState } from "react";
import { FolderHeart, PawPrint, Sparkles } from "lucide-react";
import "./michi-save.css";

export function MichiSaveSheet({ title, heading = "Guardar informe", automaticCollection, collections = [], onSave, onClose }: {
  title: string;
  heading?: string;
  automaticCollection: string;
  collections?: string[];
  onSave: (collection: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);
  const [mode, setMode] = useState<"automatic" | "folder">("automatic");
  const [folder, setFolder] = useState("Informes");
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal(); modal?.focus();
    return () => { modal?.close(); previous?.focus(); };
  }, []);
  useEffect(() => { if (mode === "folder") folderInput.current?.focus(); }, [mode]);
  return <dialog ref={dialog} tabIndex={-1} className="ms-save-dialog" aria-labelledby="ms-save-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')).filter(el => el.getClientRects().length && (!(el instanceof HTMLInputElement) || el.type !== "radio" || el.checked));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <form onSubmit={event => {
      event.preventDefault();
      const collection = mode === "automatic" ? automaticCollection : folder.trim();
      if (!collection || submitted.current) return;
      submitted.current = true;
      try { onSave(collection); } catch { submitted.current = false; setError("No pude guardar el informe. Intentá de nuevo."); }
    }}>
      <div className="ms-save-hero" aria-hidden="true"><img src="/assets/michi-icons/save-michi.webp" alt="" width="1000" height="500" /><span className="ms-save-handle" /></div>
      <div className="ms-save-body">
        <h2 id="ms-save-title">{heading}</h2>
        <p className="ms-save-subtitle" title={title}>{title}</p>
        <fieldset className="ms-save-options">
          <legend className="sr-only">Dónde guardar el informe</legend>
          <label className={`ms-save-option ${mode === "automatic" ? "is-selected" : ""}`}>
            <span className="ms-option-icon is-michi" aria-hidden="true"><PawPrint fill="white" size={27} /></span>
            <span className="ms-option-copy"><strong>Que Michi se encargue</strong><small>Michi agrupa por tema automáticamente</small></span>
            <input type="radio" name="save-destination" value="automatic" checked={mode === "automatic"} onChange={() => setMode("automatic")} />
          </label>
          <label className={`ms-save-option ${mode === "folder" ? "is-selected" : ""}`}>
            <span className="ms-option-icon is-folder" aria-hidden="true"><FolderHeart fill="#2697ff" color="#145bff" size={28} /></span>
            <span className="ms-option-copy"><strong>Elegir carpeta</strong><small>Pon el nombre que quieras</small></span>
            <input type="radio" name="save-destination" value="folder" checked={mode === "folder"} onChange={() => setMode("folder")} />
          </label>
        </fieldset>
        {mode === "folder" && <label className="ms-folder-field">Nombre de la carpeta<input ref={folderInput} value={folder} onChange={event => setFolder(event.target.value)} placeholder="Nombre de la carpeta" maxLength={120} list="ms-existing-folders" required /><datalist id="ms-existing-folders">{collections.map(collection => <option key={collection} value={collection} />)}</datalist></label>}
        {error && <p className="ms-save-error" role="alert">{error}</p>}
        <div className="ms-save-actions"><button type="button" className="ms-save-cancel" onClick={onClose}>Cancelar</button><button type="submit" className="ms-save-confirm" disabled={mode === "folder" && !folder.trim()}><Sparkles size={22} fill="white" />Guardar</button></div>
      </div>
    </form>
  </dialog>;
}
