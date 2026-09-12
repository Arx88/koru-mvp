import { useEffect, useState } from "react";
import { Check, Clock3, List, Search, Sparkles } from "lucide-react";
import type { AgentActivityKind } from "../../domain/agentKernel";
import { MichiCat } from "./v8Shared";
import "./michi-research.css";

export type WorkingDeliverable = { kicker: string; progress?: number; phaseLabel?: string };

export function MichiResearchLoading({ phase, kind, deliverable }: {
  phase: string | null;
  kind?: AgentActivityKind;
  deliverable?: WorkingDeliverable | null;
}) {
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTakingLonger(true), 35_000);
    return () => window.clearTimeout(timer);
  }, []);
  const planning = kind === "planning" && !/informe|investig|búsqueda/i.test(deliverable?.kicker ?? "");
  const writing = kind === "writing" && !/informe|investig/i.test(deliverable?.kicker ?? "");
  const steps = [
    { label: "Analizando tu pedido", icon: Search },
    { label: planning ? "Organizando los pasos" : writing ? "Desarrollando las ideas" : "Explorando fuentes confiables", icon: List },
    { label: planning ? "Preparando tu plan" : "Organizando la respuesta", icon: Sparkles },
  ];
  // These are pipeline stages, not an elapsed-time estimate of completion.
  const active = ["planning", "writing", "saving", "done"].includes(phase ?? "") ? 2
    : ["searching", "comparing"].includes(phase ?? "") ? 1 : 0;
  const rawProgress = deliverable?.progress;
  const progress = typeof rawProgress === "number" && Number.isFinite(rawProgress)
    ? Math.min(100, Math.max(0, Math.round(rawProgress))) : undefined;
  const currentLabel = deliverable?.phaseLabel?.trim() || steps[active].label;
  return <div className="mr-research">
    <span className="mr-avatar" aria-hidden="true"><MichiCat size={36} /></span>
    <div className="mr-art" aria-hidden="true">
      <img src="/assets/michi-icons/research-michi.webp" alt="" width="900" height="600" />
      <Sparkles className="mr-spark mr-spark-left" size={22} />
      <Sparkles className="mr-spark mr-spark-right" size={18} />
    </div>
    <section className="mr-panel" aria-labelledby="mr-title">
      <h2 id="mr-title">{planning ? "Estoy armando tu plan" : writing ? "Estoy preparando tu texto" : "Estoy investigando"}<span>para ti</span></h2>
      <p className="mr-description">{planning ? "Ordenando tus ideas y preparando pasos claros para ayudarte a avanzar." : writing ? "Dándole forma a tus ideas y cuidando cada detalle de la respuesta." : "Reuniendo información, comparando fuentes y organizando una respuesta clara."}</p>
      <div className="mr-progress-row">
        <div className="mr-progress" role="progressbar" aria-label="Progreso de la tarea" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={progress === undefined ? currentLabel : `${progress}%. ${currentLabel}`}>
          <span className={progress === undefined ? "is-indeterminate" : undefined} style={progress === undefined ? undefined : { width: `${progress}%` }} />
        </div>
        <strong className="mr-percent">{progress === undefined ? "En curso" : `${progress}%`}</strong>
      </div>
      <ol className="mr-steps" aria-label="Etapas de la tarea">
        {steps.map(({ label, icon: Icon }, index) => <li key={label} className={index < active ? "is-done" : index === active ? "is-active" : "is-pending"} aria-current={index === active ? "step" : undefined}>
          <span className="mr-step-icon" aria-hidden="true"><Icon size={21} /></span>
          <span>{label}<span className="sr-only">{index < active ? ": completado" : index === active ? ": en curso" : ": pendiente"}</span></span>
          <span className="mr-step-state" aria-hidden="true">{index < active && <Check size={17} />}</span>
        </li>)}
      </ol>
      <p className={currentLabel === steps[active].label ? "sr-only" : "mr-live"} role="status" aria-live="polite" aria-atomic="true">{currentLabel}</p>
      <p className="mr-hint"><Clock3 size={16} aria-hidden="true" /><span>{takingLonger ? "Sigo trabajando. Puedes seguir escribiendo mientras termino." : "Puedes seguir escribiendo mientras trabajo."}</span></p>
      <div className="mr-clouds mr-clouds-bottom" aria-hidden="true"><i /><i /><i /></div>
    </section>
  </div>;
}
