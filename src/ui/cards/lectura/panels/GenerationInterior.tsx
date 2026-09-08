/**
 * GenerationInterior — card "Lo que generé" (#p-gen), bind real del block
 * `generation` (prompt + resultType + preview + images + tips + style).
 *
 * Muestra el concepto/prompt tal cual, las imágenes generadas si las hay
 * (variantes reales con su seed), el preview textual y los tips de prompt
 * engineering. Nada inventado: sin imágenes se dice que es la variante
 * texto, sin tips no hay sección.
 */
import { Sparkles, ImageIcon, Lightbulb, Wand2, Bookmark, ArrowLeft, Type } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-gen.css";

type GenBlock = Extract<UiBlock, { type: "generation" }>;

export function GenerationInterior({ block, onClose, onSave }: LecturaInteriorProps<GenBlock>) {
  const prompt = String(block.prompt ?? "").trim();
  const preview = String(block.preview ?? "").trim();
  const images = (block.images ?? []).filter((im) => im && /^https?:\/\//i.test(String(im.url ?? "")) || String(im.url ?? "").startsWith("data:image"));
  const tips = (block.tips ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 5);
  const title = String(block.title ?? "").trim() || "Tu generación";
  const actionLabel = String(block.actionLabel ?? "").trim() || "Guardar concepto";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.style) : undefined}
      chip={{ label: "Generación", background: "linear-gradient(135deg,#f6bd6d,#b45309)" }}
      ariaLabel={title}
    >
      <div id="p-gen" className="lcr-panel">
        <div className="gen-head rv">
          <h1>
            <small>{block.resultType === "image" ? "Imagen generada" : block.resultType === "code" ? "Código generado" : block.resultType === "document" ? "Documento generado" : "Concepto generado"}</small>
            {title}
          </h1>
          {(block.style || block.aspectRatio) && (
            <p>
              {block.style ? `Estilo ${String(block.style)}` : ""}
              {block.style && block.aspectRatio ? " · " : ""}
              {block.aspectRatio ? `Formato ${String(block.aspectRatio)}` : ""}
            </p>
          )}
        </div>

        {prompt && (
          <div className="gen-prompt rv">
            <div className="gp-label">
              <Ic i={Wand2} className="ic" />
              Lo que pediste, textual
            </div>
            <p>“{prompt}”</p>
          </div>
        )}

        {images.length > 0 && (
          <div className="gen-images rv">
            <div className="gen-sub">
              <Ic i={ImageIcon} className="ic" />
              {images.length === 1 ? "La imagen" : `Las ${images.length} variantes`}
            </div>
            <div className={`gen-grid${images.length === 1 ? " single" : ""}`}>
              {images.map((im, i) => (
                <figure key={`gi_${i}`}>
                  <img src={String(im.url)} alt={`Variante ${i + 1} del concepto`} loading="lazy" />
                  <figcaption>
                    <span>v{i + 1}</span>
                    <em>seed {String(im.seed ?? "—")}</em>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {preview && (
          <div className="gen-preview rv">
            <div className="gen-sub">
              <Ic i={Type} className="ic" />
              El concepto, en palabras
            </div>
            <p>{preview}</p>
          </div>
        )}

        {tips.length > 0 && (
          <div className="gen-tips rv">
            <div className="gen-sub">
              <Ic i={Lightbulb} className="ic" />
              Para clavarlo la próxima
            </div>
            {tips.map((t, i) => (
              <div key={`tip_${i}`} className="gen-tip">
                <span className="idx">{i + 1}</span>
                <p>{t}</p>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => (onSave ? onSave(title, block.style) : onClose())}
          >
            <Ic i={Bookmark} className="ic" />
            {actionLabel}
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={ArrowLeft} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
