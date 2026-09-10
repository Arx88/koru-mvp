/**
 * ClarifyInterior — card "Una pregunta" (#p-clar), bind real del block
 * `clarifying_question` (question + options + expectedSlot).
 *
 * Koru pide un dato antes de armar algo. Las opciones son botones REALES:
 * al tocar una se envía la respuesta al chat vía el evento `koru:chat-send`
 * (KoruProvider lo puentea a sendMessage → pasa por el pipeline real), y se
 * despacha `clarifying:answer` para el registro de la acción. Sin opciones,
 * solo se muestra la pregunta (responderla queda en el chat).
 */
import { HelpCircle, Send, X, MessageCircle } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-clar.css";

type ClarifyBlock = Extract<UiBlock, { type: "clarifying_question" }>;

export function ClarifyInterior({ block, onClose }: LecturaInteriorProps<ClarifyBlock>) {
  const question = String(block.question ?? "").trim();
  const options = (block.options ?? []).map((o) => String(o).trim()).filter(Boolean);
  const title = String(block.title ?? "").trim() || "Una pregunta";

  const answer = (option: string) => {
    dispatchCardAction("clarifying:answer", block, { answer: option });
    window.dispatchEvent(new CustomEvent("koru:chat-send", { detail: { text: option } }));
    onClose();
  };

  return (
    <LecturaShell
      onClose={onClose}
      chip={{ label: "Pregunta", background: "linear-gradient(135deg,#c4b5fd,#6D52F8)" }}
      ariaLabel={title}
    >
      <div id="p-clar" className="lcr-panel">
        <div className="cl-hero rv">
          <div className="cl-q">
            <Ic i={HelpCircle} className="ic" />
          </div>
          <span className="cl-kicker">{title}</span>
          <h1>{question || "Necesito un dato para hacerlo bien."}</h1>
          {block.expectedSlot && <p className="cl-slot">Falta: {String(block.expectedSlot)}</p>}
        </div>

        {options.length > 0 && (
          <div className="cl-options rv">
            <div className="cl-sub">Tocá una y Koru sigue</div>
            {options.map((opt) => (
              <button key={`opt_${opt}`} type="button" className="cl-opt" onClick={() => answer(opt)}>
                <span>{opt}</span>
                <Ic i={Send} className="ic" />
              </button>
            ))}
          </div>
        )}

        {options.length === 0 && (
          <div className="cl-manual rv">
            <Ic i={MessageCircle} className="ic" />
            <p>Contasela en el chat y Koru arma el resto.</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              dispatchCardAction("clarifying:cancel", block);
              onClose();
            }}
          >
            <Ic i={X} className="ic" />
            Mejor déjalo
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
