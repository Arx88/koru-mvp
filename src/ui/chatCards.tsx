import {
  BookOpen,
  CalendarDays,
  Check,
  CloudSun,
  Clock,
  Circle,
  DollarSign,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Flag,
  HeartPulse,
  Home,
  Mail,
  MoveRight,
  PiggyBank,
  Pill,
  SearchCheck,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Sun,
  Truck,
  Users,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { AssistantArtifact, AssistantPlanItem, AssistantSource, UiBlock } from "../domain/types";
import type { KoruTurnItem } from "./KoruProvider";

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

function signalIcon(category: string): LucideIcon {
  if (category === "weather") return CloudSun;
  if (category === "traffic") return Waypoints;
  if (category === "market") return DollarSign;
  if (category === "health") return Pill;
  if (category === "relationship") return Users;
  if (category === "home" || category === "package") return Truck;
  if (category === "news" || category === "world") return SearchCheck;
  return Sparkles;
}

function recordDisplay(record: NonNullable<KoruTurnItem["records"]>[number]): string {
  if (record.kind === "expense" && record.amount) {
    return `${record.amount}${record.currency ? ` ${record.currency}` : ""}`;
  }
  if (record.value) return `${record.title}: ${record.value}`;
  return record.title;
}

function recordDetail(record: NonNullable<KoruTurnItem["records"]>[number]): string {
  if (record.collection && record.kind !== "shopping_item") return record.collection;
  if (record.kind === "expense") return record.title || record.value || "Gasto";
  if (record.kind === "shopping_item") return record.dueHint ?? "Compras";
  if (record.kind === "medication") return record.dueHint ?? "Salud";
  if (record.kind === "meeting_note") return record.person ? `Reunion con ${record.person}` : "Reunion";
  if (record.kind === "person_followup") return record.person ? `Seguimiento con ${record.person}` : "Seguimiento";
  if (record.kind === "deadline") return record.dueHint ?? "Deadline";
  if (record.kind === "meal_inventory") return "Comida en casa";
  if (record.kind === "tool_link") return record.url ?? record.collection ?? "Herramienta";
  return record.value && record.value !== record.title ? record.value : record.kind.replace(/_/g, " ");
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

function cleanLabel(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function joinParts(parts: Array<string | number | undefined | null>): string {
  return parts
    .map((part) => (part === undefined || part === null ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" - ");
}

function moneyLabel(amount?: number, currency?: string): string | undefined {
  if (amount === undefined) return undefined;
  return `${amount}${currency ? ` ${currency}` : ""}`;
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

function statusLabel(status?: KoruTurnItem["externalStatus"]): string {
  if (status === "verified") return "Fuentes verificadas";
  if (status === "partial") return "Resultados parciales";
  if (status === "failed") return "No se pudo navegar";
  if (status === "not_configured") return "Sin conector completo";
  return "Fuentes";
}

function recordKindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

function uniqueLabels(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values
    .map(cleanLabel)
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function StitchHeader({
  icon: Icon,
  hint,
  title,
  tone = "accent",
}: {
  icon: LucideIcon;
  hint: string;
  title: string;
  tone?: "accent" | "amber" | "rose" | "purple" | "blue";
}) {
  return (
    <div className="koru-stitch-card-header">
      <span className={cn("koru-stitch-icon", tone !== "accent" && `is-${tone}`)}>
        <Icon size={16} />
      </span>
      <span className="koru-stitch-heading">
        <span className="koru-card-hint">{hint}</span>
        <strong className="koru-card-title">{title}</strong>
      </span>
    </div>
  );
}

function StitchRow({
  icon: Icon,
  eyebrow,
  title,
  detail,
  chip,
  href,
  highlighted,
  tone = "accent",
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  detail?: string;
  chip?: string;
  href?: string;
  highlighted?: boolean;
  tone?: "accent" | "amber" | "rose" | "purple" | "blue" | "muted";
}) {
  const marker = (
    <span className={cn("koru-stitch-row-marker", `is-${tone}`)}>
      {Icon ? <Icon size={14} /> : eyebrow}
    </span>
  );
  const content = (
    <>
      {marker}
      <span className="koru-stitch-row-copy">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {chip && <em>{chip}</em>}
    </>
  );
  const className = cn("koru-stitch-row", highlighted && "is-highlighted");
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

function StitchNote({ children, tone = "accent" }: { children?: string; tone?: "accent" | "amber" | "blue" }) {
  if (!children) return null;
  return <p className={cn("koru-stitch-note", `is-${tone}`)}>{children}</p>;
}

function StitchPills({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <div className="koru-stitch-pill-row">
      {labels.slice(0, 4).map((label) => <span key={label} className="koru-stitch-pill">{label}</span>)}
    </div>
  );
}

function StitchSummaryGrid({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  if (!items.length) return null;
  return (
    <div className={cn("koru-stitch-grid", items.length === 1 && "is-single")}>
      {items.slice(0, 4).map((summary) => (
        <div key={`${summary.label}-${summary.value}`} className="koru-stitch-tile">
          <small>{summary.label}</small>
          <strong>{summary.value}</strong>
          {summary.detail && <span>{summary.detail}</span>}
        </div>
      ))}
    </div>
  );
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

function SavedRecordCard({ item, records, title }: { item: KoruTurnItem; records: NonNullable<KoruTurnItem["records"]>; title?: string }) {
  const compactTitle = !title || /^(datos?(?:\s+guardados?)?|guardar\s+datos?(?:\s+util(?:es)?)?|guardado)$/i.test(title.trim())
    ? savedRecordTitle(records)
    : title;
  const first = records[0];
  const hint = first?.kind === "tool_link"
    ? "Herramienta guardada"
    : first?.kind === "expense"
      ? "Gasto guardado"
      : first?.kind === "shopping_item"
        ? "Compra guardada"
        : "Dato guardado";
  const chips = uniqueLabels(records.flatMap((record) => [record.collection, record.domain, record.kind ? recordKindLabel(record.kind) : undefined]));
  return (
    <div className="koru-saved-record-card koru-stitch-card" data-ui-block="saved_record" data-card-kind={item.actionKind ?? item.kind}>
      <StitchHeader icon={Check} hint={hint} title={compactTitle} />
      <div className="koru-stitch-content">
        {records.slice(0, 6).map((record) => (
          <StitchRow
            key={`${record.domain}-${record.kind}-${record.title}-${record.value ?? ""}`}
            icon={Check}
            title={recordDisplay(record)}
            detail={recordDetail(record)}
            chip={record.collection ?? record.domain}
          />
        ))}
        <StitchPills labels={chips} />
      </div>
    </div>
  );
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
    return <SavedRecordCard item={item} records={item.records} />;
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

function PlanCardA({ items, note, title }: { items: AssistantPlanItem[]; note?: string; title?: string }) {
  return (
    <div className="koru-stitch-card" data-ui-block="plan">
      <StitchHeader icon={CalendarDays} hint="Tu plan" title={title ?? `${items.length} pasos priorizados`} tone="purple" />
      <div className="koru-stitch-plan">
        {items.slice(0, 6).map((plan, index) => {
          const Icon = planIcon(plan.icon, index);
          const tone = index === 0 ? "accent" : index === 1 ? "amber" : "purple";
          const meta = joinParts([
            plan.durationMinutes ? `${plan.durationMinutes} min` : undefined,
            plan.rationale,
          ]);
          return (
            <div key={`${plan.time ?? index}-${plan.title}`} className="koru-stitch-plan-row">
              <span className={cn("koru-stitch-plan-icon", `is-${tone}`)}>
                <Icon size={14} />
              </span>
              <span className="koru-stitch-plan-time">{plan.time ?? ""}</span>
              <span className="koru-stitch-plan-copy">
                <strong>{plan.title}</strong>
                {meta && <small>{meta}</small>}
              </span>
              {plan.priority && <em className={cn("koru-stitch-priority", plan.priority !== "Alta" && "is-medium")}>{plan.priority}</em>}
            </div>
          );
        })}
      </div>
      <StitchNote>{note}</StitchNote>
    </div>
  );
}

function ComparisonCardA({ item, title, recommendation }: { item: KoruTurnItem; title?: string; recommendation?: string }) {
  const offers = item.comparisonItems ?? [];
  return (
    <div className="koru-stitch-card" data-ui-block="comparison">
      <StitchHeader icon={ShoppingBasket} hint="Comparacion" title={title ?? `${offers.length} opciones`} tone="amber" />
      {item.sources?.length ? <p className="koru-source-status is-verified">Fuentes verificadas</p> : null}
      <div className="koru-stitch-content">
        {offers.slice(0, 5).map((offer, index) => (
          <StitchRow
            key={`${offer.title}-${offer.url ?? offer.vendor ?? index}`}
            eyebrow={index === 0 ? "Mejor" : `#${index + 1}`}
            title={joinParts([offer.title, offer.price])}
            detail={joinParts([offer.vendor, offer.score ? `${offer.score}/100` : undefined, offer.evidence])}
            href={offer.url}
            highlighted={index === 0}
            tone={index === 0 ? "amber" : "muted"}
          />
        ))}
      </div>
      <StitchNote tone="amber">{recommendation}</StitchNote>
    </div>
  );
}

function ResearchSourcesCardA({ block, item }: { block: Extract<NonNullable<KoruTurnItem["uiBlock"]>, { type: "research_sources" }>; item: KoruTurnItem }) {
  const status = block.sourceStatus ?? item.externalStatus ?? (block.sources.length ? "verified" : "pending");
  return (
    <div className="koru-stitch-card" data-ui-block="research_sources">
      <StitchHeader icon={SearchCheck} hint={statusLabel(status)} title={block.title ?? "Fuentes"} tone="purple" />
      <StitchNote>{block.summary}</StitchNote>
      <div className="koru-stitch-content">
        {block.sources.slice(0, 4).map((source, index) => (
          <StitchRow
            key={source.url}
            eyebrow={index === 0 ? "Top" : `#${index + 1}`}
            title={source.title}
            detail={source.domain}
            href={source.url}
            highlighted={index === 0}
            tone={index === 0 ? "purple" : "muted"}
          />
        ))}
      </div>
      <StitchNote>{block.followUpQuestion}</StitchNote>
    </div>
  );
}

function SourceRowsA({ sources }: { sources?: AssistantSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="koru-stitch-content">
      {sources.slice(0, 4).map((source, index) => (
        <StitchRow
          key={source.url}
          eyebrow={index === 0 ? "Top" : `#${index + 1}`}
          title={source.title}
          detail={source.domain}
          href={source.url}
          highlighted={index === 0}
          tone={index === 0 ? "purple" : "muted"}
        />
      ))}
    </div>
  );
}

function ResourceBundleCardA({ block }: { block: Extract<UiBlock, { type: "resource_bundle" }> }) {
  return (
    <div className="koru-stitch-card" data-ui-block="resource_bundle">
      <StitchHeader icon={FileText} hint="Archivo listo" title={block.title ?? `${block.files.length} archivo(s)`} tone="purple" />
      <StitchNote>{block.summary}</StitchNote>
      <div className="koru-stitch-content">
        {block.files.slice(0, 6).map((file) => {
          const Icon = fileIcon(file.kind);
          return (
            <button
              key={file.name}
              type="button"
              onClick={() => downloadArtifact(file)}
              className="koru-stitch-row"
              aria-label={`Descargar ${file.name}`}
            >
              <span className="koru-stitch-row-marker is-purple"><Icon size={14} /></span>
              <span className="koru-stitch-row-copy">
                <strong>{file.name}</strong>
                <small>{file.kind.toUpperCase()} - {file.sizeLabel}</small>
              </span>
              <ExternalLink size={15} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WebNavCardA({ block }: { block: Extract<UiBlock, { type: "web_nav" }> }) {
  return (
    <div className="flex relative" data-ui-block="web_nav">
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">public</span> Web Navigation
          </span>
        </div>
        <div className="bg-white rounded-3xl p-4 card-shadow border border-gray-50">
          {block.status === "loading" && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 mb-3 border border-gray-100">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 animate-spin" style={{ animationDuration: "3s" }}>
                <span className="material-symbols-outlined text-[18px]">sync</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[13px] font-mono text-gray-600 truncate">
                  {block.url
                    ? `Extrayendo datos de ${block.url}...`
                    : block.query
                      ? `Buscando "${block.query}"...`
                      : "Buscando en la web..."}
                </p>
              </div>
            </div>
          )}
          {block.results.length > 0 && (
            <div className="space-y-2">
              {block.results.map((result, index) => (
                <a
                  key={`${result.url}-${index}`}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-400 text-[18px]">
                      {result.type === "article" ? "article" : result.type === "pdf" ? "picture_as_pdf" : "description"}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">{result.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {result.source}
                        {result.readTime ? ` \u2022 ${result.readTime}` : null}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 text-[18px]">chevron_right</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UiBlockCardA({ item }: { item: KoruTurnItem }) {
  const block = item.uiBlock;
  if (!block) return null;

  if (block.type === "clarifying_question") {
    return (
      <div className="koru-question-card koru-stitch-card" data-ui-block="clarifying_question">
        <StitchHeader icon={Sparkles} hint={block.title ?? "Necesito un dato"} title={block.question} tone="purple" />
        <StitchPills labels={block.options ?? []} />
      </div>
    );
  }

  if (block.type === "weather") {
    const sourceTitle = block.sources?.[0]?.title;
    const metrics = [
      block.range ? { label: "Hoy", value: block.range } : undefined,
      block.rain ? { label: "Lluvia", value: block.rain } : undefined,
      block.wind ? { label: "Viento", value: block.wind } : undefined,
    ].filter((summary): summary is { label: string; value: string } => Boolean(summary));
    return (
      <div className="koru-weather-card koru-stitch-card" data-ui-block="weather">
        <StitchHeader icon={CloudSun} hint={block.city ? `Clima - ${block.city}` : "Clima"} title={block.title ?? block.now ?? "Estado actualizado"} tone="blue" />
        {sourceTitle && <p className="koru-source-status is-verified">{statusLabel(block.sourceStatus ?? "verified")} - {sourceTitle}</p>}
        <StitchSummaryGrid items={metrics} />
        <StitchNote tone="amber">{block.advice}</StitchNote>
      </div>
    );
  }

  if (block.type === "alarm") {
    return (
      <div className="koru-alarm-card koru-stitch-card" data-ui-block="alarm">
        <StitchHeader icon={Clock} hint="Alarma activada" title={joinParts([block.time, block.repeat]) || block.time} tone="rose" />
        <div className="koru-stitch-content">
          <StitchRow icon={Clock} title={block.title} detail={cleanLabel(block.note ?? block.repeat)} />
        </div>
      </div>
    );
  }

  if (block.type === "reminder") {
    return (
      <div className="koru-reminder-card koru-stitch-card" data-ui-block="reminder">
        <StitchHeader icon={CalendarDays} hint="Recordatorio guardado" title={block.title} />
        <div className="koru-stitch-content">
          <StitchRow icon={Clock} title={block.title} detail={block.dueText} chip={block.dueText} />
        </div>
      </div>
    );
  }

  if (block.type === "shopping_list") {
    return (
      <div className="koru-list-module koru-stitch-card" data-ui-block="shopping_list">
        <StitchHeader icon={ShoppingBasket} hint="Lista guardada" title={block.title ?? `${block.items.length} items`} tone="amber" />
        <div className="koru-stitch-content">
          {block.items.map((shoppingItem) => (
            <StitchRow key={shoppingItem} icon={Check} title={shoppingItem} detail={block.dueText} />
          ))}
          <StitchNote>{block.note}</StitchNote>
        </div>
      </div>
    );
  }

  if (block.type === "plan") {
    return <PlanCardA items={block.items} note={block.note} title={block.title} />;
  }

  if (block.type === "comparison") {
    return <ComparisonCardA item={{ ...item, comparisonItems: block.items, recommendation: block.recommendation, sources: block.sources }} title={block.title} recommendation={block.recommendation} />;
  }

  if (block.type === "research_sources") {
    return <ResearchSourcesCardA block={block} item={item} />;
  }

  if (block.type === "money_summary") {
    const summaryItems = [...(block.summaryItems ?? [])];
    const total = moneyLabel(block.total, block.currency);
    if (total && !summaryItems.some((summary) => /total|gast/i.test(summary.label))) {
      summaryItems.unshift({ label: "Total", value: total });
    }
    return (
      <div className="koru-stitch-card" data-ui-block="money_summary">
        <StitchHeader icon={DollarSign} hint="Resumen" title={block.title ?? total ?? "Dinero"} tone="blue" />
        <StitchSummaryGrid items={summaryItems} />
        <StitchNote>{block.recommendation}</StitchNote>
      </div>
    );
  }

  if (block.type === "saved_record") {
    return <SavedRecordCard item={item} records={block.records} title={block.title} />;
  }

  if (block.type === "activity_group") {
    const tileSummaries = block.sections.flatMap((section) =>
      (section.tiles ?? []).map((tile) => ({
        label: tile.label,
        value: tile.value,
        detail: joinParts([section.title, tile.detail]),
      })),
    );
    const rows = block.sections.flatMap((section) =>
      (section.rows ?? []).map((row) => ({
        ...row,
        sectionTitle: section.title,
        tone: section.tone,
      })),
    );
    return (
      <div className="koru-activity-group koru-stitch-card" data-ui-block="activity_group">
        <StitchHeader icon={Sun} hint={block.subtitle ?? "Actividad"} title={block.title} />
        <StitchSummaryGrid items={tileSummaries} />
        {rows.length > 0 && (
          <div className="koru-stitch-content">
            {rows.slice(0, 6).map((row, index) => (
              <StitchRow
                key={`${row.sectionTitle}-${row.title}-${row.meta ?? index}`}
                icon={Check}
                title={row.title}
                detail={joinParts([row.sectionTitle, row.detail])}
                chip={row.meta}
                highlighted={row.urgent}
                tone={row.urgent ? "amber" : row.tone === "purple" ? "purple" : "accent"}
              />
            ))}
          </div>
        )}
        {block.energy && (
          <StitchNote tone="blue">
            {joinParts([block.energy.label ?? "Energia", `${Math.max(0, Math.min(100, block.energy.value))}%`])}
          </StitchNote>
        )}
        <StitchNote>{block.note}</StitchNote>
      </div>
    );
  }

  if (block.type === "proactive_signal") {
    const Icon = signalIcon(block.category);
    const status = block.sourceStatus ?? item.externalStatus;
    return (
      <div className="koru-proactive-card koru-stitch-card" data-ui-block="proactive_signal" data-severity={block.severity ?? "info"}>
        <StitchHeader icon={Icon} hint={statusLabel(status)} title={block.title} tone={block.severity === "important" || block.severity === "urgent" ? "amber" : "purple"} />
        <StitchNote>{block.body}</StitchNote>
        <StitchSummaryGrid items={block.summaryItems ?? []} />
        <SourceRowsA sources={block.sources} />
        <StitchNote tone="amber">{block.followUpQuestion}</StitchNote>
      </div>
    );
  }

  if (block.type === "resource_bundle") {
    return <ResourceBundleCardA block={block} />;
  }

  if (block.type === "web_nav") {
    return <WebNavCardA block={block} />;
  }

  return null;
}

function secondaryActions(item: KoruTurnItem): Array<{ label: string; icon: LucideIcon; onClick?: () => void }> {
  if (item.actionKind === "web_research" || item.actionKind === "world_signal") {
    const firstUrl = item.sources?.[0]?.url;
    return firstUrl
      ? [{ label: "Abrir fuente", icon: ExternalLink, onClick: () => window.open(firstUrl, "_blank", "noopener,noreferrer") }]
      : [];
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
          : "Consultando fuentes ahora...";
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
