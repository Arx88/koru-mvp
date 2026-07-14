import { memo } from "react";
import type { UiBlock } from "../../domain/types";

/**
 * DeliverableCard — el componente universal para renderizar CUALQUIER entrega de Koru.
 * Convierte cualquier tipo de UiBlock (movie_review, recipe, comparison, weather, etc.)
 * en un deliverable con estructura consistente: hero + metrics + sections + sources + CTA.
 *
 * Esto implementa la propuesta del informe: "Sistema de Deliverables Unificado".
 */

type AccentColor = {
  bg: string;
  text: string;
  border: string;
  gradient: string;
};

const ACCENTS: Record<string, AccentColor> = {
  weather: { bg: "rgba(59, 130, 246, 0.08)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.2)", gradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.03))" },
  sports: { bg: "rgba(34, 197, 94, 0.08)", text: "#22c55e", border: "rgba(34, 197, 94, 0.2)", gradient: "linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.03))" },
  food: { bg: "rgba(249, 115, 22, 0.08)", text: "#f97316", border: "rgba(249, 115, 22, 0.2)", gradient: "linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.03))" },
  media: { bg: "rgba(139, 92, 246, 0.08)", text: "#8b5cf6", border: "rgba(139, 92, 246, 0.2)", gradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.03))" },
  knowledge: { bg: "rgba(99, 102, 241, 0.08)", text: "#6366f1", border: "rgba(99, 102, 241, 0.2)", gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.03))" },
  shopping: { bg: "rgba(245, 158, 11, 0.08)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.2)", gradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.03))" },
  crypto: { bg: "rgba(249, 115, 22, 0.08)", text: "#f97316", border: "rgba(249, 115, 22, 0.2)", gradient: "linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.03))" },
  memory: { bg: "rgba(124, 92, 219, 0.08)", text: "#7c5cdb", border: "rgba(124, 92, 219, 0.2)", gradient: "linear-gradient(135deg, rgba(124, 92, 219, 0.12), rgba(124, 92, 219, 0.03))" },
  plan: { bg: "rgba(16, 185, 129, 0.08)", text: "#10b981", border: "rgba(16, 185, 129, 0.2)", gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03))" },
  default: { bg: "rgba(124, 92, 219, 0.08)", text: "#7c5cdb", border: "rgba(124, 92, 219, 0.2)", gradient: "linear-gradient(135deg, rgba(124, 92, 219, 0.12), rgba(124, 92, 219, 0.03))" },
};

function getAccentForBlock(block: UiBlock): AccentColor {
  const type = block.type;
  if (type === "weather") return ACCENTS.weather;
  if (type === "live_match" || type === "match_timeline") return ACCENTS.sports;
  if (type === "recipe") return ACCENTS.food;
  if (type === "movie_review" || type === "book_review" || type === "restaurant_synthesis") return ACCENTS.media;
  if (type === "research_sources" || type === "data_card") return ACCENTS.knowledge;
  if (type === "comparison") return ACCENTS.shopping;
  if (type === "crypto_portfolio" || type === "forex" || type === "market") return ACCENTS.crypto;
  if (type === "plan") return ACCENTS.plan;
  if (type === "deliverable") return ACCENTS.default;
  return ACCENTS.default;
}

function getKickerForBlock(block: UiBlock): string {
  const k = (block as any).kicker;
  if (k) return k;
  switch (block.type) {
    case "weather": return "Tu Clima";
    case "live_match": return "Tu Partido";
    case "recipe": return "Tu Receta";
    case "movie_review": return "Tu Reseña";
    case "book_review": return "Tu Libro";
    case "restaurant_synthesis": return "Dónde Comer";
    case "comparison": return "Comparativa";
    case "crypto_portfolio": return "Cotización";
    case "plan": return "Tu Plan";
    case "research_sources": return "Tu Consulta";
    case "data_card": return "Datos";
    case "deliverable": return "Tu Búsqueda";
    default: return "Resultado";
  }
}

function getIconForBlock(block: UiBlock): string {
  switch (block.type) {
    case "weather": return "wb_sunny";
    case "live_match": return "sports_soccer";
    case "recipe": return "restaurant";
    case "movie_review": return "movie";
    case "book_review": return "menu_book";
    case "restaurant_synthesis": return "restaurant";
    case "comparison": return "compare_arrows";
    case "crypto_portfolio": return "currency_bitcoin";
    case "plan": return "calendar_today";
    case "research_sources": return "travel_explore";
    case "data_card": return "analytics";
    case "deliverable": return "auto_awesome";
    default: return "info";
  }
}

function getTitleForBlock(block: UiBlock): string {
  const b = block as any;
  if (b.title) return b.title;
  if (b.name) return b.name;
  if (b.city) return `Clima en ${b.city}`;
  if (b.homeName) return `${b.homeName} vs ${b.awayName ?? ""}`;
  if (b.topic) return b.topic;
  if (b.query) return b.query;
  return "Resultado";
}

function getArtValueForBlock(block: UiBlock): string | undefined {
  const b = block as any;
  if (b.rating) return `★ ${b.rating}/10`;
  if (b.now) return b.now;
  if (typeof b.price === "number") return `$${b.price}`;
  if (b.homeScore !== undefined && b.awayScore !== undefined) return `${b.homeScore} - ${b.awayScore}`;
  if (b.dueText) return b.dueText;
  if (b.time) return b.time;
  return undefined;
}

function getDescriptionForBlock(block: UiBlock): string | undefined {
  const b = block as any;
  if (b.overview) return b.overview.slice(0, 160);
  if (b.synopsis) return b.synopsis.slice(0, 160);
  if (b.description) return (typeof b.description === "string" ? b.description : "").slice(0, 160);
  if (b.summary) return b.summary.slice(0, 160);
  if (b.instructions) return `${(b.ingredients ?? []).length} ingredientes · ${b.area ?? ""}`;
  if (b.synthesis) return b.synthesis.slice(0, 160);
  if (b.advice) return b.advice;
  if (b.items?.[0]?.label) return b.items.slice(0, 3).map((i: any) => `${i.label}: ${i.value}`).join(" · ");
  return undefined;
}

export const DeliverableCard = memo(function DeliverableCard({
  block,
  onExpand,
}: {
  block: UiBlock;
  onExpand?: () => void;
}) {
  const accent = getAccentForBlock(block);
  const kicker = getKickerForBlock(block);
  const icon = getIconForBlock(block);
  const title = getTitleForBlock(block);
  const artValue = getArtValueForBlock(block);
  const description = getDescriptionForBlock(block);
  const b = block as any;

  // Metrics
  const metrics: Array<{ value: string; label: string }> = [];
  if (b.items?.length) metrics.push({ value: String(b.items.length), label: "Datos" });
  if (b.ingredients?.length) metrics.push({ value: String(b.ingredients.length), label: "Ingredientes" });
  if (b.matches?.length) metrics.push({ value: String(b.matches.length), label: "Opciones" });
  if (b.sources?.length) metrics.push({ value: String(b.sources.length), label: "Fuentes" });
  if (b.runtime) metrics.push({ value: b.runtime, label: "Duración" });
  if (b.director) metrics.push({ value: b.director, label: "Director" });
  if (b.genres?.length) metrics.push({ value: b.genres.join(", "), label: "Géneros" });
  if (b.change24hPct !== undefined) metrics.push({ value: `${b.change24hPct >= 0 ? "+" : ""}${b.change24hPct}%`, label: "24h" });

  return (
    <div
      className="koru-deliverable-card"
      style={{ background: accent.gradient, borderColor: accent.border }}
      onClick={onExpand}
      role="button"
      tabIndex={0}
    >
      {/* Glow decorativo */}
      <div className="koru-deliverable-glow" style={{ background: `radial-gradient(circle, ${accent.bg} 0%, transparent 70%)` }} />

      {/* Hero */}
      <div className="koru-deliverable-hero">
        <div className="koru-deliverable-hero-left">
          <div className="koru-deliverable-icon" style={{ background: accent.bg, color: accent.text }}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div className="koru-deliverable-hero-text">
            <span className="koru-deliverable-kicker" style={{ color: accent.text }}>{kicker}</span>
            <h3 className="koru-deliverable-title">{title}</h3>
            {description && <p className="koru-deliverable-desc">{description}</p>}
          </div>
        </div>
        {artValue && (
          <div className="koru-deliverable-art" style={{ color: accent.text }}>
            {artValue}
          </div>
        )}
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="koru-deliverable-metrics">
          {metrics.slice(0, 4).map((m, i) => (
            <div key={i} className="koru-deliverable-metric">
              <span className="koru-deliverable-metric-value" style={{ color: accent.text }}>{m.value}</span>
              <span className="koru-deliverable-metric-label">{m.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {onExpand && (
        <button type="button" className="koru-deliverable-cta" style={{ background: accent.text }}>
          Ver detalle
        </button>
      )}
    </div>
  );
});
