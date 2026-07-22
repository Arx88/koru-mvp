import {
  BookOpen,
  CalendarDays,
  Check,
  Circle,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Flag,
  HeartPulse,
  Home,
  Mail,
  MoveRight,
  PiggyBank,
  SearchCheck,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { AssistantArtifact, AssistantPlanItem, AssistantSource, UiBlock } from "../domain/types";
import type { KoruTurnItem } from "./KoruProvider";
import { PlanHeroCard } from "./cards/PlanHeroCard";
import { KoruUnifiedCard } from "./cards/unified/KoruUnifiedCard";
import { CardSkeleton } from "./cards/unified/CardSkeleton";
import { CardError } from "./cards/unified/CardError";

export type CardActionHandlers = {
  onReview: (id: string, approve: boolean) => void;
  onConfirmMemory: (id: string) => void;
  onPruneMemory: (id: string) => void;
  onCompleteCommitment: (id: string) => void;
  onSetWorldSignals: (enabled: boolean) => void;
};

function downloadArtifact(file: AssistantArtifact) {
  const blob = new Blob([file.content ?? file.name], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileIcon(kind: AssistantArtifact["kind"]): LucideIcon {
  if (kind === "spreadsheet" || kind === "csv") return FileSpreadsheet;
  return FileText;
}

function planIcon(icon: AssistantPlanItem["icon"], index: number): LucideIcon {
  if (icon === "book") return BookOpen;
  if (icon === "move") return MoveRight;
  if (icon === "message") return Mail;
  if (icon === "calendar") return CalendarDays;
  if (icon === "money") return PiggyBank;
  if (icon === "heart") return Stethoscope;
  if (icon === "home") return Home;
  return index === 1 ? BookOpen : index === 2 ? MoveRight : Flag;
}

function recordDisplay(record: NonNullable<KoruTurnItem["records"]>[number]): string {
  if (record.kind === "expense" && record.amount) {
    return `${record.amount}${record.currency ? ` ${record.currency}` : ""}`;
  }
  if (record.value) return `${record.title}: ${record.value}`;
  return record.title;
}

function savedRecordTitle(records: NonNullable<KoruTurnItem["records"]>): string {
  if (records.length > 1) return `${records.length} datos guardados`;
  const record = records[0];
  if (record.kind === "expense") return "Gasto anotado";
  if (record.kind === "shopping_item") return "Compra guardada";
  if (record.kind === "medication") return "Salud guardada";
  if (record.kind === "deadline") return "Deadline guardado";
  if (record.kind === "person_followup") return "Seguimiento guardado";
  if (record.kind === "meal_inventory") return "Comida guardada";
  return "Dato guardado";
}

function firstClockText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const match = value?.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/);
    if (match) return match[0];
  }
  return undefined;
}

function stitchBlockFromLegacyItem(item: KoruTurnItem): UiBlock | undefined {
  if (item.uiBlock) return item.uiBlock;

  if (item.actionKind === "day_plan" && item.planItems?.length) {
    return {
      type: "plan",
      title: item.text,
      items: item.planItems,
      note: item.recommendation ?? item.payloadPreview ?? item.result,
    };
  }

  if ((item.actionKind === "web_research" || item.actionKind === "world_signal") && item.comparisonItems?.length) {
    return {
      type: "comparison",
      title: item.text,
      items: item.comparisonItems,
      recommendation: item.recommendation ?? item.result ?? item.payloadPreview,
      sources: item.sources,
    };
  }

  if (
    (item.actionKind === "web_research" || item.actionKind === "world_signal") &&
    (item.sources?.length || item.searchQueries?.length || item.recommendation || item.externalStatus)
  ) {
    return {
      type: "research_sources",
      title: item.text,
      summary: item.recommendation ?? item.payloadPreview ?? item.result ?? item.text,
      mode: item.webMode,
      sources: item.sources ?? [],
      sourceStatus: item.externalStatus ?? (item.sources?.length ? "verified" : "pending"),
      followUpQuestion: item.questions?.[0],
    };
  }

  if (item.actionKind === "money_summary" && (item.summaryItems?.length || item.totalAmount !== undefined || item.recommendation)) {
    return {
      type: "money_summary",
      title: item.text,
      total: item.totalAmount,
      currency: item.currency,
      summaryItems: item.summaryItems,
      recommendation: item.recommendation ?? item.result ?? item.payloadPreview,
    };
  }

  if ((item.actionKind === "reminder" || item.actionKind === "calendar_event") && (item.text || item.payloadPreview)) {
    return {
      type: "reminder",
      title: item.text,
      dueText: item.payloadPreview,
      note: item.recommendation ?? item.result,
    };
  }

  if (item.actionKind === "alarm") {
    return {
      type: "alarm",
      title: item.text,
      time: firstClockText(item.payloadPreview, item.text) ?? "Alarma",
      note: item.payloadPreview,
    };
  }

  const shoppingItems = item.records
    ?.filter((record) => record.kind === "shopping_item")
    .map((record) => record.value ?? record.title)
    .filter(Boolean)
    .slice(0, 8) as string[] | undefined;

  if ((item.actionKind === "restock_note" || item.actionKind === "structured_note") && shoppingItems?.length) {
    return {
      type: "shopping_list",
      title: item.text || "Lista de compras",
      items: shoppingItems,
      dueText: item.payloadPreview,
      note: item.recommendation ?? item.result,
    };
  }

  if (item.actionKind === "structured_note" && item.records?.length) {
    return {
      type: "saved_record",
      title: item.text,
      records: item.records.slice(0, 6),
    };
  }

  if (item.actionKind === "file_bundle" && item.files?.length) {
    return {
      type: "resource_bundle",
      title: item.text,
      files: item.files,
      summary: item.payloadPreview ?? item.result,
    };
  }

  if (
    ["morning_brief", "meeting_brief", "daily_brief", "decision_support"].includes(item.actionKind ?? "") &&
    (item.summaryItems?.length || item.contextReview?.length || item.recommendation || item.decisionVote)
  ) {
    const sectionTitle = item.actionKind === "decision_support"
      ? "Criterio"
      : item.actionKind === "meeting_brief"
        ? "Reunion"
        : "Actividad";
    return {
      type: "activity_group",
      title: item.text || (item.actionKind === "decision_support" ? "Decision" : "Actividad"),
      subtitle: item.recommendation ?? item.payloadPreview,
      sections: [
        {
          title: sectionTitle,
          tone: item.actionKind === "decision_support" ? "amber" : "green",
          tiles: item.summaryItems?.map((summary) => ({
            kind: item.actionKind === "decision_support" || item.actionKind === "morning_brief" ? "money" : "work",
            label: summary.label,
            value: summary.value,
            detail: summary.detail,
          })),
          rows: [
            ...(item.decisionVote
              ? [{
                  title: item.decisionVote === "wait" ? "Yo esperaria" : item.decisionVote === "go" ? "Yo avanzaria con cuidado" : "Me falta un dato",
                  detail: item.decisionAssumption,
                  meta: "Mi voto",
                  urgent: item.decisionVote === "wait",
                }]
              : []),
            ...(item.contextReview ?? []).map((review) => ({
              title: review.title,
              detail: review.detail,
              meta: review.priority,
              urgent: review.priority === "Alta",
            })),
          ],
        },
      ],
      note: item.recommendation ?? item.result,
    };
  }

  return undefined;
}



function primaryLine(item: KoruTurnItem): string {
  if (item.actionKind === "day_plan") return "Te lo ordene para que puedas empezar sin reconstruir todo.";
  if (item.actionKind === "structured_note") return item.records?.length ? savedRecordTitle(item.records) : "Dato guardado.";
  if (item.actionKind === "money_summary") return item.recommendation ?? "Te dejo el resumen con el criterio visible.";
  if (item.actionKind === "morning_brief") return item.recommendation ?? "Junte lo que ya se y marco lo que falta verificar.";
  if (item.actionKind === "meeting_brief") return item.recommendation ?? "Te dejo una agenda usable y los pendientes cerca.";
  if (item.actionKind === "decision_support") return item.recommendation ?? "Te doy criterio, supuesto y siguiente paso.";
  if (item.actionKind === "file_bundle") return "Prepare archivos editables con lo que ya tengo.";
  if (item.actionKind === "web_research") return item.recommendation ?? "Abro fuentes reales y separo evidencia de suposicion.";
  if (item.actionKind === "world_signal") return item.recommendation ?? "Traigo senales recientes sin convertirlo en ruido.";
  if (item.actionKind === "clarifying_question") return item.text;
  return item.payloadPreview ?? item.text;
}

function ActionTitle({ item, icon: Icon = Sparkles }: { item: KoruTurnItem; icon?: LucideIcon }) {
  return (
    <p className="koru-action-title">
      <Icon size={16} />
      <span>{primaryLine(item)}</span>
    </p>
  );
}

function WorkSteps({ item }: { item: KoruTurnItem }) {
  if (item.uiBlock || item.actionKind === "structured_note") return null;
  if (
    item.actionKind === "web_research" ||
    item.actionKind === "world_signal" ||
    item.actionKind === "morning_brief" ||
    item.actionKind === "clarifying_question"
  ) return null;
  if (!item.steps?.length) return null;
  const visible = item.steps
    .filter((step) => !/leyendo tu mensaje|buscando memoria relevante|agrupando por prioridad/i.test(step.text))
    .slice(0, 4);
  if (!visible.length) return null;
  return (
    <div className="koru-process-card">
      <ul className="koru-step-list">
        {visible.map((step) => (
          <li key={step.text} className={cn("koru-step", step.status === "waiting" && "is-waiting")}>
            <span className="koru-step-icon">
              {step.status === "done" ? <Check size={14} strokeWidth={2.4} /> : <Circle size={10} />}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanPreview({ items }: { items?: AssistantPlanItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="koru-plan">
      {items.map((plan, index) => {
        const Icon = planIcon(plan.icon, index);
        return (
          <div key={`${plan.time ?? index}-${plan.title}`} className="koru-plan-row">
            <span className={cn("koru-plan-icon", index === 1 && "is-amber", index >= 2 && "is-purple")}>
              <Icon size={16} />
            </span>
            <span className="koru-plan-time">{plan.time ?? "--:--"}</span>
            <span className="koru-plan-title">{plan.title}</span>
            {plan.durationMinutes && <span className="koru-plan-duration">{plan.durationMinutes} min</span>}
            {plan.priority && <span className={cn("koru-priority", plan.priority !== "Alta" && "is-medium")}>{plan.priority}</span>}
            {plan.rationale && <small className="koru-plan-rationale">{plan.rationale}</small>}
          </div>
        );
      })}
    </div>
  );
}

function ContextReview({ item }: { item: KoruTurnItem }) {
  if (!item.contextReview?.length) return null;
  if (
    item.actionKind === "structured_note" ||
    item.actionKind === "morning_brief" ||
    item.actionKind === "web_research" ||
    item.actionKind === "world_signal" ||
    item.actionKind === "decision_support"
  ) return null;
  const sourceLabel = {
    commitment: "Pendiente",
    memory: "Memoria",
    calendar: "Agenda",
    recent: "Reciente",
    nudge: "Aviso",
    record: "Dato",
  } as const;
  return (
    <div className="koru-context-review">
      <p className="koru-context-title">Mire esto antes de responderte</p>
      {item.contextReview.slice(0, 4).map((review) => (
        <div key={`${review.source}-${review.title}`} className="koru-context-row">
          <span className="koru-context-source">{sourceLabel[review.source]}</span>
          <span className="koru-context-copy">
            <span>{review.title}</span>
            <small>{review.detail}</small>
          </span>
          <span className={cn("koru-priority", review.priority !== "Alta" && "is-medium")}>{review.priority}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryModule({ item }: { item: KoruTurnItem }) {
  if (!item.summaryItems?.length && !item.recommendation && item.totalAmount === undefined) return null;
  if ((item.actionKind === "web_research" || item.actionKind === "world_signal") && !item.summaryItems?.length) return null;
  if (item.actionKind === "structured_note") return null;
  const title = item.actionKind === "money_summary"
    ? "Dinero"
    : item.actionKind === "morning_brief"
      ? item.webMode === "weather" ? "Clima" : "Actividad"
      : item.actionKind === "meeting_brief"
        ? "Reunion"
        : item.actionKind === "decision_support"
          ? "Decision"
          : "Resumen";
  return (
    <div className="koru-activity-module">
      <div className="koru-activity-header">
        <span className="koru-activity-icon">{title.slice(0, 1)}</span>
        <span>{title}</span>
      </div>
      {item.recommendation && item.actionKind !== "world_signal" && item.actionKind !== "web_research" && <p className="koru-activity-lead">{item.recommendation}</p>}
      {item.summaryItems?.length ? (
        <div className={cn("koru-summary-grid", item.summaryItems.length === 1 && "is-single")}>
          {item.summaryItems.slice(0, 6).map((summary) => (
            <div key={`${summary.label}-${summary.value}`} className="koru-summary-tile">
              <span className="koru-summary-label">{summary.label}</span>
              <strong>{summary.value}</strong>
              {summary.detail && <small>{summary.detail}</small>}
            </div>
          ))}
        </div>
      ) : null}
      {item.totalAmount !== undefined && !item.summaryItems?.some((summary) => /total|costo/i.test(summary.label)) && (
        <div className="koru-summary-tile is-single">
          <span className="koru-summary-label">Total</span>
          <strong>{item.totalAmount} {item.currency ?? ""}</strong>
        </div>
      )}
    </div>
  );
}

function DecisionCard({ item }: { item: KoruTurnItem }) {
  if (item.actionKind !== "decision_support") return null;
  const vote = item.decisionVote === "wait" ? "Yo esperaria" : item.decisionVote === "go" ? "Yo avanzaria con cuidado" : "Me falta un dato";
  return (
    <div className="koru-decision-card">
      <div>
        <span className="koru-card-kicker">Mi voto</span>
        <strong>{vote}</strong>
      </div>
      {item.recommendation && <p>{item.recommendation}</p>}
      {item.decisionAssumption && <small>{item.decisionAssumption}</small>}
    </div>
  );
}

function RecordsModule({ item }: { item: KoruTurnItem }) {
  if (!item.records?.length) return null;
  if (item.actionKind === "structured_note") {
    return <KoruUnifiedCard block={{ type: "saved_record", records: item.records as any, title: item.text }} />;
  }
  const listRecords = item.records.filter((record) =>
    ["shopping_item", "idea", "home_task", "person_followup", "deadline"].includes(record.kind),
  );
  if (listRecords.length) {
    return (
      <div className="koru-list-module">
        <div className="koru-activity-header">
          <span className="koru-activity-icon">L</span>
          <span>{listRecords.some((record) => record.kind === "shopping_item") ? "Lista de compras" : "Lista guardada"}</span>
        </div>
        {listRecords.slice(0, 6).map((record) => (
          <div key={`${record.domain}-${record.kind}-${record.title}`} className="koru-list-row">
            <span className="koru-record-check" />
            <span>
              <strong>{record.value ?? record.title}</strong>
              <small>{record.kind.replace(/_/g, " ")}</small>
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="koru-activity-module">
      <div className="koru-activity-header">
        <span className="koru-activity-icon">G</span>
        <span>Guardado</span>
      </div>
      <div className="koru-record-grid">
        {item.records.slice(0, 6).map((record) => (
          <div key={`${record.domain}-${record.kind}-${record.title}`} className="koru-record-chip">
            <span className="koru-record-check" />
            <span>
              <strong>{recordDisplay(record)}</strong>
              <small>{record.domain} - {record.kind.replace(/_/g, " ")}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileBundle({ files }: { files?: AssistantArtifact[] }) {
  if (!files?.length) return null;
  return (
    <div className="koru-resource-list">
      {files.map((file) => {
        const Icon = fileIcon(file.kind);
        return (
          <div key={file.name} className="koru-resource-row">
            <span className="koru-resource-icon">
              <Icon size={16} />
            </span>
            <span className="koru-resource-copy">
              <span className="koru-resource-title">{file.name}</span>
              <span className="koru-resource-meta">{file.kind.toUpperCase()} - {file.sizeLabel}</span>
            </span>
            <button type="button" onClick={() => downloadArtifact(file)} aria-label={`Descargar ${file.name}`} className="koru-icon-button">
              <FileText size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SourcePreview({ sources }: { sources?: AssistantSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="koru-source-wrap">
      {sources.slice(0, 5).map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="koru-source">
          <span className="koru-source-copy">
            <span className="koru-source-title">{source.title}</span>
            <span className="koru-source-domain">{source.domain}</span>
            {source.snippet && <span className="koru-source-snippet">{source.snippet}</span>}
          </span>
          <span className="koru-source-open"><ExternalLink size={18} /></span>
        </a>
      ))}
    </div>
  );
}

function QuestionList({ item }: { item: KoruTurnItem }) {
  if (!item.questions?.length) return null;
  const first = item.questions[0];
  const rest = item.questions.slice(1);
  return (
    <div className="koru-question-card">
      <span className="koru-card-kicker">Solo necesito esto</span>
      <strong>{first}</strong>
      {rest.length > 0 && (
        <div className="koru-question-followups">
          {rest.map((question) => <span key={question}>{question}</span>)}
        </div>
      )}
    </div>
  );
}

function ResearchBrief({ item }: { item: KoruTurnItem }) {
  if (!item.searchQueries?.length && !item.researchCriteria?.length && !item.externalStatus) return null;
  const modeLabel = item.webMode === "news"
    ? "Noticias"
    : item.webMode === "world"
      ? "El mundo"
    : item.webMode === "shopping"
      ? "Comparativa"
      : item.webMode === "weather"
        ? "Clima"
        : item.webMode === "traffic"
          ? "Ruta"
          : item.webMode === "market"
            ? "Mercados"
            : "Research";
  const statusCopy = {
    pending: "Listo para abrir fuentes reales",
    verified: item.verifiedAt
      ? `Verificado ${new Date(item.verifiedAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
      : "Fuentes verificadas",
    partial: "Resultados parciales",
    failed: "No se pudo navegar",
    not_configured: "Sin conector completo",
  } as const;
  return (
    <div className="koru-web-module">
      <div className="koru-activity-header">
        <span className="koru-activity-icon"><SearchCheck size={16} /></span>
        <span>{modeLabel}</span>
      </div>
      {item.externalStatus && (
        <p className="koru-activity-lead">
          {statusCopy[item.externalStatus]}. {item.externalStatus === "verified" ? "Uso esto como evidencia." : "No voy a inventar una conclusion cerrada."}
        </p>
      )}
      {item.searchQueries?.map((query) => (
        <div key={query} className="koru-web-query">
          <span>Consulta</span>
          <strong>{query}</strong>
        </div>
      ))}
      {item.researchCriteria?.length ? <small className="koru-web-criteria">{item.researchCriteria.join(" · ")}</small> : null}
    </div>
  );
}

function ComparisonPreview({ item }: { item: KoruTurnItem }) {
  if (!item.comparisonItems?.length) return null;
  return (
    <div className="koru-activity-module">
      <div className="koru-activity-header">
        <span className="koru-activity-icon">C</span>
        <span>Comparativa</span>
      </div>
      <div className="koru-record-grid">
        {item.comparisonItems.slice(0, 5).map((offer) => (
          <a key={`${offer.title}-${offer.url ?? offer.vendor ?? ""}`} href={offer.url} target="_blank" rel="noreferrer" className="koru-record-chip">
            <span className="koru-record-check" />
            <span>
              <strong>{offer.title}</strong>
              <small>{[offer.price, offer.vendor, offer.score ? `${offer.score}/100` : undefined].filter(Boolean).join(" - ")}</small>
              {offer.evidence && <small>{offer.evidence}</small>}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}






function UiBlockCardA({ item }: { item: KoruTurnItem }) {
  const block = item.uiBlock;
  if (!block) return null;

  // 🔴 KORU 3.0 — TODOS los blocks (incluido plan) se renderizan con
  // KoruUnifiedCard que tiene DetailOverlay (detalle extendido al tocar).
  // Antes el plan usaba PlanHeroCard que se mostraba inline sin detalle.
  // if (block.type === "plan") { return <PlanHeroCard block={block} />; }

  // 🔴 KIMI AUDIT — "Error honesto": si la tool marcó __forceHonestReply (la
  // única forma en que el backend nos dice "no inventes datos"), o si algún
  // block llega con status === "error", rendereamos el CardError en lugar de
  // la card real. Sin datos falsos, con reintento y promesa de aviso.
  const blockAny = block as UiBlock & { __forceHonestReply?: boolean; status?: string };
  if (blockAny.__forceHonestReply === true || (blockAny as { status?: string }).status === "error") {
    return <CardError />;
  }

  // 🔴 KIMI AUDIT — "Nunca un spinner genérico": mientras la card carga
  // (web_nav loading / deliverable working), rendereamos un skeleton con la
  // MISMA anatomía que el molde Stitch. El usuario "ve" la card que va a
  // llegar, sin ambigüedad ni spinner huérfano.
  if (block.type === "web_nav" && block.status === "loading") {
    return <CardSkeleton />;
  }

  if (block.type === "deliverable" && block.status === "working") {
    return <CardSkeleton />;
  }

  // TODO lo demás (los otros 44 tipos) se renderiza con el molde unificado
  // Stitch "Plan Entregado": hoja lila + detalle con magical-cards. Las
  // estéticas de card sueltas dejan de existir como lenguajes separados.
  return <KoruUnifiedCard block={block} />;
}


function secondaryActions(item: KoruTurnItem): Array<{ label: string; icon: LucideIcon; onClick?: () => void }> {
  if (item.actionKind === "web_research" || item.actionKind === "world_signal") {
    // 🔴 FIX: mostrar TODAS las fuentes, no solo la primera
    const sources = item.sources ?? [];
    if (sources.length === 0) return [];
    if (sources.length === 1) {
      return [{ label: "Abrir fuente", icon: ExternalLink, onClick: () => window.open(sources[0].url, "_blank", "noopener,noreferrer") }];
    }
    // Múltiples fuentes: botón que abre la primera + contador
    return [
      { label: `Ver ${sources.length} fuentes`, icon: ExternalLink, onClick: () => window.open(sources[0].url, "_blank", "noopener,noreferrer") },
    ];
  }
  return [];
}

function ActionButtons({ item, handlers }: { item: KoruTurnItem; handlers: CardActionHandlers }) {
  if (item.kind !== "action") return null;
  if (
    item.actionKind === "clarifying_question" ||
    item.actionKind === "structured_note" ||
    item.actionKind === "money_summary" ||
    item.actionKind === "morning_brief" ||
    item.actionKind === "decision_support"
  ) return null;
  const extras = secondaryActions(item);
  if (item.status === "rejected") return <p className="koru-card-note">Lo suelto. No hice nada con eso.</p>;
  if (item.status === "working") {
    const label = item.webMode === "shopping"
      ? "Comparando fuentes ahora..."
      : item.webMode === "world"
        ? "Buscando senales reales ahora..."
        : item.webMode === "weather"
          ? "Buscando clima ahora..."
          : "Buscando información...";
    return <p className="koru-card-note">{label}</p>;
  }
  if (item.status === "executed") {
    return (
      <>
        {item.result && item.actionKind !== "web_research" && item.actionKind !== "world_signal" && <p className="koru-card-result">{item.result}</p>}
        {extras.length > 0 && (
          <div className="koru-actions">
            {extras.map(({ label, icon: Icon, onClick }) => (
              <button key={label} type="button" onClick={onClick} className="koru-pill-button">
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}
        {item.actionKind === "world_signal" && (
          <div className="koru-actions">
            <button type="button" onClick={() => handlers.onSetWorldSignals(true)} className="koru-pill-button is-primary">
              <Check size={14} />
              Seguir radar
            </button>
            <button type="button" onClick={() => handlers.onSetWorldSignals(false)} className="koru-pill-button">
              <X size={14} />
              No por ahora
            </button>
          </div>
        )}
      </>
    );
  }
  return (
    <div className="koru-actions">
      <button type="button" onClick={() => handlers.onReview(item.id, true)} className="koru-pill-button is-primary">
        <Check size={14} />
        {item.approvalLabel ?? "Aprobar"}
      </button>
      <button type="button" onClick={() => handlers.onReview(item.id, false)} className="koru-pill-button">
        <X size={14} />
        {item.rejectLabel ?? "Soltar"}
      </button>
      {extras.map(({ label, icon: Icon, onClick }) => (
        <button key={label} type="button" onClick={onClick} className="koru-pill-button">
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

function MemoryCard({ item, handlers }: { item: KoruTurnItem; handlers: CardActionHandlers }) {
  return (
    <div className="koru-inline-card">
      <p className="koru-inline-tag">{item.tag}</p>
      <p className="koru-inline-text">{item.text}</p>
      {item.payloadPreview && <p className="koru-card-note">{item.payloadPreview}</p>}
      {item.kind === "memory" && item.status === "confirmed" && <p className="koru-card-result">Guardado. Lo voy a usar cuando ayude de verdad.</p>}
      {item.kind === "memory" && item.status === "rejected" && <p className="koru-card-note">Soltado. No lo uso como memoria.</p>}
      {item.kind === "memory" && item.status !== "confirmed" && item.status !== "rejected" && (
        <div className="koru-actions">
          <button type="button" onClick={() => handlers.onConfirmMemory(item.id)} className="koru-pill-button is-primary">
            <Check size={14} />
            Guardar
          </button>
          <button type="button" onClick={() => handlers.onPruneMemory(item.id)} className="koru-pill-button">
            <X size={14} />
            Soltar
          </button>
        </div>
      )}
      {item.kind === "commitment" && item.status === "executed" && <p className="koru-card-result">Marcado como hecho. Lo saco de tu carga mental.</p>}
      {item.kind === "commitment" && item.status !== "executed" && (
        <div className="koru-actions">
          <button type="button" onClick={() => handlers.onCompleteCommitment(item.id)} className="koru-pill-button is-primary">
            <Check size={14} />
            Marcar hecho
          </button>
        </div>
      )}
    </div>
  );
}

function ReminderMeta({ item }: { item: KoruTurnItem }) {
  if (item.actionKind !== "reminder" && item.actionKind !== "calendar_event") return null;
  return (
    <div className="koru-reminder-card">
      <span className="koru-card-kicker">{item.actionKind === "calendar_event" ? "Calendario local" : "Recordatorio"}</span>
      <strong>{item.text}</strong>
      {item.payloadPreview && <small>{item.payloadPreview}</small>}
    </div>
  );
}

const actionIcons: Partial<Record<NonNullable<KoruTurnItem["actionKind"]>, LucideIcon>> = {
  web_research: SearchCheck,
  world_signal: SearchCheck,
  decision_support: PiggyBank,
  money_summary: PiggyBank,
  meeting_brief: CalendarDays,
  morning_brief: Sparkles,
  reminder: CalendarDays,
  calendar_event: CalendarDays,
  structured_note: Check,
  day_plan: Flag,
  draft_message: Mail,
  restock_note: Home,
  daily_brief: HeartPulse,
};

export function KoruSemanticCard({ item, handlers }: { item: KoruTurnItem; handlers: CardActionHandlers }) {
  if (item.kind === "memory" || item.kind === "commitment") {
    return <MemoryCard item={item} handlers={handlers} />;
  }
  const stitchBlock = stitchBlockFromLegacyItem(item);
  if (stitchBlock) {
    const stitchItem = item.uiBlock === stitchBlock ? item : { ...item, uiBlock: stitchBlock };
    return (
      <div className="koru-action-content" data-card-kind={stitchItem.actionKind ?? stitchItem.kind} data-ui-block={stitchBlock.type} data-web-mode={stitchItem.webMode ?? undefined}>
        <UiBlockCardA item={stitchItem} />
        <ActionButtons item={stitchItem} handlers={handlers} />
      </div>
    );
  }
  const Icon = item.actionKind ? actionIcons[item.actionKind] : undefined;
  const compact = item.actionKind === "structured_note" || item.actionKind === "reminder" || item.actionKind === "restock_note";
  return (
    <div className="koru-action-content" data-card-kind={item.actionKind ?? item.kind} data-web-mode={item.webMode ?? undefined} data-compact={compact ? "true" : undefined}>
      <ActionTitle item={item} icon={Icon} />
      <QuestionList item={item} />
      <ReminderMeta item={item} />
      <DecisionCard item={item} />
      <SummaryModule item={item} />
      <RecordsModule item={item} />
      <PlanPreview items={item.planItems} />
      <ResearchBrief item={item} />
      <ComparisonPreview item={item} />
      <SourcePreview sources={item.sources} />
      <ContextReview item={item} />
      <FileBundle files={item.files} />
      <WorkSteps item={item} />
      <ActionButtons item={item} handlers={handlers} />
    </div>
  );
}
