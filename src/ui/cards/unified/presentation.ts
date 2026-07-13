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
};
export type DetailSourceRef = { title: string; domain?: string; url?: string; imageUrl?: string };

export type DetailSection =
  | { kind: "text"; icon: string; accent: Accent; title: string; subtitle?: string; body: string }
  | { kind: "tiles"; icon: string; accent: Accent; title: string; subtitle?: string; tiles: DetailTile[] }
  | { kind: "rows"; icon: string; accent: Accent; title: string; subtitle?: string; rows: DetailRow[] }
  | { kind: "chips"; icon: string; accent: Accent; title: string; subtitle?: string; chips: DetailChip[] }
  | { kind: "scroller"; icon: string; accent: Accent; title: string; subtitle?: string; cards: DetailScrollCard[] }
  | { kind: "timeline"; icon: string; accent: Accent; title: string; subtitle?: string; steps: DetailStep[] }
  | { kind: "sources"; icon: string; accent: Accent; title: string; subtitle?: string; sources: DetailSourceRef[] };

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
      art: "/stitch/plan-illustration.png",
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
  const metrics: HeroMetric[] = [];
  if (b.humidity) metrics.push({ icon: "water_drop", label: "Humedad", value: b.humidity, color: A.primary.color });
  if (b.wind) metrics.push({ icon: "air", label: "Viento", value: b.wind, color: A.emerald.color });
  if (b.range) metrics.push({ icon: "device_thermostat", label: "Mín / Máx", value: b.range, color: A.amber.color });
  else if (b.rain) metrics.push({ icon: "rainy", label: "Lluvia", value: b.rain, color: A.blue.color });

  const detailTiles: DetailTile[] = [];
  if (b.rain) detailTiles.push({ icon: "rainy", label: "Prob. lluvia", value: b.rain, color: A.primary.color });
  if (b.uv) detailTiles.push({ icon: "light_mode", label: "Índice UV", value: b.uv, color: A.amber.color });
  if (b.wind) detailTiles.push({ icon: "air", label: "Viento", value: b.wind, color: A.emerald.color });
  if (b.humidity) detailTiles.push({ icon: "water_drop", label: "Humedad", value: b.humidity, color: A.blue.color });
  if (b.feel) detailTiles.push({ icon: "thermostat", label: "Sensación", value: b.feel, color: A.rose.color });

  return {
    hero: {
      kicker: b.city ? `Tu Clima · ${b.city}` : "Tu Clima",
      title: heroTitleFrom(b.condition, "Pronóstico"),
      desc: b.advice,
      icon: "partly_cloudy_day",
      accent: A.primary,
      artValue: b.now,
      metrics: metrics.length ? metrics : undefined,
    },
    detail: detailTiles.length
      ? {
          title: b.city ? `Clima · ${b.city}` : "Clima",
          subtitle: b.condition,
          sections: [
            { kind: "tiles", icon: "monitoring", accent: A.emerald, title: "Detalles", subtitle: "CONDICIONES", tiles: detailTiles },
            ...(b.sources?.length ? [sourcesSection(b.sources)] : []),
          ],
        }
      : undefined,
    cta: detailTiles.length ? { label: "Ver detalle" } : undefined,
  };
}

function alarm(b: Of<"alarm">): KoruPresentation {
  return {
    hero: {
      kicker: "Tu Alarma",
      title: heroTitleFrom(b.title, "Alarma"),
      desc: b.repeat ? `Se repite: ${b.repeat}${b.note ? ` · ${b.note}` : ""}` : b.note,
      icon: "alarm",
      accent: A.rose,
      artValue: b.time,
    },
  };
}

function reminder(b: Of<"reminder">): KoruPresentation {
  return {
    hero: {
      kicker: "Tu Recordatorio",
      title: heroTitleFrom(b.title, "Recordatorio"),
      desc: b.dueText ? `${b.dueText}${b.note ? ` · ${b.note}` : ""}` : b.note,
      icon: "notifications",
      accent: A.emerald,
    },
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
      subtitle: b.recommendation,
      sections: [
        {
          kind: "scroller",
          icon: "balance",
          accent: A.pink,
          title: "Opciones",
          subtitle: items.length ? `${items.length} ANALIZADAS` : undefined,
          cards: items.map((it, i) => ({
            badge: i === 0 ? "Recomendado" : undefined,
            badgeColor: i === 0 ? A.emerald.color : undefined,
            title: it.title,
            detail: [it.price, it.vendor].filter(Boolean).join(" · ") || undefined,
            metrics: [it.evidence].filter((x): x is string => Boolean(x)),
          })),
        },
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
  if (results.length)
    sections.push({
      kind: "sources",
      icon: "menu_book",
      accent: A.purple,
      title: "Fuentes",
      subtitle: "CONTRASTADAS",
      sources: results.map((r) => ({ title: r.title, domain: r.source, url: r.url })),
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
          title: b.title || "Datos",
          sections: [
            {
              kind: "rows",
              icon: "verified",
              accent: A.emerald,
              title: "Datos verificados",
              rows: items.map((it) => ({ title: it.label, detail: it.value, meta: it.sourceDomain })),
            },
          ],
        }
      : undefined,
    cta: items.length > 3 ? { label: "Ver todos" } : undefined,
  };
}

function restaurant(b: Of<"restaurant_synthesis">): KoruPresentation {
  const matches = b.matches ?? [];
  const sections: DetailSection[] = [];
  if (matches.length)
    sections.push({
      kind: "scroller",
      icon: "restaurant_menu",
      accent: A.amber,
      title: "Top coincidencias",
      cards: matches.map((m, i) => ({
        badge: i === 0 ? b.topScore ?? "Top" : undefined,
        badgeColor: i === 0 ? A.emerald.color : undefined,
        title: m.name,
        detail: m.quote,
        metrics: [`${m.sourcesMentioning} fuentes`, m.rating ? `★ ${m.rating}` : ""].filter(Boolean),
      })),
    });
  if (b.pros?.length || b.cons?.length)
    sections.push({
      kind: "rows",
      icon: "thumbs_up_down",
      accent: A.amber,
      title: "Pros y contras",
      rows: [
        ...(b.pros ?? []).map((p) => ({ icon: "add_circle", title: p, badgeTone: "done" as const })),
        ...(b.cons ?? []).map((c) => ({ icon: "remove_circle", title: c, badgeTone: "urgent" as const })),
      ],
    });
  if (b.synthesis) sections.push({ kind: "text", icon: "auto_awesome", accent: A.amber, title: "Síntesis", body: b.synthesis });
  if (b.sources?.length) sections.push(sourcesSection(b.sources));
  return {
    hero: {
      kicker: "Tu Recomendación",
      title: heroTitleFrom(b.title ?? b.query, "Restaurantes"),
      desc: b.synthesis ?? b.note,
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
  // Preferir nombres completos (homeName/awayName) sobre abreviaturas.
  // Las abreviaturas (SPA, BEL) son útiles solo en scoreboards compactos;
  // en una card hero, el usuario necesita saber quiénes juegan.
  const homeName = clean(b.homeName) ?? clean(b.homeTeam?.name) ?? "Local";
  const awayName = clean(b.awayName) ?? clean(b.awayTeam?.name) ?? "Visitante";
  const homeScore = b.homeScore ?? b.homeTeam?.score ?? 0;
  const awayScore = b.awayScore ?? b.awayTeam?.score ?? 0;
  const score = `${homeScore} - ${awayScore}`;
  // Título: "Spain vs Belgium" (nombres completos, no abreviaturas)
  const title = `${homeName} vs ${awayName}`;
  // Kicker: liga + estado. Si no hay liga, solo estado.
  const league = clean(b.league);
  const status = clean(b.status);
  const live = /in progress|live|halftime|en vivo/i.test(status);
  const kickerParts: string[] = [];
  if (live) kickerParts.push("En vivo");
  if (league) kickerParts.push(league);
  if (!live && status && status.toLowerCase() !== "scheduled") kickerParts.push(status);
  const kicker = kickerParts.length > 0 ? kickerParts.join(" · ") : "Partido";
  // Desc: si está scheduled, mostrar fecha/hora. Si está final, mostrar "Final".
  // Si está en vivo, mostrar minuto.
  const desc = live ? (b.minute ? `Minuto ${b.minute}` : "En juego")
    : status && /scheduled|programado/i.test(status) ? "Próximamente"
    : status ?? "Final";
  // Metrics: stats del partido (posesión, tiros) si existen.
  const metrics: HeroMetric[] = [];
  if (b.stats && b.stats.length > 0) {
    for (const s of b.stats.slice(0, 2)) {
      const left = s.leftPercent ?? 0;
      const right = s.rightPercent ?? 0;
      const total = left + right;
      const value = total > 0 ? `${left}% - ${right}%` : "—";
      metrics.push({ icon: s.label === "Posesion" ? "sports_soccer" : "crisis_alert", label: s.label, value, color: A.emerald.color });
    }
  }
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
    detail: b.stats?.length
      ? {
          title: title,
          subtitle: league ?? kicker,
          sections: [
            {
              kind: "rows",
              icon: "monitoring",
              accent: A.emerald,
              title: "Estadísticas",
              rows: b.stats.map((s) => ({ title: s.label, detail: `${s.leftPercent}% — ${s.rightPercent}%` })),
            },
          ],
        }
      : undefined,
    cta: b.stats?.length ? { label: "Ver estadísticas" } : undefined,
  };
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
  return {
    hero: {
      kicker: "Fixture · En vivo",
      title: "PARTIDO",
      desc: now ? `${now.minute}' ${now.text}` : undefined,
      icon: "sports",
      accent: A.emerald,
    },
    detail: items.length
      ? {
          title: "Timeline",
          sections: [
            {
              kind: "timeline",
              icon: "sports",
              accent: A.emerald,
              title: "Eventos",
              steps: items.map((i) => ({ title: `${i.minute}' ${i.text}`, detail: i.sub, status: i.now ? "current" : "done" })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver timeline" } : undefined,
  };
}

function matchStats(b: Of<"match_stats">): KoruPresentation {
  const stats = b.stats ?? [];
  return {
    hero: {
      kicker: "Estadísticas",
      title: "PARTIDO",
      desc: stats[0] ? `${stats[0].label}: ${stats[0].home} — ${stats[0].away}` : undefined,
      icon: "monitoring",
      accent: A.primary,
    },
    detail: stats.length
      ? {
          title: "Estadísticas",
          sections: [
            {
              kind: "rows",
              icon: "monitoring",
              accent: A.primary,
              title: "Comparativa",
              rows: stats.map((s) => ({ title: s.label, detail: `${s.home} — ${s.away}` })),
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
              rows: items.map((it) => ({ title: it.name, detail: it.detail, meta: it.percent, badgeTone: it.done ? "done" : "pending" })),
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
  return {
    hero: {
      kicker: "Resumen",
      title: "DATOS",
      desc: b.alert ?? (items[0] ? `${items[0].label}: ${items[0].value}` : undefined),
      icon: "insights",
      accent: A.primary,
      metrics: items.slice(0, 3).map((it) => ({ icon: "insights", label: it.label, value: it.value, color: A.primary.color })),
    },
    detail: items.length
      ? {
          title: "Resumen",
          sections: [
            {
              kind: "rows",
              icon: "insights",
              accent: A.primary,
              title: "Datos",
              rows: items.map((it) => ({ title: it.label, detail: it.value, badgeTone: it.highlight ? "done" : undefined })),
            },
          ],
        }
      : undefined,
    cta: items.length ? { label: "Ver datos" } : undefined,
  };
}

function cryptoPortfolio(b: Of<"crypto_portfolio">): KoruPresentation {
  const items = b.items ?? [];
  return {
    hero: {
      kicker: "Mercados",
      title: "CRIPTO",
      desc: items[0] ? `${items[0].name} · ${items[0].price}` : undefined,
      icon: "currency_bitcoin",
      accent: A.amber,
      metrics: items.slice(0, 3).map((it) => ({
        icon: it.change >= 0 ? "trending_up" : "trending_down",
        label: it.symbol,
        value: `${it.change >= 0 ? "+" : ""}${it.change}%`,
        color: it.change >= 0 ? A.emerald.color : A.red.color,
      })),
    },
    detail: items.length
      ? {
          title: "Portafolio",
          sections: [
            {
              kind: "rows",
              icon: "currency_bitcoin",
              accent: A.amber,
              title: "Activos",
              rows: items.map((it) => ({ title: it.name, detail: it.price, meta: `${it.change >= 0 ? "+" : ""}${it.change}%`, badgeTone: it.change >= 0 ? "done" : "urgent" })),
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
      kicker: "Forex",
      title: "DIVISAS",
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
  return {
    hero: {
      kicker: "Tu Mapa",
      title: b.to ? up(b.to) : "RUTA",
      desc: [b.from && `Desde ${b.from}`, b.distance, b.remaining && `${b.remaining} restante`].filter(Boolean).join(" · "),
      icon: "map",
      accent: A.indigo,
      metrics: b.progress != null ? [{ icon: "near_me", label: "Progreso", value: `${b.progress}%`, color: A.indigo.color }] : undefined,
    },
  };
}

function birthdayCalendar(b: Of<"birthday_calendar">): KoruPresentation {
  return {
    hero: {
      kicker: "Calendario",
      title: b.month ? up(b.month) : "CALENDARIO",
      desc: b.highlightedDay ? `Día destacado: ${b.highlightedDay}` : undefined,
      icon: "calendar_month",
      accent: A.pink,
    },
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
      kicker: "Tu Outfit",
      title: "LOOK DEL DÍA",
      desc: specs[0] ? `${specs[0].label}: ${specs[0].value}` : undefined,
      icon: "checkroom",
      accent: A.amber,
      metrics: specs.slice(0, 3).map((s) => ({ icon: "styler", label: s.label, value: s.value, color: A.amber.color })),
    },
    detail: specs.length
      ? {
          title: "Outfit",
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
    cta: specs.length ? { label: b.buttonLabel || "Ver outfit" } : undefined,
  };
}

function reviewScore(b: Of<"review_score">): KoruPresentation {
  const items = b.items ?? [];
  return {
    hero: {
      kicker: "Tu Review",
      title: "PUNTAJES",
      desc: items[0] ? `${items[0].label}: ${items[0].score}` : undefined,
      icon: "reviews",
      accent: A.violet,
      metrics: items.slice(0, 3).map((it) => ({ icon: "star", label: it.label, value: it.score, color: it.color })),
    },
    detail: items.length
      ? {
          title: "Review",
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
    cta: items.length ? { label: b.buttonLabel || "Ver review" } : undefined,
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
          sections: [
            {
              kind: "timeline",
              icon: "route",
              accent: A.violet,
              title: "Pasos",
              steps: items.map((it) => ({ title: it.title, detail: [it.time, it.rationale].filter(Boolean).join(" · ") })),
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
  if (cast.length > 0) tiles.push({ label: "Reparto", value: cast.join(", "), color: A.purple.color });
  if (tiles.length > 0) {
    sections.push({
      kind: "tiles",
      icon: "movie",
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