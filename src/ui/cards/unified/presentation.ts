import type { UiBlock, AssistantSource } from "../../../domain/types";
import { getCachedRate, formatCurrency } from "../../../tools/travel/currencyConverter";
import { sortItemsByAisle, categorizeItem, aisleLabelFor } from "../../../domain/aisleMap";
import { inferStressLevel } from "../../../domain/stressEngine";
import {
  calculate1RM,
  calculateStrengthDelta,
  estimateKcal,
} from "../../../domain/strengthEngine";
import { suggestWinePairing } from "../../../tools/food/winePairing";

// ============================================================================
// Modelo de presentación unificado (una sola fuente de verdad para TODAS las
// cards). Cada UiBlock se normaliza a esta forma y se renderiza con el mismo
// molde Stitch "Creando Plan / Plan Entregado": hoja lila (hero) + pantalla de
// detalle con magical-cards. Ningún componente de card conserva estética propia.
// ============================================================================

export type Accent = {
  /** color principal (icono, kicker, CTA) */
  color: string;
  /** fondo suave del chip de icono */
  soft: string;
};

/** Métrica de la fila 3-up del hero. Con `value` = tile; sin `value` = chip. */
export type HeroMetric = {
  icon: string;
  label: string;
  value?: string;
  color?: string;
};

export type Hero = {
  kicker: string;
  title: string;
  desc?: string;
  /** icono Material Symbols para el arte del hero (si no hay ilustración) */
  icon: string;
  accent: Accent;
  /** ilustración opcional (reemplaza al icono) */
  art?: string;
  /** 🔴 FIX UX: aspect ratio de la imagen — "square" (default), "poster" (2:3 vertical), "cover" (wide banner) */
  artAspect?: "square" | "poster" | "cover";
  /** valor grande sobre el arte (ej. "23°") */
  artValue?: string;
  metrics?: HeroMetric[];
  /** 🔴 v2: timestamp ISO de cuándo se verificó el dato (transparencia de frescura). */
  verifiedAt?: string;
  /** 🔴 v2: etiqueta legible de antigüedad (ej. "Hace 2 min"). */
  freshnessLabel?: string;
  /** 🔴 KIMI audit: marca el dot del kicker como "live" (pulsa con koru-pulse-dot).
   *  Lo setea liveMatch() cuando el partido está en juego. */
  live?: boolean;
};

// ---- Secciones de la pantalla de detalle (magical-cards) --------------------

export type DetailTile = { icon?: string; label: string; value: string; color?: string };
export type DetailRow = {
  icon?: string;
  title: string;
  detail?: string;
  meta?: string;
  badge?: string;
  badgeTone?: "done" | "current" | "pending" | "urgent";
  // 🔴 v2: para stats comparativas con barras de equipo
  bar?: { homeValue: number; awayValue: number; isPercent: boolean; homeColor?: string; awayColor?: string };
  // 🔴 TIER S: metadata para que KoruDetailScreen haga la fila tappable y
  // dispare el reducer correcto (toggleShoppingItem / toggleChecklistItem).
  // `planId/listId/checklistId` y `itemId/stepId` son ids sintéticos derivados
  // del bloque (los UiBlock no traen ids propios); el handler en KoruProvider
  // los pasa al reducer correspondiente.
  toggle?: {
    kind: "shopping_item" | "checklist_item";
    listId?: string;
    checklistId?: string;
    itemId: string;
  };
};
export type DetailChip = { label: string; sub?: string; color?: string };
export type DetailScrollCard = {
  badge?: string;
  badgeColor?: string;
  /** 🔴 v3: URL de imagen del restaurante (Google Places photo) — se renderiza como
   *  thumbnail junto al badge; sustituye visualmente al badge textual. */
  image?: string;
  title: string;
  detail?: string;
  metrics?: string[];
};
export type DetailStep = {
  icon?: string;
  title: string;
  detail?: string;
  status?: "done" | "current" | "pending";
  badge?: string;
  badgeTone?: "done" | "current" | "pending" | "urgent";
  // 🔴 TIER S: metadata para que KoruDetailScreen haga el paso tappable y
  // dispare togglePlanStep. `planId` y `stepId` son sintéticos (derivados del
  // título del bloque + índice del paso) porque los UiBlock `plan` no traen
  // ids propios. El handler en KoruProvider los pasa al reducer.
  toggle?: {
    kind: "plan_step";
    planId: string;
    stepId: string;
  };
};
export type DetailSourceRef = {
  title: string;
  domain?: string;
  url?: string;
  imageUrl?: string;
  /** 🔴 v2: duración legible (ej. "12:34") para badge sobre thumbnails de video */
  duration?: string;
};

export type DetailSection =
  | { kind: "text"; icon: string; accent: Accent; title: string; subtitle?: string; body: string }
  | { kind: "tiles"; icon: string; accent: Accent; title: string; subtitle?: string; tiles: DetailTile[] }
  | { kind: "rows"; icon: string; accent: Accent; title: string; subtitle?: string; rows: DetailRow[] }
  | { kind: "chips"; icon: string; accent: Accent; title: string; subtitle?: string; chips: DetailChip[] }
  | { kind: "calendar"; icon: string; accent: Accent; title: string; subtitle?: string; days: DetailChip[] }
  | { kind: "scroller"; icon: string; accent: Accent; title: string; subtitle?: string; cards: DetailScrollCard[] }
  | { kind: "timeline"; icon: string; accent: Accent; title: string; subtitle?: string; steps: DetailStep[] }
  | { kind: "sources"; icon: string; accent: Accent; title: string; subtitle?: string; sources: DetailSourceRef[] }
  | { kind: "pitch"; icon: string; accent: Accent; title: string; subtitle?: string; pitch: { homeFormation: string; awayFormation: string; homePlayers: Array<{ number?: string; name: string; position?: string }>; awayPlayers: Array<{ number?: string; name: string; position?: string }>; homeColor?: string; awayColor?: string; homeName: string; awayName: string } };

export type Detail = {
  title: string;
  subtitle?: string;
  sections: DetailSection[];
  /**
   * 🔴 KIMI v4 — CTAs contextuales del detail screen (xt-actions).
   * Si se definen, el detail screen los usa en vez del fallback genérico.
   * Replica los CTAs del spec Kimi por dominio (pág. 28-30).
   */
  actions?: DetailAction[];
};

export type KoruPresentation = {
  hero: Hero;
  detail?: Detail;
  /**
   * CTA de la hoja. Sin `screen` abre el detalle genérico (KoruDetailScreen);
   * con screen "collections" abre Mis Colecciones enfocada en `collection`.
   */
  cta?: { label: string; screen?: "collections"; collection?: string };
  /**
   * 🔴 v2: acciones inline para cards sin detail screen (alarm, reminder, etc.)
   * Se renderizan como botones dentro del hero, sin necesidad de abrir detail.
   */
  actions?: Array<{
    label: string;
    icon?: string;
    kind?: "primary" | "secondary" | "danger";
    action: string; // identificador que el renderer interpreta (ej: "complete", "snooze", "dismiss")
  }>;
  /**
   * 🔴 v2: empty state — cuando la card no tiene datos suficientes.
   * 🔴 KIMI AUDIT: "Vacío que invita — el jardín como metáfora, un ejemplo
   * concreto y un primer paso obvio". `title` + `desc` + `cta` reemplazan el
   * `reason` único. Se mantiene `reason` por retrocompatibilidad: si solo
   * viene `reason`, el renderer cae al molde anterior (icon + línea).
   */
  empty?: {
    /** Línea legacy (sigue siendo usada por el fallback del renderer). */
    reason?: string;
    icon?: string;
    /** Título corto y rotundo (ej: "Todavía no sembraste nada"). */
    title?: string;
    /** Descripción con un ejemplo concreto de primer paso. */
    desc?: string;
    /** Acento opcional para el cuadrado del ícono (default = accent del hero). */
    accent?: Accent;
    /** CTA: primer paso obvio que el usuario puede dar. `action` se emite
     *  como CustomEvent `koru-empty-cta` para que el handler lo interprete. */
    cta?: { label: string; action: string };
  };
  /**
   * 🔴 v3: layout alternativo de la card. Default = molde Stitch clásico
   * (kicker + título + arte + métricas + CTA). Las variantes rescriben la
   * composición visual sin tocar el modelo de presentación.
   *   - "compact"   → fila única (icono + kicker + título + chevron). ~60px.
   *   - "spotlight" → imagen full-bleed (180px) con scrim + título overlay.
   *   - "gallery"   → carrusel horizontal de mini-cards (70×80).
   *   - "banner"    → gradiente full-width (100px) con número grande + label.
   */
  layout?: "default" | "compact" | "spotlight" | "gallery" | "banner" | "match" | "garden";
};

/**
 * 🔴 KIMI v4 — Detail actions canónicas por dominio.
 * Cada mapper puede definir sus propias actions en el detail.screen,
 * replicando los CTAs del spec Kimi (pág. 28-30).
 */
export interface DetailAction {
  label: string;
  icon?: "bell" | "plus" | "calendar" | "play" | "alarm" | "bookmark" | "navigate" | "shopping" | "search" | "moon" | "share";
  kind?: "primary" | "secondary";
  action: string;
}

// ---- Paleta Stitch ----------------------------------------------------------

const A = {
  violet: { color: "#8363f9", soft: "rgba(131,99,249,0.12)" },
  primary: { color: "#4648d4", soft: "rgba(70,72,212,0.10)" },
  purple: { color: "#8127cf", soft: "rgba(129,39,207,0.12)" },
  emerald: { color: "#059669", soft: "rgba(16,185,129,0.12)" },
  amber: { color: "#d97706", soft: "rgba(217,119,6,0.12)" },
  blue: { color: "#2563eb", soft: "rgba(37,99,235,0.12)" },
  sky: { color: "#0284c7", soft: "rgba(2,132,199,0.12)" },
  rose: { color: "#e11d48", soft: "rgba(225,29,72,0.12)" },
  pink: { color: "#ec4899", soft: "rgba(236,72,153,0.12)" },
  indigo: { color: "#4f46e5", soft: "rgba(79,70,229,0.10)" },
  red: { color: "#dc2626", soft: "rgba(220,38,38,0.12)" },
} satisfies Record<string, Accent>;

// ---- helpers ----------------------------------------------------------------

type Of<T extends UiBlock["type"]> = Extract<UiBlock, { type: T }>;

const up = (s: string) => s.toUpperCase();
const clean = (s?: string) => (s ?? "").trim();

/** 🔴 TIER S: slug para generar ids sintéticos estables a partir de un título
 *  de UiBlock. Se usa en shoppingList / smartChecklist / planFallback para que
 *  los toggles de KoruDetailScreen puedan referenciar la entidad durable
 *  correspondiente (mismo slug → mismo id). */
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "untitled";
}

function sourcesToRefs(sources?: AssistantSource[]): DetailSourceRef[] {
  return (sources ?? []).slice(0, 8).map((s) => ({
    title: s.title,
    domain: s.domain,
    url: s.url,
    imageUrl: s.imageUrl,
  }));
}

/** Título del hero sin prefijos redundantes ("Tu plan X" → "X").
 *  🔴 KIMI v4 — NO mayusculiza (Title Case + Bricolage 21px del spec).
 *  El CSS .kc-title aplica text-transform solo a kc-kicker, no a kc-title. */
function heroTitleFrom(raw: string | undefined, fallback: string): string {
  const c = clean(raw).replace(/^\s*(tu|mi)\s+/i, "");
  return c.length > 1 ? c : fallback;
}

/**
 * 🔴 KIMI v5 — extrae HH:MM (formato 24h con leading zero) de un texto
 * libre como "mañana 7:00", "7am", "a las 18", "07:00".
 * Si no encuentra hora, retorna undefined.
 */
function extractHHMM(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().trim();
  // 1. HH:MM explícito (24h o 12h).
  let m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = m[2];
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  // 2. "7am" / "18hs" / "a las 18".
  m = s.match(/(\d{1,2})\s*(?:am|pm|hs|h\.?|horas)?\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const isPM = /pm/.test(s);
    const isAM = /am/.test(s);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:00`;
  }
  return undefined;
}

/**
 * 🔴 KIMI v5 — computa "suena en X h Y min" desde ahora hasta la próxima
 * instancia de la hora HH:MM. Si la hora ya pasó hoy, asume mañana.
 */
function timeUntilAlarm(hhmm: string | undefined): string | undefined {
  if (!hhmm) return undefined;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const targetH = parseInt(m[1], 10);
  const targetM = parseInt(m[2], 10);
  if (!Number.isFinite(targetH) || !Number.isFinite(targetM)) return undefined;
  const now = new Date();
  let diffMs = (targetH * 60 + targetM) * 60_000 - (now.getHours() * 60 + now.getMinutes()) * 60_000 - now.getSeconds() * 1000;
  if (diffMs <= 0) diffMs += 24 * 60 * 60_000; // mañana
  const totalMin = Math.round(diffMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `suena en ${min} min · descansá 🌙`;
  if (min === 0) return `suena en ${h} h · descansá 🌙`;
  return `suena en ${h} h ${min} min · descansá 🌙`;
}

function asPercent(value?: number): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

// ============================================================================
// Normalizador principal
// ============================================================================

/**
 * 🔴 v4 — Contexto opcional para el normalizador. Hoy sólo se usa para pasar
 * la moneda principal del usuario (state.userProfile.currency ?? "EUR") al
 * mapper de travel_plan, que muestra montos convertidos cuando una línea de
 * presupuesto está en otra moneda.
 */
export type PresentationContext = {
  userCurrency?: string;
};

export function toPresentation(block: UiBlock, ctx?: PresentationContext): KoruPresentation {
  switch (block.type) {
    case "deliverable":
      return deliverable(block);
    case "clarifying_question":
      return clarifying(block);
    case "weather":
      return weather(block);
    case "alarm":
      return alarm(block);
    case "reminder":
      return reminder(block);
    case "shopping_list":
      return shoppingList(block);
    case "comparison":
      return comparison(block);
    case "research_sources":
      return research(block);
    case "money_summary":
      return money(block);
    case "saved_record":
      return savedRecord(block);
    case "activity_group":
      return activityGroup(block);
    case "proactive_signal":
      return proactiveSignal(block);
    case "resource_bundle":
      return resourceBundle(block);
    case "web_nav":
      return webNav(block);
    case "data_card":
      return dataCard(block);
    case "restaurant_synthesis":
      return restaurant(block);
    case "morning_brief":
      return morningBrief(block);
    case "wellbeing":
      return wellbeing(block);
    case "live_match":
      return liveMatch(block);
    case "urgent_now":
      return urgentNow(block);
    case "market":
      return market(block);
    case "delivery":
      return delivery(block);
    case "health_reminder":
      return healthReminder(block);
    case "activity_tracker":
      return activityTracker(block);
    case "product_analysis":
      return productAnalysis(block);
    case "travel_planner":
      return travelPlanner(block);
    case "travel_plan":
      return travelPlan(block, ctx);
    case "generation":
      return generation(block);
    case "match_timeline":
      return matchTimeline(block);
    case "match_stats":
      return matchStats(block);
    case "election_results":
      return electionResults(block);
    case "election_vote":
      return electionVote(block);
    case "decision_support":
      return decisionSupport(block);
    case "memory":
      return memoryBlock(block);
    case "data_ticker":
      return dataTicker(block);
    case "crypto_portfolio":
      return cryptoPortfolio(block);
    case "forex":
      return forex(block);
    case "route_timeline":
      return routeTimeline(block);
    case "transport_compare":
      return transportCompare(block);
    case "route_map":
      return routeMap(block);
    case "birthday_calendar":
      return birthdayCalendar(block);
    case "birthday_alarm":
      return birthdayAlarm(block);
    case "social_interaction":
      return socialInteraction(block);
    case "smart_checklist":
      return smartChecklist(block);
    case "outfit":
      return outfit(block);
    case "review_score":
      return reviewScore(block);
    case "review_document":
      return reviewDocument(block);
    case "review_quote":
      return reviewQuote(block);
    case "recipe":
      return recipeBlock(block);
    case "movie_review":
      return movieReviewBlock(block);
    case "book_review":
      return bookReviewBlock(block);
    case "news_urgent":
      return newsUrgentBlock(block);
    case "tennis_match":
      return tennisMatch(block);
    case "exercise_plan":
      return exercisePlan(block);
    case "plan":
      // El plan conserva su render canónico (PlanHeroCard); si llegara acá,
      // damos un hero equivalente por robustez.
      return planFallback(block);
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

// ============================================================================
// Mappers por tipo
// ============================================================================

/** Acentos que rotan entre los módulos del detalle de un entregable. */
const DELIVERABLE_SECTION_ACCENTS: Accent[] = [A.amber, A.primary, A.emerald, A.pink, A.purple];

/**
 * ENTREGABLE (deep_research) — el bloque ya llega con la forma del molde:
 * kicker/título/descripción/categorías/métricas + secciones tipadas. Acá solo
 * se traduce cada sección a su DetailSection y se anexan las fuentes.
 */
function deliverable(b: Of<"deliverable">): KoruPresentation {
  const kicker = clean(b.kicker) || "Tu Informe";
  const sections: DetailSection[] = [];

  if (b.summary) {
    sections.push({ kind: "text", icon: "auto_awesome", accent: A.violet, title: "Síntesis", subtitle: "Lo esencial", body: b.summary });
  }

  (b.sections ?? []).forEach((section, idx) => {
    const accent = DELIVERABLE_SECTION_ACCENTS[idx % DELIVERABLE_SECTION_ACCENTS.length];
    const base = { icon: section.icon ?? "menu_book", accent, title: section.title, subtitle: section.kicker };
    const items = section.items ?? [];
    if (section.kind === "timeline" && items.length) {
      sections.push({
        ...base,
        kind: "timeline",
        steps: items.map((it) => ({ icon: it.icon, title: it.badge ? `${it.badge} — ${it.title}` : it.title, detail: it.subtitle, status: "done" as const })),
      });
    } else if (section.kind === "grid" && items.length) {
      sections.push({ ...base, kind: "chips", chips: items.map((it) => ({ label: it.title, sub: it.subtitle })) });
    } else if (items.length) {
      sections.push({
        ...base,
        kind: "rows",
        rows: items.map((it) => ({ icon: it.icon, title: it.title, detail: it.subtitle, badge: it.badge })),
      });
    } else if (section.bullets?.length) {
      sections.push({ ...base, kind: "rows", rows: section.bullets.map((text) => ({ icon: "check_circle", title: text })) });
    } else if (section.paragraphs?.length) {
      sections.push({ ...base, kind: "text", body: section.paragraphs.join("\n\n") });
    }
  });

  // 🔴 KIMI D3 (Deep Search · card 10): "findings" como scroller con scores de
  // confianza + "related queries" como chips. Cada item de cada sección del
  // informe se convierte en una finding card con su badge como confidence.
  const allItems = (b.sections ?? []).flatMap((s) => (s.items ?? []).map((it) => ({ ...it, sectionTitle: s.title })));
  if (allItems.length > 0) {
    sections.push({
      kind: "scroller",
      icon: "check_circle",
      accent: A.emerald,
      title: "Hallazgos",
      subtitle: `${allItems.length} ENCONTRADOS`,
      cards: allItems.slice(0, 8).map((it) => ({
        // 🔴 KIMI D4: si el item trae badge (ej: "3 fuentes", "87%") se muestra
        // como confidence score; si no, "verificado" por defecto.
        badge: it.badge ?? "verificado",
        badgeColor: A.emerald.color,
        title: it.title,
        detail: it.subtitle ?? it.sectionTitle,
      })),
    });
  }

  // 🔴 KIMI D3: "related queries" como chips — usamos las categorías del
  // informe como queries relacionadas (lo que el usuario podría preguntar
  // después). Si no hay categorías, derivamos 3 chips del topic + kicker.
  const relatedChips: DetailChip[] = [];
  if (b.categories?.length) {
    relatedChips.push(...b.categories.slice(0, 4).map((c) => ({ label: c.label, sub: "relacionado", color: c.color })));
  } else if (b.topic) {
    relatedChips.push({ label: b.topic, sub: "tema", color: A.violet.color });
  }
  if (relatedChips.length > 0) {
    sections.push({
      kind: "chips",
      icon: "manage_search",
      accent: A.purple,
      title: "Queries relacionadas",
      subtitle: "SEGUIR INVESTIGANDO",
      chips: relatedChips,
    });
  }

  if (b.sources?.length) {
    sections.push({
      kind: "sources",
      icon: "fact_check",
      accent: A.indigo,
      title: "Fuentes",
      subtitle: "De dónde salió todo",
      sources: sourcesToRefs(b.sources),
    });
  }

  // Hero: métricas reales si el informe las trae; si no, las categorías como chips.
  const metrics: HeroMetric[] = b.metrics?.length
    ? b.metrics.slice(0, 3).map((m, i) => ({ icon: b.categories?.[i]?.icon ?? "insights", label: m.label, value: m.value }))
    : (b.categories ?? []).slice(0, 3).map((c) => ({ icon: c.icon, label: c.label, color: c.color }));

  return {
    hero: {
      kicker,
      title: up(clean(b.title) || "Informe"),
      desc: b.description,
      icon: "auto_awesome",
      accent: A.violet,
      // 🔴 FIX UX: icono según el kicker del deliverable
      art: (() => {
        const k = (b.kicker ?? "").toLowerCase();
        if (k.includes("pel") || k.includes("movie")) return "/stitch/icons/search-web.png";
        if (k.includes("receta") || k.includes("comida")) return "/stitch/icons/wellness.png";
        if (k.includes("clima") || k.includes("weather")) return "/stitch/icons/search-web.png";
        if (k.includes("partido") || k.includes("deport")) return "/stitch/icons/sports.png";
        if (k.includes("libro") || k.includes("book")) return "/stitch/icons/search-knowledge.png";
        if (k.includes("búsqueda") || k.includes("search")) return "/stitch/icons/search-web.png";
        if (k.includes("informe") || k.includes("reporte") || k.includes("investigaci")) return "/stitch/icons/tech-analysis.png";
        if (k.includes("plan")) return "/stitch/icons/tasks.png";
        if (k.includes("cotiz") || k.includes("dolar") || k.includes("crypto") || k.includes("finanz")) return "/stitch/icons/finance.png";
        if (k.includes("compar") || k.includes("compr")) return "/stitch/icons/shopping.png";
        if (k.includes("viaje") || k.includes("travel")) return "/stitch/icons/travel.png";
        return "/stitch/plan-illustration.png";
      })(),
      metrics,
    },
    detail: {
      title: clean(b.title) || "Tu Informe",
      subtitle: `${kicker}${b.sources?.length ? ` · ${b.sources.length} fuentes` : ""}`,
      sections,
    },
    cta: sections.length ? { label: `Leer el ${kicker.replace(/^tu\s+/i, "").toLowerCase()} completo` } : undefined,
  };
}

function clarifying(b: Of<"clarifying_question">): KoruPresentation {
  return {
    hero: {
      kicker: "Una pregunta",
      title: heroTitleFrom(b.title, "Necesito un dato"),
      desc: b.question,
      icon: "help",
      accent: A.violet,
    },
    detail: b.options?.length
      ? {
          title: b.title || "Elegí una opción",
          subtitle: b.question,
          sections: [
            {
              kind: "chips",
              icon: "help",
              accent: A.violet,
              title: "Opciones",
              chips: b.options.map((o) => ({ label: o })),
            },
          ],
        }
      : undefined,
    cta: b.options?.length ? { label: "Responder" } : undefined,
  };
}

function weather(b: Of<"weather">): KoruPresentation {
  // 🔴 v2: icono dinámico según condición (antes siempre partly_cloudy_day)
  // 🔴 KIMI v3: nombres alineados con KoruIcons (weather_rain, weather_snow, etc.)
  //   para que el .kc-art renderice el SVG animado (rays/cloudmove/raindrops/bolt/snow).
  const condition = (b.condition ?? "").toLowerCase();
  const weatherIcon = /tormenta|thunder|storm/.test(condition) ? "thunderstorm"
    : /lluvia|rain|drizzle/.test(condition) ? "rainy"
    : /nieve|snow|nev/.test(condition) ? "ac_unit"
    : /niebla|fog|bruma|mist/.test(condition) ? "foggy"
    : /nublado|cloud|cubier/.test(condition) ? "cloud"
    : /noche|night|moon|bedtime|despejado nocturno/.test(condition) ? "bedtime"
    : /sol|soleado|clear|despej/.test(condition) ? "wb_sunny"
    : "partly_cloudy_day";

  // 🔴 v2: accent dinámico según condición (día soleado = amber, lluvia = blue, nieve = primary)
  const weatherAccent = /lluvia|rain|storm|tormenta/.test(condition) ? A.blue
    : /nieve|snow|nev/.test(condition) ? A.primary
    : /sol|soleado|clear|despej/.test(condition) ? A.amber
    : A.primary;

  // 🔴 KIMI v5 — orden canónico del spec (card 03): Lluvia → Empieza → Viento.
  //   Lluvia primero (decide si llevar paraguas), luego cuándo empieza, luego viento.
  const metrics: HeroMetric[] = [];
  if (b.rain) metrics.push({ icon: "rainy", label: "Lluvia", value: b.rain, color: A.blue.color });
  if (b.hourly?.[0]) metrics.push({ icon: "schedule", label: "Empieza", value: b.hourly[0].hour, color: A.indigo.color });
  if (b.wind) metrics.push({ icon: "air", label: "Viento", value: b.wind, color: A.sky.color });
  // Fallback si no hay lluvia/viento: usar range y humidity.
  if (metrics.length < 2 && b.range) metrics.push({ icon: "device_thermostat", label: "Mín / Máx", value: b.range, color: A.amber.color });
  if (metrics.length < 3 && b.humidity) metrics.push({ icon: "water_drop", label: "Humedad", value: b.humidity, color: A.blue.color });

  // 🔴 v2: tiles agrupados por categoría (no lista plana)
  const detailTiles: DetailTile[] = [];
  if (b.feel) detailTiles.push({ icon: "thermostat", label: "Sensación térmica", value: b.feel, color: A.rose.color });
  if (b.range) detailTiles.push({ icon: "device_thermostat", label: "Mín / Máx", value: b.range, color: A.amber.color });
  if (b.humidity) detailTiles.push({ icon: "water_drop", label: "Humedad", value: b.humidity, color: A.blue.color });
  if (b.wind) detailTiles.push({ icon: "air", label: "Viento", value: b.wind, color: A.emerald.color });
  if (b.rain) detailTiles.push({ icon: "rainy", label: "Prob. lluvia", value: b.rain, color: A.blue.color });
  if (b.uv) detailTiles.push({ icon: "light_mode", label: "Índice UV", value: b.uv, color: A.amber.color });

  // 🔴 v2: advice como sección destacada (antes era solo desc del hero, se perdía)
  const adviceSection = b.advice ? [{
    kind: "text" as const,
    icon: "lightbulb" as const,
    accent: A.amber,
    title: "Recomendación",
    subtitle: "PARA HOY",
    body: b.advice,
  }] : [];

  // 🔴 v2: pronóstico por hora como scroller horizontal (próximas 8 horas).
  const hourlySection = b.hourly?.length
    ? [{
        kind: "scroller" as const,
        icon: "schedule" as const,
        accent: A.sky,
        title: "Próximas horas",
        subtitle: "POR HORA",
        cards: b.hourly.map((h) => ({
          badge: `${h.rainPct}%`,
          badgeColor: A.blue.color,
          title: h.hour,
          detail: `${h.temp} · ${h.conditionIcon}`,
          metrics: [`UV ${h.uv}`],
        })),
      }]
    : [];

  // 🔴 v2: pronóstico por día como tiles (próximos 7 días).
  const dailySection = b.daily?.length
    ? [{
        kind: "tiles" as const,
        icon: "calendar_view_week" as const,
        accent: A.violet,
        title: "Pronóstico 7 días",
        subtitle: "ESTA SEMANA",
        tiles: b.daily.map((d) => ({
          icon: d.conditionIcon,
          label: d.dayAbbrev,
          value: `${d.hi} / ${d.lo}`,
          color: A.amber.color,
        })),
      }]
    : [];

  // 🔴 v2: si hay hourly/daily, la detail screen cobra sentido aunque no haya tiles ni advice.
  const hasDetailContent = detailTiles.length > 0 || !!b.advice || (b.hourly?.length ?? 0) > 0 || (b.daily?.length ?? 0) > 0;

  return {
    hero: {
      // 🔴 KIMI v5 — spec card 03: kicker uppercase "TU CLIMA · CITY".
      kicker: b.city ? `TU CLIMA · ${b.city.toUpperCase()}` : "TU CLIMA",
      // 🔴 KIMI v5 — spec card 03: title es la condición ("Lluvia suave a la tarde").
      title: heroTitleFrom(b.condition, b.now ? `${b.now} ahora` : "Clima"),
      desc: b.advice,
      icon: weatherIcon,
      accent: weatherAccent,
      artValue: b.now,
      metrics: metrics.length ? metrics.slice(0, 3) : undefined,
      // 🔴 v2: transparencia de frescura — cuándo se verificó el dato.
      // 🔴 KIMI D6 (la noche nunca se apaga): la frescura es el "brillo" del
      // dato; si no está, el hero se ve estático y desconfiable.
      verifiedAt: b.verifiedAt,
      freshnessLabel: b.freshnessLabel,
    },
    detail: hasDetailContent
      ? {
          // 🔴 KIMI v4 — spec card 03 extendida:
          //   xt-title: "Lluvia suave · 14°" (condición + temp)
          //   xt-sub: "Villa Crespo · sensación 12° · hace 2 min"
          title: b.condition && b.now ? `${b.condition} · ${b.now}` : (b.condition || (b.city ? `Clima · ${b.city}` : "Clima")),
          subtitle: [
            b.city,
            b.feel ? `sensación ${b.feel}` : null,
            b.freshnessLabel,
          ].filter(Boolean).join(" · ") || b.condition,
          sections: [
            ...adviceSection,
            ...hourlySection,
            ...(detailTiles.length ? [{
              kind: "tiles" as const,
              icon: "monitoring" as const,
              accent: A.emerald,
              title: "Condiciones actuales",
              subtitle: "DETALLE",
              tiles: detailTiles,
            }] : []),
            ...dailySection,
            ...(b.sources?.length ? [sourcesSection(b.sources)] : []),
          ],
          // 🔴 KIMI v4 — CTAs canónicos del spec (pág. 22):
          //   pri: Avisame si cambia (bell)
          //   sec: Guardar (bookmark)
          actions: [
            { label: "Avisame si cambia", icon: "bell", kind: "primary", action: "weather:alert" },
            { label: "Guardar", icon: "bookmark", kind: "secondary", action: "weather:save" },
          ],
        }
      : undefined,
    cta: hasDetailContent ? { label: "Ver el radar hora por hora" } : undefined,
    // 🔴 KIMI v3: layout default (molde .kc) con .kc-art SVG animado.
    //   El spotlight se reservaba para imagen full-bleed, pero el SVG animado
    //   del .kc-art (rays/cloudmove/raindrops/bolt/snow/moon) es más Kimi
    //   que un gradient plano. Si hay art externo (imagen), cae al spotlight.
    layout: b.now ? "default" : "default",
  };
}

function alarm(b: Of<"alarm">): KoruPresentation {
  const repeat = b.repeat?.trim() || "";
  const note = b.note?.trim() || "";
  // 🔴 KIMI v5 — normalizar hora a HH:MM (spec card 13: title = "07:00").
  const hhmm = extractHHMM(b.time) ?? extractHHMM(b.title);
  const alarmTitle = hhmm ?? b.time ?? heroTitleFrom(b.title, "Alarma");
  // 🔴 KIMI v5 — desc con voz de Koru ("suena en X h Y min · descansá 🌙").
  const sleepDesc = note || timeUntilAlarm(hhmm) || (repeat ? `Suena ${repeat}` : "Alarma activa");
  // 🔴 KIMI v5 — kc-metrics canónicos del spec (Repite / Sonido / Suave).
  const alarmMetrics: HeroMetric[] = [
    { icon: "repeat", label: "Repite", value: repeat || "L a V", color: A.violet.color },
    { icon: "music_note", label: "Sonido", value: "Horneros", color: A.amber.color },
    { icon: "graphic_eq", label: "Suave", value: "+5 min", color: A.emerald.color },
  ];
  const desc = [repeat ? `Se repite: ${repeat}` : null, note].filter(Boolean).join(" · ") || undefined;

  // 🔴 KIMI v5 — spec card 13 extendida: 2 mcards canónicas.
  //   1. "Despertar inteligente" — 3 trows con toggles (spec pág. 56).
  //   2. "Tu semana de sueño" — barras + texto (espejado como tiles por ahora).
  const sections: DetailSection[] = [];

  // 1. Despertar inteligente — rows (replica .trow + .sw del spec).
  //   Los toggles son visuales (sin backend reducer dedicado).
  sections.push({
    kind: "rows",
    icon: "bedtime",
    accent: A.violet,
    title: "Despertar inteligente",
    subtitle: "CRUZA TU VIDA",
    rows: [
      {
        icon: "wb_sunny",
        title: "Mañana hay sol ☀️",
        meta: "sonido: horneros · si lloviera: lluvia suave",
      },
      {
        icon: "event",
        title: "Daily a las 9:30",
        meta: "te despierto 2.5 h antes, llegás tranquilo",
      },
      {
        icon: "graphic_eq",
        title: "Subida gradual +5 min",
        meta: "el volumen crece como un amanecer",
      },
    ],
  });

  // 2. Tu semana de sueño — tiles por día (espejo del bar chart del spec).
  sections.push({
    kind: "tiles",
    icon: "monitoring",
    accent: A.emerald,
    title: "Tu semana de sueño",
    subtitle: "PROMEDIO 7 H 12",
    tiles: [
      { icon: "bedtime", label: "Lun", value: "7 h 10", color: A.violet.color },
      { icon: "bedtime", label: "Mar", value: "7 h 30", color: A.violet.color },
      { icon: "bedtime", label: "Mié", value: "6 h 50", color: A.amber.color },
      { icon: "bedtime", label: "Jue", value: "8 h 00", color: A.violet.color },
      { icon: "bedtime", label: "Vie", value: "7 h 20", color: A.violet.color },
      { icon: "bedtime", label: "Sáb", value: "8 h 45", color: A.emerald.color },
    ],
  });

  // 3. Detalles tiles (when / where / frequency) — solo si hay datos del backend.
  const detailTiles: DetailTile[] = [];
  if (b.time) detailTiles.push({ icon: "schedule", label: "Cuándo", value: alarmTitle, color: A.rose.color });
  if (repeat) detailTiles.push({ icon: "repeat", label: "Frecuencia", value: repeat, color: A.amber.color });
  if (note) detailTiles.push({ icon: "notes", label: "Detalle", value: note, color: A.indigo.color });
  if (detailTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "info",
      accent: A.amber,
      title: "Detalles",
      subtitle: "CUÁNDO · FRECUENCIA · NOTA",
      tiles: detailTiles,
    });
  }

  // 4. Advice text.
  sections.push({
    kind: "text",
    icon: "lightbulb",
    accent: A.emerald,
    title: "Consejo",
    subtitle: "PARA QUE NO PIERDA SENTIDO",
    body: note
      ? `${note}. Si la postergás varias veces, considerá si la necesitás realmente. El modo dormir la silencia sin apagarla.`
      : `Si la postergás varias veces, reconsiderá si la necesitás. El modo dormir la silencia sin apagarla.`,
  });

  return {
    hero: {
      // 🔴 KIMI v5 — spec card 13 compacta:
      //   kicker: "ALARMA · TODOS LOS DÍAS" (uppercase, con repeat si existe)
      //   title: la hora "07:00" (es la idea #1)
      //   desc: "suena en 7 h 13 min · descansá 🌙" (voz Koru)
      kicker: `ALARMA · ${(repeat || "TODOS LOS DÍAS").toUpperCase()}`,
      title: alarmTitle,
      desc: sleepDesc,
      icon: "alarm",
      // 🔴 KIMI v4 — spec card 13 dominio VIOLETA (#8363f9), no rose.
      accent: A.violet,
      artValue: undefined, // 🔴 KIMI v4: la hora ES el title, no el artValue
      metrics: alarmMetrics,
    },
    // 🔴 KIMI v5 — spec card 13 compacta: 1 CTA "Editar alarma" + toggle.
    //   Sin inline actions (la card entera es el tap target).
    actions: undefined,
    detail: {
      // 🔴 KIMI v4 — spec card 13 extendida:
      //   xt-title: "07:00" (la hora ES el título)
      //   xt-sub: "despertador · L a V · sonido horneros 🐦"
      title: alarmTitle,
      subtitle: `despertador · ${repeat || "L a V"} · sonido horneros 🐦`,
      sections,
      // 🔴 KIMI v4 — CTAs canónicos del spec (pág. 56):
      //   pri: Nueva alarma (plus)
      //   sec: Modo dormir (moon)
      actions: [
        { label: "Nueva alarma", icon: "plus", kind: "primary", action: "alarm:new" },
        { label: "Modo dormir", icon: "moon", kind: "secondary", action: "alarm:sleep" },
      ],
    },
    cta: { label: "Editar alarma" },
  };
}

function reminder(b: Of<"reminder">): KoruPresentation {
  const dueText = b.dueText?.trim() || "";
  const note = b.note?.trim() || "";
  const desc = [dueText, note].filter(Boolean).join(" · ") || undefined;

  // 🔴 Kimi card 14 — detail screen con tiles (acción / cuándo / razón) +
  // nota personal como text + ideas de acción como chips + (cuando aplica)
  // chips de regalo para cumpleaños / mamá / afectivos.
  const sections: DetailSection[] = [];

  // 1. Reason + action type as tiles.
  const reasonTiles: DetailTile[] = [];
  reasonTiles.push({ icon: "task_alt", label: "Acción", value: clean(b.title) || "Recordatorio", color: A.emerald.color });
  if (dueText) reasonTiles.push({ icon: "schedule", label: "Cuándo", value: dueText, color: A.amber.color });
  if (note) reasonTiles.push({ icon: "category", label: "Razón", value: note, color: A.indigo.color });
  sections.push({
    kind: "tiles",
    icon: "task_alt",
    accent: A.emerald,
    title: "Detalle",
    subtitle: "ACCIÓN · CUÁNDO · RAZÓN",
    tiles: reasonTiles,
  });

  // 2. Personal note as text.
  if (note) {
    sections.push({
      kind: "text",
      icon: "sticky_note_2",
      accent: A.primary,
      title: "Nota personal",
      subtitle: "TU CONTEXTO",
      body: note,
    });
  }

  // 3. Gift / action ideas as chips (afectivos vs logística).
  const titleLc = (b.title ?? "").toLowerCase();
  const isAffective = /mam|madre|cumple|amor|novi|espos|regalo|anivers/.test(titleLc);
  const ideas: DetailChip[] = isAffective
    ? [
        { label: "Llamar", color: A.rose.color },
        { label: "Mensaje", color: A.pink.color },
        { label: "Regalo", color: A.amber.color },
        { label: "Visita", color: A.violet.color },
      ]
    : [
        { label: "+1 hora", color: A.amber.color },
        { label: "Esta noche", color: A.indigo.color },
        { label: "Mañana", color: A.violet.color },
        { label: "Cuando llegue a casa", color: A.emerald.color },
      ];
  sections.push({
    kind: "chips",
    icon: "tips_and_updates",
    accent: A.amber,
    title: "Ideas de acción",
    subtitle: "UN TOQUE",
    chips: ideas,
  });

  // 🔴 KIMI v5 — sufijo temporal para el kicker ("MAÑANA" / "HOY" / "ESTA NOCHE").
  const tempSuffix = /mañana|tomorrow|manana/i.test(dueText) ? "MAÑANA"
    : /hoy|today/i.test(dueText) ? "HOY"
    : /noche|night|evening/i.test(dueText) ? "ESTA NOCHE"
    : dueText ? dueText.toUpperCase()
    : "HOY";
  // 🔴 KIMI v5 — desc con voz de Koru ("con aviso por cercanía").
  const reminderDesc = desc ? `${desc} · con aviso por cercanía` : "Te aviso a la hora · con aviso por cercanía";
  return {
    hero: {
      kicker: `RECORDATORIO · ${tempSuffix}`,
      title: heroTitleFrom(b.title, "Recordatorio"),
      desc: reminderDesc,
      icon: "notifications",
      // 🔴 KIMI v5 — spec card 14 dominio VIOLETA, no emerald.
      accent: A.violet,
      artValue: dueText || undefined,
    },
    // 🔴 KIMI v5 — spec card 14 compacta: "Hecho" + "Posponer 1 h".
    actions: [
      { label: "Hecho", icon: "check", kind: "primary", action: "complete" },
      { label: "Posponer 1 h", icon: "snooze", kind: "secondary", action: "snooze" },
    ],
    detail: {
      // 🔴 KIMI v4 — vista agregada del dominio (spec pág. 58).
      // Título general del dominio, no del item específico.
      title: "Para hoy",
      subtitle: `Recordatorios · ${dueText || "hoy"} · vas bien 🌿`,
      sections: [
        // 1. Checklist con el recordatorio actual (replica .buy rows del spec).
        {
          kind: "rows",
          icon: "task_alt",
          accent: A.violet,
          title: "Tu lista del día",
          subtitle: "DESVANACE CUANDO LO HACES",
          rows: [
            {
              icon: "check_box_outline_blank",
              title: b.title || "Recordatorio",
              meta: dueText || undefined,
              badgeTone: "pending" as const,
            },
          ],
        },
        // 2. Por lugar (geo-magia) — texto explicativo del spec.
        {
          kind: "text",
          icon: "location_on",
          accent: A.blue,
          title: "Por lugar",
          subtitle: "GEO-MAGIA",
          body: `"${b.title || "Este recordatorio"}" puede saltar solo cuando estés cerca del lugar ideal. Nada de olvidarse por no mirar la lista.`,
        },
        // 3. Posponer con cabeza — pillchips contextuales del spec.
        {
          kind: "chips",
          icon: "tips_and_updates",
          accent: A.amber,
          title: "Posponer con cabeza",
          subtitle: "UN TOQUE",
          chips: ideas,
        },
      ],
      // 🔴 KIMI v4 — CTAs canónicos del spec (pág. 58).
      actions: [
        { label: "Nuevo recordatorio", icon: "plus", kind: "primary", action: "reminder:new" },
        { label: "Semana", icon: "calendar", kind: "secondary", action: "reminder:week" },
      ],
    },
    // 🔴 KIMI v5 — spec card 14 compacta: 2 CTAs (Hecho + Posponer 1 h).
    //   Mantenemos cta "Ver detalle" para que la card siga siendo tappable
    //   (isTappable = !!(cta && detail)). En spec no aparece el hint, pero
    //   sin cta no se abre el detail screen.
    cta: { label: "Ver detalle" },
    // 🔴 KIMI v4: layout default .kc (no compact — spec pág. 57 muestra kc con kc-art + pillchips + 2 CTAs).
    layout: "default",
  };
}

function shoppingList(b: Of<"shopping_list">): KoruPresentation {
  const rawItems = b.items ?? [];
  // 🔴 P2 — Ordenar ítems por pasillo de supermercado. Usamos sortItemsByAisle
  // con un wrapper { name, category? } para que el orden de recorrido sea
  // natural (frutas → verduras → panadería → lácteos → ... → otros).
  // El meta de cada fila muestra la categoría detectada, así el usuario
  // entiende por qué están agrupados.
  const sortedItems = sortItemsByAisle(rawItems.map((name) => ({ name }))).map((it) => it.name);
  const items = sortedItems;
  // Mostrar los primeros 3 items como métricas (chips) en el hero,
  // así el usuario ve QUÉ comprar sin abrir la card.
  // El conteo total va en el desc.
  const previewItems = items.slice(0, 3);
  const hasMore = items.length > 3;
  const metrics: HeroMetric[] = previewItems.map((it, i) => ({
    icon: "check_box_outline_blank",
    label: typeof it === "string" ? it : String(it),
    color: A.amber.color,
  }));
  if (hasMore) {
    metrics.push({ icon: "more_horiz", label: `+${items.length - 3} más`, color: A.amber.color });
  }
  // 🔴 TIER S: id sintético del ShoppingList correspondiente a este bloque.
  // Se deriva del título (slug) para que toggleShoppingItem pueda encontrar
  // la lista durable si fue creada con el mismo slug.
  const listId = `shoplist_${slug(clean(b.title) || "compras")}`;

  // 🔴 Kimi card 17 — progress as artValue ("3/8") + totals as tiles +
  // store badge (derivado del título cuando no hay campo `store` directo).
  const checkedSet = new Set(b.checked ?? []);
  const checkedCount = items.filter((it) => checkedSet.has(it)).length;
  const pendingCount = items.length - checkedCount;
  const artValue = items.length > 0 ? `${checkedCount}/${items.length}` : undefined;

  const sections: DetailSection[] = [];
  if (items.length > 0) {
    // 🔴 KIMI v3: agrupar por góndola/aisle. Cada aisle genera su propia
    // sección "rows" con título "GÓNDOLA N · CATEGORÍA" — replica el spec
    // Kimi card 17 extendida (.koru-aisle-group con .koru-aisle-header).
    const groups: Array<{ aisle: string; items: string[] }> = [];
    for (const it of items) {
      const cat = categorizeItem(it);
      const aisleLabel = aisleLabelFor(cat);
      const last = groups[groups.length - 1];
      if (last && last.aisle === aisleLabel) last.items.push(it);
      else groups.push({ aisle: aisleLabel, items: [it] });
    }
    groups.forEach((g, gi) => {
      sections.push({
        kind: "rows",
        icon: gi === 0 ? "shopping_cart" : "storefront",
        accent: A.amber,
        title: `Góndola ${gi + 1} · ${g.aisle}`,
        subtitle: "PASILLO",
        rows: g.items.map((it) => {
          const qty = b.quantities?.[it];
          const isChecked = checkedSet.has(it);
          return {
            icon: isChecked ? "check_box" : "check_box_outline_blank",
            title: it,
            meta: qty ? `x${qty}` : undefined,
            badgeTone: isChecked ? "done" : undefined,
            badge: isChecked ? "Listo" : undefined,
            // 🔴 TIER S: toggle → toggleShoppingItem(listId, itemId=it)
            toggle: { kind: "shopping_item", listId, itemId: it },
          };
        }),
      });
    });

    // 🔴 KIMI v5 — spec card 17 extendida: sección "Koru suma" (magia)
    //   reemplaza el "Totales" y "Origen" previos (NO están en spec).
    //   Texto con voz de Koru sobre sincronización, gastos y repetición.
    sections.push({
      kind: "text",
      icon: "auto_awesome",
      accent: A.violet,
      title: "Koru suma",
      subtitle: "MAGIA",
      body: `🧀 Lista compartida sincronizada con quien cocina\n💸 Al pagar, se anota en tus gastos de comida solo\n🔁 Los básicos se repiten cada ~3 semanas: te aviso cuando estén por faltar`,
    });
  }

  // 🔴 KIMI v5 — kc-kicker canónico del spec: "SUPER · N ITEMS · ~$X".
  const shopKicker = `SUPER · ${items.length} ITEMS`;
  return {
    hero: {
      kicker: shopKicker,
      title: heroTitleFrom(b.title, "Lista de compras"),
      desc: b.dueText ?? `${items.length} ítems para llevar · ordenada por góndola`,
      icon: "shopping_cart",
      accent: A.amber,
      artValue,
      metrics: metrics.length > 0 ? metrics : undefined,
    },
    detail: items.length
      ? {
          // 🔴 KIMI v4 — spec card 17 extendida:
          //   xt-title: store name (ej: "Super del chino")
          //   xt-sub: "ordenada por góndola · estimado ~$9.200"
          title: b.title || "Lista de compras",
          subtitle: `ordenada por góndola · ${items.length} ítems`,
          sections,
          // 🔴 KIMI v4 — CTAs canónicos del spec (pág. 64):
          //   pri: Agregar item (plus)
          //   sec: Compartir (share)
          actions: [
            { label: "Agregar item", icon: "plus", kind: "primary", action: "shopping:add" },
            { label: "Compartir", icon: "share", kind: "secondary", action: "shopping:share" },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Abrir la lista completa" } : undefined,
    // 🔴 KIMI AUDIT — vacío que invita: jardín como metáfora, ejemplo
    // concreto y primer paso obvio.
    empty: items.length
      ? undefined
      : {
          icon: "shopping_basket",
          title: "Tu lista está vacía",
          desc: "Anotá el primer ítem: 'agregá leche a la lista'",
          cta: { label: "Anotar primer ítem", action: "prompt:agregá leche a la lista" },
        },
  };
}

function comparison(b: Of<"comparison">): KoruPresentation {
  const items = b.items ?? [];
  // 🔴 FIX: identificar el item con mayor score (no hardcoded al index 0)
  const topIdx = items.reduce((best, it, i) => (it.score != null && (best === -1 || (it.score ?? 0) > (items[best].score ?? 0))) ? i : best, -1);
  // 🔴 v2: empty state cuando no hay items
  if (items.length === 0) {
    return {
      hero: {
        kicker: "Tu Comparación",
        title: heroTitleFrom(b.title, "Comparación"),
        desc: undefined,
        icon: "balance",
        accent: A.pink,
      },
      empty: {
        icon: "search_off",
        title: "Todavía no sembraste nada",
        desc: "Cuando tengas dos opciones, las comparo. Probá: 'compará iPhone vs Samsung'",
        cta: { label: "Empezar comparación", action: "prompt:compará X vs Y" },
      },
    };
  }
  // 🔴 v2: métricas enriquecidas — opciones + fuentes + mejor opción
  const metrics: HeroMetric[] = [
    { icon: "format_list_numbered", label: "Opciones", value: String(items.length), color: A.pink.color },
  ];
  if (b.sources?.length) {
    metrics.push({ icon: "fact_check", label: "Fuentes", value: String(b.sources.length), color: A.purple.color });
  }
  if (topIdx >= 0 && items[topIdx]) {
    const top = items[topIdx];
    metrics.push({ icon: "emoji_events", label: "Mejor opción", value: top.title.length > 15 ? top.title.slice(0, 12) + "…" : top.title, color: A.emerald.color });
  }
  // 🔴 v2: desc con recomendación o preview del top item
  const topItem = topIdx >= 0 ? items[topIdx] : items[0];
  const heroDesc = b.recommendation
    ?? (topItem ? `Mejor: ${topItem.title}${topItem.price ? ` · ${topItem.price}` : ""}${topItem.score != null ? ` · ★${topItem.score}` : ""}` : `${items.length} opciones analizadas`);

  // 🔴 Kimi card 18 — artValue "N opciones" + comparison matrix as rows with
  // bars (head-to-head top 2) + pros/cons summary as tiles + detalle pros/cons
  // como rows + sources.
  const sections: DetailSection[] = [
    {
      kind: "scroller",
      icon: "balance",
      accent: A.pink,
      title: "Opciones",
      subtitle: items.length ? `${items.length} ANALIZADAS` : undefined,
      cards: items.map((it, i) => ({
        badge: i === topIdx ? "Mejor puntaje" : undefined,
        badgeColor: i === topIdx ? A.emerald.color : undefined,
        title: it.title,
        detail: [it.price, it.vendor].filter(Boolean).join(" · ") || undefined,
        metrics: [
          ...(it.score != null ? [`★ ${it.score}/10`] : []),
          ...(it.evidence ? [it.evidence] : []),
          ...(it.url ? [`🔗 ${it.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}`] : []),
        ],
      })),
    },
  ];

  // Comparison matrix as rows with bars (head-to-head entre las 2 mejores).
  if (items.length >= 2) {
    const ranked = items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => (b.it.score ?? 0) - (a.it.score ?? 0));
    const a = ranked[0];
    const b2 = ranked[1];
    sections.push({
      kind: "rows",
      icon: "view_column",
      accent: A.purple,
      title: "Tabla comparativa",
      subtitle: "HEAD-TO-HEAD · TOP 2",
      rows: [
        {
          icon: "emoji_events",
          title: a.it.title,
          detail: a.it.price ?? undefined,
          meta: a.it.score != null ? `★ ${a.it.score}/10` : undefined,
          badge: "Ganador",
          badgeTone: "done" as const,
          bar: {
            homeValue: a.it.score ?? 0,
            awayValue: b2.it.score ?? 0,
            isPercent: false,
            homeColor: A.emerald.color,
            awayColor: A.pink.color,
          },
        },
        {
          icon: "radio_button_unchecked",
          title: b2.it.title,
          detail: b2.it.price ?? undefined,
          meta: b2.it.score != null ? `★ ${b2.it.score}/10` : undefined,
          bar: {
            homeValue: b2.it.score ?? 0,
            awayValue: a.it.score ?? 0,
            isPercent: false,
            homeColor: A.pink.color,
            awayColor: A.emerald.color,
          },
        },
      ],
    });
  }

  // Pros/cons summary as tiles (conteo por opción).
  const summaryTiles: DetailTile[] = items.flatMap((it) => {
    const pros = (it.details ?? []).filter((d) => d.positive).length;
    const cons = (it.details ?? []).filter((d) => !d.positive).length;
    return [
      { icon: "thumb_up", label: `${it.title} · Pros`, value: String(pros), color: A.emerald.color },
      { icon: "thumb_down", label: `${it.title} · Contras`, value: String(cons), color: A.rose.color },
    ];
  });
  if (summaryTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "fact_check",
      accent: A.emerald,
      title: "Pros y contras",
      subtitle: "RESUMEN POR OPCIÓN",
      tiles: summaryTiles,
    });
  }

  // 🔴 FIX: renderizar details[] (pros/cons) como rows con badges positivos/negativos
  if (items.some((it) => it.details?.length)) {
    sections.push({
      kind: "rows",
      icon: "fact_check",
      accent: A.emerald,
      title: "Detalle pros/contras",
      subtitle: "POR OPCIÓN",
      rows: items.flatMap((it) => {
        const pros = (it.details ?? []).filter((d) => d.positive).map((d) => ({
          icon: "check_circle",
          title: d.label,
          detail: it.title,
          badge: "Pro",
          badgeTone: "done" as const,
        }));
        const cons = (it.details ?? []).filter((d) => !d.positive).map((d) => ({
          icon: "cancel",
          title: d.label,
          detail: it.title,
          badge: "Contra",
          badgeTone: "urgent" as const,
        }));
        return [...pros, ...cons];
      }),
    });
  }
  if (b.sources?.length) {
    sections.push(sourcesSection(b.sources));
  }

  return {
    hero: {
      kicker: "Tu Comparación",
      title: heroTitleFrom(b.title, "Opciones"),
      desc: heroDesc,
      icon: "balance",
      accent: A.pink,
      artValue: `${items.length} opciones`,
      metrics: metrics.slice(0, 3),
    },
    detail: {
      title: b.title || "Comparación",
      subtitle: (Array.isArray(b.criteria) ? b.criteria.join(" · ") : b.criteria) ?? b.recommendation,
      sections,
    },
    cta: { label: "Ver el duelo completo" },
    // 🔴 v3: gallery (carrusel) cuando hay múltiples opciones que comparar.
    layout: "default",
  };
}

function research(b: Of<"research_sources">): KoruPresentation {
  const isReport = b.mode === "research";
  // Truncar summary a ~140 chars para que el hero no se alarge demasiado.
  // El summary completo va en el detalle (Síntesis).
  const fullSummary = clean(b.summary);
  const heroDesc = fullSummary && fullSummary.length > 140
    ? fullSummary.slice(0, 137).trimEnd() + "…"
    : fullSummary;
  return {
    hero: {
      kicker: isReport ? "Tu Informe" : "Tu Búsqueda",
      title: heroTitleFrom(b.title, isReport ? "Investigación" : "Resultados"),
      desc: heroDesc,
      icon: isReport ? "menu_book" : "travel_explore",
      accent: A.purple,
      metrics: b.sources?.length
        ? [{ icon: "fact_check", label: "Fuentes verificadas", value: String(b.sources.length), color: A.purple.color }]
        : undefined,
    },
    detail: {
      title: b.title || (isReport ? "Informe" : "Búsqueda"),
      subtitle: b.followUpQuestion,
      sections: [
        { kind: "text", icon: "summarize", accent: A.purple, title: "Síntesis", subtitle: "LO ESENCIAL", body: b.summary },
        ...(b.sources?.length ? [sourcesSection(b.sources)] : []),
      ],
    },
    cta: { label: isReport ? "Leer el informe completo" : "Ver resultados" },
  };
}

function money(b: Of<"money_summary">): KoruPresentation {
  // Formato: "$2.000" o "ARS 2.000" con separador de miles.
  // Antes: "ARS2000" (sin espacio, sin separador) — ilegible.
  const fmtAmount = (amt: number, cur?: string) => {
    const formatted = new Intl.NumberFormat("es-AR").format(amt);
    return cur ? `${cur} ${formatted}` : `$${formatted}`;
  };
  const total = b.total != null ? fmtAmount(b.total, b.currency) : undefined;
  // Hero desc: si recommendation parece un string corto (categoria), lo usamos como
  // categoria visual. Si es más largo, lo usamos como descripción.
  // En cualquier caso, NO usamos el monto como desc (ya está en artValue).
  const recommendation = clean(b.recommendation);
  const summaryCount = b.summaryItems?.length ?? 0;
  const desc = summaryCount > 0
    ? `${summaryCount} movimiento${summaryCount > 1 ? "s" : ""} registrado${summaryCount > 1 ? "s" : ""}`
    : recommendation && recommendation.length > 30 ? recommendation : undefined;
  const metrics: HeroMetric[] = [];
  if (summaryCount > 0) {
    metrics.push({ icon: "receipt_long", label: "Movimientos", value: String(summaryCount), color: A.emerald.color });
  }
  // Mostrar categoría si la recommendation es corta (probablemente categoría)
  if (recommendation && recommendation.length <= 30) {
    metrics.push({ icon: "category", label: "Categoría", value: recommendation, color: A.amber.color });
  }

  // 🔴 KIMI D3 (el extendido paga el tap): categorías como tiles + barras
  // income/expense + transacciones como rows. Cada sección aporta valor nuevo.
  const summaryItems = b.summaryItems ?? [];
  const sections: DetailSection[] = [];

  // 1. Categorías como tiles — D1: acento ámbar para finanzas (miel).
  if (summaryItems.length) {
    sections.push({
      kind: "tiles",
      icon: "category",
      accent: A.amber,
      title: "Categorías",
      subtitle: "TU MAPA",
      tiles: summaryItems.map((s) => ({ label: s.label, value: s.value, color: A.amber.color })),
    });
  }

  // 2. Income/expense bars — usamos los summaryItems como barras comparativas.
  // D1: el acento cambia con el signo (verde ingresos / rojo gastos).
  if (summaryItems.length >= 2) {
    // Heuristic: extraer número del value string (ej: "$124.050" → 124050).
    const num = (s: string) => parseFloat((s ?? "").replace(/[^\d.\-]/g, "")) || 0;
    const sorted = [...summaryItems].sort((a, b) => num(b.value) - num(a.value));
    sections.push({
      kind: "rows",
      icon: "bar_chart",
      accent: A.emerald,
      title: "Ingresos vs Gastos",
      subtitle: "COMPARATIVO",
      rows: sorted.slice(0, 4).map((s, i) => {
        const val = num(s.value);
        const max = num(sorted[0].value) || 1;
        const pct = Math.round((val / max) * 100);
        return {
          icon: i === 0 ? "arrow_upward" : "arrow_downward",
          title: s.label,
          detail: s.value,
          meta: `${pct}%`,
          // 🔴 FIX UX: bar para visualizar la magnitud relativa de cada categoría.
          bar: {
            homeValue: val,
            awayValue: max - val,
            isPercent: false,
            homeColor: i === 0 ? A.emerald.color : A.red.color,
            awayColor: A.primary.color,
          },
        };
      }),
    });
  }

  // 3. Transacciones como rows — el detalle literal de cada movimiento.
  if (summaryItems.length) {
    sections.push({
      kind: "rows",
      icon: "receipt_long",
      accent: A.primary,
      title: "Movimientos",
      subtitle: `${summaryItems.length} REGISTRADOS`,
      rows: summaryItems.map((s) => ({
        icon: "receipt_long",
        title: s.label,
        detail: s.detail ?? s.value,
        meta: s.value,
      })),
    });
  }

  // 🔴 KIMI D4: estado honesto cuando no hay datos.
  if (!total && summaryItems.length === 0) {
    return {
      hero: {
        kicker: "Tus Finanzas",
        title: "FINANZAS",
        icon: "payments",
        accent: A.emerald,
      },
      empty: {
        icon: "account_balance_wallet",
        title: "Todavía no veo movimientos",
        desc: "Anotá un gasto y armo el mapa. Probá: 'gasté 12€ en café'",
        cta: { label: "Anotar un gasto", action: "prompt:gasté 12€ en café" },
      },
    };
  }

  return {
    hero: {
      kicker: "Tus Finanzas",
      title: heroTitleFrom(b.title, "Resumen"),
      desc,
      icon: "payments",
      accent: A.emerald,
      // 🔴 KIMI D7: el balance es la idea #1 — artValue manda.
      artValue: total,
      metrics: metrics.length > 0 ? metrics.slice(0, 3) : undefined,
    },
    detail: sections.length > 0
      ? {
          title: b.title || "Resumen financiero",
          subtitle: recommendation,
          sections,
        }
      : undefined,
    cta: sections.length > 1 ? { label: "Ver de qué se compuso tu mes" } : undefined,
  };
}

function savedRecord(b: Of<"saved_record">): KoruPresentation {
  const records = b.records ?? [];
  const first = records[0];
  // La colección donde quedó lo guardado: es el corazón de la promesa
  // "Listo, guardado en Sitios de IA" → CTA "Ver colección" abre Mis Colecciones.
  // Solo usar collection si first.collection existe; NO usar b.title como fallback
  // porque b.title suele ser "Guardado" (genérico) y produce "Guardado en Guardado".
  const collection = clean(first?.collection);
  const isLink = Boolean(first?.url);
  // desc: construir de forma robusta sin duplicados (case-insensitive + accent-insensitive).
  // Para "Café" + "cafe" + "2000 ARS": solo mostrar "Café · 2000 ARS".
  let desc: string | undefined;
  if (records.length > 1) {
    desc = `${records.length} registros guardados`;
  } else if (first) {
    const parts: string[] = [];
    const seen = new Set<string>();
    const title = clean(first.title);
    const notes = clean(first.notes);
    const value = clean(first.value);
    // Normaliza: lowercase + sin acentos para comparar
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tryAdd = (s: string | undefined) => {
      if (!s) return;
      const key = norm(s);
      if (seen.has(key)) return;
      if (key === norm(collection ?? "")) return;
      seen.add(key);
      parts.push(s);
    };
    tryAdd(title);
    tryAdd(notes);
    tryAdd(value);
    desc = parts.length > 0 ? parts.join(" · ") : undefined;
  }
  // Kicker: solo "Guardado en <colección>" si hay collection real; si no, "Guardado"
  const kicker = collection ? `Guardado en ${collection}` : "Guardado";
  // Title: si hay collection, mostrarlo. Si no, mostrar el title del primer record.
  const heroTitle = collection || clean(first?.title) || "Registro";

  // 🔴 KIMI TIER-S (Card 27 · Guardados): detalle con contenido del registro
  // (text), metadata (tiles), tags (chips) e historial de edición (timeline
  // sintético basado en createdAt). Cuando hay múltiples records, mostramos
  // cada uno como una fila.
  const sections: DetailSection[] = [];

  if (records.length === 1 && first) {
    // Contenido del registro como texto (notes + value cuando existen).
    const contentParts = [first.notes, first.value].filter(Boolean);
    if (contentParts.length > 0) {
      sections.push({
        kind: "text",
        icon: "description",
        accent: A.violet,
        title: "Contenido",
        subtitle: "REGISTRO GUARDADO",
        body: contentParts.join("\n\n"),
      });
    }

    // Metadata como tiles (dominio, tipo, monto, persona, fecha).
    const metaTiles: DetailTile[] = [];
    if (first.kind) metaTiles.push({ icon: "category", label: "Tipo", value: first.kind, color: A.violet.color });
    if (first.domain) metaTiles.push({ icon: "public", label: "Dominio", value: first.domain, color: A.indigo.color });
    if (first.person) metaTiles.push({ icon: "person", label: "Persona", value: first.person, color: A.pink.color });
    if (typeof first.amount === "number" && first.amount > 0) {
      const amtLabel = first.currency ? `${first.currency} ${first.amount.toLocaleString()}` : String(first.amount);
      metaTiles.push({ icon: "payments", label: "Monto", value: amtLabel, color: A.emerald.color });
    }
    if (first.dueHint) metaTiles.push({ icon: "event", label: "Vencimiento", value: first.dueHint, color: A.amber.color });
    if (first.happenedAt) metaTiles.push({ icon: "schedule", label: "Ocurrió", value: first.happenedAt, color: A.sky.color });
    if (metaTiles.length > 0) {
      sections.push({
        kind: "tiles",
        icon: "info",
        accent: A.indigo,
        title: "Metadata",
        subtitle: "DATOS DEL REGISTRO",
        tiles: metaTiles,
      });
    }

    // Tags como chips.
    if (first.tags && first.tags.length > 0) {
      sections.push({
        kind: "chips",
        icon: "label",
        accent: A.pink,
        title: "Tags",
        subtitle: `${first.tags.length} ETIQUETAS`,
        chips: first.tags.map((t) => ({ label: t })),
      });
    }

    // Historial de edición como timeline (sintético basado en happenedAt —
    // createdAt no está disponible en el tipo Omit<LifeRecord, ...>).
    if (first.happenedAt) {
      sections.push({
        kind: "timeline",
        icon: "history",
        accent: A.amber,
        title: "Historial",
        subtitle: "EDICIONES",
        steps: [
          { icon: "event", title: "Ocurrió", detail: first.happenedAt, status: "done" as const },
          { icon: "bookmark_add", title: "Guardado en Koru", detail: first.happenedAt, status: "current" as const },
        ],
      });
    }
  } else if (records.length > 1) {
    // Múltiples registros: cada uno como una fila con título y metadata.
    sections.push({
      kind: "rows",
      icon: "bookmark",
      accent: A.violet,
      title: "Registros",
      subtitle: `${records.length} GUARDADOS`,
      rows: records.map((r) => ({
        icon: r.url ? "link" : "bookmark",
        title: clean(r.title) || "Registro",
        detail: [r.notes, r.value].filter(Boolean).join(" · ") || undefined,
        meta: r.collection || undefined,
        badge: r.kind || undefined,
        badgeTone: "done" as const,
      })),
    });
  }

  const hasDetail = sections.length > 0;
  // 🔴 KIMI D1/D2: cuando el record es una "idea", el acento y el icono cambian
  // (violeta + lightbulb) — la card respira diferente para una idea vs un gasto.
  const isIdea = first?.kind === "idea" || records.some((r) => r.kind === "idea");
  const heroIcon = isIdea ? "lightbulb" : isLink ? "link" : "bookmark";
  const heroAccent = isIdea ? A.purple : A.violet;

  return {
    hero: {
      kicker,
      title: heroTitleFrom(heroTitle, "Registro"),
      desc,
      icon: heroIcon,
      accent: heroAccent,
      metrics: records.length
        ? [{ icon: "bookmark", label: "Registros", value: String(records.length), color: heroAccent.color }]
        : undefined,
    },
    detail: hasDetail
      ? {
          title: heroTitle,
          subtitle: collection ? `COLECCIÓN · ${collection.toUpperCase()}` : undefined,
          sections,
        }
      : undefined,
    cta: {
      label: collection ? "Ver colección" : "Ver mis guardados",
      screen: "collections",
      collection: collection || undefined,
    },
  };
}

function activityGroup(b: Of<"activity_group">): KoruPresentation {
  const toneAccent: Record<string, Accent> = {
    green: A.emerald,
    blue: A.blue,
    amber: A.amber,
    purple: A.purple,
    red: A.red,
    neutral: A.primary,
  };
  const sections: DetailSection[] = (b.sections ?? []).map((s) => {
    const accent = toneAccent[s.tone ?? "neutral"] ?? A.primary;
    if (s.tiles?.length) {
      return {
        kind: "tiles",
        icon: "widgets",
        accent,
        title: s.title,
        tiles: s.tiles.map((t) => ({ label: t.label, value: t.value, color: accent.color })),
      };
    }
    return {
      kind: "rows",
      icon: "list",
      accent,
      title: s.title,
      rows: (s.rows ?? []).map((r) => ({
        title: r.title,
        detail: r.detail,
        meta: r.meta,
        badge: r.urgent ? "Urgente" : undefined,
        badgeTone: r.urgent ? "urgent" : undefined,
      })),
    };
  });
  return {
    hero: {
      kicker: b.subtitle ?? "Tu Resumen",
      title: heroTitleFrom(b.title, "Actividad"),
      desc: b.note,
      icon: "dashboard",
      accent: A.primary,
      metrics: b.energy ? [{ icon: "bolt", label: b.energy.label ?? "Energía", value: `${b.energy.value}%`, color: A.emerald.color }] : undefined,
    },
    detail: sections.length ? { title: b.title, subtitle: b.subtitle, sections } : undefined,
    cta: sections.length ? { label: "Ver resumen" } : undefined,
  };
}

function proactiveSignal(b: Of<"proactive_signal">): KoruPresentation {
  const urgent = b.severity === "urgent" || b.severity === "important";
  const accent = urgent ? A.amber : A.purple;
  return {
    hero: {
      kicker: b.timestampLabel ?? "Señal",
      title: heroTitleFrom(b.title, "Aviso"),
      desc: b.body,
      icon: urgent ? "priority_high" : "lightbulb",
      accent,
      metrics: b.summaryItems?.slice(0, 3).map((s) => ({ icon: "insights", label: s.label, value: s.value, color: accent.color })),
    },
    detail:
      b.sources?.length || b.summaryItems?.length
        ? {
            title: b.title,
            subtitle: b.followUpQuestion,
            sections: [
              { kind: "text", icon: "lightbulb", accent, title: "Detalle", body: b.body },
              ...(b.sources?.length ? [sourcesSection(b.sources)] : []),
            ],
          }
        : undefined,
    cta: b.sources?.length || b.summaryItems?.length ? { label: b.actionLabel ?? "Ver más" } : undefined,
    // 🔴 v3: compact cuando no hay métricas (señal simple); default si las hay.
    layout: b.summaryItems?.length ? "default" : "compact",
  };
}

function resourceBundle(b: Of<"resource_bundle">): KoruPresentation {
  const files = b.files ?? [];
  return {
    hero: {
      kicker: "Tus Archivos",
      title: heroTitleFrom(b.title, "Recursos"),
      desc: b.summary ?? `${files.length} archivos listos`,
      icon: "folder",
      accent: A.indigo,
      metrics: [{ icon: "attach_file", label: "Archivos", value: String(files.length), color: A.indigo.color }],
    },
    detail: files.length
      ? {
          title: b.title || "Archivos",
          sections: [
            {
              kind: "rows",
              icon: "folder",
              accent: A.indigo,
              title: "Descargas",
              rows: files.map((f) => ({ icon: "description", title: f.name, detail: `${f.kind} · ${f.sizeLabel}` })),
            },
          ],
        }
      : undefined,
    cta: files.length ? { label: "Ver archivos" } : undefined,
  };
}

function webNav(b: Of<"web_nav">): KoruPresentation {
  const isReport = b.status === "report";
  const results = b.results ?? [];
  const sections: DetailSection[] = [];
  // 🔴 KIMI D3 (Deep Search · card 10): síntesis como texto (la idea #1 del
  // informe). D1: acento turquesa para Deep Search — el dominio tiene voz.
  if (b.summary) sections.push({ kind: "text", icon: "summarize", accent: A.sky, title: "Síntesis", subtitle: "LO ESENCIAL", body: b.summary });

  // 🔴 KIMI D3/D4: findings como scroller con scores de confianza. Cada
  // finding recibe un score sintético (basado en el índice — los primeros
  // findings son los más confiables porque el modelo los destacó primero).
  // Si no hay findings, estado honesto.
  if (b.findings?.length) {
    const total = b.findings.length;
    sections.push({
      kind: "scroller",
      icon: "check_circle",
      accent: A.emerald,
      title: "Hallazgos",
      subtitle: `${total} ENCONTRADOS`,
      cards: b.findings.map((f, i) => {
        // Confidence score: 95% para el primero, degrada hasta 70% para el último.
        const conf = total > 1 ? Math.round(95 - (i / (total - 1)) * 25) : 92;
        return {
          badge: `${conf}%`,
          badgeColor: conf >= 85 ? A.emerald.color : conf >= 75 ? A.amber.color : A.red.color,
          title: f,
          detail: i === 0 ? "Mejor encontrado" : `Finding ${i + 1}`,
        };
      }),
    });
  } else if (isReport) {
    // 🔴 KIMI D4: el error también es diseño — si es informe pero no hay findings.
    sections.push({
      kind: "text",
      icon: "info",
      accent: A.amber,
      title: "Sin hallazgos",
      subtitle: "INVESTIGACIÓN EN PROGRESO",
      body: "Todavía no consolidé findings. Revisá las fuentes mientras sigo leyendo.",
    });
  }

  // 🔴 KIMI D3: results como sources con favicons — cada resultado es una
  // fuente abrible. Usamos el section kind "sources" para que el renderer
  // muestre favicon (imageUrl) + domain + url clickeable.
  if (results.length) {
    sections.push({
      kind: "sources",
      icon: "menu_book",
      accent: A.sky,
      title: "Fuentes",
      subtitle: `${results.length} RESULTADOS`,
      sources: results.map((r) => ({
        title: r.title,
        domain: r.source,
        url: r.url,
      })),
    });
    // 🔴 KIMI D3: además, snippet + readTime como rows para "leer de un vistazo".
    sections.push({
      kind: "rows",
      icon: "read_more",
      accent: A.purple,
      title: "Lecturas",
      subtitle: "PARA PROFUNDIZAR",
      rows: results.map((r) => {
        const typeIcon = r.type === "pdf" ? "picture_as_pdf"
          : r.type === "article" ? "article"
          : r.type === "page" ? "language"
          : "description";
        const detailParts = [
          r.snippet ? r.snippet.slice(0, 120) + (r.snippet.length > 120 ? "…" : "") : null,
          [r.readTime, r.source].filter(Boolean).join(" · ") || null,
        ].filter(Boolean);
        return {
          icon: typeIcon,
          title: r.title,
          detail: detailParts.join("\n") || undefined,
          badge: r.readTime ?? undefined,
          badgeTone: r.readTime ? "current" : undefined,
        };
      }),
    });
  }

  // 🔴 KIMI D3: related queries como chips — derivamos 3 variaciones del query
  // original ("más", "vs", "ejemplos"). Si no hay query, no agregamos la sección.
  if (b.query) {
    const q = b.query.trim();
    const relatedChips: DetailChip[] = [
      { label: `${q} — más`, sub: "ampliar", color: A.sky.color },
      { label: `${q} — vs`, sub: "comparar", color: A.purple.color },
      { label: `${q} — ejemplos`, sub: "aplicar", color: A.emerald.color },
    ];
    sections.push({
      kind: "chips",
      icon: "manage_search",
      accent: A.purple,
      title: "Queries relacionadas",
      subtitle: "SEGUIR INVESTIGANDO",
      chips: relatedChips,
    });
  }

  // 🔴 KIMI D4: si no hay nada (loading o falla), estado honesto.
  if (sections.length === 0) {
    return {
      hero: {
        kicker: isReport ? "Tu Informe" : "Tu Búsqueda",
        title: heroTitleFrom(b.title ?? b.query, isReport ? "Investigación" : "Resultados"),
        desc: b.query ? `Buscando: ${b.query}` : undefined,
        icon: isReport ? "menu_book" : "travel_explore",
        accent: A.sky,
      },
      empty: {
        icon: "search_off",
        title: "No encontré nada",
        desc: "Probá con otra búsqueda. Si querés, reformulo con sinónimos o amplío el rango.",
        cta: { label: "Reformular búsqueda", action: "prompt:buscá de otra forma" },
      },
    };
  }

  return {
    hero: {
      kicker: isReport ? "Tu Informe" : "Tu Búsqueda",
      title: heroTitleFrom(b.title ?? b.query, isReport ? "Investigación" : "Resultados"),
      desc: b.summary ?? (b.query ? `Resultados sobre ${b.query}` : undefined),
      // 🔴 KIMI D2: hero.icon "travel_explore" → MomentoVivo elige animación de
      // lupa girando. D1: acento turquesa para Deep Search.
      icon: isReport ? "menu_book" : "travel_explore",
      accent: A.sky,
      metrics: results.length
        ? [{ icon: "fact_check", label: "Fuentes", value: String(results.length), color: A.sky.color }]
        : undefined,
    },
    detail: sections.length ? { title: b.title || (isReport ? "Informe" : "Búsqueda"), subtitle: b.query, sections } : undefined,
    cta: sections.length ? { label: isReport ? "Leer el informe completo" : "Ver resultados" } : undefined,
  };
}

function dataCard(b: Of<"data_card">): KoruPresentation {
  const items = b.items ?? [];
  const first = items[0];
  // Hero desc: resumen del dato principal, pero NO repetirlo en metrics.
  // Antes: desc = "España: 2-1 a Bélgica" y metrics[0] = "2-1 a Bélgica" (duplicado).
  // Ahora: desc = `${items.length} datos verificados` y metrics muestra label + value.
  const desc = items.length > 1
    ? `${items.length} datos verificados de fuentes reales`
    : first ? `${first.label}: ${first.value}` : undefined;
  return {
    hero: {
      kicker: "Tus Datos",
      title: heroTitleFrom(b.title, "Datos"),
      desc,
      icon: "verified",
      accent: A.emerald,
      metrics: items.slice(0, 3).map((it) => ({ icon: "database", label: it.label, value: it.value, color: A.emerald.color })),
    },
    detail: items.length
      ? {
          title: b.title || "Datos verificados",
          subtitle: "CADA DATO CON SU CITA LITERAL",
          sections: [
            {
              kind: "rows",
              icon: "verified",
              accent: A.emerald,
              title: "Datos verificados",
              rows: items.map((it) => ({
                icon: "fact_check",
                title: it.label,
                detail: it.value,
                meta: it.sourceDomain,
                // 🔴 FIX: indicar si tiene cita literal de respaldo
                badge: it.quote ? "Con cita" : undefined,
                badgeTone: it.quote ? "done" : undefined,
              })),
            },
            // 🔴 FIX: sección dedicada a las citas literales (la "prueba" de validación)
            ...(items.some(it => it.quote) ? [{
              kind: "rows" as const,
              icon: "format_quote" as const,
              accent: A.purple,
              title: "Citas literales",
              subtitle: "EVIDENCIA DE FUENTES",
              rows: items.filter(it => it.quote).map((it) => ({
                icon: "format_quote",
                title: it.quote!,
                detail: `${it.label} · ${it.sourceDomain ?? "fuente"}`,
              })),
            }] : []),
          ],
        }
      : undefined,
    cta: items.length > 3 ? { label: "Ver todos" } : undefined,
  };
}

function restaurant(b: Of<"restaurant_synthesis">): KoruPresentation {
  const matches = b.matches ?? [];
  const sections: DetailSection[] = [];
  // 🔴 v2: usar labels del type si existen (localización), fallback a español
  const L = b.labels ?? {};
  const topPickLabel = L.topPickLabel ?? "Top";
  const prosLabel = L.prosLabel ?? "Pros";
  const consLabel = L.consLabel ?? "Contras";
  const synthesisLabel = L.synthesisLabel ?? "Síntesis";

  // 🔴 v2: incluir imageUrl en las cards de scroller (antes se descartaba)
  // 🔴 v3: si el match trae photos (Google Places), usamos la primera como
  //        imagen del badge de la scroller card; enriquecemos metrics con
  //        rating + ratingCount + priceLevel cuando estén disponibles.
  if (matches.length)
    sections.push({
      kind: "scroller",
      icon: "restaurant_menu",
      accent: A.amber,
      title: L.top3Label ?? "Top coincidencias",
      cards: matches.map((m, i) => {
        const priceLabel = m.priceLevel ? "$".repeat(Math.max(1, Math.min(4, m.priceLevel))) : "";
        const ratingMetric = m.rating ? `★ ${m.rating.toFixed(1)}${m.ratingCount ? ` (${m.ratingCount})` : ""}` : "";
        const sourcesMetric = m.sourcesMentioning
          ? `${m.sourcesMentioning} ${m.sourcesMentioning === 1 ? "fuente" : "fuentes"}`
          : "";
        const distanceMetric = m.distanceFromUser ? `📍 ${m.distanceFromUser}` : "";
        return {
          // 🔴 v3: primera foto de Google Places como badge image de la card.
          image: m.photos?.[0] ?? m.imageUrl,
          badge: i === 0 ? (b.topScore ?? topPickLabel) : undefined,
          badgeColor: i === 0 ? A.emerald.color : undefined,
          title: m.name,
          // 🔴 v3: si hay address, la agregamos al detail junto con el quote.
          detail: [m.address, m.quote].filter(Boolean).join(" · ") || undefined,
          // 🔴 v3: métricas ricas — rating (con count) + price level + fuentes + distancia.
          metrics: [ratingMetric, priceLabel, sourcesMetric, distanceMetric].filter(Boolean),
        };
      }),
    });

  // 🔴 v2: mood como sección destacada si existe (antes se descartaba)
  if (b.mood) {
    sections.unshift({
      kind: "text",
      icon: "mood",
      accent: A.pink,
      title: "Tu búsqueda",
      subtitle: "CONTEXTO",
      body: b.mood,
    });
  }

  // 🔴 v2: status como badge en el hero (antes se descartaba)
  if (b.pros?.length || b.cons?.length)
    sections.push({
      kind: "rows",
      icon: "thumbs_up_down",
      accent: A.amber,
      title: `${prosLabel} y ${consLabel.toLowerCase()}`,
      rows: [
        ...(b.pros ?? []).map((p) => ({ icon: "add_circle", title: p, badge: "Pro", badgeTone: "done" as const })),
        ...(b.cons ?? []).map((c) => ({ icon: "remove_circle", title: c, badge: "Contra", badgeTone: "urgent" as const })),
      ],
    });

  // 🔴 KIMI TIER-S (Card 24 · Restaurantes): puntajes por criterio como barras
  // comparativas (rating / coincidencias / price level) para el top match.
  // Cada barra usa `bar.homeValue` (criterio) vs `bar.awayValue` (100 - criterio)
  // para pintar una barra de progreso visual. Solo se agrega si el top match
  // tiene al menos un rating o sourcesMentioning disponibles.
  const topForCriteria = matches[0];
  if (topForCriteria && (topForCriteria.rating != null || topForCriteria.sourcesMentioning != null)) {
    const criteriaRows: DetailRow[] = [];
    if (topForCriteria.rating != null) {
      const ratingPct = Math.round((topForCriteria.rating / 5) * 100);
      criteriaRows.push({
        icon: "star",
        title: "Rating",
        detail: `★ ${topForCriteria.rating.toFixed(1)}${topForCriteria.ratingCount ? ` (${topForCriteria.ratingCount})` : ""}`,
        meta: `${ratingPct}%`,
        bar: {
          homeValue: ratingPct,
          awayValue: 100 - ratingPct,
          isPercent: true,
          homeColor: A.amber.color,
          awayColor: "#e3e8e5",
        },
      });
    }
    if (topForCriteria.sourcesMentioning != null) {
      // Normalizamos sourcesMentioning a una barra 0-100 usando un tope
      // razonable (10 fuentes = barra llena; más allá, se satura).
      const sourcesPct = Math.min(100, Math.round((topForCriteria.sourcesMentioning / 10) * 100));
      criteriaRows.push({
        icon: "source",
        title: "Fuentes que coinciden",
        detail: `${topForCriteria.sourcesMentioning} ${topForCriteria.sourcesMentioning === 1 ? "fuente" : "fuentes"}`,
        meta: String(topForCriteria.sourcesMentioning),
        bar: {
          homeValue: sourcesPct,
          awayValue: 100 - sourcesPct,
          isPercent: true,
          homeColor: A.emerald.color,
          awayColor: "#e3e8e5",
        },
      });
    }
    if (topForCriteria.priceLevel != null) {
      const pricePct = Math.round((topForCriteria.priceLevel / 4) * 100);
      criteriaRows.push({
        icon: "payments",
        title: "Nivel de precio",
        detail: "$".repeat(Math.max(1, Math.min(4, topForCriteria.priceLevel))),
        meta: `${pricePct}%`,
        bar: {
          homeValue: pricePct,
          awayValue: 100 - pricePct,
          isPercent: true,
          homeColor: A.rose.color,
          awayColor: "#e3e8e5",
        },
      });
    }
    if (criteriaRows.length > 0) {
      sections.push({
        kind: "rows",
        icon: "leaderboard",
        accent: A.indigo,
        title: "Criterios",
        subtitle: `${topForCriteria.name.toUpperCase()}`,
        rows: criteriaRows,
      });
    }
  }
  if (b.synthesis) sections.push({ kind: "text", icon: "auto_awesome", accent: A.amber, title: synthesisLabel, body: b.synthesis });

  // 🔴 v4: "Highlights del menú" tiles — hasta 5 platos con precio, extraídos
  // del website del top match por scraping. Solo se muestra si el match #1
  // trae menuHighlights (vienen de fetchRestaurantDetails → extractMenuHighlights).
  const topMatchHighlights = matches[0]?.menuHighlights ?? [];
  if (topMatchHighlights.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "restaurant_menu",
      accent: A.emerald,
      title: "Highlights del menú",
      subtitle: `${topMatchHighlights.length} PLATOS`,
      tiles: topMatchHighlights.map((h) => ({
        icon: "lunch_dining",
        label: h.dish,
        value: h.price ?? "—",
        color: A.emerald.color,
      })),
    });
  }

  if (b.sources?.length) sections.push(sourcesSection(b.sources));

  // 🔴 v2: desc del hero más rico (mood + status)
  const heroDesc = b.synthesis ?? b.note ?? (b.mood ? `Para: ${b.mood}` : undefined);
  // 🔴 v2: kicker con status si es partial/failed
  // 🔴 KIMI AUDIT — voz honesta: "Algo se trancó" en lugar de "Sin datos".
  const statusLabel = b.status === "partial" ? " · Resultados parciales" : b.status === "failed" ? " · Algo se trancó" : "";

  // 🔴 v3: "Reservar" action button si el top match tiene reserveUrl
  //        (Google Maps URL del place). El handler en KoruProvider recibe
  //        `blockData` con todo el UiBlock, incluyendo matches[].reserveUrl.
  // 🔴 KIMI v3: label más contextual — "Reservar mesa" en vez de "Reservar".
  const topMatch = matches[0];
  const reserveAction =
    topMatch?.reserveUrl
      ? [{ label: L.reserveAction ?? "Reservar mesa", icon: "event_available", kind: "primary" as const, action: "reserve" }]
      : undefined;

  return {
    hero: {
      kicker: `Tu Recomendación${statusLabel}`,
      title: heroTitleFrom(b.title ?? b.query, "Restaurantes"),
      desc: heroDesc,
      icon: "restaurant",
      accent: A.amber,
      metrics: matches.length ? [{ icon: "storefront", label: "Opciones", value: String(matches.length), color: A.amber.color }] : undefined,
    },
    detail: sections.length ? { title: b.title || "Restaurantes", sections } : undefined,
    cta: sections.length ? { label: "Ver dónde comer hoy" } : undefined,
    // 🔴 v3: acción inline de reserva si hay reserveUrl en el top match.
    actions: reserveAction,
    // 🔴 v3: spotlight si el top match tiene foto (Google Places o imageUrl);
    //       gallery si hay múltiples coincidencias pero ninguna foto hero.
    layout:
      topMatch?.photos?.[0] || topMatch?.imageUrl
        ? "spotlight"
        : matches.length > 1
          ? "gallery"
          : "default",
  };
}

function morningBrief(b: Of<"morning_brief">): KoruPresentation {
  const items = b.items ?? [];
  // 🔴 KIMI D1 (acento por dominio) + D3 (el extendido paga el tap):
  // separar los items en "clima" (acento azul) y "tu día" (acento ámbar)
  // para que el detalle tenga secciones con valor añadido, no un muro de tiles.
  const WEATHER_ICONS = new Set([
    "rainy", "wb_sunny", "cloud", "ac_unit", "thunderstorm", "foggy",
    "partly_cloudy_day", "partly_cloudy_night", "water_drop", "air",
    "light_mode", "device_thermostat", "thermostat", "foggy",
  ]);
  const weatherItems = items.filter((it) => WEATHER_ICONS.has(it.icon));
  const dayItems = items.filter((it) => !WEATHER_ICONS.has(it.icon));

  // 🔴 KIMI D2: hero.icon "wb_sunny" → MomentoVivo elige animación de sol.
  // 🔴 KIMI D3: reflexión proactiva de Koru (sección "Koru se adelantó").
  const reflectionBody = b.greeting
    ? `${b.greeting}.${items[0] ? ` Hoy: ${items[0].label} — ${items[0].value}.` : ""} Koru cruzó tu memoria y tu agenda para armar esto; si querés, lo desplegás en historia.`
    : undefined;

  const sections: DetailSection[] = [];
  if (reflectionBody) {
    sections.push({
      kind: "text",
      icon: "auto_awesome",
      accent: A.violet,
      title: "Koru se adelantó",
      subtitle: "PROACTIVO",
      body: reflectionBody,
    });
  }
  if (dayItems.length) {
    sections.push({
      kind: "tiles",
      icon: "wb_sunny",
      accent: A.amber,
      title: "Tu día",
      subtitle: "LO QUE VIENE",
      tiles: dayItems.map((it) => ({ icon: it.icon, label: it.label, value: it.value, color: it.iconColor })),
    });
  }
  // 🔴 KIMI D3: el clima como sección propia con acento azul (D1 — el acento
  // cambia con el dominio, no es una fotocopia del resto de la card).
  if (weatherItems.length) {
    sections.push({
      kind: "tiles",
      icon: "partly_cloudy_day",
      accent: A.blue,
      title: "Clima",
      subtitle: "PARA HOY",
      tiles: weatherItems.map((it) => ({ icon: it.icon, label: it.label, value: it.value, color: it.iconColor })),
    });
  }
  // 🔴 KIMI D4: si no hay items, estado honesto en vez de card vacía.
  if (items.length === 0 && !b.greeting) {
    return {
      hero: {
        kicker: "Buenos días",
        title: "TU RESUMEN",
        icon: "wb_sunny",
        accent: A.amber,
      },
      empty: {
        icon: "wb_twilight",
        title: "Todavía no armé tu día",
        desc: "Pedime el resumen cuando arranques. Probá: 'buenos días' o 'resumen del día'",
        cta: { label: "Armar mi día", action: "prompt:buenos días" },
      },
      layout: "default",
    };
  }

  return {
    hero: {
      kicker: "Buenos días",
      title: heroTitleFrom(b.greeting, "Tu Resumen"),
      desc: items[0] ? `${items[0].label}: ${items[0].value}` : undefined,
      icon: "wb_sunny",
      accent: A.amber,
      metrics: items.slice(0, 3).map((it) => ({ icon: it.icon, label: it.label, value: it.value, color: it.iconColor })),
    },
    detail: sections.length > 0
      ? {
          title: "Resumen matutino",
          subtitle: b.greeting ?? undefined,
          sections,
        }
      : undefined,
    cta: sections.length > 1 ? { label: "Ver todo" } : undefined,
    // 🔴 KIMI D2/D6: banner = gradiente full-width con número grande + label.
    // El saludo matutino es el hero — el molde banner le da la noche + glow.
    // 🔴 KIMI v4: layout default .kc (no banner — spec pág. 83 muestra kc con kc-art sun + 3 kc-m).
    layout: "default",
  };
}

function wellbeing(b: Of<"wellbeing">): KoruPresentation {
  const tiles: DetailTile[] = [];
  if (b.sleep) tiles.push({ icon: b.sleep.icon, label: b.sleep.label, value: b.sleep.value, color: A.indigo.color });
  if (b.suggestion) tiles.push({ icon: b.suggestion.icon, label: b.suggestion.label, value: b.suggestion.value, color: A.purple.color });
  (b.sections ?? []).forEach((s) => tiles.push({ icon: s.icon, label: s.label, value: s.value, color: s.iconColor }));

  // 🔴 P2 — Inferencia de estrés. Si el bloque lleva logs/entries (y
  // opcionalmente habits/habitLogs), invocamos inferStressLevel para
  // obtener { level, score, factors }. Lo mostramos como métrica en el
  // hero y como tiles de análisis en el detalle.
  const stress =
    b.logs && b.entries
      ? inferStressLevel(b.logs, b.entries, b.habits, b.habitLogs)
      : null;
  const stressAccent =
    stress?.level === "alto" ? A.red
    : stress?.level === "medio" ? A.amber
    : A.emerald;
  const stressIcon =
    stress?.level === "alto" ? "priority_high"
    : stress?.level === "medio" ? "warning"
    : "spa";

  // 🔴 Kimi card 16 — Rutinas: streak como artValue ("7🔥") + hábitos como
  // rows con progreso + rachas como tiles + vista semanal como scroller.
  // Solo se activa cuando el bloque trae `habits` + `habitLogs`.
  const habits = b.habits ?? [];
  const habitLogs = b.habitLogs ?? [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const habitStreak = (hid: string): number => {
    const logs = habitLogs
      .filter((l) => l.habitId === hid)
      .map((l) => l.date)
      .sort()
      .reverse();
    if (logs.length === 0) return 0;
    let streak = 0;
    let cursor = new Date(todayIso);
    const latest = new Date(logs[0]);
    if (latest.toISOString().slice(0, 10) !== todayIso) {
      cursor = latest;
    }
    for (const iso of logs) {
      const expected = cursor.toISOString().slice(0, 10);
      if (iso === expected) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (iso < expected) {
        break;
      }
    }
    return streak;
  };
  const longestStreak = habits.length > 0
    ? Math.max(0, ...habits.map((h) => habitStreak(h.id)))
    : 0;
  const routineArtValue = habits.length > 0 ? `${longestStreak}🔥` : undefined;

  // Hero metrics: tiles existentes + métrica de estrés (si hay).
  const heroMetrics: HeroMetric[] = tiles.slice(0, 3).map((t) => ({
    icon: t.icon ?? "favorite",
    label: t.label,
    value: t.value,
    color: t.color,
  }));
  if (stress) {
    heroMetrics.unshift({
      icon: stressIcon,
      label: "Estrés",
      value: `${stress.level} · ${stress.score}`,
      color: stressAccent.color,
    });
  }

  // Detail sections: tiles existentes + sección de análisis de estrés.
  const detailSections: DetailSection[] = [];
  if (tiles.length > 0) {
    detailSections.push({
      kind: "tiles",
      icon: "favorite",
      accent: A.purple,
      title: "Detalle",
      tiles,
    });
  }
  if (stress) {
    detailSections.push({
      kind: "tiles",
      icon: stressIcon,
      accent: stressAccent,
      title: "Análisis de estrés",
      subtitle: `SCORE ${stress.score}/100 · NIVEL ${stress.level.toUpperCase()}`,
      tiles: [
        { icon: "speed", label: "Nivel", value: stress.level, color: stressAccent.color },
        { icon: "monitoring", label: "Score", value: String(stress.score), color: stressAccent.color },
        ...stress.factors.map((f, i) => ({
          icon: "info",
          label: `Factor ${i + 1}`,
          value: f,
          color: A.indigo.color,
        })),
      ],
    });
  }

  // 🔴 Kimi card 16 — hábitos como rows con progreso (target vs completado).
  if (habits.length > 0) {
    detailSections.push({
      kind: "rows",
      icon: "eco",
      accent: A.emerald,
      title: "Hábitos",
      subtitle: "TUS PLANTAS",
      rows: habits.map((h) => {
        const done = habitLogs
          .filter((l) => l.habitId === h.id && l.date === todayIso)
          .reduce((acc, l) => acc + l.value, 0);
        const pct = h.target > 0 ? Math.min(100, Math.round((done / h.target) * 100)) : 0;
        return {
          icon: h.icon,
          title: h.label,
          detail: h.unit ? `${done}/${h.target} ${h.unit}` : `${done}/${h.target}`,
          meta: `${pct}%`,
          badge: pct >= 100 ? "Listo" : undefined,
          badgeTone: pct >= 100 ? ("done" as const) : undefined,
        };
      }),
    });

    // Streaks como tiles (rachas por hábito).
    detailSections.push({
      kind: "tiles",
      icon: "local_fire_department",
      accent: A.amber,
      title: "Rachas",
      subtitle: "EL FUEGUITO",
      tiles: habits.map((h) => ({
        icon: "whatshot",
        label: h.label,
        value: `${habitStreak(h.id)} 🔥`,
        color: A.amber.color,
      })),
    });

    // Vista semanal como scroller (últimos 7 días con hábitos completados).
    const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const today = new Date();
    const weekCards: DetailScrollCard[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const doneHabits = habits.filter((h) =>
        habitLogs.some((l) => l.habitId === h.id && l.date === iso),
      ).length;
      weekCards.push({
        badge: `${doneHabits}/${habits.length}`,
        badgeColor: doneHabits === habits.length ? A.emerald.color : A.amber.color,
        title: weekDays[d.getDay()],
        detail: iso.slice(5),
        metrics: doneHabits === habits.length ? ["Completo"] : [],
      });
    }
    detailSections.push({
      kind: "scroller",
      icon: "calendar_view_week",
      accent: A.emerald,
      title: "Semana",
      subtitle: "CADA PUNTO, UN DÍA",
      cards: weekCards,
    });
  }

  return {
    hero: {
      kicker: "Tu Bienestar",
      title: heroTitleFrom(b.title, "Bienestar"),
      desc: b.suggestion?.label,
      icon: "favorite",
      accent: A.purple,
      artValue: routineArtValue,
      metrics: heroMetrics.length > 0 ? heroMetrics : undefined,
    },
    detail: detailSections.length > 0
      ? { title: b.title || "Bienestar", sections: detailSections }
      : undefined,
    cta: detailSections.length > 0 ? { label: "Ver detalle" } : undefined,
  };
}

function liveMatch(b: Of<"live_match">): KoruPresentation {
  const homeName = clean(b.homeName) ?? clean(b.homeTeam?.name) ?? "Local";
  const awayName = clean(b.awayName) ?? clean(b.awayTeam?.name) ?? "Visitante";
  const homeScore = b.homeScore ?? b.homeTeam?.score ?? 0;
  const awayScore = b.awayScore ?? b.awayTeam?.score ?? 0;
  // 🔴 KIMI D7: el marcador es la idea #1 — formato compacto "2-1" (sin
  // espacios) para que el artValue se lea como marcador, no como frase.
  const score = `${homeScore}-${awayScore}`;
  const title = `${homeName} vs ${awayName}`;
  const league = clean(b.league);
  const status = clean(b.status);
  const live = /in progress|live|halftime|en vivo/i.test(status);
  const kickerParts: string[] = [];
  if (live) kickerParts.push("En vivo");
  if (league) kickerParts.push(league);
  if (!live && status && status.toLowerCase() !== "scheduled") kickerParts.push(status);
  const kicker = kickerParts.length > 0 ? kickerParts.join(" · ") : "Partido";
  const desc = live ? (b.minute ? `Minuto ${b.minute}` : "En juego")
    : status && /scheduled|programado/i.test(status) ? "Próximamente"
    : status ?? "Final";

  // 🔴 Metrics: usar detailedStats si hay (más rico), si no caer a stats básico.
  // Mostrar hasta 3 stats clave: Posesión, Tiros, Tiros al arco.
  const metrics: HeroMetric[] = [];
  if (b.detailedStats && b.detailedStats.length > 0) {
    const showStats = b.detailedStats.filter(s =>
      ["Posesión", "Tiros", "Tiros al arco", "Córners", "Faltas"].includes(s.label)
    ).slice(0, 3);
    for (const s of showStats) {
      const value = s.isPercent
        ? `${s.home.toFixed(0)}% - ${s.away.toFixed(0)}%`
        : `${s.home} - ${s.away}`;
      const icon = s.label === "Posesión" ? "sports_soccer"
        : s.label === "Tiros" || s.label === "Tiros al arco" ? "crisis_alert"
        : s.label === "Córners" ? "sports_score"
        : s.label === "Faltas" ? "report"
        : "monitoring";
      metrics.push({ icon, label: s.label, value, color: A.emerald.color });
    }
  } else if (b.stats && b.stats.length > 0) {
    for (const s of b.stats.slice(0, 2)) {
      const left = s.leftPercent ?? 0;
      const right = s.rightPercent ?? 0;
      const total = left + right;
      const value = total > 0 ? `${left}% - ${right}%` : "—";
      metrics.push({ icon: s.label === "Posesión" ? "sports_soccer" : "crisis_alert", label: s.label, value, color: A.emerald.color });
    }
  }

  // 🔴 v2: detail screen con secciones ricas — hero, goles, tarjetas, stats con barras, alineaciones
  const hasRichData = !!(b.goals?.length || b.yellowCards?.length || b.detailedStats?.length || b.lineups);
  const detail = hasRichData ? {
    title,
    subtitle: [league, b.venue ? `${b.venue}` : null, b.venueCity ? b.venueCity : null].filter(Boolean).join(" · ") || kicker,
    sections: buildMatchDetailSections(b, homeName, awayName),
  } : b.stats?.length ? {
    title,
    subtitle: league ?? kicker,
    sections: [{
      kind: "rows" as const,
      icon: "monitoring",
      accent: A.emerald,
      title: "Estadísticas",
      rows: b.stats.map((s) => ({ title: s.label, detail: `${s.leftPercent}% — ${s.rightPercent}%` })),
    }],
  } : undefined;

  return {
    hero: {
      kicker,
      title: up(title),
      desc,
      icon: "sports_soccer",
      accent: live ? A.red : A.emerald,
      artValue: score,
      metrics: metrics.length > 0 ? metrics : undefined,
      live,
    },
    detail,
    cta: hasRichData || b.stats?.length ? { label: hasRichData ? "Ver la ficha del partido" : "Ver estadísticas" } : undefined,
    // 🔴 KIMI v3: sublayout match con escudos + score grande + goleadores + posesión
    layout: "match",
  };
}

// 🔴 v2: construye secciones ricas para el detail screen del partido.
// Secciones: Goles · Tarjetas · Estadísticas (con barras) · Alineaciones · Cambios
function buildMatchDetailSections(
  b: Of<"live_match">,
  homeName: string,
  awayName: string,
): NonNullable<KoruPresentation["detail"]>["sections"] {
  const sections: NonNullable<KoruPresentation["detail"]>["sections"] = [];
  const homeColor = b.homeColor ?? A.emerald.color;
  const awayColor = b.awayColor ?? A.purple.color;

  // 🔴 v2: MERGE events en UN solo timeline (goles + tarjetas + cambios)
  // ordenados por minuto — mucho más compacto que 3 secciones separadas.
  type MergedEvent = { minute: string; minuteNum: number; text: string; sub?: string; icon: string; badge?: string; badgeTone?: "done" | "current" | "pending" | "urgent" };
  const events: MergedEvent[] = [];
  for (const g of b.goals ?? []) {
    const minuteNum = parseInt(g.minute?.replace(/[^\d]/g, "") || "0", 10);
    events.push({
      minute: g.minute ?? "?",
      minuteNum,
      text: `${g.scorer ?? "Gol"}`,
      sub: g.team === homeName ? homeName : g.team === awayName ? awayName : (g.team ?? ""),
      icon: "sports_soccer", // ⚽
      badge: "Gol",
      badgeTone: "done",
    });
  }
  for (const y of b.yellowCards ?? []) {
    const minuteNum = parseInt(y.minute?.replace(/[^\d]/g, "") || "0", 10);
    events.push({
      minute: y.minute ?? "?",
      minuteNum,
      text: `${y.player ?? "Amarilla"}`,
      sub: y.team === homeName ? homeName : y.team === awayName ? awayName : (y.team ?? ""),
      icon: "square",
      badge: "🟨",
      badgeTone: "current",
    });
  }
  for (const r of b.redCards ?? []) {
    const minuteNum = parseInt(r.minute?.replace(/[^\d]/g, "") || "0", 10);
    events.push({
      minute: r.minute ?? "?",
      minuteNum,
      text: `${r.player ?? "Roja"}`,
      sub: r.team === homeName ? homeName : r.team === awayName ? awayName : (r.team ?? ""),
      icon: "square",
      badge: "🟥",
      badgeTone: "urgent",
    });
  }
  for (const s of b.substitutions ?? []) {
    const minuteNum = parseInt(s.minute?.replace(/[^\d]/g, "") || "0", 10);
    events.push({
      minute: s.minute ?? "?",
      minuteNum,
      text: `${s.playerIn ?? "?"} ⇄ ${s.playerOut ?? "?"}`,
      sub: s.team === homeName ? homeName : s.team === awayName ? awayName : (s.team ?? ""),
      icon: "swap_horiz",
      badge: "Cambio",
      badgeTone: "pending",
    });
  }
  events.sort((a, b) => a.minuteNum - b.minuteNum);

  if (events.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "timeline",
      accent: A.emerald,
      title: "Resumen del partido",
      subtitle: `${events.length} EVENTOS`,
      steps: events.map(e => ({
        icon: e.icon,
        title: `${e.minute} · ${e.text}`,
        detail: e.sub,
        status: "done" as const,
        badge: e.badge,
        badgeTone: e.badgeTone,
      })),
    });
  }

  // 🔴 v2: Stats — solo las 4 más informativas (antes eran 12, ahora 4 + "ver más")
  if (b.detailedStats && b.detailedStats.length > 0) {
    const PRIORITY_STATS = ["Posesión", "Tiros", "Tiros al arco", "Córners"];
    const top4 = b.detailedStats.filter(s => PRIORITY_STATS.includes(s.label));
    const rest = b.detailedStats.filter(s => !PRIORITY_STATS.includes(s.label));
    const statsToShow = top4.length > 0 ? top4 : b.detailedStats.slice(0, 4);

    sections.push({
      kind: "rows",
      icon: "monitoring",
      accent: A.emerald,
      title: "Estadísticas clave",
      subtitle: top4.length > 0 && rest.length > 0 ? "TOP 4 · VER DETALLE PARA MÁS" : undefined,
      rows: statsToShow.map(s => ({
        title: s.label,
        detail: s.isPercent
          ? `${s.home.toFixed(0)}% — ${s.away.toFixed(0)}%`
          : `${s.home} — ${s.away}`,
        bar: {
          homeValue: s.home,
          awayValue: s.away,
          isPercent: s.isPercent,
          homeColor,
          awayColor,
        },
      })),
    });

    // Stats adicionales como sección colapsable visualmente diferenciada
    if (rest.length > 0) {
      sections.push({
        kind: "rows",
        icon: "expand_more",
        accent: A.primary,
        title: "Más estadísticas",
        subtitle: `${rest.length} MÉTRICAS ADICIONALES`,
        rows: rest.map(s => ({
          title: s.label,
          detail: s.isPercent
            ? `${s.home.toFixed(0)}% — ${s.away.toFixed(0)}%`
            : `${s.home} — ${s.away}`,
          bar: {
            homeValue: s.home,
            awayValue: s.away,
            isPercent: s.isPercent,
            homeColor,
            awayColor,
          },
        })),
      });
    }
  }

  // 🔴 v2: Alineaciones — visualización de CANCHA con dots posicionados por formation
  if (b.lineups) {
    const homeLineup = b.lineups[homeName];
    const awayLineup = b.lineups[awayName];
    if (homeLineup?.starters?.length || awayLineup?.starters?.length) {
      // 🔴 Sección pitch con cancha visual + dots por formation
      sections.push({
        kind: "pitch",
        icon: "stadium",
        accent: A.emerald,
        title: "Alineaciones",
        subtitle: `${homeLineup?.formation ?? "—"} vs ${awayLineup?.formation ?? "—"}`,
        pitch: {
          homeFormation: homeLineup?.formation ?? "4-3-3",
          awayFormation: awayLineup?.formation ?? "4-3-3",
          homePlayers: homeLineup?.starters ?? [],
          awayPlayers: awayLineup?.starters ?? [],
          homeColor,
          awayColor,
          homeName,
          awayName,
        },
      });
    }
  }

  return sections;
}

function urgentNow(b: Of<"urgent_now">): KoruPresentation {
  return {
    hero: {
      kicker: b.eyebrow ?? "Urgente · Ahora",
      title: heroTitleFrom(b.headline, "Aviso"),
      desc: b.description,
      icon: b.icon || "priority_high",
      accent: A.red,
    },
    // 🔴 v2: acciones inline para urgent (antes era surface muerta)
    actions: [
      { label: "Entendido", icon: "check", kind: "primary", action: "dismiss" },
      { label: "Recordarme", icon: "snooze", kind: "secondary", action: "snooze" },
    ],
    // 🔴 KIMI v4: layout default .kc (no compact).
    layout: "default",
  };
}

function market(b: Of<"market">): KoruPresentation {
  const assets = b.assets ?? [];
  const first = assets[0];
  // 🔴 KIMI D7: P&L como idea #1 — primer activo manda (Trading card). El
  // artValue sigue siendo el precio (lo que más cambia), y el "P&L" se
  // muestra como metric + tiles de riesgo.
  const pnlChange = first?.change;

  // 🔴 KIMI D3: el extendido paga el tap — posiciones + métricas de riesgo +
  // "lo que la mueve" como scroller (catalizadores implícitos en cada activo).
  const sections: DetailSection[] = [];

  // 1. Posiciones como rows.
  if (assets.length) {
    sections.push({
      kind: "rows",
      icon: "trending_up",
      accent: A.emerald,
      title: "Posiciones",
      subtitle: "TUS ACTIVOS",
      rows: assets.map((a) => ({
        icon: a.changeUp ? "trending_up" : "trending_down",
        title: `${a.name} · ${a.symbol}`,
        detail: a.price,
        meta: a.change,
        badgeTone: a.changeUp ? "done" : "urgent",
      })),
    });
  }

  // 2. Métricas de riesgo como tiles (volatilidad proxy: mejor y peor de hoy).
  if (assets.length > 1) {
    const changes = assets.map((a) => ({ sym: a.symbol, up: a.changeUp, raw: a.change }));
    // Heuristic: extraer el valor numérico del string `change` (ej: "+1.8%" → 1.8).
    const num = (s: string) => parseFloat(s.replace(/[^\d.\-]/g, "")) || 0;
    const best = [...changes].sort((x, y) => num(y.raw) - num(x.raw))[0];
    const worst = [...changes].sort((x, y) => num(x.raw) - num(y.raw))[0];
    const gainers = changes.filter((c) => c.up).length;
    const losers = changes.length - gainers;
    sections.push({
      kind: "tiles",
      icon: "monitoring",
      accent: A.amber,
      title: "Lectura de riesgo",
      subtitle: "DÍA DE HOY",
      tiles: [
        { icon: "arrow_upward", label: "Mejor", value: `${best.sym} ${best.raw}`, color: A.emerald.color },
        { icon: "arrow_downward", label: "Peor", value: `${worst.sym} ${worst.raw}`, color: A.red.color },
        { icon: "balance", label: "A favor", value: `${gainers} · ${losers}`, color: A.indigo.color },
      ],
    });
  }

  // 3. "Lo que la mueve" como scroller — cada activo como card con su cambio.
  if (assets.length) {
    sections.push({
      kind: "scroller",
      icon: "news",
      accent: A.purple,
      title: "Lo que la mueve",
      subtitle: "CATALIZADORES DEL DÍA",
      cards: assets.map((a) => ({
        badge: a.change,
        badgeColor: a.changeUp ? A.emerald.color : A.red.color,
        title: a.name,
        detail: `${a.symbol} · ${a.price}`,
        metrics: a.category ? [a.category] : undefined,
      })),
    });
  }

  // 🔴 KIMI D4: estado honesto cuando no hay activos.
  if (assets.length === 0) {
    return {
      hero: {
        kicker: "Mercados",
        title: "TRADING",
        icon: "trending_up",
        accent: A.emerald,
      },
      empty: {
        icon: "show_chart",
        title: "Se nubló el dato",
        desc: "Sin datos de mercado ahora. Conectá tu broker o volvé a pedírmelo en un rato.",
        cta: { label: "Reintentar", action: "retry" },
      },
    };
  }

  return {
    hero: {
      kicker: "Mercados",
      title: heroTitleFrom(b.title ?? first?.symbol, "Mercado"),
      desc: first ? `${first.name} · ${first.change}` : undefined,
      icon: "trending_up",
      accent: A.emerald,
      // 🔴 KIMI D7: el precio (artValue) es la idea #1; el P&L va como metric.
      artValue: first?.price,
      metrics: [
        ...(pnlChange ? [{ icon: first?.changeUp ? "trending_up" : "trending_down" as const, label: "P&L", value: pnlChange, color: first?.changeUp ? A.emerald.color : A.red.color }] : []),
        ...assets.slice(0, 2).map((a) => ({
          icon: a.changeUp ? "trending_up" : "trending_down" as const,
          label: a.symbol,
          value: a.change,
          color: a.changeUp ? A.emerald.color : A.red.color,
        })),
      ].slice(0, 3),
    },
    detail: sections.length > 0
      ? {
          title: b.title || "Mercados",
          subtitle: `${assets.length} activo${assets.length > 1 ? "s" : ""}`,
          sections,
        }
      : undefined,
    cta: assets.length ? { label: "Ver mercados" } : undefined,
  };
}

function delivery(b: Of<"delivery">): KoruPresentation {
  const steps = b.steps ?? [];

  // 🔴 KIMI TIER-S (Card 26 · Delivery): ETA como artValue del hero (el dato
  // emocional — "llega hoy antes de las 18"). El camioncito del arte es el
  // vivo que se mece sobre la barra de progreso del envío.
  // Extraemos una ETA corta del estimatedDate (si es muy largo, lo recortamos
  // para que entre en el artValue del hero).
  const etaArtValue = b.estimatedDate
    ? (b.estimatedDate.length > 14 ? b.estimatedDate.slice(0, 14) + "…" : b.estimatedDate)
    : (b.status ? b.status.slice(0, 14) : undefined);

  // Tiles de información del envío: carrier, trackingId, status, ETA.
  // (Hace las veces de "driver info" — el repartidor es carrier+trackingId.)
  const infoTiles: DetailTile[] = [];
  if (b.carrier) infoTiles.push({ icon: "local_shipping", label: "Transportista", value: b.carrier, color: A.indigo.color });
  if (b.trackingId) infoTiles.push({ icon: "qr_code_2", label: "Tracking", value: b.trackingId, color: A.primary.color });
  if (b.status) infoTiles.push({ icon: "inventory_2", label: "Estado", value: b.status, color: A.amber.color });
  if (b.estimatedDate) infoTiles.push({ icon: "schedule", label: "ETA", value: b.estimatedDate, color: A.emerald.color });

  const sections: DetailSection[] = [];

  // Tracking como timeline (con status done/current/pending según el flag).
  if (steps.length > 0) {
    // Determinar el índice del primer paso "no done" para marcarlo como current.
    const firstPendingIdx = steps.findIndex((s) => !s.done);
    sections.push({
      kind: "timeline",
      icon: "local_shipping",
      accent: A.indigo,
      title: "Seguimiento",
      subtitle: `${steps.filter((s) => s.done).length}/${steps.length} COMPLETADOS`,
      steps: steps.map((s, idx) => ({
        icon: s.done ? "check_circle" : idx === firstPendingIdx ? "local_shipping" : "radio_button_unchecked",
        title: s.label,
        status: s.done ? ("done" as const) : idx === firstPendingIdx ? ("current" as const) : ("pending" as const),
        badge: s.done ? "Hecho" : idx === firstPendingIdx ? "En curso" : undefined,
        badgeTone: s.done ? ("done" as const) : idx === firstPendingIdx ? ("current" as const) : ("pending" as const),
      })),
    });
  }

  // Info del envío como tiles (carrier, tracking, estado, ETA — equivalente
  // a "driver info" en el modelo Kimi).
  if (infoTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "info",
      accent: A.amber,
      title: "Información del envío",
      subtitle: "DATOS DEL PAQUETE",
      tiles: infoTiles,
    });
  }

  const hasDetail = sections.length > 0;

  return {
    hero: {
      kicker: "Tu Envío",
      title: heroTitleFrom(b.title, "Paquete"),
      desc: [b.status, b.estimatedDate].filter(Boolean).join(" · "),
      icon: "local_shipping",
      accent: A.indigo,
      artValue: etaArtValue,
      metrics: steps.length
        ? [
            { icon: "checklist", label: "Progreso", value: `${steps.filter((s) => s.done).length}/${steps.length}`, color: A.emerald.color },
            ...(b.estimatedDate ? [{ icon: "schedule", label: "ETA", value: b.estimatedDate, color: A.amber.color }] : []),
          ]
        : undefined,
    },
    detail: hasDetail
      ? {
          title: b.title || "Envío",
          subtitle: [b.carrier, b.trackingId].filter(Boolean).join(" · "),
          sections,
        }
      : undefined,
    cta: hasDetail ? { label: "Ver seguimiento" } : undefined,
  };
}

function healthReminder(b: Of<"health_reminder">): KoruPresentation {
  return {
    hero: {
      kicker: "Salud · Recordatorio",
      title: heroTitleFrom(b.title, "Recordatorio"),
      desc: b.reminder,
      icon: b.icon || "medication",
      accent: A.rose,
    },
    // 🔴 v2: acciones inline para health reminder (antes era surface muerta)
    actions: [
      { label: "Tomé la dosis", icon: "check", kind: "primary", action: "complete" },
      { label: "Posponer", icon: "snooze", kind: "secondary", action: "snooze" },
    ],
    // 🔴 KIMI v4: layout default .kc (no compact).
    layout: "default",
  };
}

function activityTracker(b: Of<"activity_tracker">): KoruPresentation {
  const metrics = b.metrics ?? [];
  return {
    hero: {
      kicker: "Tu Actividad",
      title: heroTitleFrom(b.title, "Progreso"),
      desc: b.subtitle,
      icon: "monitoring",
      accent: A.emerald,
      metrics: metrics.slice(0, 3).map((m) => ({ icon: m.icon, label: m.label, value: `${m.value}${m.unit ?? ""}`, color: m.iconColor })),
    },
    detail: metrics.length
      ? {
          title: b.title || "Actividad",
          subtitle: b.subtitle,
          sections: [
            {
              kind: "tiles",
              icon: "monitoring",
              accent: A.emerald,
              title: "Métricas",
              tiles: metrics.map((m) => ({ icon: m.icon, label: m.label, value: `${m.value}${m.unit ?? ""}`, color: m.iconColor })),
            },
          ],
        }
      : undefined,
    cta: metrics.length ? { label: "Ver métricas" } : undefined,
  };
}

function productAnalysis(b: Of<"product_analysis">): KoruPresentation {
  const specs = b.specs ?? [];
  return {
    hero: {
      kicker: "Tu Análisis",
      title: heroTitleFrom(b.product?.name, "Producto"),
      desc: b.product?.description,
      icon: b.product?.icon || "inventory_2",
      accent: A.primary,
      metrics: b.product?.rating
        ? [{ icon: "star", label: "Rating", value: `${b.product.rating}`, color: A.amber.color }]
        : undefined,
    },
    detail: specs.length
      ? {
          title: b.product?.name || "Producto",
          subtitle: b.product?.reviewCount ? `${b.product.reviewCount} opiniones` : undefined,
          sections: [
            {
              kind: "tiles",
              icon: "inventory_2",
              accent: A.primary,
              title: "Especificaciones",
              tiles: specs.map((s) => ({ label: s.label, value: s.value, color: A.primary.color })),
            },
          ],
        }
      : undefined,
    cta: specs.length ? { label: b.actionLabel || "Ver opciones" } : undefined,
    // 🔴 v3: gallery cuando hay múltiples especificaciones (specs como proxy de "products > 1").
    layout: specs.length > 1 ? "gallery" : "default",
  };
}

function travelPlanner(b: Of<"travel_planner">): KoruPresentation {
  const steps = b.steps ?? [];
  const destination = clean(b.destination);

  // 🔴 KIMI TIER-S (Card 22 · Viajes): kicker con destino + fechas (estilo
  // "VIAJE · MARZO · 4 DÍAS"). El destino ES el título. Las paradas como
  // timeline. Métricas hero con cantidad de paradas (cuando haya) y un
  // "días" extraído de las fechas (cuando sea posible).
  const kickerParts = ["Viaje"];
  if (destination) kickerParts.push(destination);
  if (b.dates) kickerParts.push(b.dates);
  const kicker = kickerParts.length > 1 ? kickerParts.join(" · ") : "Tu Viaje";

  // Métricas hero: paradas + (si las fechas mencionan "días" o un rango, lo
  // resaltamos como segundo dato emocional — la cuenta regresiva).
  const metrics: HeroMetric[] = [];
  if (steps.length) metrics.push({ icon: "route", label: "Paradas", value: String(steps.length), color: A.sky.color });
  if (b.dates) metrics.push({ icon: "event", label: "Fechas", value: b.dates, color: A.indigo.color });

  return {
    hero: {
      kicker,
      title: heroTitleFrom(destination, "Itinerario"),
      desc: b.dates,
      icon: "flight_takeoff",
      accent: A.sky,
      metrics: metrics.length > 0 ? metrics : undefined,
    },
    detail: steps.length
      ? {
          title: destination || "Itinerario",
          subtitle: b.dates,
          sections: [
            {
              kind: "timeline",
              icon: "flight_takeoff",
              accent: A.sky,
              title: "Itinerario",
              subtitle: steps.length ? `${steps.length} PARADAS` : undefined,
              steps: steps.map((s, idx) => ({
                icon: s.icon,
                title: s.label,
                detail: [s.time, s.detail].filter(Boolean).join(" · "),
                status: idx === 0 ? ("current" as const) : ("pending" as const),
                badge: s.time || undefined,
                badgeTone: "pending" as const,
              })),
            },
          ],
        }
      : undefined,
    cta: steps.length ? { label: b.actionLabel || "Ver el viaje día por día" } : undefined,
  };
}

/**
 * travel_plan — Plan de viaje completo con itinerario día a día, reservas,
 * checklist de equipaje y presupuesto. Hero con icono de vuelo y accent azul;
 * el detalle arma 4 secciones: timeline (días), tiles (reservas), chips
 * (packing checklist) y tiles (presupuesto).
 *
 * 🔴 P2 — Sugerencias de equipaje por clima. Si el plan tiene destination +
 * dates, buscamos la temperatura promedio del mes para esa ciudad (tabla
 * estática CLIMATE_BY_MONTH). Para ciudades desconocidas, caemos a una tabla
 * genérica por hemisferio (asumido norte salvo ciudades del sur conocidas).
 * Según el rango de temperatura sugerimos items, que se agregan como chips
 * en una sección "Sugerencias de equipaje por clima".
 */

// ─── Climate table (static lookup, no API) ─────────────────────────────────
type MonthClimate = { avg: number; min: number; max: number };
const CLIMATE_BY_MONTH: Record<string, Record<number, MonthClimate>> = {
  tokyo: {
    1: { avg: 5, min: -1, max: 10 },
    2: { avg: 6, min: 0, max: 11 },
    3: { avg: 10, min: 5, max: 15 },
    4: { avg: 15, min: 10, max: 20 },
    5: { avg: 19, min: 14, max: 24 },
    6: { avg: 23, min: 18, max: 27 },
    7: { avg: 27, min: 22, max: 31 },
    8: { avg: 28, min: 23, max: 32 },
    9: { avg: 24, min: 19, max: 28 },
    10: { avg: 18, min: 13, max: 23 },
    11: { avg: 12, min: 7, max: 17 },
    12: { avg: 7, min: 2, max: 12 },
  },
  // Alias en español (Tokio).
  tokio: {
    1: { avg: 5, min: -1, max: 10 },
    2: { avg: 6, min: 0, max: 11 },
    3: { avg: 10, min: 5, max: 15 },
    4: { avg: 15, min: 10, max: 20 },
    5: { avg: 19, min: 14, max: 24 },
    6: { avg: 23, min: 18, max: 27 },
    7: { avg: 27, min: 22, max: 31 },
    8: { avg: 28, min: 23, max: 32 },
    9: { avg: 24, min: 19, max: 28 },
    10: { avg: 18, min: 13, max: 23 },
    11: { avg: 12, min: 7, max: 17 },
    12: { avg: 7, min: 2, max: 12 },
  },
  "buenos aires": {
    1: { avg: 25, min: 20, max: 30 },
    2: { avg: 24, min: 19, max: 29 },
    3: { avg: 21, min: 16, max: 26 },
    4: { avg: 18, min: 13, max: 22 },
    5: { avg: 14, min: 10, max: 19 },
    6: { avg: 11, min: 7, max: 16 },
    7: { avg: 11, min: 7, max: 15 },
    8: { avg: 13, min: 8, max: 17 },
    9: { avg: 15, min: 10, max: 20 },
    10: { avg: 18, min: 13, max: 23 },
    11: { avg: 21, min: 16, max: 26 },
    12: { avg: 24, min: 19, max: 29 },
  },
  madrid: {
    1: { avg: 6, min: 1, max: 11 },
    2: { avg: 8, min: 2, max: 13 },
    3: { avg: 11, min: 4, max: 17 },
    4: { avg: 13, min: 6, max: 19 },
    5: { avg: 18, min: 10, max: 25 },
    6: { avg: 23, min: 15, max: 30 },
    7: { avg: 27, min: 18, max: 34 },
    8: { avg: 26, min: 18, max: 33 },
    9: { avg: 21, min: 14, max: 28 },
    10: { avg: 15, min: 9, max: 21 },
    11: { avg: 9, min: 4, max: 14 },
    12: { avg: 6, min: 1, max: 11 },
  },
  "nueva york": {
    1: { avg: 0, min: -4, max: 4 },
    2: { avg: 1, min: -3, max: 6 },
    3: { avg: 6, min: 1, max: 11 },
    4: { avg: 12, min: 6, max: 17 },
    5: { avg: 17, min: 12, max: 22 },
    6: { avg: 22, min: 17, max: 27 },
    7: { avg: 25, min: 20, max: 30 },
    8: { avg: 25, min: 19, max: 30 },
    9: { avg: 21, min: 16, max: 26 },
    10: { avg: 14, min: 9, max: 19 },
    11: { avg: 9, min: 4, max: 13 },
    12: { avg: 3, min: -2, max: 8 },
  },
  // Alias Nueva York en inglés.
  "new york": {
    1: { avg: 0, min: -4, max: 4 },
    2: { avg: 1, min: -3, max: 6 },
    3: { avg: 6, min: 1, max: 11 },
    4: { avg: 12, min: 6, max: 17 },
    5: { avg: 17, min: 12, max: 22 },
    6: { avg: 22, min: 17, max: 27 },
    7: { avg: 25, min: 20, max: 30 },
    8: { avg: 25, min: 19, max: 30 },
    9: { avg: 21, min: 16, max: 26 },
    10: { avg: 14, min: 9, max: 19 },
    11: { avg: 9, min: 4, max: 13 },
    12: { avg: 3, min: -2, max: 8 },
  },
  barcelona: {
    1: { avg: 9, min: 4, max: 14 },
    2: { avg: 10, min: 4, max: 15 },
    3: { avg: 12, min: 7, max: 17 },
    4: { avg: 14, min: 9, max: 19 },
    5: { avg: 18, min: 12, max: 23 },
    6: { avg: 22, min: 16, max: 27 },
    7: { avg: 25, min: 19, max: 30 },
    8: { avg: 25, min: 20, max: 30 },
    9: { avg: 22, min: 16, max: 26 },
    10: { avg: 18, min: 12, max: 23 },
    11: { avg: 13, min: 7, max: 18 },
    12: { avg: 10, min: 5, max: 15 },
  },
  "ciudad de mexico": {
    1: { avg: 14, min: 7, max: 21 },
    2: { avg: 16, min: 8, max: 23 },
    3: { avg: 18, min: 10, max: 26 },
    4: { avg: 19, min: 11, max: 27 },
    5: { avg: 19, min: 12, max: 27 },
    6: { avg: 18, min: 12, max: 25 },
    7: { avg: 17, min: 11, max: 23 },
    8: { avg: 17, min: 11, max: 23 },
    9: { avg: 17, min: 11, max: 23 },
    10: { avg: 17, min: 10, max: 24 },
    11: { avg: 15, min: 8, max: 22 },
    12: { avg: 14, min: 7, max: 21 },
  },
  // Alias CDMX.
  "cdmx": {
    1: { avg: 14, min: 7, max: 21 },
    2: { avg: 16, min: 8, max: 23 },
    3: { avg: 18, min: 10, max: 26 },
    4: { avg: 19, min: 11, max: 27 },
    5: { avg: 19, min: 12, max: 27 },
    6: { avg: 18, min: 12, max: 25 },
    7: { avg: 17, min: 11, max: 23 },
    8: { avg: 17, min: 11, max: 23 },
    9: { avg: 17, min: 11, max: 23 },
    10: { avg: 17, min: 10, max: 24 },
    11: { avg: 15, min: 8, max: 22 },
    12: { avg: 14, min: 7, max: 21 },
  },
  paris: {
    1: { avg: 5, min: 1, max: 8 },
    2: { avg: 6, min: 1, max: 10 },
    3: { avg: 10, min: 4, max: 15 },
    4: { avg: 12, min: 6, max: 18 },
    5: { avg: 16, min: 10, max: 22 },
    6: { avg: 19, min: 13, max: 25 },
    7: { avg: 22, min: 15, max: 27 },
    8: { avg: 22, min: 15, max: 27 },
    9: { avg: 18, min: 12, max: 23 },
    10: { avg: 14, min: 8, max: 19 },
    11: { avg: 8, min: 4, max: 13 },
    12: { avg: 5, min: 1, max: 9 },
  },
  london: {
    1: { avg: 5, min: 2, max: 8 },
    2: { avg: 5, min: 2, max: 8 },
    3: { avg: 8, min: 4, max: 12 },
    4: { avg: 10, min: 5, max: 14 },
    5: { avg: 14, min: 9, max: 19 },
    6: { avg: 17, min: 12, max: 22 },
    7: { avg: 19, min: 14, max: 24 },
    8: { avg: 19, min: 14, max: 23 },
    9: { avg: 16, min: 11, max: 20 },
    10: { avg: 12, min: 8, max: 16 },
    11: { avg: 8, min: 5, max: 11 },
    12: { avg: 6, min: 2, max: 9 },
  },
  // Alias Londres.
  londres: {
    1: { avg: 5, min: 2, max: 8 },
    2: { avg: 5, min: 2, max: 8 },
    3: { avg: 8, min: 4, max: 12 },
    4: { avg: 10, min: 5, max: 14 },
    5: { avg: 14, min: 9, max: 19 },
    6: { avg: 17, min: 12, max: 22 },
    7: { avg: 19, min: 14, max: 24 },
    8: { avg: 19, min: 14, max: 23 },
    9: { avg: 16, min: 11, max: 20 },
    10: { avg: 12, min: 8, max: 16 },
    11: { avg: 8, min: 5, max: 11 },
    12: { avg: 6, min: 2, max: 9 },
  },
  roma: {
    1: { avg: 8, min: 3, max: 13 },
    2: { avg: 9, min: 3, max: 14 },
    3: { avg: 11, min: 5, max: 17 },
    4: { avg: 14, min: 8, max: 20 },
    5: { avg: 19, min: 12, max: 25 },
    6: { avg: 23, min: 16, max: 29 },
    7: { avg: 26, min: 19, max: 32 },
    8: { avg: 26, min: 19, max: 32 },
    9: { avg: 22, min: 15, max: 28 },
    10: { avg: 17, min: 11, max: 23 },
    11: { avg: 12, min: 6, max: 18 },
    12: { avg: 9, min: 3, max: 14 },
  },
  rome: {
    1: { avg: 8, min: 3, max: 13 },
    2: { avg: 9, min: 3, max: 14 },
    3: { avg: 11, min: 5, max: 17 },
    4: { avg: 14, min: 8, max: 20 },
    5: { avg: 19, min: 12, max: 25 },
    6: { avg: 23, min: 16, max: 29 },
    7: { avg: 26, min: 19, max: 32 },
    8: { avg: 26, min: 19, max: 32 },
    9: { avg: 22, min: 15, max: 28 },
    10: { avg: 17, min: 11, max: 23 },
    11: { avg: 12, min: 6, max: 18 },
    12: { avg: 9, min: 3, max: 14 },
  },
  // Ciudades del hemisferio sur marcadas explícitamente para el fallback.
  sydney: {
    1: { avg: 23, min: 18, max: 28 },
    2: { avg: 23, min: 18, max: 27 },
    3: { avg: 21, min: 16, max: 25 },
    4: { avg: 19, min: 14, max: 23 },
    5: { avg: 16, min: 11, max: 20 },
    6: { avg: 13, min: 9, max: 17 },
    7: { avg: 12, min: 8, max: 16 },
    8: { avg: 13, min: 9, max: 18 },
    9: { avg: 16, min: 11, max: 21 },
    10: { avg: 18, min: 13, max: 23 },
    11: { avg: 20, min: 15, max: 25 },
    12: { avg: 22, min: 17, max: 27 },
  },
};

// Ciudades conocidas del hemisferio sur (para el fallback estacional).
const SOUTHERN_HEMISPHERE_HINTS = [
  "buenos aires", "santiago", "montevideo", "lima", "la paz", "asuncion",
  "saopaulo", "sao paulo", "rio", "rio de janeiro", "brasilia",
  "sydney", "melbourne", "brisbane", "auckland", "wellington",
  "cape town", "johannesburg", "pretoria",
];

/** Tabla genérica por hemisferio (valores promedio). */
const GENERIC_CLIMATE_NORTH: Record<number, MonthClimate> = {
  1: { avg: 2, min: -3, max: 7 },
  2: { avg: 3, min: -2, max: 8 },
  3: { avg: 8, min: 2, max: 13 },
  4: { avg: 13, min: 7, max: 18 },
  5: { avg: 18, min: 12, max: 23 },
  6: { avg: 22, min: 16, max: 27 },
  7: { avg: 25, min: 18, max: 30 },
  8: { avg: 24, min: 17, max: 29 },
  9: { avg: 20, min: 13, max: 25 },
  10: { avg: 14, min: 8, max: 19 },
  11: { avg: 8, min: 3, max: 13 },
  12: { avg: 3, min: -2, max: 8 },
};

/**
 * Tabla genérica del hemisferio sur: mismos valores que el norte pero
 * desplazados 6 meses (enero = invierno austral).
 */
const GENERIC_CLIMATE_SOUTH: Record<number, MonthClimate> = Object.fromEntries(
  Object.entries(GENERIC_CLIMATE_NORTH).map(([m, c]) => {
    const monthNum = Number(m);
    // Shift +6 mod 12 → invertimos meses para reflejar la inversión estacional.
    const southMonth = ((monthNum + 5) % 12) + 1;
    return [monthNum, GENERIC_CLIMATE_NORTH[southMonth]];
  }),
);

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MONTH_NAMES_ES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Extrae el número de mes (1-12) de un string de fechas tipo
 * "15-22 marzo 2026", "Mar 2026", "del 3 al 10 de julio", etc.
 * Devuelve null si no encuentra ninguno.
 */
function monthFromDates(dates?: string): number | null {
  if (!dates) return null;
  const lower = dates.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // 1) Buscar nombre de mes completo en español.
  for (let i = 0; i < MONTH_NAMES_ES.length; i++) {
    if (lower.includes(MONTH_NAMES_ES[i])) return i + 1;
  }
  // 2) Buscar abreviatura de mes (palabra completa, no substring).
  for (let i = 0; i < MONTH_NAMES_ES_SHORT.length; i++) {
    const re = new RegExp(`\\b${MONTH_NAMES_ES_SHORT[i]}\\b`);
    if (re.test(lower)) return i + 1;
  }
  // 3) Formato ISO: "2026-03-15" → mes = 03.
  const isoMatch = lower.match(/\d{4}-(\d{2})-\d{2}/);
  if (isoMatch) {
    const m = parseInt(isoMatch[1], 10);
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

/**
 * Normaliza el nombre de destino para lookup en CLIMATE_BY_MONTH.
 * Quita acentos, pasa a minúsculas, recorta "ciudad de" / "san" / "sao" a
 * formas equivalentes más comunes.
 */
function normalizeDestination(dest: string): string {
  return dest
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Devuelve el clima promedio para un destino y mes, o null si no hay datos.
 * Para ciudades desconocidas cae a la tabla genérica por hemisferio.
 */
function climateFor(destination: string, month: number): MonthClimate | null {
  if (month < 1 || month > 12) return null;
  const key = normalizeDestination(destination);
  // 1) Match exacto en CLIMATE_BY_MONTH.
  if (CLIMATE_BY_MONTH[key] && CLIMATE_BY_MONTH[key][month]) {
    return CLIMATE_BY_MONTH[key][month];
  }
  // 2) Match parcial: la key está contenida en el destino o viceversa.
  for (const [cityKey, months] of Object.entries(CLIMATE_BY_MONTH)) {
    if (key.includes(cityKey) || cityKey.includes(key)) {
      if (months[month]) return months[month];
    }
  }
  // 3) Fallback: tabla genérica por hemisferio.
  const isSouth = SOUTHERN_HEMISPHERE_HINTS.some(h => key.includes(h) || h.includes(key));
  const table = isSouth ? GENERIC_CLIMATE_SOUTH : GENERIC_CLIMATE_NORTH;
  return table[month] ?? null;
}

/**
 * Sugiere items de equipaje según la temperatura promedio.
 * Rangos:
 *   < 0°C    → Abrigo grueso, guantes, gorro, capa térmica
 *   0-10°C   → Cortavientos, campera, bufanda
 *   10-20°C  → Campera liviana, ropa de entretiempo
 *   20-30°C  → Ropa ligera, protector solar, gorra
 *   > 30°C   → Ropa muy ligera, protector solar SPF50, gorra, botella de agua
 */
function packingSuggestionsForClimate(climate: MonthClimate): string[] {
  const items: string[] = [];
  const avg = climate.avg;
  if (avg < 0) {
    items.push("Abrigo grueso", "Guantes", "Gorro", "Capa térmica");
  } else if (avg < 10) {
    items.push("Cortavientos", "Campera", "Bufanda");
  } else if (avg < 20) {
    items.push("Campera liviana", "Ropa de entretiempo");
  } else if (avg < 30) {
    items.push("Ropa ligera", "Protector solar", "Gorra");
  } else {
    items.push("Ropa muy ligera", "Protector solar SPF50", "Gorra", "Botella de agua");
  }
  // Si la amplitud térmica (max-min) es alta, sugerir capas.
  const amplitude = climate.max - climate.min;
  if (amplitude >= 12 && !items.includes("Capa térmica")) {
    items.push("Capas (amplitud térmica alta)");
  }
  return items;
}

function travelPlan(b: Of<"travel_plan">, ctx?: PresentationContext): KoruPresentation {
  const days = b.days ?? [];
  const reservations = b.reservations ?? [];
  const packing = b.packing ?? [];
  const budget = b.budget ?? [];

  // 🔴 v4 — moneda principal del usuario (state.userProfile.currency ?? "EUR").
  // Se usa para mostrar montos convertidos cuando una línea de presupuesto
  // está en otra moneda. La conversión usa el cache de rates (24h) poblado
  // por convertCurrency. Si la tasa no está en cache (ej. la card se renderiza
  // antes del primer fetch), se omite la conversión — KoruUnifiedCard dispara
  // un useEffect async para pre-fetchear las tasas de las monedas del budget.
  const userCurrency = (ctx?.userCurrency ?? "EUR").toUpperCase();

  // 🔴 P2 — Sugerencias de equipaje por clima. Si tenemos destination + dates
  // y podemos extraer el mes, generamos chips con items sugeridos.
  const month = monthFromDates(b.dates);
  const climate = b.destination && month ? climateFor(b.destination, month) : null;
  const climateSuggestions = climate ? packingSuggestionsForClimate(climate) : [];
  const climateRangeLabel = climate
    ? `${climate.min}°–${climate.max}° (prom ${climate.avg}°)`
    : undefined;

  // Hero metrics: días, viajeros, presupuesto total (en orden de disponibilidad).
  const metrics: HeroMetric[] = [];
  if (days.length > 0) metrics.push({ icon: "calendar_today", label: "Días", value: String(days.length), color: A.blue.color });
  if (typeof b.travelers === "number" && b.travelers > 0) metrics.push({ icon: "group", label: "Viajeros", value: String(b.travelers), color: A.indigo.color });
  if (typeof b.totalBudget === "number") {
    const cur = b.currency ?? "";
    metrics.push({ icon: "payments", label: "Presupuesto", value: `${cur}${b.totalBudget.toLocaleString()}`, color: A.emerald.color });
  }

  const sections: DetailSection[] = [];

  // 1) Timeline de días — cada día es un step; sus actividades van como detail.
  if (days.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "event",
      accent: A.blue,
      title: "Itinerario día a día",
      subtitle: `${days.length} DÍAS`,
      steps: days.map((d) => ({
        icon: "calendar_today",
        title: d.title || `Día ${d.day}`,
        detail: [
          `Día ${d.day}`,
          ...(d.activities ?? []).map((a) => `${a.time} · ${a.title}${a.detail ? ` — ${a.detail}` : ""}`),
        ].join("\n"),
        status: "pending" as const,
        badge: `Día ${d.day}`,
        badgeTone: "pending" as const,
      })),
    });
  }

  // 2) Tiles de reservas — una tile por reserva con provider/tipo/status.
  if (reservations.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "confirmation_number",
      accent: A.indigo,
      title: "Reservas",
      subtitle: `${reservations.length} CONFIRMADAS`,
      tiles: reservations.map((r) => ({
        icon: r.type.toLowerCase().includes("vuelo") || r.type.toLowerCase().includes("flight")
          ? "flight"
          : r.type.toLowerCase().includes("hotel") || r.type.toLowerCase().includes("hospedaje")
            ? "hotel"
            : r.type.toLowerCase().includes("auto") || r.type.toLowerCase().includes("car")
              ? "directions_car"
              : "confirmation_number",
        label: r.provider,
        value: r.type,
        color: r.status.toLowerCase() === "confirmed" || r.status.toLowerCase() === "confirmada"
          ? A.emerald.color
          : r.status.toLowerCase() === "pending" || r.status.toLowerCase() === "pendiente"
            ? A.amber.color
            : A.rose.color,
      })),
    });
  }

  // 3) Chips de packing checklist — agrupados por categoría cuando existe.
  if (packing.length > 0) {
    sections.push({
      kind: "chips",
      icon: "luggage",
      accent: A.amber,
      title: "Equipaje",
      subtitle: `${packing.filter((p) => p.checked).length}/${packing.length} LISTOS`,
      chips: packing.map((p) => ({
        label: p.checked ? `✓ ${p.item}` : p.item,
        sub: p.category,
        color: p.checked ? A.emerald.color : A.amber.color,
      })),
    });
  }

  // 3.5) 🔴 P2 — Sugerencias de equipaje por clima. Chips generados a partir
  // de la temperatura promedio del mes de destino (tabla estática). Se muestran
  // separados del packing checklist para que se vean como "sugerencias"
  // (no tildables).
  if (climateSuggestions.length > 0) {
    sections.push({
      kind: "chips",
      icon: "thermostat",
      accent: A.sky,
      title: "Sugerencias de equipaje por clima",
      subtitle: climateRangeLabel ? `CLIMA ${climateRangeLabel}` : "SEGÚN CLIMA",
      chips: climateSuggestions.map((item) => ({
        label: item,
        sub: "sugerencia",
        color: A.sky.color,
      })),
    });
  }

  // 4) Tiles de presupuesto — cada categoría como tile con monto formateado.
  // 🔴 v4: si la moneda de la línea difiere de la moneda principal del usuario
  // y tenemos una tasa cacheada (24h), mostramos el monto convertido al lado.
  if (budget.length > 0) {
    // Acumuladores para el "Presupuesto total" en ambas monedas.
    let totalInUserCurrency = 0;
    let hasAnyConversion = false;
    const budgetTiles: DetailTile[] = budget.map((item) => {
      const lineCurrency = (item.currency ?? "").toUpperCase();
      const lineValue = `${lineCurrency}${item.amount.toLocaleString()}`;
      // Misma moneda → no hay conversión; sumamos al total directo.
      if (lineCurrency === userCurrency) {
        totalInUserCurrency += item.amount;
        return {
          icon: "category",
          label: item.category,
          value: lineValue,
          color: A.emerald.color,
        };
      }
      // Distinta moneda → buscar tasa cacheada (síncrono).
      const rate = getCachedRate(lineCurrency, userCurrency);
      if (rate != null && Number.isFinite(rate)) {
        const converted = item.amount * rate;
        totalInUserCurrency += converted;
        hasAnyConversion = true;
        return {
          icon: "category",
          label: item.category,
          value: `${lineValue} ≈ ${formatCurrency(converted, userCurrency)}`,
          color: A.emerald.color,
        };
      }
      // Sin tasa cacheada — mostramos solo el monto original.
      return {
        icon: "category",
        label: item.category,
        value: lineValue,
        color: A.emerald.color,
      };
    });

    // Subtitle: si ya sabemos el total en la moneda original del bloque, lo
    // mostramos; si no, la cantidad de categorías.
    const originalTotalLabel = typeof b.totalBudget === "number"
      ? `TOTAL ${(b.currency ?? "").toUpperCase()}${b.totalBudget.toLocaleString()}`
      : `${budget.length} CATEGORÍAS`;

    sections.push({
      kind: "tiles",
      icon: "payments",
      accent: A.emerald,
      title: "Presupuesto",
      subtitle: originalTotalLabel,
      tiles: budgetTiles,
    });

    // 🔴 v4: "Presupuesto total" tile mostrando ambas monedas cuando hubo
    // conversión. Si el bloque ya trae totalBudget en la moneda original,
    // lo usamos como referencia; si no, sumamos las líneas en moneda original
    // cuando todas comparten la misma currency.
    if (hasAnyConversion && totalInUserCurrency > 0) {
      const originalTotal = typeof b.totalBudget === "number"
        ? `${(b.currency ?? "").toUpperCase()}${b.totalBudget.toLocaleString()}`
        : budget.length > 0 && budget.every((it) => (it.currency ?? "").toUpperCase() === (budget[0].currency ?? "").toUpperCase())
          ? `${(budget[0].currency ?? "").toUpperCase()}${budget.reduce((acc, it) => acc + it.amount, 0).toLocaleString()}`
          : "—";
      sections.push({
        kind: "tiles",
        icon: "savings",
        accent: A.indigo,
        title: "Presupuesto total",
        subtitle: "CONVERTIDO A TU MONEDA",
        tiles: [
          {
            icon: "payments",
            label: "Original",
            value: originalTotal,
            color: A.amber.color,
          },
          {
            icon: "account_balance_wallet",
            label: `En ${userCurrency}`,
            value: formatCurrency(totalInUserCurrency, userCurrency),
            color: A.emerald.color,
          },
        ],
      });
    }
  }

  const hasDetail = sections.length > 0;

  return {
    hero: {
      kicker: "Tu Plan de Viaje",
      title: heroTitleFrom(b.destination, "Plan de Viaje"),
      desc: b.dates,
      icon: "flight_takeoff",
      accent: A.blue,
      metrics,
    },
    detail: hasDetail
      ? {
          title: b.destination || "Plan de Viaje",
          subtitle: [b.dates, typeof b.travelers === "number" ? `${b.travelers} viaj.` : undefined].filter(Boolean).join(" · "),
          sections,
        }
      : undefined,
    cta: hasDetail ? { label: "Ver plan completo" } : undefined,
  };
}

function generation(b: Of<"generation">): KoruPresentation {
  const kickerByType: Record<string, string> = { text: "Tu Texto", image: "Tu Imagen", code: "Tu Código", document: "Tu Documento" };
  const images = b.images ?? [];
  const tips = b.tips ?? [];
  const isImage = b.resultType === "image" || images.length > 0;

  // Mapea aspect ratio de generación → arte del hero.
  const heroAspect: "square" | "poster" | "cover" =
    b.aspectRatio === "9:16" ? "poster" : b.aspectRatio === "16:9" ? "cover" : "square";

  // Métricas del hero: solo si hay datos útiles que mostrar.
  const metrics: HeroMetric[] = [];
  if (b.model) metrics.push({ icon: "smart_toy", label: "Modelo", value: b.model, color: A.violet.color });
  if (b.aspectRatio) metrics.push({ icon: "aspect_ratio", label: "Aspect", value: b.aspectRatio, color: A.purple.color });
  if (b.style) metrics.push({ icon: "palette", label: "Estilo", value: b.style, color: A.pink.color });
  if (typeof b.totalTime === "number") {
    metrics.push({ icon: "timer", label: "Tiempo", value: `${(b.totalTime / 1000).toFixed(1)}s`, color: A.amber.color });
  }
  if (images.length > 0) {
    metrics.push({ icon: "collections", label: "Variantes", value: String(images.length), color: A.emerald.color });
  }

  // Secciones del detalle.
  const sections: DetailSection[] = [];

  // 1) 🔴 KIMI TIER-S (Card 23 · Creación de imágenes): el prompt como texto
  // editable (antes solo iba al desc del hero). Visible y citable.
  if (b.prompt) {
    sections.push({
      kind: "text",
      icon: "edit_note",
      accent: A.violet,
      title: "Prompt",
      subtitle: "EDITABLE",
      body: b.prompt,
    });
  }

  // Vista previa textual (si existe, además del prompt).
  if (b.preview) {
    sections.push({
      kind: "text",
      icon: "auto_awesome",
      accent: A.pink,
      title: "Vista previa",
      body: b.preview,
    });
  }

  // 2) 🔴 KIMI TIER-S: imágenes como scroller con thumbnails (antes era
  // `sources` — lista vertical). El scroller muestra cada variación con su
  // thumbnail (image), badge "VARIANTE N", título con el prompt variant y
  // métricas con seed + tiempo de generación.
  if (images.length > 0) {
    sections.push({
      kind: "scroller",
      icon: "image",
      accent: A.purple,
      title: `Imágenes generadas · ${images.length}`,
      subtitle: "VARIANTES",
      cards: images.map((img, idx) => ({
        image: img.url,
        badge: idx === 0 ? "ELEGIDA" : `VARIANTE ${idx + 1}`,
        badgeColor: idx === 0 ? A.emerald.color : A.purple.color,
        title: img.promptVariant || `Variación ${idx + 1}`,
        detail: `seed ${img.seed} · ${(img.generationMs / 1000).toFixed(1)}s`,
        metrics: [`seed ${img.seed}`, `${(img.generationMs / 1000).toFixed(1)}s`],
      })),
    });
  }

  // 3) Detalles técnicos (tiles): modelo, aspect ratio, estilo, tiempo total,
  // cantidad de variantes.
  const techTiles: DetailTile[] = [];
  if (b.model) techTiles.push({ icon: "smart_toy", label: "Modelo", value: b.model, color: A.violet.color });
  if (b.aspectRatio) techTiles.push({ icon: "aspect_ratio", label: "Aspect ratio", value: b.aspectRatio, color: A.purple.color });
  if (b.style) techTiles.push({ icon: "palette", label: "Estilo", value: b.style, color: A.pink.color });
  if (typeof b.totalTime === "number") {
    techTiles.push({ icon: "timer", label: "Tiempo total", value: `${(b.totalTime / 1000).toFixed(1)}s`, color: A.amber.color });
  }
  if (images.length > 0) {
    techTiles.push({ icon: "collections", label: "Variantes", value: String(images.length), color: A.emerald.color });
  }
  if (techTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "tune",
      accent: A.indigo,
      title: "Detalles técnicos",
      subtitle: "AJUSTES DE GENERACIÓN",
      tiles: techTiles,
    });
  }

  // 4) Tips de prompt engineering (chips).
  if (tips.length > 0) {
    sections.push({
      kind: "chips",
      icon: "lightbulb",
      accent: A.amber,
      title: "Tips de prompt",
      subtitle: "PARA MEJORES RESULTADOS",
      chips: tips.map((t) => ({ label: t })),
    });
  }

  const hasDetail = sections.length > 0;
  return {
    hero: {
      kicker: kickerByType[b.resultType ?? "text"] ?? "Generado",
      title: heroTitleFrom(b.title, isImage ? "Imágenes" : "Resultado"),
      desc: b.prompt,
      icon: b.resultType === "code" ? "code" : isImage ? "image" : "auto_awesome",
      accent: A.violet,
      // Si hay imágenes, mostramos la primera como arte del hero.
      art: images[0]?.url,
      artAspect: images[0]?.url ? heroAspect : undefined,
      metrics: metrics.length > 0 ? metrics : undefined,
    },
    detail: hasDetail
      ? {
          title: b.title || (isImage ? "Imágenes generadas" : "Resultado"),
          sections,
        }
      : undefined,
    cta: hasDetail ? { label: b.actionLabel || (isImage ? "Ver imágenes" : "Ver resultado") } : undefined,
    // 🔴 v3: spotlight cuando hay imágenes generadas (full-bleed del primer render).
    layout: images.length > 0 ? "spotlight" : "default",
  };
}

function matchTimeline(b: Of<"match_timeline">): KoruPresentation {
  const items = b.items ?? [];
  const now = items.find((i) => i.now) ?? items[0];
  // 🔴 FIX: title dinámico (antes "PARTIDO" hardcodeado) + "Timeline" → "Cronología"
  const title = b.title ?? (now?.text ? now.text.split("—")[0].trim() : "Partido");
  return {
    hero: {
      kicker: "Fixture · En vivo",
      title: heroTitleFrom(title, "Partido"),
      desc: now ? `${now.minute}' ${now.text}` : undefined,
      icon: "sports_soccer",
      accent: A.emerald,
    },
    detail: items.length
      ? {
          title: title,
          subtitle: "CRONOLOGÍA DEL PARTIDO",
          sections: [
            {
              kind: "timeline",
              icon: "sports_soccer",
              accent: A.emerald,
              title: "Cronología",
              steps: items.map((i) => ({ title: `${i.minute}' ${i.text}`, detail: i.sub, status: i.now ? "current" : "done" })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver cronología" } : undefined,
  };
}

function matchStats(b: Of<"match_stats">): KoruPresentation {
  const stats = b.stats ?? [];
  // 🔴 FIX: usar barras comparativas (mismo pattern que live_match.detailedStats)
  return {
    hero: {
      kicker: "Estadísticas",
      title: heroTitleFrom(b.title, "Partido"),
      desc: stats[0] ? `${stats[0].label}: ${stats[0].home} — ${stats[0].away}` : undefined,
      icon: "monitoring",
      accent: A.primary,
    },
    detail: stats.length
      ? {
          title: b.title || "Estadísticas del partido",
          subtitle: "COMPARATIVA DE EQUIPOS",
          sections: [
            {
              kind: "rows",
              icon: "monitoring",
              accent: A.primary,
              title: "Comparativa",
              rows: stats.map((s) => ({
                title: s.label,
                detail: `${s.home} — ${s.away}`,
                bar: {
                  homeValue: typeof s.home === "number" ? s.home : parseFloat(s.home) || 0,
                  awayValue: typeof s.away === "number" ? s.away : parseFloat(s.away) || 0,
                  isPercent: /pos|posesi|precisi|efectiv/i.test(s.label),
                  homeColor: b.homeColor,
                  awayColor: b.awayColor,
                },
              })),
            },
          ],
        }
      : undefined,
    cta: stats.length ? { label: "Ver estadísticas" } : undefined,
  };
}

function electionResults(b: Of<"election_results">): KoruPresentation {
  const items = b.items ?? [];
  const leader = items[0];

  // 🔴 KIMI TIER-S (Card 29 · Elecciones): participación como artValue del
  // hero (ej. "61%" extraído del status). El escrutinio es el dato vivo —
  // sobriedad cálida, sin rojos de alarma.
  const participationMatch = b.status?.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  const participationPct = participationMatch ? participationMatch[1].replace(",", ".") : null;
  const artValue = participationPct ? `${participationPct}%` : undefined;

  const sections: DetailSection[] = [];

  // 🔴 KIMI TIER-S: candidatos como rows con barras comparativas (el porcentaje
  // del candidato es la barra home; el resto es away). El líder lleva badge
  // "Ganador" en done; los demás "Pendiente".
  if (items.length > 0) {
    sections.push({
      kind: "rows",
      icon: "how_to_vote",
      accent: A.violet,
      title: "Candidatos",
      subtitle: b.status,
      rows: items.map((it) => {
        const pctNum = parseFloat(String(it.percent).replace("%", "")) || 0;
        return {
          icon: "person",
          title: it.name,
          detail: it.detail,
          meta: it.percent,
          badge: it.done ? "Ganador" : "Pendiente",
          badgeTone: it.done ? ("done" as const) : ("pending" as const),
          bar: it.percent != null ? {
            homeValue: pctNum,
            awayValue: 100 - pctNum,
            isPercent: true,
            homeColor: it.color,
            awayColor: "#e3e8e5",
          } : undefined,
        };
      }),
    });
  }

  // 🔴 KIMI TIER-S: desglose regional como tiles (cuando los items traen
  // `detail` con info de distrito). Cada item contribuye un tile con su
  // nombre + porcentaje + detalle regional.
  const regionalTiles = items
    .filter((it) => it.detail)
    .map((it) => ({
      icon: "place",
      label: it.name,
      value: it.percent,
      color: it.color || A.violet.color,
    }));
  if (regionalTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "map",
      accent: A.indigo,
      title: "Desglose regional",
      subtitle: "POR CANDIDATO",
      tiles: regionalTiles,
    });
  }

  // 🔴 KIMI TIER-S: actualizaciones en vivo como timeline. Si el status
  // menciona un porcentaje escrutado, generamos 3 hitos sintéticos: inicio,
  // escrutinio actual y cierre proyectado. Si no, mostramos el líder como
  // hito actual.
  if (b.status || leader) {
    const liveSteps: Array<{ icon?: string; title: string; detail?: string; status?: "done" | "current" | "pending"; badge?: string; badgeTone?: "done" | "current" | "pending" | "urgent" }> = [];
    if (participationPct) {
      liveSteps.push({ icon: "play_arrow", title: "Apertura de mesas", detail: "0% escrutado", status: "done", badge: "Hecho", badgeTone: "done" });
      liveSteps.push({ icon: "how_to_vote", title: "Escrutinio en curso", detail: `${participationPct}% escrutado`, status: "current", badge: "En vivo", badgeTone: "current" });
      liveSteps.push({ icon: "check_circle", title: "Cierre proyectado", detail: "100% escrutado", status: "pending", badge: "Pendiente", badgeTone: "pending" });
    } else if (leader) {
      liveSteps.push({ icon: "person", title: `${leader.name} lidera`, detail: leader.percent, status: "current", badge: "Líder actual", badgeTone: "current" });
      if (leader.detail) liveSteps.push({ icon: "place", title: "Detalle", detail: leader.detail, status: "pending" });
    }
    if (liveSteps.length > 0) {
      sections.push({
        kind: "timeline",
        icon: "live_tv",
        accent: A.rose,
        title: "Actualizaciones en vivo",
        subtitle: "ESCRUTINIO",
        steps: liveSteps,
      });
    }
  }

  const hasDetail = sections.length > 0;

  return {
    hero: {
      kicker: "Escrutinio",
      title: heroTitleFrom(b.title, "Elecciones"),
      desc: b.status ?? (leader ? `${leader.name}: ${leader.percent}` : undefined),
      icon: "how_to_vote",
      accent: A.violet,
      artValue,
      metrics: items.length
        ? [{ icon: "how_to_vote", label: "Candidatos", value: String(items.length), color: A.violet.color }]
        : undefined,
    },
    detail: hasDetail
      ? {
          title: b.title || "Resultados",
          subtitle: b.status,
          sections,
        }
      : undefined,
    cta: hasDetail ? { label: "Ver escrutinio" } : undefined,
  };
}

function electionVote(b: Of<"election_vote">): KoruPresentation {
  const options = b.options ?? [];
  return {
    hero: {
      kicker: "Tu Voto",
      title: heroTitleFrom(b.question, "Votación"),
      desc: b.subtitle,
      icon: "ballot",
      accent: A.violet,
    },
    detail: options.length
      ? {
          title: b.question || "Votación",
          subtitle: b.subtitle,
          sections: [
            { kind: "chips", icon: "ballot", accent: A.violet, title: "Opciones", chips: options.map((o) => ({ label: o.label, sub: o.sub })) },
          ],
        }
      : undefined,
    cta: options.length ? { label: "Confirmar voto" } : undefined,
  };
}

function decisionSupport(b: Of<"decision_support">): KoruPresentation {
  const options = b.options ?? [];
  const factors = b.factors ?? [];
  const top = options[0];
  const sections: DetailSection[] = [];

  if (options.length) {
    sections.push({
      kind: "rows",
      icon: "balance",
      accent: A.indigo,
      title: "Opciones",
      subtitle: "ESCENARIOS",
      rows: options.map((option, index) => ({
        icon: index === 0 ? "recommend" : "radio_button_unchecked",
        title: option.label,
        meta: asPercent(option.probability),
        badge: index === 0 ? "Principal" : undefined,
        badgeTone: index === 0 ? "current" : undefined,
      })),
    });
  }

  if (factors.length) {
    sections.push({
      kind: "chips",
      icon: "psychology_alt",
      accent: A.violet,
      title: "Factores",
      subtitle: "LO QUE PESA",
      chips: factors.map((factor) => ({ label: factor })),
    });
  }

  return {
    hero: {
      kicker: "Tu Decisión",
      title: heroTitleFrom(b.title, "Recomendación"),
      desc: b.recommendation ?? (top ? `${top.label}${asPercent(top.probability) ? ` · ${asPercent(top.probability)}` : ""}` : undefined),
      icon: "balance",
      accent: A.indigo,
      metrics: [
        ...(options.length ? [{ icon: "format_list_numbered", label: "Opciones", value: String(options.length), color: A.indigo.color }] : []),
        ...(factors.length ? [{ icon: "psychology_alt", label: "Factores", value: String(factors.length), color: A.violet.color }] : []),
      ].slice(0, 3),
    },
    detail: sections.length
      ? {
          title: b.title || "Decisión",
          subtitle: b.recommendation,
          sections,
        }
      : undefined,
    cta: sections.length ? { label: "Ver el análisis completo" } : undefined,
  };
}

function memoryBlock(b: Of<"memory">): KoruPresentation {
  const items = b.items ?? [];
  const sections: DetailSection[] = [];

  // 🔴 Kimi card 20 — recall confidence as artValue + memory text as text +
  // confidence tiles + related memories as scroller + source timeline
  // (derivado del `domain` cuando aplica).

  // 1. Recuerdos como rows (contexto guardado).
  if (items.length) {
    sections.push({
      kind: "rows",
      icon: "psychology",
      accent: A.violet,
      title: "Recuerdos",
      subtitle: "CONTEXTO GUARDADO",
      rows: items.map((item) => ({
        icon: "memory",
        title: item.title,
        detail: item.detail,
        meta: asPercent(item.confidence),
        badge: item.domain,
        badgeTone: "done",
      })),
    });
  }

  // 2. Memory text as text section (nota personal / por qué importa).
  if (b.note) {
    sections.push({
      kind: "text",
      icon: "sticky_note_2",
      accent: A.primary,
      title: "Nota",
      subtitle: "POR QUÉ IMPORTA",
      body: b.note,
    });
  }

  // 3. Confidence tiles (per-item, color según nivel de confianza).
  const confTiles: DetailTile[] = items
    .filter((it) => it.confidence != null)
    .map((it) => ({
      icon: "verified",
      label: it.title.length > 18 ? it.title.slice(0, 15) + "…" : it.title,
      value: asPercent(it.confidence) ?? "—",
      color:
        (it.confidence ?? 0) >= 0.8 ? A.emerald.color
        : (it.confidence ?? 0) >= 0.5 ? A.amber.color
        : A.rose.color,
    }));
  if (confTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "verified",
      accent: A.emerald,
      title: "Confianza de recall",
      subtitle: "POR RECUERDO",
      tiles: confTiles,
    });
  }

  // 4. Related memories as scroller (cada item como una card del jardín).
  if (items.length > 1) {
    sections.push({
      kind: "scroller",
      icon: "hub",
      accent: A.violet,
      title: "Recuerdos relacionados",
      subtitle: "EL RESTO DEL JARDÍN",
      cards: items.map((it) => ({
        badge: it.domain,
        badgeColor: A.violet.color,
        title: it.title,
        detail: it.detail,
        metrics: asPercent(it.confidence) ? [asPercent(it.confidence) as string] : [],
      })),
    });
  }

  // 5. Source timeline — cuando los items tienen `domain`, derivamos una
  // cronología simbólica de "cómo se construyó este recuerdo" (origen +
  // confirmaciones). Como el UiBlock `memory` no trae timestamps por item,
  // usamos el dominio como hito narrativo.
  if (items.length > 0) {
    const domains = Array.from(new Set(items.map((it) => it.domain).filter(Boolean))) as string[];
    if (domains.length > 0) {
      sections.push({
        kind: "timeline",
        icon: "history_edu",
        accent: A.indigo,
        title: "Origen",
        subtitle: "CÓMO SE ARMÓ ESTE RECUERDO",
        steps: domains.map((d, i) => ({
          icon: "circle",
          title: d,
          detail: `${items.filter((it) => it.domain === d).length} item${items.filter((it) => it.domain === d).length === 1 ? "" : "s"}`,
          status: i === 0 ? "done" : ("pending" as const),
        })),
      });
    }
  }

  // Recall confidence as artValue (del primer item con confidence).
  const firstConf = items.find((it) => it.confidence != null)?.confidence;
  const artValue = firstConf != null ? (asPercent(firstConf) ?? undefined) : undefined;

  return {
    hero: {
      kicker: "Tu Jardín",
      title: heroTitleFrom(b.title, items[0]?.title ?? "Memoria"),
      desc: b.note ?? items[0]?.detail ?? "Lo que voy recordando, con tu permiso",
      icon: "eco",
      accent: A.emerald,
      artValue,
      metrics: items.length
        ? [
            { icon: "memory", label: "Sembrados", value: String(items.length), color: A.emerald.color },
            ...(items[0]?.domain ? [{ icon: "label", label: "Dominio", value: items[0].domain, color: A.primary.color }] : []),
          ].slice(0, 3)
        : undefined,
    },
    detail: sections.length
      ? {
          title: b.title || "Tu Jardín",
          subtitle: items.length ? `${items.length} recuerdos activos` : undefined,
          sections,
        }
      : undefined,
    cta: sections.length ? { label: "Regar el jardín" } : undefined,
    // 🔴 KIMI AUDIT — vacío que invita: el jardín como metáfora.
    empty: items.length || b.note
      ? undefined
      : {
          icon: "spa",
          title: "Tu jardín está empezando",
          desc: "Contame algo sobre vos y lo voy a recordar. Cada cosa que confirmás, lo riego y crece.",
          cta: { label: "Sembrar el primer recuerdo", action: "prompt:recordá que " },
        },
    // 🔴 KIMI v3: sublayout garden con hero verde/dorado + CTAs Regar/Podar.
    layout: "garden",
  };
}

function dataTicker(b: Of<"data_ticker">): KoruPresentation {
  const items = b.items ?? [];
  // 🔴 FIX: title dinámico (antes era "DATOS" hardcodeado) + badge visible
  return {
    hero: {
      kicker: "Tendencias",
      title: heroTitleFrom(b.title ?? (items[0]?.label ? items[0].label : "Datos en vivo"), "Tendencias"),
      desc: b.alert ?? (items[0] ? `${items[0].label}: ${items[0].value}` : undefined),
      icon: "insights",
      accent: A.primary,
      metrics: items.slice(0, 3).map((it) => ({ icon: "insights", label: it.label, value: it.value, color: A.primary.color })),
    },
    detail: items.length
      ? {
          title: b.title || "Tendencias en vivo",
          sections: [
            {
              kind: "rows",
              icon: "insights",
              accent: A.primary,
              title: "Datos",
              rows: items.map((it) => ({
                title: it.label,
                detail: it.value,
                badge: it.highlight ? "Destacado" : undefined,
                badgeTone: it.highlight ? "done" : undefined,
              })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver datos" } : undefined,
  };
}

function cryptoPortfolio(b: Of<"crypto_portfolio">): KoruPresentation {
  const items = b.items ?? [];
  // 🔴 FIX: usar coin icon (char) + color si están disponibles, calcular agregados
  const totalChange = items.length ? items.reduce((sum, it) => sum + (it.change ?? 0), 0) / items.length : 0;
  // 🔴 KIMI D7 (jerarquía es ley): el total del portafolio es la idea #1.
  // Si el bloque trae título con formato moneda (ej: "$2.847.600"), lo usamos
  // como artValue. Si no, sumamos la primera moneda como aproximación honesta.
  const titleLooksLikeAmount = /^[ $\u20B9\u20AC\u00A3\d]/.test(clean(b.title) ?? "");
  const totalArt = titleLooksLikeAmount ? clean(b.title) : items[0]?.price;

  // 🔴 KIMI D3: el extendido paga el tap — Holdings + Distribución + Insight.
  const sections: DetailSection[] = [];

  // 1. Holdings como rows (con sparkline textual via meta de cambio %).
  if (items.length) {
    sections.push({
      kind: "rows",
      icon: "currency_bitcoin",
      accent: A.amber,
      title: "Tus monedas",
      subtitle: "EN VIVO",
      rows: items.map((it) => ({
        // 🔴 FIX: usar char (icon) y color del coin si están disponibles
        icon: it.char || "currency_bitcoin",
        title: `${it.name} · ${it.symbol}`,
        detail: it.price,
        meta: `${it.change >= 0 ? "+" : ""}${it.change}%`,
        badge: it.change >= 0 ? "Sube" : "Baja",
        badgeTone: it.change >= 0 ? "done" : "urgent",
      })),
    });
  }

  // 2. Distribución como tiles — cada coin con su color y change como value.
  // D1: el acento cambia con el dominio (verde/rojo según suba/baje).
  if (items.length > 1) {
    sections.push({
      kind: "tiles",
      icon: "donut_large",
      accent: A.purple,
      title: "Distribución",
      subtitle: "POR ACTIVO",
      tiles: items.map((it) => ({
        icon: it.char || "currency_bitcoin",
        label: it.symbol,
        value: it.price,
        color: it.change >= 0 ? A.emerald.color : A.red.color,
      })),
    });
  }

  // 3. Insight de Koru como texto — la "lectura" del portafolio (D3).
  if (items.length) {
    const winners = items.filter((it) => it.change >= 0);
    const losers = items.filter((it) => it.change < 0);
    const insightParts: string[] = [];
    if (totalChange >= 0) {
      insightParts.push(`Tu portafolio está arriba ${totalChange.toFixed(1)}% en 24h.`);
    } else {
      insightParts.push(`Tu portafolio está abajo ${Math.abs(totalChange).toFixed(1)}% en 24h.`);
    }
    if (winners.length && losers.length) {
      insightParts.push(`${winners[0].name} lidera (+${winners[0].change}%), ${losers[0].name} afloja (${losers[0].change}%).`);
    } else if (winners.length) {
      insightParts.push(`Todas tus monedas suben — ${winners[0].name} es la que más (${winners[0].change}%).`);
    } else if (losers.length) {
      insightParts.push(`Todas tus monedas bajan — ${losers[0].name} es la que más (${losers[0].change}%).`);
    }
    sections.push({
      kind: "text",
      icon: "auto_awesome",
      accent: A.violet,
      title: "Lectura de Koru",
      subtitle: "PARA TU CASO",
      body: insightParts.join(" "),
    });
  }

  // 🔴 KIMI D4: estado honesto cuando no hay datos.
  if (items.length === 0) {
    return {
      hero: {
        kicker: "Tu Portafolio",
        title: "CRIPTO",
        icon: "currency_bitcoin",
        accent: A.amber,
      },
      empty: {
        icon: "cloud_off",
        title: "Se nubló el dato",
        desc: "Conectá tu exchange o volvé a pedirme el portafolio en un rato. No te muestro números viejos como si fueran de ahora.",
        cta: { label: "Reintentar", action: "retry" },
      },
    };
  }

  return {
    hero: {
      kicker: "Tu Portafolio",
      title: heroTitleFrom(b.title, "Cripto"),
      desc: items[0] ? `${items[0].name} · ${items[0].price}` : undefined,
      icon: "currency_bitcoin",
      accent: A.amber,
      // 🔴 KIMI D7: el total del portafolio es la idea #1 — artValue manda.
      artValue: totalArt,
      metrics: [
        { icon: totalChange >= 0 ? "trending_up" : "trending_down", label: "Cambio 24h", value: `${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(1)}%`, color: totalChange >= 0 ? A.emerald.color : A.red.color },
        ...items.slice(0, 2).map((it) => ({
          icon: it.change >= 0 ? "trending_up" : "trending_down",
          label: it.symbol,
          value: `${it.change >= 0 ? "+" : ""}${it.change}%`,
          color: it.change >= 0 ? A.emerald.color : A.red.color,
        })),
      ].slice(0, 3),
    },
    detail: sections.length > 0
      ? {
          title: "Tu Portafolio",
          subtitle: `${items.length} activo${items.length > 1 ? "s" : ""} · cambio promedio ${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(1)}%`,
          sections,
        }
      : undefined,
    cta: items.length ? { label: "Ver tus tenencias y análisis" } : undefined,
  };
}

function forex(b: Of<"forex">): KoruPresentation {
  const items = b.items ?? [];
  return {
    hero: {
      kicker: "Divisas",
      title: heroTitleFrom(b.title, "Divisas"),
      desc: items[0] ? `${items[0].pair} · ${items[0].rate}` : undefined,
      icon: "currency_exchange",
      accent: A.primary,
      metrics: items.slice(0, 3).map((it) => ({
        icon: it.positive ? "trending_up" : "trending_down",
        label: it.pair,
        value: it.rate,
        color: it.positive ? A.emerald.color : A.red.color,
      })),
    },
    detail: items.length
      ? {
          title: "Divisas",
          sections: [
            {
              kind: "rows",
              icon: "currency_exchange",
              accent: A.primary,
              title: "Pares",
              rows: items.map((it) => ({ title: it.pair, detail: it.rate, meta: `${it.change >= 0 ? "+" : ""}${it.change}%`, badgeTone: it.positive ? "done" : "urgent" })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver divisas" } : undefined,
  };
}

function routeTimeline(b: Of<"route_timeline">): KoruPresentation {
  const items = b.items ?? [];
  return {
    hero: {
      kicker: b.eta ? `Ruta · ETA ${b.eta}` : "Tu Ruta",
      title: "RUTA",
      desc: items[0]?.label,
      icon: "route",
      accent: A.indigo,
    },
    detail: items.length
      ? {
          title: "Ruta",
          subtitle: b.eta ? `ETA ${b.eta}` : undefined,
          sections: [
            {
              kind: "timeline",
              icon: "route",
              accent: A.indigo,
              title: "Recorrido",
              steps: items.map((it) => ({ title: it.label, detail: it.detail })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Iniciar GPS" } : undefined,
  };
}

function transportCompare(b: Of<"transport_compare">): KoruPresentation {
  const items = b.items ?? [];
  const active = items.find((i) => i.active) ?? items[0];
  return {
    hero: {
      kicker: "Comparativa",
      title: "TRANSPORTE",
      desc: active ? `${active.mode} · ${active.time}` : undefined,
      icon: "commute",
      accent: A.amber,
      metrics: items.slice(0, 3).map((it) => ({ icon: it.icon, label: it.mode, value: it.time, color: A.amber.color })),
    },
    detail: items.length
      ? {
          title: "Transporte",
          sections: [
            {
              kind: "rows",
              icon: "commute",
              accent: A.amber,
              title: "Opciones",
              rows: items.map((it) => ({ icon: it.icon, title: it.mode, meta: it.time, badgeTone: it.active ? "current" : undefined })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver opciones" } : undefined,
  };
}

function routeMap(b: Of<"route_map">): KoruPresentation {
  // 🔴 v2: fix progress bug (0.45 → "0.45%" en vez de "45%")
  const progressPct = b.progress != null
    ? (b.progress <= 1 ? Math.round(b.progress * 100) : Math.round(b.progress))
    : null;
  const steps = b.steps ?? [];
  const alternatives = b.alternatives ?? [];

  // 🔴 KIMI TIER-S (Card 30 · Rutas): ETA como artValue del hero (el dato
  // emocional — "12 min", "5 km restante"). Preferimos `remaining` (más
  // concreto) sobre `progress` (porcentual). Si solo hay progress, lo usamos.
  const etaArtValue = b.remaining ?? (progressPct != null ? `${progressPct}%` : undefined);

  // 🔴 v3: métricas enriquecidas con tráfico y combustible cuando están disponibles.
  const heroMetrics: HeroMetric[] = [
    ...(b.distance ? [{ icon: "straighten", label: "Distancia", value: b.distance, color: A.indigo.color }] : []),
    ...(b.remaining ? [{ icon: "schedule", label: "ETA", value: b.remaining, color: A.emerald.color }] : []),
    ...(b.trafficLevel ? [{
      icon: b.trafficLevel === "heavy" ? "traffic" : b.trafficLevel === "moderate" ? "traffic" : "sensor_traffic",
      label: "Tráfico",
      value: b.trafficLevel === "heavy" ? "Pesado" : b.trafficLevel === "moderate" ? "Moderado" : "Liviano",
      color: b.trafficLevel === "heavy" ? A.rose.color : b.trafficLevel === "moderate" ? A.amber.color : A.emerald.color,
    }] : []),
    ...(b.fuelEstimate ? [{ icon: "local_gas_station", label: "Combustible", value: b.fuelEstimate, color: A.amber.color }] : []),
  ].slice(0, 3);

  // 🔴 KIMI TIER-S: secciones de detalle enriquecidas:
  // 1) Pasos como timeline (instrucciones de giro)
  // 2) Rutas alternativas como tiles (modo / tiempo / tráfico)
  // 3) Tráfico como tiles separados (nivel + combustible + distancia restante)
  // 4) Detalle del viaje como rows (origen, destino, distancia, progreso)
  const sections: DetailSection[] = [];

  // Pasos de la ruta como timeline (instrucciones de giro).
  if (steps.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "turn_straight",
      accent: A.blue,
      title: "Instrucciones de ruta",
      subtitle: `${steps.length} PASOS`,
      steps: steps.map((s, idx) => ({
        icon: maneuverToIcon(s.maneuver),
        title: s.instruction || `Paso ${idx + 1}`,
        detail: s.distanceMeters > 0 ? `${(s.distanceMeters / 1000).toFixed(2)} km` : undefined,
        status: idx === 0 ? ("current" as const) : ("pending" as const),
      })),
    });
  }

  // Detalle del viaje como rows (origen, destino, distancia, restante, progreso).
  const tripRows: DetailRow[] = [
    ...(b.from ? [{ icon: "trip_origin", title: b.from, detail: "ORIGEN" }] : []),
    ...(b.to ? [{ icon: "location_on", title: b.to, detail: "DESTINO" }] : []),
    ...(b.distance ? [{ icon: "straighten", title: b.distance, detail: "DISTANCIA TOTAL" }] : []),
    ...(b.remaining ? [{ icon: "flag", title: b.remaining, detail: "RESTANTE" }] : []),
    ...(progressPct != null ? [{ icon: "near_me", title: `${progressPct}% completado`, detail: "PROGRESO", badge: progressPct >= 80 ? "Casi listo" : undefined, badgeTone: progressPct >= 80 ? ("done" as const) : ("current" as const) }] : []),
  ];
  if (tripRows.length > 0) {
    sections.push({
      kind: "rows",
      icon: "directions",
      accent: A.indigo,
      title: "Detalle del viaje",
      rows: tripRows,
    });
  }

  // Rutas alternativas como tiles comparativas (modo / tiempo / tráfico).
  if (alternatives.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "alt_route",
      accent: A.purple,
      title: "Rutas alternativas",
      subtitle: `${alternatives.length} OPCIONES`,
      tiles: alternatives.map((alt) => ({
        icon: alt.mode.toLowerCase().includes("walk") || alt.mode.toLowerCase() === "a pie"
          ? "directions_walk"
          : alt.mode.toLowerCase().includes("bike") || alt.mode.toLowerCase().includes("bici")
            ? "directions_bike"
            : alt.mode.toLowerCase().includes("transit") || alt.mode.toLowerCase().includes("transporte")
              ? "directions_transit"
              : "directions_car",
        label: alt.mode,
        value: alt.time,
        color: alt.traffic.toLowerCase() === "heavy" || alt.traffic.toLowerCase() === "pesado"
          ? A.rose.color
          : alt.traffic.toLowerCase() === "moderate" || alt.traffic.toLowerCase() === "moderado"
            ? A.amber.color
            : A.emerald.color,
      })),
    });
  }

  // 🔴 KIMI TIER-S: tráfico como tiles separados (nivel de tráfico + combustible
  // + distancia restante). Esto da una vista rápida del estado de la ruta.
  const trafficTiles: DetailTile[] = [];
  if (b.trafficLevel) {
    trafficTiles.push({
      icon: "traffic",
      label: "Tráfico",
      value: b.trafficLevel === "heavy" ? "Pesado" : b.trafficLevel === "moderate" ? "Moderado" : "Liviano",
      color: b.trafficLevel === "heavy" ? A.rose.color : b.trafficLevel === "moderate" ? A.amber.color : A.emerald.color,
    });
  }
  if (b.fuelEstimate) {
    trafficTiles.push({ icon: "local_gas_station", label: "Combustible", value: b.fuelEstimate, color: A.amber.color });
  }
  if (b.remaining) {
    trafficTiles.push({ icon: "flag", label: "Restante", value: b.remaining, color: A.indigo.color });
  }
  if (progressPct != null) {
    trafficTiles.push({ icon: "near_me", label: "Progreso", value: `${progressPct}%`, color: A.emerald.color });
  }
  if (trafficTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "traffic",
      accent: A.amber,
      title: "Tráfico",
      subtitle: "ESTADO DE LA RUTA",
      tiles: trafficTiles,
    });
  }

  // 🔴 KIMI TIER-S (Card 30): "Navegar" custom action. Abre la app nativa de
  // mapas con el destino cargado (geo: en Android, maps:// en iOS). El handler
  // en KoruProvider recibe `action: "navigate"` y usa lat/lng o to (address)
  // para construir el deep link. El renderer lo muestra como botón inline.
  const navigateAction = b.to || (b.lat != null && b.lng != null)
    ? [{ label: "Navegar", icon: "navigation", kind: "primary" as const, action: "navigate" }]
    : undefined;

  return {
    hero: {
      kicker: "Tu Mapa",
      title: heroTitleFrom(b.to, "Ruta"),
      desc: [b.from && `Desde ${b.from}`, b.distance, b.remaining && `${b.remaining} restante`].filter(Boolean).join(" · "),
      icon: "map",
      accent: A.indigo,
      artValue: etaArtValue,
      metrics: heroMetrics,
    },
    detail: sections.length > 0
      ? {
          title: b.to ? `Ruta a ${b.to}` : "Ruta",
          subtitle: b.from ? `DESDE ${b.from.toUpperCase()}` : undefined,
          sections,
        }
      : undefined,
    cta: b.to ? { label: "Ver detalle" } : undefined,
    // 🔴 KIMI TIER-S: "Navegar" — botón inline que dispara el deep link a la
    // app nativa de mapas.
    actions: navigateAction,
  };
}

/**
 * Mapea un maneuver de Google Maps (turn-left, roundabout-right, merge, etc.)
 * a un ícono Material Symbols. Default: "turn_straight".
 */
function maneuverToIcon(maneuver: string): string {
  const m = maneuver.trim().toLowerCase();
  if (!m || m === "straight") return "straight";
  if (m.includes("turn-left")) return "turn_left";
  if (m.includes("turn-right")) return "turn_right";
  if (m.includes("turn-slight-left")) return "turn_slight_left";
  if (m.includes("turn-slight-right")) return "turn_slight_right";
  if (m.includes("turn-sharp-left")) return "turn_sharp_left";
  if (m.includes("turn-sharp-right")) return "turn_sharp_right";
  if (m.includes("uturn") || m.includes("u-turn")) return "u_turn_left";
  if (m.includes("roundabout")) return "roundabout_right";
  if (m.includes("merge")) return "merge";
  if (m.includes("fork")) return "fork_right";
  if (m.includes("ramp")) return "departure_board";
  if (m.includes("keep-left")) return "keep_left";
  if (m.includes("keep-right")) return "keep_right";
  if (m.includes("depart")) return "trip_origin";
  if (m.includes("arrive")) return "location_on";
  return "turn_straight";
}

function birthdayCalendar(b: Of<"birthday_calendar">): KoruPresentation {
  // 🔴 v2: usar startDay + daysInMonth para generar grid visual del mes
  const month = b.month ?? "Calendario";
  const highlightedDay = b.highlightedDay;
  const startDay = b.startDay ?? 0; // 0=Sunday, 1=Monday
  const daysInMonth = b.daysInMonth ?? 30;

  // Generar array de días con offset para el grid
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const days: Array<{ day: number | null; highlighted: boolean }> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      days.push({ day: null, highlighted: false });
    } else {
      days.push({ day: dayNum, highlighted: dayNum === highlightedDay });
    }
  }

  const dayNames = ["D", "L", "M", "M", "J", "V", "S"];

  // 🔴 Kimi card 12 — countdown real como artValue (días hasta el día
  // destacado) + agenda del día como timeline + actions (Abrir enlace /
  // Compartir) como "meeting link" / custom action.
  const today = new Date();
  const todayDay = today.getDate();
  let countdownLabel: string | undefined;
  if (highlightedDay != null) {
    let diff = highlightedDay - todayDay;
    if (diff < 0) diff = daysInMonth - todayDay + highlightedDay;
    countdownLabel = diff === 0 ? "HOY" : diff === 1 ? "MAÑANA" : `FALTAN ${diff}D`;
  }

  const sections: DetailSection[] = [
    {
      kind: "calendar",
      icon: "calendar_month",
      accent: A.pink,
      title: "Calendario del mes",
      subtitle: `${daysInMonth} DÍAS`,
      // 🔴 v2: kind dedicado "calendar" — usa .koru-dsec-calendar / -day
      // (clases dedicadas) en lugar de colisionar con .koru-dsec-chips.
      days: days.map((d) => ({
        label: d.day ? String(d.day) : "·",
        color: d.highlighted ? A.pink.color : undefined,
        sub: d.highlighted ? "★" : undefined,
      })),
    },
  ];

  // Agenda del día destacado como timeline (slots mañana / mediodía / tarde).
  if (highlightedDay != null) {
    sections.push({
      kind: "timeline",
      icon: "event_note",
      accent: A.amber,
      title: "Agenda del día",
      subtitle: `DÍA ${highlightedDay} · ${month.toUpperCase()}`,
      steps: [
        { title: "Mañana", detail: "9 a 12 — agenda abierta", status: "pending" },
        { title: "Mediodía", detail: "13 a 15 — pausa y comida", status: "pending" },
        { title: "Tarde", detail: "16 a 20 — bloque principal", status: "pending" },
      ],
    });
  }

  return {
    hero: {
      kicker: "Calendario",
      title: heroTitleFrom(month, "Calendario"),
      desc: highlightedDay ? `Día destacado: ${highlightedDay}` : undefined,
      icon: "calendar_month",
      accent: A.pink,
      artValue: countdownLabel,
      metrics: [
        { icon: "event", label: "Mes", value: month, color: A.pink.color },
        { icon: "cake", label: "Día", value: highlightedDay ? String(highlightedDay) : "—", color: A.amber.color },
      ],
    },
    // 🔴 Kimi card 12 — "meeting link" / custom action: Abrir enlace + Compartir.
    actions: [
      { label: "Abrir enlace", icon: "link", kind: "primary", action: "open_link" },
      { label: "Compartir", icon: "share", kind: "secondary", action: "share" },
    ],
    detail: {
      title: `Calendario · ${month}`,
      subtitle: highlightedDay ? `DÍA DESTACADO: ${highlightedDay}` : undefined,
      sections,
    },
    cta: { label: "Ver calendario" },
    // 🔴 KIMI v4: layout default .kc (no banner — spec pág. 53 muestra kc normal).
    layout: "default",
  };
}

function birthdayAlarm(b: Of<"birthday_alarm">): KoruPresentation {
  return {
    hero: {
      kicker: b.eta ? `Alarma · ${b.eta}` : "Cumpleaños",
      title: heroTitleFrom(b.name, "Cumpleaños"),
      desc: b.date,
      icon: "cake",
      accent: A.amber,
      artValue: b.countdown ? `${b.countdown}${b.unit ? ` ${b.unit}` : ""}` : undefined,
    },
    // 🔴 KIMI v4: layout default .kc (no banner — spec pág. 53 muestra kc normal).
    layout: "default",
  };
}

function socialInteraction(b: Of<"social_interaction">): KoruPresentation {
  const gifts = b.gifts ?? [];
  return {
    hero: {
      kicker: "Social · Hoy",
      title: heroTitleFrom(b.name, "Cumpleaños"),
      desc: [b.date, b.age && `Cumple ${b.age}`, b.remaining].filter(Boolean).join(" · "),
      icon: "celebration",
      accent: A.pink,
    },
    detail: gifts.length
      ? {
          title: b.name || "Ideas de regalo",
          subtitle: b.date,
          sections: [
            {
              kind: "scroller",
              icon: "featured_seasonal_and_gifts",
              accent: A.pink,
              title: "Ideas de regalo",
              cards: gifts.map((g) => ({ title: `${g.emoji} ${g.title}`, detail: g.detail })),
            },
          ],
        }
      : undefined,
    cta: gifts.length ? { label: "Ver ideas" } : undefined,
  };
}

function smartChecklist(b: Of<"smart_checklist">): KoruPresentation {
  const items = b.items ?? [];
  const done = items.filter((i) => i.checked).length;
  // 🔴 TIER S: id sintético del Checklist durable. Misma convención de slug
  // que createChecklist en KoruProvider: si el usuario crea un checklist desde
  // CreateScreen con el mismo título, el toggle acá lo encontrará.
  const checklistId = `checklist_${slug(clean(b.title) || "lista")}`;
  return {
    hero: {
      kicker: "Tu Checklist",
      title: heroTitleFrom(b.title, "Lista"),
      desc: items.length ? `${done} de ${items.length} completados` : undefined,
      icon: "checklist",
      accent: A.violet,
      metrics: b.progress != null ? [{ icon: "task_alt", label: "Progreso", value: `${b.progress}%`, color: A.violet.color }] : undefined,
    },
    detail: items.length
      ? {
          title: b.title || "Checklist",
          sections: [
            {
              kind: "rows",
              icon: "checklist",
              accent: A.violet,
              title: "Tareas",
              rows: items.map((it, i) => ({
                icon: it.checked ? "check_box" : "check_box_outline_blank",
                title: it.label,
                badge: it.checked ? "Listo" : undefined,
                badgeTone: it.checked ? "done" : undefined,
                // 🔴 TIER S: toggle → toggleChecklistItem(checklistId, itemId)
                toggle: { kind: "checklist_item", checklistId, itemId: `citem_${slug(it.label)}_${i}` },
              })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver checklist" } : undefined,
  };
}

function outfit(b: Of<"outfit">): KoruPresentation {
  const specs = b.specs ?? [];
  return {
    hero: {
      kicker: "Tu Look",
      title: heroTitleFrom(b.title, "Look del día"),
      desc: specs[0] ? `${specs[0].label}: ${specs[0].value}` : undefined,
      icon: "checkroom",
      accent: A.amber,
      metrics: specs.slice(0, 3).map((s) => ({ icon: "styler", label: s.label, value: s.value, color: A.amber.color })),
    },
    detail: specs.length
      ? {
          title: "Tu Look",
          sections: [
            {
              kind: "tiles",
              icon: "checkroom",
              accent: A.amber,
              title: "Detalles",
              tiles: specs.map((s) => ({ label: `${s.emoji} ${s.label}`, value: s.value, color: A.amber.color })),
            },
          ],
        }
      : undefined,
    cta: specs.length ? { label: b.buttonLabel || "Ver look" } : undefined,
  };
}

function reviewScore(b: Of<"review_score">): KoruPresentation {
  const items = b.items ?? [];
  return {
    hero: {
      kicker: "Tu Reseña",
      title: heroTitleFrom(b.title, "Puntajes"),
      desc: items[0] ? `${items[0].label}: ${items[0].score}` : undefined,
      icon: "reviews",
      accent: A.violet,
      metrics: items.slice(0, 3).map((it) => ({ icon: "star", label: it.label, value: it.score, color: it.color })),
    },
    detail: items.length
      ? {
          title: "Reseña",
          sections: [
            {
              kind: "tiles",
              icon: "reviews",
              accent: A.violet,
              title: "Puntajes",
              tiles: items.map((it) => ({ label: `${it.emoji} ${it.label}`, value: it.score, color: it.color })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: b.buttonLabel || "Ver reseña" } : undefined,
  };
}

function reviewDocument(b: Of<"review_document">): KoruPresentation {
  return {
    hero: {
      kicker: "Veredicto",
      title: heroTitleFrom(b.title, "Análisis"),
      desc: b.body ? b.body.slice(0, 140) : undefined,
      icon: "description",
      accent: A.primary,
    },
    detail: b.body
      ? { title: b.title || "Veredicto", sections: [{ kind: "text", icon: "description", accent: A.primary, title: "Análisis", body: b.body }] }
      : undefined,
    cta: b.body ? { label: "Leer veredicto" } : undefined,
  };
}

function reviewQuote(b: Of<"review_quote">): KoruPresentation {
  return {
    hero: {
      kicker: "Veredicto final",
      title: heroTitleFrom(b.sourceName, "Opinión"),
      desc: b.quote,
      icon: "format_quote",
      accent: A.purple,
    },
    detail: b.quote
      ? {
          title: b.sourceName || "Opinión",
          subtitle: b.sourceType,
          sections: [
            { kind: "text", icon: "format_quote", accent: A.purple, title: "Cita", body: b.quote },
            ...(b.tags?.length
              ? [{ kind: "chips" as const, icon: "sell", accent: A.purple, title: "Etiquetas", chips: b.tags.map((t) => ({ label: t })) }]
              : []),
          ],
        }
      : undefined,
    cta: b.quote ? { label: b.buttonLabel || "Ver opinión" } : undefined,
  };
}

function planFallback(b: Of<"plan">): KoruPresentation {
  const items = b.items ?? [];
  // Mostrar los primeros 3 items del plan como métricas (chips con icono de hora)
  // así el usuario ve QUÉ va a hacer sin abrir la card.
  // El conteo total va en el desc.
  const previewItems = items.slice(0, 3);
  const hasMore = items.length > 3;
  const metrics: HeroMetric[] = previewItems.map((it) => ({
    icon: "schedule",
    label: clean(it.time) ?? "Paso",
    color: A.violet.color,
  }));
  if (hasMore) {
    metrics.push({ icon: "more_horiz", label: `+${items.length - 3} más`, color: A.violet.color });
  }
  // Title: NO usar heroTitleFrom acá porque uppercasea todo ("Tu Día" → "DÍA").
  // El plan es un caso especial: el título se muestra en title case natural.
  const rawTitle = clean(b.title) ?? "";
  const heroTitle = rawTitle && rawTitle.length > 1
    ? rawTitle
    : "Tu día";
  // 🔴 TIER S: id sintético del Plan durable. Misma convención de slug que
  // createPlan en KoruProvider: si el usuario crea un plan desde CreateScreen
  // con el mismo título, el toggle acá lo encontrará.
  const planId = `plan_${slug(rawTitle || "tu_dia")}`;

  // 🔴 Kimi card 15 — step count as artValue ("2/7") + time distribution as
  // tiles + strategy notes as text. Statuses realistas (done / current /
  // pending) en vez de "done | current" binario.
  const doneCount = items.filter((it) => it.done).length;
  const artValue = items.length > 0 ? `${doneCount}/${items.length}` : undefined;
  const firstNotDoneIdx = items.findIndex((it) => !it.done);

  // Time distribution tiles (by mode).
  const modeTotals: Record<string, number> = {};
  let totalMin = 0;
  for (const it of items) {
    const min = it.durationMinutes ?? 0;
    if (min > 0) {
      totalMin += min;
      const mode = it.mode ?? "otros";
      modeTotals[mode] = (modeTotals[mode] ?? 0) + min;
    }
  }
  const modeLabel: Record<string, string> = {
    focus: "Foco",
    quick: "Rápidas",
    admin: "Admin",
    recovery: "Recuperación",
    otros: "Otros",
  };
  const timeTiles: DetailTile[] = [];
  if (totalMin > 0) {
    timeTiles.push({ icon: "schedule", label: "Total", value: `${totalMin} min`, color: A.violet.color });
    for (const [mode, min] of Object.entries(modeTotals)) {
      timeTiles.push({ icon: "timelapse", label: modeLabel[mode] ?? mode, value: `${min} min`, color: A.indigo.color });
    }
  }

  const sections: DetailSection[] = [];
  if (items.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "route",
      accent: A.violet,
      title: "Pasos",
      subtitle: `${items.length} PASO${items.length > 1 ? "S" : ""} ORDENADOS`,
      steps: items.map((it, i) => ({
        // 🔴 FIX: icono específico del paso (no genérico route)
        icon: it.icon || "schedule",
        title: it.title,
        detail: [
          it.time,
          it.durationMinutes ? `${it.durationMinutes} min` : null,
          it.priority,
          it.mode ? `· ${it.mode}` : null,
        ].filter(Boolean).join(" · "),
        // 🔴 Kimi: done / current (primero no-hecho) / pending.
        status: it.done ? "done" : i === firstNotDoneIdx ? "current" : ("pending" as const),
        // 🔴 FIX: badge con priority (Alta/Media/Baja)
        badge: it.priority,
        badgeTone: it.priority === "Alta" ? "urgent" : it.priority === "Media" ? "current" : "pending",
        // 🔴 TIER S: toggle → togglePlanStep(planId, stepId)
        toggle: { kind: "plan_step", planId, stepId: `step_${slug(it.title)}_${i}` },
      })),
    });
  }
  if (timeTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "timelapse",
      accent: A.indigo,
      title: "Distribución del tiempo",
      subtitle: "POR MODO",
      tiles: timeTiles,
    });
  }
  if (b.note) {
    sections.push({
      kind: "text",
      icon: "psychology_alt",
      accent: A.amber,
      title: "Notas de estrategia",
      subtitle: "POR QUÉ EN ESTE ORDEN",
      body: b.note,
    });
  }

  return {
    hero: {
      kicker: "Tu Plan",
      title: heroTitle,
      desc: items.length > 0
        ? `${items.length} paso${items.length > 1 ? "s" : ""} para hoy`
        : b.note,
      icon: "checklist_rtl",
      accent: A.violet,
      art: "/stitch/plan-illustration.png",
      artValue,
      metrics: metrics.length > 0 ? metrics : undefined,
    },
    detail: sections.length > 0
      ? {
          title: b.title || "Tu Plan",
          subtitle: `${items.length} PASO${items.length > 1 ? "S" : ""} ORDENADOS`,
          sections,
        }
      : undefined,
    cta: items.length ? { label: "Ver el plan paso a paso" } : undefined,
  };
}

// ---- sección de fuentes reutilizable ----------------------------------------

function sourcesSection(sources: AssistantSource[]): DetailSection {
  return {
    kind: "sources",
    icon: "menu_book",
    accent: A.purple,
    title: "Fuentes",
    subtitle: "CONTRASTADAS",
    sources: sourcesToRefs(sources),
  };
}

// ---- 🔴 FIX P2.3: Nuevos renderers para recipe, movie_review, book_review ----

function recipeBlock(b: Of<"recipe">): KoruPresentation {
  const ingredients = b.ingredients ?? [];
  const steps = b.steps ?? [];
  const subtitle = [b.category, b.area].filter(Boolean).join(" · ") || undefined;
  const sections: DetailSection[] = [];

  if (ingredients.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "kitchen",
      accent: A.emerald,
      title: "Ingredientes",
      subtitle: `${ingredients.length} items`,
      tiles: ingredients.map((ing) => ({
        label: ing.ingredient,
        value: ing.measure || "",
        color: A.emerald.color,
      })),
    });
  }

  if (steps.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "format_list_numbered",
      accent: A.primary,
      title: "Pasos",
      subtitle: `${steps.length} pasos`,
      steps: steps.map((s) => ({
        title: `Paso ${s.step}`,
        detail: s.text,
      })),
    });
  } else if (b.instructions) {
    sections.push({
      kind: "text",
      icon: "description",
      accent: A.primary,
      title: "Preparación",
      body: b.instructions,
    });
  }

  if (b.tips && b.tips.length > 0) {
    sections.push({
      kind: "chips",
      icon: "lightbulb",
      accent: A.amber,
      title: "Tips",
      chips: b.tips.map((t) => ({ label: t })),
    });
  }

  // 🔴 v4: Maridaje de vino — cuando la receta declara category o area,
  // sugerimos un vino con un motivo corto y un pairingScore 0-1. Lo dejamos
  // como una sección de texto simple para no inventar un nuevo kind.
  if (b.category || b.area) {
    const pairing = suggestWinePairing(b.category ?? "", b.area);
    sections.push({
      kind: "text",
      icon: "wine_bar",
      accent: A.rose,
      title: "Maridaje",
      subtitle: "VINO SUGERIDO",
      body: `${pairing.wine} — ${pairing.reason}. (Afinidad ${Math.round(pairing.pairingScore * 100)}%)`,
    });
  }

  // 🔴 KIMI TIER-S (Card 25 · Recetas): nutrición como tiles (kcal, protein,
  // carbs, fat) cuando el bloque trae el campo opcional `nutrition` (vía
  // Open Food Facts). Cada valor se muestra con su unidad y color semáforo.
  if (b.nutrition) {
    const nutritionTiles: DetailTile[] = [
      { icon: "local_fire_department", label: "Calorías", value: `${b.nutrition.kcal} kcal`, color: A.amber.color },
      { icon: "fitness_center", label: "Proteína", value: `${b.nutrition.protein} g`, color: A.emerald.color },
      { icon: "bakery_dining", label: "Carbs", value: `${b.nutrition.carbs} g`, color: A.purple.color },
      { icon: "water_drop", label: "Grasas", value: `${b.nutrition.fat} g`, color: A.rose.color },
    ];
    sections.push({
      kind: "tiles",
      icon: "monitor_weight",
      accent: A.indigo,
      title: "Nutrición",
      subtitle: "POR 100 G (APROX.)",
      tiles: nutritionTiles,
    });
  }

  if (b.source) {
    sections.push({
      kind: "sources",
      icon: "link",
      accent: A.purple,
      title: "Fuente",
      sources: [{ title: b.source.title, url: b.source.url, domain: b.source.domain }],
    });
  }

  // 🔴 v2: video como source clicable (antes solo cambiaba el CTA label)
  if (b.videoUrl) {
    sections.push({
      kind: "sources",
      icon: "smart_display",
      accent: A.red,
      title: "Video de la receta",
      subtitle: "MIRÁ CÓMO SE HACE",
      sources: [{ title: "Ver receta en video", url: b.videoUrl, domain: "YouTube" }],
    });
  }

  return {
    hero: {
      kicker: "Tu Receta",
      title: heroTitleFrom(b.name ?? b.title, "Receta"),
      desc: b.description ?? subtitle,
      art: b.image,
      artAspect: "poster" as const,
      icon: "restaurant",
      accent: A.emerald,
      metrics: [
        ...(ingredients.length ? [{ icon: "kitchen", label: "Ingredientes", value: String(ingredients.length), color: A.emerald.color }] : []),
        ...(b.prepTime ? [{ icon: "schedule", label: "Preparación", value: b.prepTime, color: A.primary.color }] : []),
        ...(b.cookTime ? [{ icon: "local_fire_department", label: "Cocción", value: b.cookTime, color: A.amber.color }] : []),
        ...(b.servings ? [{ icon: "groups", label: "Porciones", value: String(b.servings), color: A.purple.color }] : []),
      ],
    },
    detail: sections.length
      ? {
          title: b.name ?? b.title ?? "Receta",
          subtitle,
          sections,
        }
      : undefined,
    cta: { label: b.videoUrl ? "Ver el video y cocinar paso a paso" : "Cocinar paso a paso" },
    // 🔴 v3: spotlight full-bleed cuando hay imagen del plato.
    layout: b.image ? "spotlight" : "default",
  };
}

function movieReviewBlock(b: Of<"movie_review">): KoruPresentation {
  const cast = b.cast ?? [];
  const genres = b.genres ?? [];
  const crew = b.crew ?? [];
  const ratings = b.ratings ?? [];
  const streaming = b.streaming ?? [];
  const sections: DetailSection[] = [];

  if (b.overview) {
    sections.push({
      kind: "text",
      icon: "description",
      accent: A.primary,
      title: "Sinopsis",
      body: b.overview,
    });
  }

  const tiles: DetailTile[] = [];
  if (b.director) tiles.push({ label: "Director", value: b.director, color: A.primary.color });
  if (b.runtime) tiles.push({ label: "Duración", value: b.runtime, color: A.primary.color });
  if (b.releaseDate) tiles.push({ label: "Estreno", value: b.releaseDate, color: A.primary.color });
  if (genres.length > 0) tiles.push({ label: "Géneros", value: genres.join(", "), color: A.emerald.color });
  if (tiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "movie",
      accent: A.primary,
      title: "Detalles",
      tiles,
    });
  }

  // 🔴 v2: cast como chips (antes era comma string en un tile — poco visual)
  if (cast.length > 0) {
    sections.push({
      kind: "chips",
      icon: "groups",
      accent: A.purple,
      title: "Reparto",
      subtitle: `${cast.length} ACTORES`,
      chips: cast.map((c) => ({ label: c })),
    });
  }

  // 🎬 Crew: Writer, Composer, Cinematographer como tiles section
  if (crew.length > 0) {
    const crewLabelMap: Record<string, string> = {
      Writer: "Guionista",
      Composer: "Compositor",
      Cinematographer: "Fotografía",
    };
    sections.push({
      kind: "tiles",
      icon: "edit_note",
      accent: A.indigo,
      title: "Equipo",
      subtitle: `${crew.length} ROLES`,
      tiles: crew.map((c) => ({
        label: crewLabelMap[c.job] ?? c.job,
        value: c.name,
        color: A.indigo.color,
      })),
    });
  }

  // ⭐ Ratings: IMDb, RT, Metacritic como tiles section
  if (ratings.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "star",
      accent: A.amber,
      title: "Puntajes",
      subtitle: `${ratings.length} FUENTES`,
      tiles: ratings.map((r) => ({
        label: r.source,
        value: `${r.score}/${r.outOf}`,
        color: A.amber.color,
      })),
    });
  }

  // 💰 Detalles financieros: presupuesto y taquilla (formato "$150M" / "$1.2B")
  // extraídos de TMDB. Awards se deja vacío por ahora (no viene de TMDB).
  const financialTiles: DetailTile[] = [];
  if (b.budget) financialTiles.push({ icon: "savings", label: "Presupuesto", value: b.budget, color: A.emerald.color });
  if (b.boxOffice) financialTiles.push({ icon: "monetization_on", label: "Taquilla", value: b.boxOffice, color: A.emerald.color });
  if (financialTiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "payments",
      accent: A.emerald,
      title: "Detalles financieros",
      subtitle: "PRESUPUESTO · TAQUILLA",
      tiles: financialTiles,
    });
  }

  if (b.sources && b.sources.length > 0) {
    sections.push({
      kind: "sources",
      icon: "menu_book",
      accent: A.purple,
      title: "Fuentes",
      subtitle: "CONTRASTADAS",
      sources: sourcesToRefs(b.sources),
    });
  }

  // 📺 Streaming: chips con proveedores (preferir streaming rico sobre whereToWatch simple)
  if (streaming.length > 0) {
    sections.push({
      kind: "chips",
      icon: "play_circle",
      accent: A.emerald,
      title: "Dónde verla",
      subtitle: "ESPAÑA",
      chips: streaming.map((s) => ({ label: s.provider })),
    });
  } else if (b.whereToWatch && b.whereToWatch.length > 0) {
    sections.push({
      kind: "chips",
      icon: "play_circle",
      accent: A.emerald,
      title: "Dónde verla",
      chips: b.whereToWatch.map((w) => ({ label: w })),
    });
  }

  const heroMetrics: HeroMetric[] = [];
  if (b.rating) heroMetrics.push({ icon: "star", label: "Rating", value: `${b.rating}/10`, color: A.amber.color });
  if (b.ratingCount) heroMetrics.push({ icon: "people", label: "Votos", value: String(b.ratingCount), color: A.primary.color });
  if (b.runtime) heroMetrics.push({ icon: "schedule", label: "Duración", value: b.runtime, color: A.purple.color });

  return {
    hero: {
      kicker: "Tu Película",
      title: heroTitleFrom(b.title, "Película"),
      desc: b.overview ? b.overview.slice(0, 200) : undefined,
      art: b.poster,
      artAspect: "poster" as const,
      icon: "movie",
      accent: A.primary,
      metrics: heroMetrics,
    },
    detail: sections.length
      ? {
          title: b.title ?? "Película",
          subtitle: [b.releaseDate, b.runtime].filter(Boolean).join(" · ") || undefined,
          sections,
        }
      : undefined,
    cta: { label: "Ver trailer y ficha" },
    // 🔴 v3: spotlight full-bleed cuando hay poster de la película.
    layout: b.poster ? "spotlight" : "default",
  };
}

function bookReviewBlock(b: Of<"book_review">): KoruPresentation {
  const sections: DetailSection[] = [];

  if (b.synopsis) {
    sections.push({
      kind: "text",
      icon: "description",
      accent: A.primary,
      title: "Sinopsis",
      body: b.synopsis,
    });
  }

  const tiles: DetailTile[] = [];
  if (b.author) tiles.push({ label: "Autor", value: b.author, color: A.primary.color });
  if (b.year) tiles.push({ label: "Año", value: String(b.year), color: A.primary.color });
  if (b.pages) tiles.push({ label: "Páginas", value: String(b.pages), color: A.primary.color });
  if (b.publisher) tiles.push({ label: "Editorial", value: b.publisher, color: A.primary.color });
  if (b.genre) tiles.push({ label: "Género", value: b.genre, color: A.emerald.color });
  if (b.isbn) tiles.push({ label: "ISBN", value: b.isbn, color: A.purple.color });
  if (tiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "menu_book",
      accent: A.primary,
      title: "Detalles",
      tiles,
    });
  }

  // 🔴 v4: preview embebido de Archive.org — se renderiza como iframe 16:9
  // en el detail screen (KoruDetailScreen detecta la URL archive.org/embed
  // y la convierte a <iframe> en vez de un link textual).
  if (b.previewUrl) {
    sections.push({
      kind: "sources",
      icon: "auto_stories",
      accent: A.amber,
      title: "Fuentes",
      subtitle: "PREVIEW DISPONIBLE",
      sources: [{
        title: "Ver preview",
        domain: "archive.org",
        url: b.previewUrl,
      }],
    });
  } else if (b.sources && b.sources.length > 0) {
    sections.push({
      kind: "sources",
      icon: "menu_book",
      accent: A.purple,
      title: "Fuentes",
      subtitle: "CONTRASTADAS",
      sources: sourcesToRefs(b.sources),
    });
  }

  const heroMetrics: HeroMetric[] = [];
  if (b.rating) heroMetrics.push({ icon: "star", label: "Rating", value: `${b.rating}/10`, color: A.amber.color });
  if (b.year) heroMetrics.push({ icon: "calendar_today", label: "Año", value: String(b.year), color: A.primary.color });
  if (b.pages) heroMetrics.push({ icon: "auto_stories", label: "Páginas", value: String(b.pages), color: A.purple.color });

  return {
    hero: {
      kicker: "Tu Libro",
      title: heroTitleFrom(b.title, "Libro"),
      desc: b.synopsis ? b.synopsis.slice(0, 200) : undefined,
      art: b.cover,
      artAspect: "poster" as const,
      icon: "menu_book",
      accent: A.amber,
      metrics: heroMetrics,
    },
    detail: sections.length
      ? {
          title: b.title ?? "Libro",
          subtitle: [b.author, b.year ? String(b.year) : undefined].filter(Boolean).join(", ") || undefined,
          sections,
        }
      : undefined,
    cta: { label: "Leer sinopsis y comprar" },
    // 🔴 v3: spotlight full-bleed cuando hay tapa del libro.
    layout: b.cover ? "spotlight" : "default",
  };
}

// ─── news_urgent ────────────────────────────────────────────────────────────
// Agregado de GDELT + USGS + NewsAPI con fact-check. El hero rota entre
// accent rojo (breaking), ámbar (urgent) y primario (important) según
// severidad; el detalle arma timeline + chips de fact-check (✓/✗/⚠) +
// fuentes con favicon.
function newsUrgentBlock(b: Of<"news_urgent">): KoruPresentation {
  const severity = b.severity ?? "important";
  const severityLabel =
    severity === "breaking" ? "ÚLTIMA HORA" : severity === "urgent" ? "URGENTE" : "IMPORTANTE";
  const accent =
    severity === "breaking" ? A.red : severity === "urgent" ? A.amber : A.primary;

  const categoryLabel = (b.category ?? "general")
    .split(/[_\s-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const sections: DetailSection[] = [];

  // 🔴 Kimi card 11 — severity badge + context chips (severidad · categoría ·
  // frescura). Convierte el severity del hero en una bad Row visible del detalle.
  const contextChips: DetailChip[] = [{ label: severityLabel, color: accent.color }];
  if (b.category) contextChips.push({ label: categoryLabel, color: A.indigo.color });
  if (b.lastUpdated) {
    const fresh = formatFreshness(b.lastUpdated);
    if (fresh) contextChips.push({ label: fresh, color: A.amber.color });
  }
  sections.push({
    kind: "chips",
    icon: "label",
    accent,
    title: "Contexto",
    subtitle: "SEVERIDAD · CATEGORÍA · ACTUALIZACIÓN",
    chips: contextChips,
  });

  // 1. Resumen (texto).
  if (b.summary) {
    sections.push({
      kind: "text",
      icon: "subject",
      accent,
      title: "Resumen",
      body: b.summary,
    });
  }

  // 2. Timeline de eventos (5 más recientes).
  const timeline = b.timeline ?? [];
  if (timeline.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "timeline",
      accent,
      title: "Cronología",
      subtitle: "EVENTOS RECIENTES",
      steps: timeline.map((t) => ({
        title: t.event,
        meta: t.time,
        status: (t.status === "current" ? "current" : t.status === "pending" ? "pending" : "done") as
          | "done"
          | "current"
          | "pending",
      })),
    });
  }

  // 3. Fact-checks como chips con icono ✓/✗/⚠ embebido en el label.
  const factChecks = b.factChecks ?? [];
  if (factChecks.length > 0) {
    sections.push({
      kind: "chips",
      icon: "fact_check",
      accent: A.emerald,
      title: "Verificación",
      subtitle: "FACT-CHECK",
      chips: factChecks.map((fc) => {
        const icon =
          fc.verdict === "confirmed" ? "✓" : fc.verdict === "denied" ? "✗" : "⚠";
        const color =
          fc.verdict === "confirmed"
            ? A.emerald.color
            : fc.verdict === "denied"
              ? A.red.color
              : A.amber.color;
        return {
          label: `${icon} ${fc.claim}`,
          sub: `${fc.verdict.toUpperCase()} · ${fc.source}`,
          color,
        };
      }),
    });
  }

  // 4. Ubicación (si hay, ej. epicentro de terremoto).
  if (b.location) {
    sections.push({
      kind: "tiles",
      icon: "place",
      accent: A.rose,
      title: "Ubicación",
      tiles: [
        { label: "Lugar", value: b.location.label, color: A.rose.color },
        { label: "Latitud", value: b.location.lat.toFixed(3), color: A.rose.color },
        { label: "Longitud", value: b.location.lng.toFixed(3), color: A.rose.color },
      ],
    });
  }

  // 5. Fuentes con favicon.
  if (b.sources && b.sources.length > 0) {
    sections.push({
      kind: "sources",
      icon: "link",
      accent: A.indigo,
      title: "Fuentes",
      subtitle: "TRAZABLES",
      sources: sourcesToRefs(b.sources),
    });
  }

  const heroMetrics: HeroMetric[] = [
    { icon: "bolt", label: "Severidad", value: severityLabel, color: accent.color },
  ];
  if (b.category) heroMetrics.push({ icon: "category", label: "Categoría", value: categoryLabel, color: A.indigo.color });
  if (b.sources?.length) heroMetrics.push({ icon: "link", label: "Fuentes", value: String(b.sources.length), color: A.emerald.color });
  if (b.factChecks?.length) heroMetrics.push({ icon: "fact_check", label: "Fact-checks", value: String(b.factChecks.length), color: A.purple.color });

  return {
    hero: {
      kicker: severity === "breaking" ? `🔴 ${severityLabel}` : severityLabel,
      title: heroTitleFrom(b.headline, "Última Hora"),
      desc: b.summary,
      icon: "breaking_news",
      accent,
      metrics: heroMetrics,
      verifiedAt: b.lastUpdated,
      freshnessLabel: b.lastUpdated ? formatFreshness(b.lastUpdated) : undefined,
    },
    detail: sections.length
      ? {
          title: b.headline ?? "Última Hora",
          subtitle: [categoryLabel, severityLabel].filter(Boolean).join(" · ") || undefined,
          sections,
        }
      : undefined,
    cta: { label: "Ver cobertura completa" },
  };
}

function tennisMatch(b: Of<"tennis_match">): KoruPresentation {
  const homeName = b.players?.home.name ?? "Local";
  const awayName = b.players?.away.name ?? "Visitante";
  const homeCountry = b.players?.home.country;
  const awayCountry = b.players?.away.country;
  const homeRank = b.players?.home.rank;
  const awayRank = b.players?.away.rank;
  const tournament = b.tournament;
  const sets = b.sets ?? [];
  const status = b.status ?? "live";
  const live = status === "live";
  const accent = live ? A.red : A.emerald;

  // Sets ganados (conteo de sets con winner explícito).
  const homeSetsWon = sets.filter((s) => s.winner === "home").length;
  const awaySetsWon = sets.filter((s) => s.winner === "away").length;
  const score = sets.length > 0 ? `${homeSetsWon} - ${awaySetsWon}` : "vs";
  const title = `${homeName} vs ${awayName}`;

  const tournamentName = tournament?.name ?? "Tenis";
  const round = tournament?.round;
  const surface = tournament?.surface;
  const category = tournament?.category;

  const kickerParts: string[] = [];
  kickerParts.push(live ? "🔴 En vivo" : status === "scheduled" ? "Próximamente" : "Finalizado");
  if (category && category !== "ATP/WTA") kickerParts.push(category);
  const kicker = kickerParts.join(" · ");

  const descParts: string[] = [];
  if (tournamentName && tournamentName !== "Tenis") descParts.push(tournamentName);
  if (round && round !== "—") descParts.push(round);
  if (surface && surface !== "—") descParts.push(surface);
  const desc = descParts.join(" · ") || undefined;

  // Métricas del hero: aces, break points, 1er saque %.
  const metrics: HeroMetric[] = [];
  if (b.stats) {
    const s = b.stats;
    metrics.push({
      icon: "flash_on",
      label: "Aces",
      value: `${s.aces.h}-${s.aces.a}`,
      color: accent.color,
    });
    metrics.push({
      icon: "flag",
      label: "Breaks",
      value: `${s.breakPointsWon.h}/${s.breakPointsFaced.h} · ${s.breakPointsWon.a}/${s.breakPointsFaced.a}`,
      color: accent.color,
    });
    metrics.push({
      icon: "speed",
      label: "1er saque",
      value: `${Math.round(s.firstServePct.h)}%-${Math.round(s.firstServePct.a)}%`,
      color: accent.color,
    });
  }
  if (live && b.currentPoint) {
    metrics.push({ icon: "sports_tennis", label: "Punto", value: b.currentPoint, color: accent.color });
  }
  if (b.elapsedMs != null && b.elapsedMs > 0) {
    const min = Math.floor(b.elapsedMs / 60_000);
    metrics.push({ icon: "schedule", label: "Duración", value: `${min} min`, color: accent.color });
  }

  const sections: DetailSection[] = [];

  // 1. Sets como tiles (Set 1, Set 2, Set 3 con scores).
  const tiles: DetailTile[] = sets.map((s, i) => {
    const scoreStr = s.tiebreak
      ? `${s.homeGames}-${s.awayGames} (TB ${s.tiebreak.homePts}-${s.tiebreak.awayPts})`
      : `${s.homeGames}-${s.awayGames}`;
    return {
      icon: s.winner ? "emoji_events" : undefined,
      label: `Set ${i + 1}`,
      value: scoreStr,
      color: s.winner === "home" ? A.emerald.color : s.winner === "away" ? A.purple.color : undefined,
    };
  });
  if (live && b.currentSet) {
    tiles.push({
      icon: "my_location",
      label: "Set actual",
      value: `${b.currentSet.gamesHome}-${b.currentSet.gamesAway}`,
      color: A.amber.color,
    });
  }
  if (tiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "scoreboard",
      accent,
      title: "Sets",
      subtitle: `${sets.length} SET${sets.length > 1 ? "S" : ""}`,
      tiles,
    });
  }

  // 2. Stats como rows con barras comparativas (home vs away).
  if (b.stats) {
    const s = b.stats;
    const homeColor = A.emerald.color;
    const awayColor = A.purple.color;
    const rows: DetailRow[] = [
      {
        title: "Aces",
        detail: `${s.aces.h} — ${s.aces.a}`,
        bar: { homeValue: s.aces.h, awayValue: s.aces.a, isPercent: false, homeColor, awayColor },
      },
      {
        title: "Dobles faltas",
        detail: `${s.doubleFaults.h} — ${s.doubleFaults.a}`,
        bar: { homeValue: s.doubleFaults.h, awayValue: s.doubleFaults.a, isPercent: false, homeColor: A.red.color, awayColor: A.red.color },
      },
      {
        title: "1er saque %",
        detail: `${Math.round(s.firstServePct.h)}% — ${Math.round(s.firstServePct.a)}%`,
        bar: { homeValue: s.firstServePct.h, awayValue: s.firstServePct.a, isPercent: true, homeColor, awayColor },
      },
      {
        title: "Break points ganados",
        detail: `${s.breakPointsWon.h}/${s.breakPointsFaced.h} — ${s.breakPointsWon.a}/${s.breakPointsFaced.a}`,
        bar: { homeValue: s.breakPointsWon.h, awayValue: s.breakPointsWon.a, isPercent: false, homeColor, awayColor },
      },
      {
        title: "Juegos de saque rotos",
        detail: `${s.returnGamesWon.h} — ${s.returnGamesWon.a}`,
        bar: { homeValue: s.returnGamesWon.h, awayValue: s.returnGamesWon.a, isPercent: false, homeColor, awayColor },
      },
    ];
    sections.push({
      kind: "rows",
      icon: "monitoring",
      accent,
      title: "Estadísticas",
      subtitle: `${homeName} vs ${awayName}`,
      rows,
    });
  }

  // 3. Timeline de momentos clave (sets, aces, breaks, juego actual).
  const steps: DetailStep[] = [];
  if (tournament) {
    const ctx: string[] = [];
    if (tournament.surface && tournament.surface !== "—") ctx.push(`Superficie: ${tournament.surface}`);
    if (tournament.category) ctx.push(tournament.category);
    steps.push({
      icon: "event",
      title: `${tournament.name}${tournament.round && tournament.round !== "—" ? ` · ${tournament.round}` : ""}`,
      detail: ctx.join(" · ") || undefined,
      status: "done",
    });
  }
  const homeIntro = [homeName, homeCountry ? `(${homeCountry})` : null, homeRank ? `#${homeRank}` : null].filter(Boolean).join(" ");
  const awayIntro = [awayName, awayCountry ? `(${awayCountry})` : null, awayRank ? `#${awayRank}` : null].filter(Boolean).join(" ");
  steps.push({ icon: "person", title: homeIntro, detail: "Local", status: "current" });
  steps.push({ icon: "person", title: awayIntro, detail: "Visitante", status: "current" });

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    const winnerName = s.winner === "home" ? homeName : s.winner === "away" ? awayName : null;
    const scoreStr = s.tiebreak
      ? `${s.homeGames}-${s.awayGames} (TB ${s.tiebreak.homePts}-${s.tiebreak.awayPts})`
      : `${s.homeGames}-${s.awayGames}`;
    steps.push({
      icon: s.winner ? "emoji_events" : "sports_tennis",
      title: `Set ${i + 1}: ${scoreStr}`,
      detail: winnerName ? `Ganó ${winnerName}` : "En progreso",
      status: s.winner ? "done" : "current",
      badge: s.tiebreak ? "TB" : undefined,
      badgeTone: "current" as const,
    });
  }

  if (live && b.currentSet) {
    const cs = b.currentSet;
    const serverName = cs.server === "home" ? homeName : awayName;
    steps.push({
      icon: "my_location",
      title: `Juego actual: ${cs.gamesHome}-${cs.gamesAway}`,
      detail: `Al saque: ${serverName}${b.currentPoint ? ` · Punto: ${b.currentPoint}` : ""}`,
      status: "current",
      badge: "Ahora",
      badgeTone: "current" as const,
    });
  }

  if (b.stats && (b.stats.aces.h > 0 || b.stats.aces.a > 0)) {
    const s = b.stats;
    const detail = s.aces.h > s.aces.a
      ? `${homeName} domina en aces`
      : s.aces.a > s.aces.h
        ? `${awayName} domina en aces`
        : "Empate en aces";
    steps.push({
      icon: "flash_on",
      title: `Aces: ${s.aces.h} ${homeName} · ${s.aces.a} ${awayName}`,
      detail,
      status: "done",
    });
  }

  if (b.stats && (b.stats.breakPointsWon.h > 0 || b.stats.breakPointsWon.a > 0)) {
    const s = b.stats;
    const homeEff = s.breakPointsFaced.h > 0 ? Math.round((s.breakPointsWon.h / s.breakPointsFaced.h) * 100) : 0;
    const awayEff = s.breakPointsFaced.a > 0 ? Math.round((s.breakPointsWon.a / s.breakPointsFaced.a) * 100) : 0;
    steps.push({
      icon: "flag",
      title: `Breaks: ${s.breakPointsWon.h}/${s.breakPointsFaced.h} ${homeName} · ${s.breakPointsWon.a}/${s.breakPointsFaced.a} ${awayName}`,
      detail: `Conversión ${homeEff}% vs ${awayEff}%`,
      status: "done",
    });
  }

  if (steps.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "timeline",
      accent,
      title: "Momentos clave",
      subtitle: live ? "PARTIDO EN JUEGO" : "RESUMEN",
      steps,
    });
  }

  // 4. Sources.
  if (b.sources && b.sources.length > 0) {
    sections.push({
      kind: "sources",
      icon: "link",
      accent: A.indigo,
      title: "Fuentes",
      subtitle: "TRAZABLES",
      sources: sourcesToRefs(b.sources),
    });
  }

  const verifiedAt = new Date().toISOString();

  return {
    hero: {
      kicker,
      title: up(title),
      desc,
      icon: "sports_tennis",
      accent,
      artValue: score,
      metrics: metrics.length > 0 ? metrics : undefined,
      verifiedAt,
      freshnessLabel: live ? "ahora" : status === "finished" ? "finalizado" : "programado",
    },
    detail: sections.length > 0
      ? {
          title: `${homeName} vs ${awayName}`,
          subtitle: [tournamentName, round, surface].filter((v) => v && v !== "—").join(" · ") || undefined,
          sections,
        }
      : undefined,
    cta: sections.length > 0 ? { label: live ? "Ver partido en vivo" : "Ver resumen completo" } : undefined,
  };
}

/** Etiqueta legible de antigüedad desde un ISO timestamp. */
function formatFreshness(iso: string): string | undefined {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "ahora";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

// ============================================================================
// exercise_plan — Plan de entrenamiento activo
// ============================================================================
function exercisePlan(b: Of<"exercise_plan">): KoruPresentation {
  const plan = b.plan;
  const sessions = plan.sessions ?? [];
  const totalSessions = sessions.length;
  const currentIdx = Math.min(Math.max(plan.currentSessionIdx ?? 0, 0), Math.max(totalSessions - 1, 0));
  const current = sessions[currentIdx];

  // 🔴 P2 — Peso del usuario para estimar kcal (MET). Default 70kg si no se
  // especifica. Si el bloque trae `userWeightKg`, lo usamos; si no, cae a 70.
  const userWeightKg = typeof b.userWeightKg === "number" && b.userWeightKg > 0
    ? b.userWeightKg
    : 70;

  // WorkoutLogs históricos (para delta de fuerza vs hace 4 semanas).
  const historicalLogs = b.workoutLogs ?? [];

  const sections: DetailSection[] = [];

  // Resumen del plan: semanas + estado + sesión actual
  sections.push({
    kind: "tiles",
    icon: "fitness_center",
    accent: A.emerald,
    title: "Resumen del plan",
    subtitle: plan.name?.toUpperCase() ?? "PLAN",
    tiles: [
      { icon: "event", label: "Sesiones", value: String(totalSessions) },
      { icon: "calendar_month", label: "Semanas", value: String(plan.weeksTotal ?? 0) },
      { icon: "play_circle", label: "Próxima sesión", value: current?.dayLabel ?? "—" },
      { icon: "toggle_on", label: "Estado", value: plan.status === "active" ? "Activo" : plan.status === "completed" ? "Completado" : "Archivado" },
    ],
  });

  // Sesiones como timeline (cada una con sus ejercicios como rows internas)
  if (sessions.length > 0) {
    sections.push({
      kind: "timeline",
      icon: "timeline",
      accent: A.primary,
      title: "Sesiones",
      subtitle: `${totalSessions} DÍAS`,
      steps: sessions.map((s, i) => ({
        icon: s.completedAt ? "check_circle" : i === currentIdx ? "play_arrow" : "radio_button_unchecked",
        title: s.dayLabel || `Sesión ${i + 1}`,
        detail: s.exercises.map((e) => `${e.exercise} · ${e.sets}×${e.reps}${e.weight ? ` · ${e.weight}kg` : ""}`).join("  ·  ") || undefined,
        status: s.completedAt ? "done" : i === currentIdx ? "current" : ("pending" as const),
      })),
    });
  }

  // Detalle de ejercicios de la sesión actual
  if (current && current.exercises.length > 0) {
    sections.push({
      kind: "rows",
      icon: "list_alt",
      accent: A.amber,
      title: current.dayLabel ?? "Sesión actual",
      subtitle: "EJERCICIOS DE HOY",
      rows: current.exercises.map((e) => ({
        icon: "fitness_center",
        title: e.exercise,
        detail: [
          `${e.sets} series × ${e.reps} reps`,
          e.weight ? `${e.weight} kg` : undefined,
          e.restSec ? `${e.restSec}s descanso` : undefined,
          e.durationSec ? `${e.durationSec}s` : undefined,
        ].filter(Boolean).join(" · "),
        badge: e.notes,
      })),
    });
  }

  // 🔴 Kimi card 19 — current exercises as tiles (series / reps / volumen).
  // Agrega una vista agregada de la sesión actual en tiles, complementando
  // las rows de arriba.
  if (current && current.exercises.length > 0) {
    const totalSets = current.exercises.reduce((acc, e) => acc + e.sets, 0);
    const totalReps = current.exercises.reduce((acc, e) => acc + e.reps * e.sets, 0);
    const totalWeight = current.exercises.reduce((acc, e) => acc + (e.weight ?? 0) * e.reps * e.sets, 0);
    const sessionTiles: DetailTile[] = [
      { icon: "repeat", label: "Series totales", value: String(totalSets), color: A.emerald.color },
      { icon: "fitness_center", label: "Reps totales", value: String(totalReps), color: A.amber.color },
    ];
    if (totalWeight > 0) {
      sessionTiles.push({ icon: "weight", label: "Volumen (kg·rep)", value: String(Math.round(totalWeight)), color: A.primary.color });
    }
    sections.push({
      kind: "tiles",
      icon: "monitoring",
      accent: A.emerald,
      title: "Sesión actual",
      subtitle: current.dayLabel?.toUpperCase() ?? "HOY",
      tiles: sessionTiles,
    });
  }

  // 🔴 P2 — Sección de fuerza: 1RM (Epley) + delta vs histórico + kcal por
  // ejercicio.
  // 🔴 Kimi card 19 — strength progress as scroller (1 card por ejercicio con
  // 1RM + delta + kcal). Reemplaza los tiles anteriores por un scroller que
  // deja ver cada ejercicio por separado.
  if (current && current.exercises.length > 0) {
    const strengthCards: DetailScrollCard[] = [];
    let sessionKcalTotal = 0;
    for (const ex of current.exercises) {
      const cardMetrics: string[] = [];
      // 1RM (sólo si hay peso declarado)
      if (typeof ex.weight === "number" && ex.weight > 0) {
        const onerm = calculate1RM(ex.weight, ex.reps);
        cardMetrics.push(`1RM ${onerm.toFixed(1)} kg`);
        // Delta vs histórico (si hay logs)
        if (historicalLogs.length > 0) {
          const delta = calculateStrengthDelta(historicalLogs, historicalLogs, ex.exercise);
          if (delta.deltaPct !== 0 && delta.previous1RM > 0) {
            const sign = delta.deltaPct > 0 ? "+" : "";
            cardMetrics.push(`Δ ${sign}${delta.deltaPct.toFixed(0)}%`);
          }
        }
      }
      // kcal estimadas por ejercicio
      const durationMin = ex.durationSec ? ex.durationSec / 60 : 0;
      const kcal = estimateKcal(
        ex.exercise,
        ex.sets ?? 0,
        ex.reps ?? 0,
        ex.weight ?? 0,
        durationMin,
        userWeightKg,
      );
      sessionKcalTotal += kcal;
      if (kcal > 0) cardMetrics.push(`${kcal} kcal`);
      strengthCards.push({
        badge: ex.weight ? `${ex.weight} kg` : undefined,
        badgeColor: A.emerald.color,
        title: ex.exercise,
        detail: `${ex.sets}×${ex.reps}${ex.restSec ? ` · ${ex.restSec}s` : ""}`,
        metrics: cardMetrics,
      });
    }
    // Card final con el total de kcal de la sesión.
    if (sessionKcalTotal > 0) {
      strengthCards.push({
        badge: "Total",
        badgeColor: A.rose.color,
        title: "Calorías de la sesión",
        detail: `${sessionKcalTotal} kcal`,
        metrics: [`peso ${userWeightKg}kg`],
      });
    }
    if (strengthCards.length > 0) {
      sections.push({
        kind: "scroller",
        icon: "monitoring",
        accent: A.emerald,
        title: "Progreso de fuerza",
        subtitle: `1RM (Epley) · kcal MET · peso ${userWeightKg}kg`,
        cards: strengthCards,
      });
    }
  }

  // 🔴 Kimi card 19 — session progress as artValue ("4/12").
  const completedSessions = sessions.filter((s) => s.completedAt).length;
  const artValue = totalSessions > 0 ? `${completedSessions}/${totalSessions}` : undefined;

  return {
    hero: {
      kicker: "Tu Plan de Fuerza",
      title: heroTitleFrom(plan.name ?? b.title, "Entrenamiento"),
      desc: current ? `Hoy: ${current.dayLabel} — ${current.exercises.length} ejercicio${current.exercises.length === 1 ? "" : "s"}` : `${totalSessions} sesiones`,
      icon: "fitness_center",
      accent: A.emerald,
      artValue,
      metrics: [
        { icon: "event", label: "Sesiones", value: String(totalSessions), color: A.emerald.color },
        { icon: "calendar_month", label: "Semanas", value: String(plan.weeksTotal ?? 0), color: A.primary.color },
      ],
    },
    detail: {
      title: plan.name || "Plan de Entrenamiento",
      subtitle: `${totalSessions} sesiones · ${plan.status}`,
      sections,
    },
    cta: { label: "Ver el plan sesión por sesión" },
  };
}