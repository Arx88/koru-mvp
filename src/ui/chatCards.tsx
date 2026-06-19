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
  Shirt,
  SearchCheck,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Sun,
  Truck,
  Users,
  Wallet,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { AssistantArtifact, AssistantPlanItem, AssistantSource } from "../domain/types";
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

function activityIcon(kind: string): LucideIcon {
  if (kind === "weather") return CloudSun;
  if (kind === "outfit") return Shirt;
  if (kind === "traffic") return Waypoints;
  if (kind === "calendar") return CalendarDays;
  if (kind === "health") return Pill;
  if (kind === "food" || kind === "home") return Home;
  if (kind === "money") return Wallet;
  if (kind === "wellbeing") return HeartPulse;
  if (kind === "relationship") return Users;
  if (kind === "work") return Flag;
  return Sparkles;
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
  return (
    <div className="koru-saved-record-card koru-stitch-card" data-ui-block="saved_record" data-card-kind={item.actionKind ?? item.kind}>
      <div className="koru-stitch-card-header">
        <span className="koru-stitch-icon"><Check size={16} /></span>
        <span>{compactTitle}</span>
      </div>
      <div className="koru-saved-record-list">
        {records.slice(0, 6).map((record) => (
          <div key={`${record.domain}-${record.kind}-${record.title}-${record.value ?? ""}`} className="koru-saved-record-row">
            <span className="koru-record-check" />
            <span>
              <strong>{recordDisplay(record)}</strong>
              <small>{recordDetail(record)}</small>
            </span>
            <em>{record.domain}</em>
          </div>
        ))}
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

function UiBlockCard({ item }: { item: KoruTurnItem }) {
  const block = item.uiBlock;
  if (!block) return null;

  if (block.type === "clarifying_question") {
    return (
      <div className="koru-question-card koru-stitch-card" data-ui-block="clarifying_question">
        <span className="koru-card-kicker">{block.title ?? "Solo necesito esto"}</span>
        <strong>{block.question}</strong>
        {block.options?.length ? (
          <div className="koru-question-followups">
            {block.options.map((option) => <span key={option}>{option}</span>)}
          </div>
        ) : null}
      </div>
    );
  }

  if (block.type === "weather") {
    const sourceTitle = block.sources?.[0]?.title;
    return (
      <div className="koru-weather-card koru-stitch-card" data-ui-block="weather">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><SearchCheck size={16} /></span>
          <span>{block.city ? `Clima en ${block.city}` : "Clima"}</span>
        </div>
        {sourceTitle && <p className="koru-source-status is-verified">Fuentes verificadas · {sourceTitle}</p>}
        <div className="koru-stitch-grid">
          {block.now && <div className="koru-stitch-tile"><small>Ahora</small><strong>{block.now}</strong></div>}
          {block.range && <div className="koru-stitch-tile"><small>Hoy</small><strong>{block.range}</strong></div>}
          {block.rain && <div className="koru-stitch-tile"><small>Lluvia</small><strong>{block.rain}</strong></div>}
          {block.wind && <div className="koru-stitch-tile"><small>Viento</small><strong>{block.wind}</strong></div>}
        </div>
        {block.advice && <p className="koru-stitch-note">{block.advice}</p>}
      </div>
    );
  }

  if (block.type === "alarm") {
    return (
      <div className="koru-alarm-card koru-stitch-card" data-ui-block="alarm">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon is-amber"><Clock size={16} /></span>
          <span>Alarma</span>
        </div>
        <div className="koru-stitch-content">
          <strong className="koru-alarm-time">{block.time}</strong>
          <p>{block.title}</p>
          {block.note && <small>{block.note}</small>}
        </div>
      </div>
    );
  }

  if (block.type === "reminder") {
    return (
      <div className="koru-reminder-card koru-stitch-card" data-ui-block="reminder">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><CalendarDays size={16} /></span>
          <span>{block.title ?? "Recordatorio"}</span>
        </div>
        <div className="koru-stitch-content">
          {block.dueText && <small>{block.dueText}</small>}
          {block.note && <p>{block.note}</p>}
        </div>
      </div>
    );
  }

  if (block.type === "shopping_list") {
    return (
      <div className="koru-list-module koru-stitch-card" data-ui-block="shopping_list">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><ShoppingBasket size={16} /></span>
          <span>{block.title ?? "Lista de compras"}</span>
        </div>
        {block.items.map((shoppingItem) => (
          <div key={shoppingItem} className="koru-list-row">
            <span className="koru-record-check" />
            <span>
              <strong>{shoppingItem}</strong>
              <small>{block.dueText ?? "compras"}</small>
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "plan") {
    return (
      <div className="koru-stitch-card" data-ui-block="plan">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><Flag size={16} /></span>
          <span>{block.title ?? "Plan"}</span>
        </div>
        <PlanPreview items={block.items} />
        {block.note && <p className="koru-stitch-note">{block.note}</p>}
      </div>
    );
  }

  if (block.type === "comparison") {
    return (
      <div className="koru-stitch-card" data-ui-block="comparison">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><SearchCheck size={16} /></span>
          <span>{block.title ?? "Comparativa"}</span>
        </div>
        {block.sources?.length ? <p className="koru-source-status is-verified">Fuentes verificadas</p> : null}
        <ComparisonPreview item={{ ...item, comparisonItems: block.items, recommendation: block.recommendation, sources: block.sources }} />
        <SourcePreview sources={block.sources?.filter((source) => !block.items.some((offer) => offer.url === source.url))} />
      </div>
    );
  }

  if (block.type === "research_sources") {
    const status = block.sourceStatus ?? item.externalStatus ?? (block.sources.length ? "verified" : "pending");
    return (
      <div className="koru-stitch-card" data-ui-block="research_sources">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><SearchCheck size={16} /></span>
          <span>{block.title ?? "Fuentes"}</span>
        </div>
        <p className={cn("koru-source-status", status === "verified" && "is-verified")}>
          {status === "verified" ? "Fuentes verificadas" : status === "partial" ? "Resultados parciales" : status === "failed" ? "No se pudo navegar" : "Listo para abrir fuentes reales"}
        </p>
        <p className="koru-stitch-note">{block.summary}</p>
        <SourcePreview sources={block.sources} />
        {block.followUpQuestion && <p className="koru-card-note">{block.followUpQuestion}</p>}
      </div>
    );
  }

  if (block.type === "money_summary") {
    return (
      <div className="koru-stitch-card" data-ui-block="money_summary">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><DollarSign size={16} /></span>
          <span>{block.title ?? "Resumen de gastos"}</span>
        </div>
        <div className="koru-stitch-content">
          <SummaryModule item={{ ...item, summaryItems: block.summaryItems, totalAmount: block.total, currency: block.currency, recommendation: block.recommendation }} />
        </div>
      </div>
    );
  }

  if (block.type === "saved_record") {
    return <SavedRecordCard item={item} records={block.records} title={block.title} />;
  }

  if (block.type === "activity_group") {
    return (
      <div className="koru-activity-group koru-stitch-card" data-ui-block="activity_group">
        <div className="koru-activity-group-head">
          <span className="koru-stitch-icon"><Sun size={16} /></span>
          <span>
            <strong>{block.title}</strong>
            {block.subtitle && <small>{block.subtitle}</small>}
          </span>
          {block.energy && (
            <span className="koru-energy-rail" aria-label={block.energy.label ?? "Energia"}>
              <span style={{ height: `${Math.max(8, Math.min(100, block.energy.value))}%` }} />
            </span>
          )}
        </div>
        {block.sections.map((section) => (
          <div key={section.id ?? section.title} className="koru-activity-section" data-tone={section.tone ?? "neutral"}>
            <div className="koru-activity-section-title">{section.title}</div>
            {section.tiles?.length ? (
              <div className="koru-activity-tiles">
                {section.tiles.map((tile) => {
                  const Icon = activityIcon(tile.kind);
                  return (
                    <div key={`${tile.label}-${tile.value}`} className="koru-activity-tile" data-urgent={tile.urgent ? "true" : undefined}>
                      <div className="koru-activity-tile-top">
                        <Icon size={18} />
                        {tile.actionLabel && <span>{tile.actionLabel}</span>}
                      </div>
                      <span className="koru-card-kicker">{tile.label}</span>
                      <strong>{tile.value}</strong>
                      {tile.detail && <small>{tile.detail}</small>}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {section.rows?.length ? (
              <div className="koru-activity-rows">
                {section.rows.map((row) => (
                  <div key={`${row.title}-${row.meta ?? ""}`} className="koru-activity-row" data-urgent={row.urgent ? "true" : undefined}>
                    <span className="koru-record-check" />
                    <span>
                      <strong>{row.title}</strong>
                      {row.detail && <small>{row.detail}</small>}
                    </span>
                    {row.meta && <em>{row.meta}</em>}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {item.actionKind === "decision_support" ? <DecisionCard item={item} /> : null}
        {block.note && <p className="koru-stitch-note">{block.note}</p>}
      </div>
    );
  }

  if (block.type === "proactive_signal") {
    const Icon = signalIcon(block.category);
    const status = block.sourceStatus ?? item.externalStatus;
    return (
      <div className="koru-proactive-card koru-stitch-card" data-ui-block="proactive_signal" data-severity={block.severity ?? "info"}>
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><Icon size={16} /></span>
          <span>{block.title ?? "Señal"}</span>
        </div>
        <div className="koru-stitch-content">
        {status && (
          <p className={cn("koru-source-status", status === "verified" && "is-verified")}>
            {status === "verified" ? "Fuentes verificadas" : status === "partial" ? "Resultados parciales" : status === "failed" ? "No se pudo navegar" : "Listo para abrir fuentes reales"}
          </p>
        )}
        <p>{block.body}</p>
        {block.summaryItems?.length ? (
          <div className={cn("koru-summary-grid", block.summaryItems.length === 1 && "is-single")}>
            {block.summaryItems.slice(0, 4).map((summary) => (
              <div key={`${summary.label}-${summary.value}`} className="koru-summary-tile">
                <span className="koru-summary-label">{summary.label}</span>
                <strong>{summary.value}</strong>
                {summary.detail && <small>{summary.detail}</small>}
              </div>
            ))}
          </div>
        ) : null}
        <SourcePreview sources={block.sources} />
        {block.followUpQuestion && <p className="koru-card-note">{block.followUpQuestion}</p>}
        </div>
      </div>
    );
  }

  if (block.type === "resource_bundle") {
    return (
      <div className="koru-stitch-card" data-ui-block="resource_bundle">
        <div className="koru-stitch-card-header">
          <span className="koru-stitch-icon"><FileText size={16} /></span>
          <span>{block.title ?? "Archivos"}</span>
        </div>
        {block.summary && <p className="koru-stitch-note">{block.summary}</p>}
        <FileBundle files={block.files} />
      </div>
    );
  }

  return null;
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
  if (item.uiBlock) {
    return (
      <div className="koru-action-content" data-card-kind={item.actionKind ?? item.kind} data-ui-block={item.uiBlock.type} data-web-mode={item.webMode ?? undefined}>
        <UiBlockCard item={item} />
        <ActionButtons item={item} handlers={handlers} />
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
