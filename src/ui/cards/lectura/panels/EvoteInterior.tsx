/**
 * EvoteInterior — card "¿Qué lente uso?" (#p-evote), bind real del block
 * `election_vote` (question/subtitle/options).
 *
 * La pregunta real del block como título. Las options[] REALES como cards
 * seleccionables (estado local — sin preselección: la elección es del
 * usuario). El botón primario queda deshabilitado hasta elegir. Confirmar
 * → create_commitment REAL guardando la lente/voto elegido.
 */
import { useState } from "react";
import {
  PiggyBank,
  Shield,
  Trees,
  HeartPulse,
  GraduationCap,
  Check,
  Brain,
  ArrowRight,
  SlidersHorizontal,
  Dices,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-evote.css";

type EvoteBlock = Extract<UiBlock, { type: "election_vote" }>;

const LENS_ICONS: Array<{ Icon: LucideIcon; bg: string; color: string }> = [
  { Icon: PiggyBank, bg: "var(--mint-soft)", color: "var(--mint-ink)" },
  { Icon: Shield, bg: "var(--sky-soft)", color: "var(--sky-ink)" },
  { Icon: Trees, bg: "var(--honey-soft)", color: "var(--honey-ink)" },
  { Icon: HeartPulse, bg: "var(--rose-soft)", color: "var(--rose-ink)" },
  { Icon: GraduationCap, bg: "var(--violet-soft)", color: "var(--violet-ink)" },
];

export function EvoteInterior({ block, onClose, onSave }: LecturaInteriorProps<EvoteBlock>) {
  const [selected, setSelected] = useState<number | null>(null);
  const question = block.question || "¿Cómo ordeno esto?";
  const subtitle = block.subtitle;
  const options = block.options ?? [];
  const chosen = selected != null ? options[selected] : undefined;

  const confirm = (lens: string, sub?: string) => {
    dispatchCardAction("create_commitment", block, {
      title: `Tu lente: ${lens}`,
      dueHint: sub ?? "criterio guardado para el análisis",
    });
    onClose();
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(question, subtitle) : undefined}
      chip={{ label: "Tu voto", background: "linear-gradient(135deg,#8B6DFF,#6D52F8)" }}
      ariaLabel={question}
    >
      <div id="p-evote" className="lcr-panel">
        <div className="pr-hero rv">
          <div>
            <div className="pr-q">{question}</div>
            <p className="pr-sub" style={{ marginTop: "8px" }}>
              {subtitle ||
                "Elige una opción y arma el análisis desde ahí. Toca una para continuar."}
            </p>
          </div>
          {options.map((o, i) => {
            const { Icon, bg, color } = LENS_ICONS[i % LENS_ICONS.length];
            return (
              <button
                type="button"
                key={`opt_${i}_${o.label}`}
                className={`pr-card${selected === i ? " sel" : ""}`}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
              >
                <div className="pic2" style={{ background: bg }}>
                  <Ic i={Icon} className="ic" style={{ color }} />
                </div>
                <div className="pt">
                  <b>{o.label}</b>
                  {o.sub ? <span>{o.sub}</span> : null}
                </div>
                <span className="chk">
                  <Ic i={Check} className="ic" />
                </span>
              </button>
            );
          })}
        </div>

        {options.length > 1 && (
          <div className="pr-why rv">
            <h4>
              <Ic i={Brain} className="ic" />
              Por qué te lo pregunto
            </h4>
            <li>
              <Ic i={ArrowRight} className="ic" />
              <span>
                Con “{chosen ? chosen.label : options[0].label}” como lente, ordeno todo lo demás por
                impacto directo en vos.
              </span>
            </li>
            <li>
              <Ic i={ArrowRight} className="ic" />
              <span>Las otras opciones no desaparecen: quedan como contexto en el análisis.</span>
            </li>
            <li>
              <Ic i={ArrowRight} className="ic" />
              <span>Sin tu criterio, el empate técnico es imposible de romper.</span>
            </li>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!chosen}
            onClick={() => chosen && confirm(chosen.label, chosen.sub)}
          >
            <Ic i={SlidersHorizontal} className="ic" />
            {chosen ? `Usar: ${chosen.label}` : "Elige una opción"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => confirm("Balanceada", "sin lente dominante")}
          >
            <Ic i={Dices} className="ic" />
            Más balanceado
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
