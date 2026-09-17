import { useEffect, useRef } from "react";
import type { LifeRecord } from "../domain/types";
import { KoruUnifiedCard } from "./cards/unified/KoruUnifiedCard";
import "./michi/michi-save.css";

export function ReopenedRecordSheet({ record, onClose }: { record: LifeRecord; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    return () => { modal?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="ms-save-dialog" aria-label="Elemento guardado"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}>
    <div className="ms-save-body" style={{ paddingTop: 18 }}>
      {record.sourceBlock && <KoruUnifiedCard block={record.sourceBlock} key={record.id} />}
      <div className="ms-save-actions"><button type="button" className="ms-save-cancel" onClick={onClose}>Cerrar elemento guardado</button></div>
    </div>
  </dialog>;
}
