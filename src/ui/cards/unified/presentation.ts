import type { UiBlock, AssistantSource } from "../../../domain/types";

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
};
export type DetailChip = { label: string; sub?: string; color?: string };
export type DetailScrollCard = {
  badge?: string;
  badgeColor?: string;
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
};
export type DetailSourceRef = { title: string; domain?: string; url?: string; imageUrl?: string };

export type DetailSection =
  | { kind: "text"; icon: string; accent: Accent; title: string; subtitle?: string; body: string }
  | { kind: "tiles"; icon: string; accent: Accent; title: string; subtitle?: string; tiles: DetailTile[] }
  | { kind: "rows"; icon: string; accent: Accent; title: string; subtitle?: string; rows: DetailRow[] }
  | { kind: "chips"; icon: string; accent: Accent; title: string; subtitle?: string; chips: DetailChip[] }
  | { kind: "scroller"; icon: string; accent: Accent; title: string; subtitle?: string; cards: DetailScrollCard[] }
  | { kind: "timeline"; icon: string; accent: Accent; title: string; subtitle?: string; steps: DetailStep[] }
  | { kind: "sources"; icon: string; accent: Accent; title: string; subtitle?: string; sources: DetailSourceRef[] }
  | { kind: "pitch"; icon: string; accent: Accent; title: string; subtitle?: string; pitch: { homeFormation: string; awayFormation: string; homePlayers: Array<{ number?: string; name: string; position?: string }>; awayPlayers: Array<{ number?: string; name: string; position?: string }>; homeColor?: string; awayColor?: string; homeName: string; awayName: string } };

export type Detail = {
  title: string;
  subtitle?: string;
  sections: DetailSection[];
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
};

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

function sourcesToRefs(sources?: AssistantSource[]): DetailSourceRef[] {
  return (sources ?? []).slice(0, 8).map((s) => ({
    title: s.title,
    domain: s.domain,
    url: s.url,
    imageUrl: s.imageUrl,
  }));
}

/** Título del hero sin prefijos redundantes ("Tu plan X" → "X"). */
function heroTitleFrom(raw: string | undefined, fallback: string): string {
  const c = clean(raw).replace(/^\s*(tu|mi)\s+/i, "");
  return up(c || fallback);
}

function asPercent(value?: number): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

// ============================================================================
// Normalizador principal
// ============================================================================

export function toPresentation(block: UiBlock): KoruPresentation {
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
    cta: sections.length ? { label: `Ver ${kicker.replace(/^tu\s+/i, "").toLowerCase()} completo` } : undefined,
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
  const condition = (b.condition ?? "").toLowerCase();
  const weatherIcon = /lluvia|rain|storm|tormenta/.test(condition) ? "rainy"
    : /nieve|snow|nev/.test(condition) ? "ac_unit"
    : /nublado|cloud|cubier/.test(condition) ? "cloud"
    : /tormenta|thunder|storm/.test(condition) ? "thunderstorm"
    : /niebla|fog|bruma/.test(condition) ? "foggy"
    : /sol|soleado|clear|despej/.test(condition) ? "wb_sunny"
    : "partly_cloudy_day";

  // 🔴 v2: accent dinámico según condición (día soleado = amber, lluvia = blue, nieve = primary)
  const weatherAccent = /lluvia|rain|storm|tormenta/.test(condition) ? A.blue
    : /nieve|snow|nev/.test(condition) ? A.primary
    : /sol|soleado|clear|despej/.test(condition) ? A.amber
    : A.primary;

  const metrics: HeroMetric[] = [];
  if (b.range) metrics.push({ icon: "device_thermostat", label: "Mín / Máx", value: b.range, color: A.amber.color });
  if (b.humidity) metrics.push({ icon: "water_drop", label: "Humedad", value: b.humidity, color: A.blue.color });
  if (b.wind) metrics.push({ icon: "air", label: "Viento", value: b.wind, color: A.emerald.color });
  if (b.rain) metrics.push({ icon: "rainy", label: "Lluvia", value: b.rain, color: A.blue.color });

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

  return {
    hero: {
      kicker: b.city ? `Tu Clima · ${b.city}` : "Tu Clima",
      title: heroTitleFrom(b.condition, "Pronóstico"),
      desc: b.advice,
      icon: weatherIcon,
      accent: weatherAccent,
      artValue: b.now,
      metrics: metrics.length ? metrics.slice(0, 3) : undefined,
    },
    detail: detailTiles.length || b.advice
      ? {
          title: b.city ? `Clima · ${b.city}` : "Clima",
          subtitle: b.condition,
          sections: [
            ...adviceSection,
            ...(detailTiles.length ? [{
              kind: "tiles" as const,
              icon: "monitoring" as const,
              accent: A.emerald,
              title: "Condiciones actuales",
              subtitle: "DETALLE",
              tiles: detailTiles,
            }] : []),
            ...(b.sources?.length ? [sourcesSection(b.sources)] : []),
          ],
        }
      : undefined,
    cta: detailTiles.length || b.advice ? { label: "Ver detalle" } : undefined,
  };
}

function alarm(b: Of<"alarm">): KoruPresentation {
  const repeat = b.repeat?.trim() || "";
  const note = b.note?.trim() || "";
  const desc = [repeat ? `Se repite: ${repeat}` : null, note].filter(Boolean).join(" · ") || undefined;
  return {
    hero: {
      kicker: "Alarma",
      title: heroTitleFrom(b.title, "Alarma"),
      desc,
      icon: "alarm",
      accent: A.rose,
      artValue: b.time,
    },
    // 🔴 v2: acciones inline para alarm (sin detail screen)
    actions: [
      { label: "Apagar", icon: "alarm_off", kind: "primary", action: "dismiss" },
      { label: "Postergar 10 min", icon: "snooze", kind: "secondary", action: "snooze" },
    ],
  };
}

function reminder(b: Of<"reminder">): KoruPresentation {
  const dueText = b.dueText?.trim() || "";
  const note = b.note?.trim() || "";
  const desc = [dueText, note].filter(Boolean).join(" · ") || undefined;

  return {
    hero: {
      kicker: "Recordatorio",
      title: heroTitleFrom(b.title, "Recordatorio"),
      desc,
      icon: "notifications",
      accent: A.emerald,
      artValue: dueText || undefined,
    },
    // 🔴 v2: acciones inline para reminder
    actions: [
      { label: "Listo", icon: "check", kind: "primary", action: "complete" },
      { label: "Posponer", icon: "snooze", kind: "secondary", action: "snooze" },
    ],
  };
}

function shoppingList(b: Of<"shopping_list">): KoruPresentation {
  const items = b.items ?? [];
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
  return {
    hero: {
      kicker: "Tu Lista",
      title: heroTitleFrom(b.title, "Compras"),
      desc: b.dueText ?? `${items.length} ítems para llevar`,
      icon: "shopping_cart",
      accent: A.amber,
      metrics: metrics.length > 0 ? metrics : undefined,
    },
    detail: items.length
      ? {
          title: b.title || "Lista de compras",
          subtitle: b.dueText,
          sections: [
            {
              kind: "rows",
              icon: "shopping_cart",
              accent: A.amber,
              title: "Ítems",
              rows: items.map((it) => ({
                icon: "check_box_outline_blank",
                title: it,
                meta: b.quantities?.[it] ? `x${b.quantities[it]}` : undefined,
                badgeTone: b.checked?.includes(it) ? "done" : undefined,
                badge: b.checked?.includes(it) ? "Listo" : undefined,
              })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver lista" } : undefined,
  };
}

function comparison(b: Of<"comparison">): KoruPresentation {
  const items = b.items ?? [];
  // 🔴 FIX: identificar el item con mayor score (no hardcoded al index 0)
  const topIdx = items.reduce((best, it, i) => (it.score != null && (best === -1 || (it.score ?? 0) > (items[best].score ?? 0))) ? i : best, -1);
  return {
    hero: {
      kicker: "Tu Comparación",
      title: heroTitleFrom(b.title, "Opciones"),
      desc: b.recommendation ?? `${items.length} opciones analizadas`,
      icon: "balance",
      accent: A.pink,
      metrics: [{ icon: "format_list_numbered", label: "Opciones", value: String(items.length), color: A.pink.color }],
    },
    detail: {
      title: b.title || "Comparación",
      subtitle: (Array.isArray(b.criteria) ? b.criteria.join(" · ") : b.criteria) ?? b.recommendation,
      sections: [
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
        // 🔴 FIX: renderizar details[] (pros/cons) como rows con badges positivos/negativos
        ...(items.some(it => it.details?.length) ? [{
          kind: "rows" as const,
          icon: "fact_check" as const,
          accent: A.emerald,
          title: "Pros y Contras",
          subtitle: "DETALLE POR OPCIÓN",
          rows: items.flatMap((it) => {
            const pros = (it.details ?? []).filter(d => d.positive).map(d => ({
              icon: "check_circle",
              title: d.label,
              detail: it.title,
              badge: "Pro",
              badgeTone: "done" as const,
            }));
            const cons = (it.details ?? []).filter(d => !d.positive).map(d => ({
              icon: "cancel",
              title: d.label,
              detail: it.title,
              badge: "Contra",
              badgeTone: "urgent" as const,
            }));
            return [...pros, ...cons];
          }),
        }] : []),
        ...(b.sources?.length ? [sourcesSection(b.sources)] : []),
      ],
    },
    cta: { label: "Ver comparación" },
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
    cta: { label: isReport ? "Ver informe completo" : "Ver resultados" },
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
  return {
    hero: {
      kicker: "Tus Finanzas",
      title: heroTitleFrom(b.title, "Resumen"),
      desc,
      icon: "payments",
      accent: A.emerald,
      artValue: total,
      metrics: metrics.length > 0 ? metrics.slice(0, 3) : undefined,
    },
    detail: b.summaryItems?.length
      ? {
          title: b.title || "Resumen financiero",
          subtitle: b.recommendation,
          sections: [
            {
              kind: "tiles",
              icon: "payments",
              accent: A.emerald,
              title: "Detalle",
              tiles: b.summaryItems.map((s) => ({ label: s.label, value: s.value, color: A.emerald.color })),
            },
          ],
        }
      : undefined,
    cta: b.summaryItems?.length ? { label: "Ver detalle" } : undefined,
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
  return {
    hero: {
      kicker,
      title: heroTitleFrom(heroTitle, "Registro"),
      desc,
      icon: isLink ? "link" : "bookmark",
      accent: A.violet,
    },
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
  if (b.summary) sections.push({ kind: "text", icon: "summarize", accent: A.purple, title: "Síntesis", subtitle: "LO ESENCIAL", body: b.summary });
  if (b.findings?.length)
    sections.push({
      kind: "rows",
      icon: "check_circle",
      accent: A.purple,
      title: "Hallazgos clave",
      rows: b.findings.map((f) => ({ icon: "check_circle", title: f })),
    });
  // 🔴 v2: results con snippet + readTime + type icon (antes solo título + url)
  if (results.length)
    sections.push({
      kind: "rows",
      icon: "menu_book",
      accent: A.purple,
      title: "Fuentes",
      subtitle: `${results.length} RESULTADOS`,
      rows: results.map((r) => {
        // 🔴 v2: icono según type (article/pdf/page/description)
        const typeIcon = r.type === "pdf" ? "picture_as_pdf"
          : r.type === "article" ? "article"
          : r.type === "page" ? "language"
          : "description";
        // 🔴 v2: detail con snippet (lo más valioso) + readTime + source
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
  return {
    hero: {
      kicker: isReport ? "Tu Informe" : "Tu Búsqueda",
      title: heroTitleFrom(b.title ?? b.query, isReport ? "Investigación" : "Resultados"),
      desc: b.summary ?? (b.query ? `Resultados sobre ${b.query}` : undefined),
      icon: isReport ? "menu_book" : "travel_explore",
      accent: A.purple,
      metrics: results.length ? [{ icon: "fact_check", label: "Fuentes", value: String(results.length), color: A.purple.color }] : undefined,
    },
    detail: sections.length ? { title: b.title || (isReport ? "Informe" : "Búsqueda"), sections } : undefined,
    cta: sections.length ? { label: isReport ? "Ver informe completo" : "Ver resultados" } : undefined,
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
  if (matches.length)
    sections.push({
      kind: "scroller",
      icon: "restaurant_menu",
      accent: A.amber,
      title: L.top3Label ?? "Top coincidencias",
      cards: matches.map((m, i) => ({
        badge: i === 0 ? (b.topScore ?? topPickLabel) : undefined,
        badgeColor: i === 0 ? A.emerald.color : undefined,
        title: m.name,
        detail: m.quote,
        // 🔴 v2: métricas con rating visual (estrellas) + count de fuentes
        metrics: [
          m.rating ? `★ ${m.rating.toFixed(1)}` : "",
          m.sourcesMentioning ? `${m.sourcesMentioning} ${m.sourcesMentioning === 1 ? "fuente" : "fuentes"}` : "",
        ].filter(Boolean),
      })),
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
  if (b.synthesis) sections.push({ kind: "text", icon: "auto_awesome", accent: A.amber, title: synthesisLabel, body: b.synthesis });
  if (b.sources?.length) sections.push(sourcesSection(b.sources));

  // 🔴 v2: desc del hero más rico (mood + status)
  const heroDesc = b.synthesis ?? b.note ?? (b.mood ? `Para: ${b.mood}` : undefined);
  // 🔴 v2: kicker con status si es partial/failed
  const statusLabel = b.status === "partial" ? " · Resultados parciales" : b.status === "failed" ? " · Sin datos" : "";

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
    cta: sections.length ? { label: "Ver recomendación" } : undefined,
  };
}

function morningBrief(b: Of<"morning_brief">): KoruPresentation {
  const items = b.items ?? [];
  return {
    hero: {
      kicker: "Buenos días",
      title: heroTitleFrom(b.greeting, "Tu Resumen"),
      desc: items[0] ? `${items[0].label}: ${items[0].value}` : undefined,
      icon: "wb_sunny",
      accent: A.amber,
      metrics: items.slice(0, 3).map((it) => ({ icon: it.icon, label: it.label, value: it.value, color: it.iconColor })),
    },
    detail: items.length
      ? {
          title: "Resumen matutino",
          sections: [
            {
              kind: "tiles",
              icon: "wb_sunny",
              accent: A.amber,
              title: "Tu día",
              tiles: items.map((it) => ({ icon: it.icon, label: it.label, value: it.value, color: it.iconColor })),
            },
          ],
        }
      : undefined,
    cta: items.length > 3 ? { label: "Ver todo" } : undefined,
  };
}

function wellbeing(b: Of<"wellbeing">): KoruPresentation {
  const tiles: DetailTile[] = [];
  if (b.sleep) tiles.push({ icon: b.sleep.icon, label: b.sleep.label, value: b.sleep.value, color: A.indigo.color });
  if (b.suggestion) tiles.push({ icon: b.suggestion.icon, label: b.suggestion.label, value: b.suggestion.value, color: A.purple.color });
  (b.sections ?? []).forEach((s) => tiles.push({ icon: s.icon, label: s.label, value: s.value, color: s.iconColor }));
  return {
    hero: {
      kicker: "Tu Bienestar",
      title: heroTitleFrom(b.title, "Bienestar"),
      desc: b.suggestion?.label,
      icon: "favorite",
      accent: A.purple,
      metrics: tiles.slice(0, 3).map((t) => ({ icon: t.icon ?? "favorite", label: t.label, value: t.value, color: t.color })),
    },
    detail: tiles.length
      ? { title: b.title || "Bienestar", sections: [{ kind: "tiles", icon: "favorite", accent: A.purple, title: "Detalle", tiles }] }
      : undefined,
    cta: tiles.length ? { label: "Ver detalle" } : undefined,
  };
}

function liveMatch(b: Of<"live_match">): KoruPresentation {
  const homeName = clean(b.homeName) ?? clean(b.homeTeam?.name) ?? "Local";
  const awayName = clean(b.awayName) ?? clean(b.awayTeam?.name) ?? "Visitante";
  const homeScore = b.homeScore ?? b.homeTeam?.score ?? 0;
  const awayScore = b.awayScore ?? b.awayTeam?.score ?? 0;
  const score = `${homeScore} - ${awayScore}`;
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
    },
    detail,
    cta: hasRichData || b.stats?.length ? { label: hasRichData ? "Ver partido completo" : "Ver estadísticas" } : undefined,
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
  };
}

function market(b: Of<"market">): KoruPresentation {
  const assets = b.assets ?? [];
  const first = assets[0];
  return {
    hero: {
      kicker: "Mercados",
      title: heroTitleFrom(b.title ?? first?.symbol, "Mercado"),
      desc: first ? `${first.name} · ${first.change}` : undefined,
      icon: "trending_up",
      accent: A.emerald,
      artValue: first?.price,
      metrics: assets.slice(0, 3).map((a) => ({
        icon: a.changeUp ? "trending_up" : "trending_down",
        label: a.symbol,
        value: a.change,
        color: a.changeUp ? A.emerald.color : A.red.color,
      })),
    },
    detail: assets.length
      ? {
          title: b.title || "Mercados",
          sections: [
            {
              kind: "rows",
              icon: "trending_up",
              accent: A.emerald,
              title: "Activos",
              rows: assets.map((a) => ({ title: a.name, detail: a.price, meta: a.change, badgeTone: a.changeUp ? "done" : "urgent" })),
            },
          ],
        }
      : undefined,
    cta: assets.length ? { label: "Ver mercados" } : undefined,
  };
}

function delivery(b: Of<"delivery">): KoruPresentation {
  const steps = b.steps ?? [];
  return {
    hero: {
      kicker: "Tu Envío",
      title: heroTitleFrom(b.title, "Paquete"),
      desc: [b.status, b.estimatedDate].filter(Boolean).join(" · "),
      icon: "local_shipping",
      accent: A.indigo,
    },
    detail: steps.length
      ? {
          title: b.title || "Envío",
          subtitle: [b.carrier, b.trackingId].filter(Boolean).join(" · "),
          sections: [
            {
              kind: "timeline",
              icon: "local_shipping",
              accent: A.indigo,
              title: "Seguimiento",
              steps: steps.map((s) => ({ title: s.label, status: s.done ? "done" : "pending" })),
            },
          ],
        }
      : undefined,
    cta: steps.length ? { label: "Ver seguimiento" } : undefined,
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
  };
}

function travelPlanner(b: Of<"travel_planner">): KoruPresentation {
  const steps = b.steps ?? [];
  return {
    hero: {
      kicker: "Tu Viaje",
      title: heroTitleFrom(b.destination, "Itinerario"),
      desc: b.dates,
      icon: "flight_takeoff",
      accent: A.sky,
      metrics: steps.length ? [{ icon: "route", label: "Paradas", value: String(steps.length), color: A.sky.color }] : undefined,
    },
    detail: steps.length
      ? {
          title: b.destination || "Itinerario",
          subtitle: b.dates,
          sections: [
            {
              kind: "timeline",
              icon: "flight_takeoff",
              accent: A.sky,
              title: "Itinerario",
              steps: steps.map((s) => ({ icon: s.icon, title: s.label, detail: [s.time, s.detail].filter(Boolean).join(" · ") })),
            },
          ],
        }
      : undefined,
    cta: steps.length ? { label: b.actionLabel || "Ver itinerario" } : undefined,
  };
}

function generation(b: Of<"generation">): KoruPresentation {
  const kickerByType: Record<string, string> = { text: "Tu Texto", image: "Tu Imagen", code: "Tu Código", document: "Tu Documento" };
  return {
    hero: {
      kicker: kickerByType[b.resultType ?? "text"] ?? "Generado",
      title: heroTitleFrom(b.title, "Resultado"),
      desc: b.prompt,
      icon: b.resultType === "code" ? "code" : b.resultType === "image" ? "image" : "auto_awesome",
      accent: A.violet,
    },
    detail: b.preview
      ? {
          title: b.title || "Resultado",
          sections: [{ kind: "text", icon: "auto_awesome", accent: A.violet, title: "Vista previa", body: b.preview }],
        }
      : undefined,
    cta: b.preview ? { label: b.actionLabel || "Ver resultado" } : undefined,
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
  return {
    hero: {
      kicker: "Escrutinio",
      title: heroTitleFrom(b.title, "Elecciones"),
      desc: b.status ?? (leader ? `${leader.name}: ${leader.percent}` : undefined),
      icon: "how_to_vote",
      accent: A.amber,
    },
    detail: items.length
      ? {
          title: b.title || "Resultados",
          subtitle: b.status,
          sections: [
            {
              kind: "rows",
              icon: "how_to_vote",
              accent: A.amber,
              title: "Candidatos",
              rows: items.map((it) => ({
                title: it.name,
                detail: it.detail,
                meta: it.percent,
                badge: it.done ? "Ganador" : "Pendiente",
                badgeTone: it.done ? "done" : "pending",
                bar: it.percent != null ? {
                  homeValue: parseFloat(String(it.percent).replace("%", "")) || 0,
                  awayValue: 100 - (parseFloat(String(it.percent).replace("%", "")) || 0),
                  isPercent: true,
                  homeColor: it.color,
                  awayColor: "#e3e8e5",
                } : undefined,
              })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver escrutinio" } : undefined,
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
    cta: sections.length ? { label: "Ver análisis" } : undefined,
  };
}

function memoryBlock(b: Of<"memory">): KoruPresentation {
  const items = b.items ?? [];
  const sections: DetailSection[] = [];

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

  return {
    hero: {
      kicker: "Memoria",
      title: heroTitleFrom(b.title, items[0]?.title ?? "Contexto"),
      desc: b.note ?? items[0]?.detail,
      icon: "psychology",
      accent: A.violet,
      metrics: items.length
        ? [
            { icon: "memory", label: "Ítems", value: String(items.length), color: A.violet.color },
            ...(items[0]?.domain ? [{ icon: "label", label: "Dominio", value: items[0].domain, color: A.primary.color }] : []),
          ].slice(0, 3)
        : undefined,
    },
    detail: sections.length
      ? {
          title: b.title || "Memoria",
          subtitle: items.length ? `${items.length} recuerdos activos` : undefined,
          sections,
        }
      : undefined,
    cta: sections.length ? { label: "Ver memoria" } : undefined,
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
  return {
    hero: {
      kicker: "Tu Portafolio",
      title: heroTitleFrom(b.title, "Cripto"),
      desc: items[0] ? `${items[0].name} · ${items[0].price}` : undefined,
      icon: "currency_bitcoin",
      accent: A.amber,
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
    detail: items.length
      ? {
          title: "Tu Portafolio",
          subtitle: `${items.length} activo${items.length > 1 ? "s" : ""} · cambio promedio ${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(1)}%`,
          sections: [
            {
              kind: "rows",
              icon: "currency_bitcoin",
              accent: A.amber,
              title: "Activos",
              rows: items.map((it) => ({
                // 🔴 FIX: usar char (icon) y color del coin si están disponibles
                icon: it.char || "currency_bitcoin",
                title: it.name,
                detail: it.price,
                meta: `${it.change >= 0 ? "+" : ""}${it.change}%`,
                badge: it.change >= 0 ? "Sube" : "Baja",
                badgeTone: it.change >= 0 ? "done" : "urgent",
              })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver portafolio" } : undefined,
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
  return {
    hero: {
      kicker: "Tu Mapa",
      title: heroTitleFrom(b.to, "Ruta"),
      desc: [b.from && `Desde ${b.from}`, b.distance, b.remaining && `${b.remaining} restante`].filter(Boolean).join(" · "),
      icon: "map",
      accent: A.indigo,
      artValue: progressPct != null ? `${progressPct}%` : undefined,
      metrics: [
        ...(b.distance ? [{ icon: "straighten", label: "Distancia", value: b.distance, color: A.indigo.color }] : []),
        ...(progressPct != null ? [{ icon: "near_me", label: "Progreso", value: `${progressPct}%`, color: A.emerald.color }] : []),
      ].slice(0, 3),
    },
    detail: {
      title: b.to ? `Ruta a ${b.to}` : "Ruta",
      subtitle: b.from ? `DESDE ${b.from.toUpperCase()}` : undefined,
      sections: [
        {
          kind: "rows",
          icon: "directions",
          accent: A.indigo,
          title: "Detalle del viaje",
          rows: [
            ...(b.from ? [{ icon: "trip_origin", title: b.from, detail: "ORIGEN" }] : []),
            ...(b.to ? [{ icon: "location_on", title: b.to, detail: "DESTINO" }] : []),
            ...(b.distance ? [{ icon: "straighten", title: b.distance, detail: "DISTANCIA TOTAL" }] : []),
            ...(b.remaining ? [{ icon: "flag", title: b.remaining, detail: "RESTANTE" }] : []),
            ...(progressPct != null ? [{ icon: "near_me", title: `${progressPct}% completado`, detail: "PROGRESO", badge: progressPct >= 80 ? "Casi listo" : undefined, badgeTone: progressPct >= 80 ? "done" as const : "current" as const }] : []),
          ],
        },
      ],
    },
    cta: b.to ? { label: "Ver detalle" } : undefined,
  };
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

  return {
    hero: {
      kicker: "Calendario",
      title: heroTitleFrom(month, "Calendario"),
      desc: highlightedDay ? `Día destacado: ${highlightedDay}` : undefined,
      icon: "calendar_month",
      accent: A.pink,
      artValue: highlightedDay ? String(highlightedDay) : undefined,
      metrics: [
        { icon: "event", label: "Mes", value: month, color: A.pink.color },
        { icon: "cake", label: "Día", value: highlightedDay ? String(highlightedDay) : "—", color: A.amber.color },
      ],
    },
    detail: {
      title: `Calendario · ${month}`,
      subtitle: highlightedDay ? `DÍA DESTACADO: ${highlightedDay}` : undefined,
      sections: [
        {
          kind: "chips",
          icon: "calendar_month",
          accent: A.pink,
          title: "Calendario del mes",
          subtitle: `${daysInMonth} DÍAS`,
          // 🔴 Usamos chips para simular el grid — cada chip es un día
          // El renderer de chips los pone en flex-wrap, lo que da el efecto de calendario
          chips: days.map((d) => ({
            label: d.day ? String(d.day) : "·",
            color: d.highlighted ? A.pink.color : undefined,
            sub: d.highlighted ? "★" : undefined,
          })),
        },
      ],
    },
    cta: { label: "Ver calendario" },
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
              rows: items.map((it) => ({
                icon: it.checked ? "check_box" : "check_box_outline_blank",
                title: it.label,
                badge: it.checked ? "Listo" : undefined,
                badgeTone: it.checked ? "done" : undefined,
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
      metrics: metrics.length > 0 ? metrics : undefined,
    },
    detail: items.length
      ? {
          title: b.title || "Tu Plan",
          subtitle: `${items.length} PASO${items.length > 1 ? "S" : ""} ORDENADOS`,
          sections: [
            {
              kind: "timeline",
              icon: "route",
              accent: A.violet,
              title: "Pasos",
              steps: items.map((it) => ({
                // 🔴 FIX: icono específico del paso (no genérico route)
                icon: it.icon || "schedule",
                title: it.title,
                detail: [
                  it.time,
                  it.durationMinutes ? `${it.durationMinutes} min` : null,
                  it.priority,
                  it.mode ? `· ${it.mode}` : null,
                ].filter(Boolean).join(" · "),
                // 🔴 FIX: status basado en done (no siempre "done")
                status: it.done ? "done" : "current",
                // 🔴 FIX: badge con priority (Alta/Media/Baja)
                badge: it.priority,
                badgeTone: it.priority === "Alta" ? "urgent" : it.priority === "Media" ? "current" : "pending",
              })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver plan completo" } : undefined,
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
    cta: { label: b.videoUrl ? "Ver video y receta completa" : "Ver receta completa" },
  };
}

function movieReviewBlock(b: Of<"movie_review">): KoruPresentation {
  const cast = b.cast ?? [];
  const genres = b.genres ?? [];
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

  if (b.whereToWatch && b.whereToWatch.length > 0) {
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
    cta: { label: b.trailerUrl ? "Ver trailer y ficha completa" : "Ver ficha completa" },
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
    cta: { label: "Ver ficha completa" },
  };
}