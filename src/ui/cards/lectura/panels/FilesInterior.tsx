/**
 * FilesInterior — card "Archivos de tu chat" (#p-files), bind real del
 * block `resource_bundle` (title/files/summary).
 *
 * Los files[] REALES (AssistantArtifact) arman la bandeja: nombre, sello
 * de tipo derivado del kind + mimeType (PDF/DOC/XLS/PPT/CSV…), tamaño real
 * (sizeLabel) y preview del contenido cuando el artifact lo trae (texto
 * verbatim recortado). El summary real va a la nota. Sin datos que no
 * están en el block: nada de fechas ni estados inventados.
 * Acción: descargar el archivo (blob real del content si existe).
 */
import { useState } from "react";
import {
  FolderOpen,
  CloudUpload,
  Paperclip,
  Copy,
  Check,
  Download,
  FileText,
  FileSpreadsheet,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock, AssistantArtifact } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-files.css";

type FilesBlock = Extract<UiBlock, { type: "resource_bundle" }>;

function stampOf(file: AssistantArtifact): { label: string; cls: string } {
  const mt = file.mimeType.toLowerCase();
  if (mt.includes("pdf")) return { label: "PDF", cls: "pdf" };
  if (file.kind === "spreadsheet" || mt.includes("sheet") || mt.includes("csv"))
    return { label: file.kind === "csv" ? "CSV" : "XLS", cls: "doc" };
  if (file.kind === "presentation") return { label: "PPT", cls: "doc" };
  if (file.kind === "markdown") return { label: "MD", cls: "doc" };
  if (file.kind === "text") return { label: "TXT", cls: "doc" };
  return { label: "DOC", cls: "doc" };
}

function iconOf(file: AssistantArtifact): LucideIcon {
  if (file.kind === "spreadsheet" || file.kind === "csv") return FileSpreadsheet;
  if (file.kind === "presentation") return Presentation;
  return FileText;
}

function contextOf(file: AssistantArtifact): string | null {
  if (file.content) return `${file.content.slice(0, 64)}${file.content.length > 64 ? "…" : ""}`;
  return null;
}

export function FilesInterior({ block, onClose, onSave }: LecturaInteriorProps<FilesBlock>) {
  const files = block.files ?? [];
  // Copiar contenido real del artifact con feedback visible por archivo.
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const title = block.title || "Archivos de tu chat";

  const download = (file: AssistantArtifact) => {
    if (!file.content) return;
    try {
      const blob = new Blob([file.content], { type: file.mimeType || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* jsdom/sandbox — la descarga es best-effort */
    }
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, `${files.length} archivos`) : undefined}
      chip={{ label: "Archivos", background: "linear-gradient(135deg,#6ee7b7,#059669)" }}
      ariaLabel={title}
    >
      <div id="p-files" className="lcr-panel">
        <div className="fl-head rv">
          <h1>
            <small>Lo que me pasaste</small>
            {title}
          </h1>
          <p>
            {files.length
              ? "Los documentos de nuestra conversación, con su contenido a mano."
              : "Todavía no me pasaste archivos en este hilo."}
          </p>
        </div>

        <div className="fl-tray rv">
          <div className="fl-top">
            <div className="t">
              <div className="icb">
                <Ic i={FolderOpen} className="ic" />
              </div>
              <b>Bandeja de archivos</b>
            </div>
            <span className="cnt4">{files.length} archivos</span>
          </div>

          {files.map((f, i) => {
            const stamp = stampOf(f);
            const Icon = iconOf(f);
            return (
              <div key={`file_${i}_${f.name}`} className="fl-item">
              <button
                type="button"
                className="fl-row"
                onClick={() => download(f)}
                style={{ textAlign: "left", width: "100%" }}
              >
                <div className="th">
                  <div className={`ft ${stamp.cls}`}>
                    <span>
                      <Ic i={Icon} className="ic" style={{ fontSize: 14, verticalAlign: -2 }} />{" "}
                      {stamp.label}
                    </span>
                  </div>
                </div>
                <div className="tx">
                  <b>{f.name}</b>
                  <span>{contextOf(f) ?? f.mimeType}</span>
                </div>
                <div className="sz">
                  <b>{f.sizeLabel}</b>
                  <span>{f.kind}</span>
                </div>
              </button>
              {f.content && (
                <button
                  type="button"
                  className="fl-copy"
                  aria-pressed={copiedIdx === i}
                  key={`copy_${i}_${f.name}`}
                  onClick={() => {
                    setCopiedIdx(i);
                    try {
                      void navigator.clipboard?.writeText(f.content ?? "");
                    } catch {
                      /* clipboard best-effort */
                    }
                    setTimeout(() => setCopiedIdx((cur) => (cur === i ? null : cur)), 1600);
                  }}
                >
                  <Ic i={copiedIdx === i ? Check : Copy} className="ic" style={{ fontSize: 13 }} />
                  {copiedIdx === i ? "Copiado" : "Copiar"}
                </button>
              )}
              </div>
            );
          })}

          {block.summary && (
            <div className="fl-new">
              <Ic i={CloudUpload} className="ic" />
              <p>{block.summary}</p>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={files.length === 0 || !files[0]?.content}
            onClick={() => files[0] && download(files[0])}
          >
            <Ic i={Download} className="ic" />
            Descargar el primero
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={Paperclip} className="ic" />
            Pasarme otro archivo
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
