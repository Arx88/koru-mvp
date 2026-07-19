export type KoruStage = "seed" | "sprout" | "roots" | "born" | "garden";

export type MemorySensitivity = "normal" | "sensitive";

export type MemoryStatus = "candidate" | "confirmed" | "rejected" | "archived" | "superseded";

/**
 * 🔴 P2 — Memory edit history.
 * Cada vez que el texto de una memoria se modifica (manualmente o por
 * reversión desde el Historial), el valor anterior se preserva acá para
 * mostrar un timeline con diff visual y permitir revertir.
 */
export type MemoryEditHistoryEntry = {
  timestamp: string;
  field: "text" | "status" | "confidence" | "kind";
  before: string;
  after: string;
};

export type MemoryKind =
  | "profile"
  | "routine"
  | "preference"
  | "goal"
  | "relationship"
  | "boundary"
  | "retail"
  | "wellbeing"
  | "task";

export type MascotState =
  | "idle"
  | "thinking"
  | "working"
  | "happy"
  | "tired"
  | "sleeping"
  | "mistake"
  | "planning"
  | "product-search"
  | "building"
  | "cooking"
  | "thinking-2"
  | "celebrating"
  | "worried"
  | "affectionate"
  | "curious";

export const VALID_MASCOT_STATES: MascotState[] = [
  "idle", "thinking", "working", "happy", "tired", "sleeping",
  "mistake", "planning", "product-search", "building", "cooking",
  "thinking-2", "celebrating", "worried", "affectionate", "curious",
];

export type RelevantMemory = {
  text: string;
  kind: MemoryKind;
  confidence: number;
};

export type LifeDomain =
  | "morning"
  | "work"
  | "money"
  | "health"
  | "relationship"
  | "home"
  | "interest"
  | "capture";

export type LifeRecordKind =
  | "expense"
  | "medication"
  | "meal_inventory"
  | "tool_link"
  | "meeting_note"
  | "deadline"
  | "person_followup"
  | "gift"
  | "birthday"
  | "home_task"
  | "shopping_item"
  | "idea"
  | "recommendation"
  | "medical_info"
  | "sleep"
  | "decision";

export type LifeRecord = {
  id: string;
  domain: LifeDomain;
  kind: LifeRecordKind;
  title: string;
  value?: string;
  amount?: number;
  currency?: string;
  person?: string;
  url?: string;
  collection?: string;
  dueHint?: string;
  happenedAt?: string;
  notes?: string;
  tags?: string[];
  attachments?: Attachment[];
  createdAt: string;
  sourceEntryId: string;
  /** 🔴 v2: persistir el bloque original para poder reabrir el informe rico */
  sourceBlock?: UiBlock;
};

export type MemoryFact = {
  id: string;
  kind: MemoryKind;
  text: string;
  confidence: number;
  sensitivity: MemorySensitivity;
  status: MemoryStatus;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
  rootQuote?: string;
  useForSuggestions?: boolean;
  embedding?: number[];
  embeddingModel?: string;
  sourceEntryId: string;
  // 🔴 P2 — edit history con diff. Se appendea en updateMemoryText y se
  // consume desde SettingsScreen ("Historial" expandable en cada MemoryRow).
  editHistory?: MemoryEditHistoryEntry[];
};

export type CommitmentStatus = "open" | "done" | "dismissed";

export type Commitment = {
  id: string;
  title: string;
  dueHint: string;
  dueAt?: string;
  recurrence?: "daily" | "weekly" | "monthly";
  remindedAt?: string;
  status: CommitmentStatus;
  createdAt: string;
  sourceEntryId: string;
};

export type DailyEntry = {
  id: string;
  text: string;
  createdAt: string;
  summary: string;
  transcriptSource: "typed" | "speech";
  energyAwarded: number;
  sentiment: "calm" | "heavy" | "busy" | "good";
  memoryIds: string[];
  commitmentIds: string[];
  actionIds: string[];
  recordIds: string[];
  activeMemoryIds: string[];
  brainProvider: BrainProvider;
  brainModel?: string;
};

export type EnergyEvent = {
  id: string;
  createdAt: string;
  source: string;
  points: number;
  explanation: string;
};

export type ProactiveNudge = {
  id: string;
  title: string;
  body: string;
  reason: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
  source?: "brain" | "heartbeat" | "calendar" | "commitment";
  sourceId?: string;
  dismissed?: boolean;
};

export type CalendarAttendee = {
  name: string;
  email: string;
  status: "confirmed" | "tentative" | "declined";
  role?: string;
};

export type CalendarAgendaItem = {
  time: string;
  label: string;
  durationMin: number;
};

export type CalendarMeetingLink = {
  provider: "zoom" | "meet" | "teams";
  url: string;
  meetingId?: string;
  passcode?: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  source: "manual" | "ics" | "google";
  sourceRef?: string;
  createdAt: string;
  /** Asistentes con estado RSVP (principalmente desde Google Calendar). */
  attendees?: CalendarAttendee[];
  /** Agenda preliminar opcional (bloques de tiempo dentro del evento). */
  agenda?: CalendarAgendaItem[];
  /** Link de reunión parseado desde location/description (Zoom, Meet, Teams). */
  meetingLink?: CalendarMeetingLink;
};

export type HeartbeatSettings = {
  enabled: boolean;
  activeStartHour: number;
  activeEndHour: number;
  maxNudgesPerDay: number;
  lastRunAt?: string;
  dailyNudgeDate?: string;
  dailyNudgeCount: number;
};

export type ModelCall = {
  id: string;
  createdAt: string;
  taskType: "reflection_analysis" | "embedding" | "connection_test";
  provider: BrainProvider;
  model?: string;
  success: boolean;
  latencyMs: number;
  summary: string;
  error?: string;
};

export type VoicePreference = {
  warmth: number;
  directness: number;
  humor: number;
  detail: number;
  proactivity: number;
};

export type RuntimeSettings = {
  freeLlmApiBaseUrl: string;
  freeLlmApiKey: string;
  freeLlmApiModel: string;
  freeLlmApiEnabled: boolean;
  embeddingsEnabled: boolean;
  openModelBaseUrl: string;
  openModelApiKey: string;
  openModelModel: string;
  openModelEnabled: boolean;
};

export type BrainProvider = "local" | "freellmapi" | "open-model" | "nvidia" | "openrouter" | "minimax" | "bluesminds";

export type ContextReviewItem = {
  title: string;
  detail: string;
  source: "commitment" | "memory" | "calendar" | "recent" | "nudge" | "record";
  priority: "Alta" | "Media" | "Baja";
};

export type AssistantActionKind =
  | "draft_message"
  | "calendar_event"
  | "alarm"
  | "reminder"
  | "restock_note"
  | "daily_brief"
  | "day_plan"
  | "file_bundle"
  | "web_research"
  | "world_signal"
  | "clarifying_question"
  | "structured_note"
  | "money_summary"
  | "morning_brief"
  | "meeting_brief"
  | "decision_support";

export type AssistantArtifact = {
  name: string;
  kind: "document" | "spreadsheet" | "presentation" | "text" | "markdown" | "csv";
  mimeType: string;
  sizeLabel: string;
  content?: string;
};

export type AssistantSource = {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  content?: string;
  /** 🔴 P2.2: URL de imagen principal extraída de la página (og:image, hero img, etc.) */
  imageUrl?: string;
};

export type AssistantPlanItem = {
  time?: string;
  title: string;
  priority?: "Alta" | "Media" | "Baja";
  icon?: "flag" | "book" | "move" | "message" | "calendar" | "money" | "heart" | "home";
  durationMinutes?: number;
  mode?: "focus" | "quick" | "admin" | "recovery";
  rationale?: string;
  done?: boolean;
  detail?: string;
  timeEstimate?: string;
};

export type SemanticIntent = {
  domain:
    | "chat"
    | "morning"
    | "work"
    | "money"
    | "health"
    | "home"
    | "relationship"
    | "interest"
    | "research"
    | "planning"
    | "calendar";
  kind: string;
  confidence: number;
  slots?: Record<string, unknown>;
  needsTool?: boolean;
};

export type ToolCall = {
  id?: string;
  tool:
    | "weather"
    | "web_search"
    | "deep_research"
    | "shopping_compare"
    | "route_traffic"
    | "calendar_reminder"
    | "alarm"
    | "money_summary"
    | "memory_recall"
    | "match_live"
    | "crypto_price";
  args: Record<string, unknown>;
  reason?: string;
};

export type ToolResult = {
  id: string;
  tool: ToolCall["tool"];
  status: "ok" | "partial" | "failed" | "needs_context";
  summary: string;
  data?: Record<string, unknown>;
  sources?: AssistantSource[];
};

export type ToolRisk = "readonly" | "local_write" | "external_side_effect" | "financial" | "destructive";

export type ToolPolicy = {
  requiresApproval: boolean;
  autoRun: boolean;
  risk: ToolRisk;
  reason: string;
};

export type RouterResult = {
  intent: SemanticIntent;
  missingContext?: Array<{ slot: string; question: string }>;
  toolCalls: ToolCall[];
  directReply?: string;
  directUiBlocks?: UiBlock[];
  forceLocal?: boolean;
};

export type ComposerResult = {
  reply: string;
  uiBlocks: UiBlock[];
};

export type KoruTurnResult = {
  reply: string;
  intent: SemanticIntent;
  uiBlocks: UiBlock[];
  toolCalls: ToolCall[];
  executedToolCalls: ToolCall[];
  pendingToolCalls: ToolCall[];
  toolResults: ToolResult[];
  model?: string;
  fallbackReason?: string;
  mascotState?: MascotState;
};

export type UiBlock =
  | {
      /**
       * ENTREGABLE — el bloque estrella de Koru. Todo resultado de peso
       * (informe, investigación, análisis) llega en esta forma única:
       * hoja Stitch (kicker → título → descripción → categorías → CTA) que
       * abre la pantalla de detalle con módulos. Mientras status = "working"
       * la UI muestra el panel "Trabajando en tu {kicker}" con progreso REAL.
       */
      type: "deliverable";
      status: "working" | "ready";
      /** "Tu Informe", "Tu Plan", "Tu Análisis"... */
      kicker: string;
      /** Título corto en mayúsculas de la hoja (ej: "AGE OF EMPIRES II"). */
      title: string;
      /** Bajada de 1-2 líneas con lo esencial. */
      description?: string;
      /** Tema pedido por el usuario (para historial y re-búsquedas). */
      topic?: string;
      /** Progreso real del pipeline 0..100 (solo con status working). */
      progress?: number;
      /** Etiqueta de la fase actual ("Buscando fuentes 2/4…"). */
      phaseLabel?: string;
      /** Hasta 3 categorías del contenido (icono Material Symbols + label). */
      categories?: Array<{ icon: string; label: string; color?: string }>;
      /** Hasta 3 métricas destacadas (valor grande + label chico). */
      metrics?: Array<{ value: string; label: string }>;
      /** Síntesis narrativa (párrafo de apertura del detalle). */
      summary?: string;
      /** Módulos del detalle, en orden. */
      sections?: Array<{
        icon?: string;
        title: string;
        kicker?: string;
        kind: "text" | "bullets" | "timeline" | "grid" | "rows";
        paragraphs?: string[];
        bullets?: string[];
        items?: Array<{ title: string; subtitle?: string; badge?: string; icon?: string }>;
      }>;
      sources?: AssistantSource[];
    }
  | {
      type: "clarifying_question";
      title?: string;
      question: string;
      expectedSlot?: string;
      options?: string[];
    }
  | {
      type: "weather";
      title?: string;
      city?: string;
      now?: string;
      feel?: string;
      condition?: string;
      range?: string;
      rain?: string;
      wind?: string;
      humidity?: string;
      uv?: string;
      advice?: string;
      /** Pronóstico por hora (próximas 8 horas). */
      hourly?: Array<{ hour: string; temp: string; conditionIcon: string; rainPct: number; uv: number }>;
      /** Pronóstico por día (próximos 7 días). */
      daily?: Array<{ dayAbbrev: string; hi: string; lo: string; conditionIcon: string }>;
      /** ISO timestamp de cuándo se verificó el dato. */
      verifiedAt?: string;
      /** Etiqueta legible de antigüedad (ej. "Hace 2 min"). */
      freshnessLabel?: string;
      sourceStatus?: AssistantActionPayload["externalStatus"];
      sources?: AssistantSource[];
    }
  | {
      type: "alarm";
      title: string;
      time: string;
      repeat?: string;
      note?: string;
    }
  | {
      type: "reminder";
      title: string;
      dueText?: string;
      note?: string;
    }
  | {
      type: "shopping_list";
      title?: string;
      items: string[];
      dueText?: string;
      note?: string;
      quantities?: Record<string, number>;
      checked?: string[];
    }
  | {
      type: "plan";
      title?: string;
      items: AssistantPlanItem[];
      note?: string;
    }
  | {
      type: "comparison";
      title?: string;
      items: NonNullable<AssistantActionPayload["comparisonItems"]>;
      criteria?: string[];
      recommendation?: string;
      sources?: AssistantSource[];
    }
  | {
      type: "research_sources";
      title?: string;
      summary: string;
      mode?: AssistantActionPayload["webMode"];
      sources: AssistantSource[];
      sourceStatus?: AssistantActionPayload["externalStatus"];
      followUpQuestion?: string;
    }
  | {
      type: "money_summary";
      title?: string;
      total?: number;
      currency?: string;
      summaryItems?: Array<{ label: string; value: string; detail?: string }>;
      recommendation?: string;
    }
  | {
      type: "saved_record";
      title?: string;
      records: Array<Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">>;
    }
  | {
      type: "activity_group";
      title: string;
      subtitle?: string;
      energy?: { value: number; label?: string };
      sections: Array<{
        id?: string;
        title: string;
        tone?: "green" | "blue" | "amber" | "purple" | "red" | "neutral";
        tiles?: Array<{
          kind: "weather" | "outfit" | "traffic" | "calendar" | "health" | "food" | "work" | "money" | "wellbeing" | "home" | "relationship" | "research";
          label: string;
          value: string;
          detail?: string;
          actionLabel?: string;
          urgent?: boolean;
        }>;
        rows?: Array<{
          title: string;
          detail?: string;
          meta?: string;
          actionLabel?: string;
          urgent?: boolean;
        }>;
      }>;
      note?: string;
    }
  | {
      type: "proactive_signal";
      category: "world" | "news" | "market" | "weather" | "traffic" | "health" | "relationship" | "home" | "package" | "sports" | "general";
      severity?: "info" | "useful" | "important" | "urgent";
      title: string;
      body: string;
      timestampLabel?: string;
      sourceStatus?: AssistantActionPayload["externalStatus"];
      actionLabel?: string;
      followUpQuestion?: string;
      sources?: AssistantSource[];
      summaryItems?: Array<{ label: string; value: string; detail?: string }>;
    }
  | {
      type: "resource_bundle";
      title?: string;
      files: AssistantArtifact[];
      summary?: string;
    }
  | {
      type: "web_nav";
      title?: string;
      status: "loading" | "complete" | "report";
      query?: string;
      url?: string;
      summary?: string;
      findings?: string[];
      results: Array<{
        title: string;
        source: string;
        url: string;
        type: "article" | "pdf" | "description" | "page";
        readTime?: string;
        snippet?: string;
      }>;
    }
  | {
      /**
       * Datos concretos extraídos de la web y VALIDADOS (cada item respaldado por
       * cita literal de un source). Genérico: sirve para cualquier tema (deportes,
       * finanzas, clima, precios...) porque la detección es por forma del dato,
       * no por vocabulario. La UI los renderiza como filas label/value.
       */
      type: "data_card";
      title?: string;
      sourceStatus?: AssistantActionPayload["externalStatus"];
      items: Array<{
        label: string;
        value: string;
        detail?: string;
        quote?: string;
        sourceUrl?: string;
        sourceDomain?: string;
      }>;
    }
  | {
      /**
       * Síntesis de búsqueda de restaurante (restaurant_deep_search tool).
       * Top coincidencias con score por fuente, pros/contras del #1, cita de síntesis.
       * Renderizado por RestaurantSynthesisCard (estilo DeepHungry Síntesis Comparativa).
       */
      type: "restaurant_synthesis";
      title?: string;
      query?: string;
      mood?: string;
      status: "ok" | "partial" | "failed";
      matches?: Array<{
        name: string;
        sourcesMentioning: number;
        quote?: string;
        imageUrl?: string;
        rating?: number;
        // 🔴 v3: enriquecido por Google Places (fetchRestaurantDetails).
        placeId?: string;
        lat?: number;
        lng?: number;
        address?: string;
        phone?: string;
        ratingCount?: number;
        priceLevel?: number;
        photos?: string[];
        reserveUrl?: string;
        distanceFromUser?: string;
        // 🔴 v4: highlights del menú extraídos por scraping del website del place.
        menuHighlights?: Array<{ dish: string; price?: string }>;
      }>;
      topScore?: string;
      pros?: string[];
      cons?: string[];
      synthesis?: string;
      sources?: AssistantSource[];
      note?: string;
      labels?: {
        cardTitle?: string;
        badge?: string;
        top3Label?: string;
        topPickLabel?: string;
        prosLabel?: string;
        consLabel?: string;
        chefLabel?: string;
        reserveAction?: string;
        menuAction?: string;
        navigateLabel?: string;
        callLabel?: string;
        synthesisLabel?: string;
        sourcesLabel?: string;
      };
    }
  | {
      type: "morning_brief";
      greeting?: string;
      items: Array<{
        icon: string;
        iconColor: string;
        label: string;
        value: string;
        variant?: "default" | "highlight";
      }>;
    }
  | {
      type: "wellbeing";
      title?: string;
      emoji?: string;
      sections?: Array<{
        icon: string;
        iconColor: string;
        bgColor: string;
        borderColor?: string;
        value: string;
        label: string;
      }>;
      sleep?: { icon: string; value: string; label: string };
      suggestion?: { icon: string; value: string; label: string };
      /**
       * 🔴 P2 — Bienestar con inferencia de estrés. Cuando el bloque lleva
       * `logs` y `entries` (WellbeingLog[] y DailyEntry[] del KoruState), el
       * presentation mapper puede invocar `inferStressLevel` para calcular
       * nivel de estrés y mostrarlo como métrica + tiles de análisis.
       * `habits` y `habitLogs` opcionales habilitan el factor "racha cortada".
       */
      logs?: WellbeingLog[];
      entries?: DailyEntry[];
      habits?: Habit[];
      habitLogs?: HabitLog[];
    }
  | {
      type: "live_match";
      league?: string;
      time?: string;
      status?: string;
      homeName?: string;
      awayName?: string;
      homeScore?: number;
      awayScore?: number;
      homeInitials?: string;
      awayInitials?: string;
      minute?: string;
      globalAgg?: string;
      homePossession?: string;
      awayPossession?: string;
      homeShots?: string;
      awayShots?: string;
      homeTeam?: { name: string; abbrev: string; color?: string; score: number };
      awayTeam?: { name: string; abbrev: string; color?: string; score: number };
      stats?: Array<{
        label: string;
        leftPercent: number;
        rightPercent: number;
        leftColor?: string;
        rightColor?: string;
      }>;
      // 🔴 v2: datos ricos desde ESPN /summary
      homeColor?: string;
      awayColor?: string;
      homeLogo?: string;
      awayLogo?: string;
      homeAbbrev?: string;
      awayAbbrev?: string;
      venue?: string;
      venueCity?: string;
      attendance?: number;
      goals?: Array<{ minute: string; team?: string; scorer?: string; text?: string }>;
      yellowCards?: Array<{ minute: string; team?: string; player?: string }>;
      redCards?: Array<{ minute: string; team?: string; player?: string }>;
      substitutions?: Array<{ minute: string; team?: string; playerIn?: string; playerOut?: string }>;
      lineups?: Record<string, {
        formation?: string;
        starters: Array<{ number?: string; name: string; position?: string }>;
        subs: Array<{ number?: string; name: string; position?: string }>;
      }>;
      detailedStats?: Array<{ label: string; home: number; away: number; isPercent: boolean }>;
    }
  | {
      type: "urgent_now";
      eyebrow?: string;
      icon?: string;
      iconColor?: string;
      iconBg?: string;
      headline: string;
      description: string;
    }
  | {
      type: "market";
      title?: string;
      assets: Array<{
        symbol: string;
        name: string;
        category?: string;
        price: string;
        change: string;
        changeUp: boolean;
        icon?: string;
        iconBg?: string;
        iconColor?: string;
        shape?: "circle" | "rounded";
      }>;
    }
  | {
      type: "delivery";
      title?: string;
      status: string;
      carrier?: string;
      trackingId?: string;
      estimatedDate?: string;
      steps?: Array<{ label: string; done: boolean }>;
    }
  | {
      type: "health_reminder";
      title?: string;
      icon?: string;
      iconColor?: string;
      bgColor?: string;
      reminder: string;
      actionLabel?: string;
    }
  | {
      type: "activity_tracker";
      title?: string;
      subtitle?: string;
      metrics: Array<{
        icon: string;
        iconColor: string;
        label: string;
        value: string;
        unit?: string;
        progress?: number;
        progressColor?: string;
      }>;
    }
  | {
      type: "product_analysis";
      product?: {
        name?: string;
        image?: string;
        icon?: string;
        rating?: number;
        reviewCount?: string;
        description?: string;
      };
      specs?: Array<{ label: string; value: string }>;
      actionLabel?: string;
      actionIcon?: string;
    }
  | {
      type: "travel_planner";
      destination?: string;
      dates?: string;
      steps?: Array<{ time: string; label: string; detail?: string; icon?: string }>;
      actionLabel?: string;
    }
  | {
      /**
       * travel_plan — Plan de viaje completo (diferente de travel_planner que
       * es solo un itinerario de paradas). Este bloque agrupa itinerario día a
       * día + reservas + checklist de equipaje + presupuesto. Lo genera el
       * travel planner cuando el usuario pide "planeá mi viaje a X".
       */
      type: "travel_plan";
      destination?: string;
      dates?: string;
      travelers?: number;
      days?: Array<{ day: number; title: string; activities: Array<{ time: string; title: string; detail: string }> }>;
      reservations?: Array<{ provider: string; type: string; detail: string; status: string; deepLink?: string }>;
      packing?: Array<{ item: string; checked: boolean; category?: string }>;
      budget?: Array<{ category: string; amount: number; currency: string }>;
      totalBudget?: number;
      currency?: string;
    }
  | {
      type: "generation";
      title?: string;
      prompt?: string;
      resultType?: "text" | "image" | "code" | "document";
      preview?: string;
      actionLabel?: string;
      actionIcon?: string;
      /** Imágenes generadas (cuando resultType === "image"). */
      images?: Array<{
        id: string;
        url: string;
        promptVariant: string;
        seed: number;
        generationMs: number;
      }>;
      /** Tips de prompt engineering en español. */
      tips?: string[];
      /** Preset de estilo aplicado al prompt. */
      style?: string;
      /** Relación de aspecto solicitada. */
      aspectRatio?: string;
      /** Modelo de generación (dall-e-3 | sdxl). */
      model?: string;
      /** Tiempo total de generación en ms. */
      totalTime?: number;
    }
  | {
      type: "match_timeline";
      title?: string;
      items?: Array<{ minute: string; text: string; sub?: string; active?: boolean; now?: boolean }>;
      /** 🔴 KORU 3.0 — Campos adicionales para cuando no hay partido jugado */
      teamInfo?: { name: string; stadium?: string; location?: string; league?: string; description?: string };
      nextMatch?: { match?: string; homeTeam?: string; awayTeam?: string; date?: string; time?: string; league?: string };
      wikipediaExtract?: string;
    }
  | {
      type: "match_stats";
      title?: string;
      stats?: Array<{ label: string; home: string; away: string; width: string }>;
      homeColor?: string;
      awayColor?: string;
      homeName?: string;
      awayName?: string;
    }
  | {
      type: "election_results";
      title?: string;
      status?: string;
      items?: Array<{ name: string; percent: string; detail?: string; done: boolean; color: string }>;
    }
  | {
      type: "election_vote";
      question?: string;
      subtitle?: string;
      options?: Array<{ label: string; sub?: string }>;
    }
  | {
      type: "decision_support";
      title?: string;
      options?: Array<{ label: string; probability?: number }>;
      factors?: string[];
      recommendation?: string;
      /** 🔴 v4: id de la Decision durable en state.decisions que respalda este
       *  bloque. Si está presente, KoruDetailScreen puede:
       *  - leer `decision.outcome` para mostrar "Decidiste: X · Satisfacción: N/5"
       *  - ofrecer botones para registrar el outcome (chosenOptionId + satisfaction1to5)
       *  y disparar el reducer `updateDecisionOutcome`.
       */
      decisionId?: string;
    }
  | {
      type: "memory";
      title?: string;
      items?: Array<{
        domain?: string;
        title: string;
        detail?: string;
        confidence?: number;
      }>;
      note?: string;
    }
  | {
      type: "data_ticker";
      title?: string;
      items?: Array<{ label: string; value: string; highlight?: boolean }>;
      alert?: string;
    }
  | {
      type: "crypto_portfolio";
      title?: string;
      items?: Array<{
        symbol: string;
        name: string;
        price: string;
        change: number;
        color: string;
        bg: string;
        char?: string;
        /** 🔴 KIMI Card 06 — cantidad de la moneda (ej: 0.042). */
        amount?: number;
        /** 🔴 KIMI Card 06 — valor formateado de la tenencia (ej: "$2.697"). */
        value?: string;
      }>;
      /** 🔴 KIMI Card 06 — total del portafolio formateado (artValue del hero). */
      totalValue?: string;
      /** 🔴 KIMI Card 06 — delta % semanal (kicker del hero). */
      weekChange?: number;
      /** 🔴 KIMI Card 06 — historial 7 días (para sparkline). */
      sparkline?: number[];
      /** 🔴 KIMI Card 06 — alertas de precio activas. */
      alerts?: Array<{ symbol: string; target: string; direction: "above" | "below" }>;
      /** 🔴 KIMI Card 06 — source attribution (CoinGecko / Binance / CoinCap). */
      sources?: AssistantSource[];
    }
  | {
      type: "forex";
      title?: string;
      items?: Array<{ pair: string; rate: string; change: number; flag: string; positive: boolean }>;
    }
  | {
      type: "route_timeline";
      eta?: string;
      items?: Array<{ label: string; detail: string; color: string }>;
    }
  | {
      type: "transport_compare";
      items?: Array<{ mode: string; time: string; icon: string; active: boolean }>;
    }
  | {
      type: "route_map";
      progress?: number;
      from?: string;
      to?: string;
      distance?: string;
      remaining?: string;
      /**
       * Coordenadas del destino (opcional). Si están presentes, el botón
       * "Navegar" usa geo:${lat},${lng} en Android y maps://?daddr=${lat},${lng}
       * en iOS para abrir la app nativa de mapas. Si no, cae a esquemas
       * address-based (geo:0,0?q=address / maps://?daddr=address).
       */
      lat?: number;
      lng?: number;
      /**
       * Pasos detallados de la ruta (instrucciones de giro). Se populan desde
       * `fetchRoute()` en travelPlanner.ts (Google Maps Directions API).
       */
      steps?: Array<{ instruction: string; distanceMeters: number; maneuver: string }>;
      /**
       * Rutas alternativas sugeridas por la API, cada una con modo/tiempo/tráfico
       * en forma resumida (para mostrar como tiles comparativos).
       */
      alternatives?: Array<{ mode: string; time: string; traffic: string }>;
      /** Nivel de tráfico: "light" | "moderate" | "heavy". */
      trafficLevel?: string;
      /** Estimación de combustible formateada (ej: "12.4 L"). */
      fuelEstimate?: string;
    }
  | {
      type: "birthday_calendar";
      month?: string;
      highlightedDay?: number;
      startDay?: number;
      daysInMonth?: number;
    }
  | {
      type: "birthday_alarm";
      name?: string;
      date?: string;
      countdown?: string;
      unit?: string;
      eta?: string;
    }
  | {
      type: "social_interaction";
      name?: string;
      event?: string;
      date?: string;
      age?: string;
      remaining?: string;
      gifts?: Array<{ emoji: string; title: string; detail: string }>;
    }
  | {
      type: "smart_checklist";
      title?: string;
      progress?: number;
      items?: Array<{ label: string; checked: boolean }>;
    }
  | {
      type: "outfit";
      title?: string;
      specs?: Array<{ emoji: string; label: string; value: string }>;
      buttonLabel?: string;
    }
  | {
      type: "review_score";
      title?: string;
      items?: Array<{ emoji: string; score: string; label: string; color: string }>;
      buttonLabel?: string;
    }
  | {
      type: "review_document";
      title?: string;
      body?: string;
    }
  | {
      type: "review_quote";
      sourceName?: string;
      sourceType?: string;
      quote?: string;
      tags?: string[];
      buttonLabel?: string;
    }
  // 🔴 FIX P2.3 — Nuevos UiBlock types para dominios específicos
  | {
      type: "recipe";
      title?: string;
      name?: string;
      image?: string;
      category?: string;
      area?: string;
      description?: string;
      instructions?: string;
      videoUrl?: string;
      ingredients?: Array<{ ingredient: string; measure: string }>;
      steps?: Array<{ step: number; text: string }>;
      tips?: string[];
      servings?: number;
      prepTime?: string;
      cookTime?: string;
      source?: { title: string; url: string; domain: string };
      /** 🔴 FREE: nutrición promedio por 100g del ingrediente principal,
       *  vía Open Food Facts. Opcional — solo presente si la API lo devuelve. */
      nutrition?: { kcal: number; protein: number; carbs: number; fat: number };
    }
  | {
      type: "movie_review";
      title?: string;
      poster?: string;
      rating?: number;
      ratingCount?: number;
      releaseDate?: string;
      runtime?: string;
      director?: string;
      cast?: string[];
      genres?: string[];
      overview?: string;
      trailerUrl?: string;
      whereToWatch?: string[];
      crew?: Array<{ name: string; job: string }>;
      ratings?: Array<{ source: string; score: number; outOf: number }>;
      streaming?: Array<{ provider: string; logo?: string; deeplink?: string }>;
      /** Awards (no se traen desde TMDB; reservado para futuro enriquecimiento IMDb/OMDB). */
      awards?: string[];
      /** 🔴 Budget formateado (ej. "$150M") — extraído de TMDB /movie/{id}.budget. */
      budget?: string;
      /** 🔴 Box office formateado (ej. "$1.2B") — extraído de TMDB /movie/{id}.revenue. */
      boxOffice?: string;
      sources?: AssistantSource[];
    }
  | {
      type: "book_review";
      title?: string;
      cover?: string;
      author?: string;
      year?: string;
      pages?: number;
      publisher?: string;
      genre?: string;
      rating?: number;
      synopsis?: string;
      isbn?: string;
      /** 🔴 URL de preview embebido (Open Library / Archive.org embed). */
      previewUrl?: string;
      sources?: AssistantSource[];
    }
  | {
      type: "news_urgent";
      headline?: string;
      summary?: string;
      severity?: "breaking" | "urgent" | "important";
      category?: string;
      timeline?: Array<{ time: string; event: string; status: "done" | "current" | "pending" }>;
      factChecks?: Array<{ claim: string; verdict: string; source: string }>;
      sources?: AssistantSource[];
      location?: { lat: number; lng: number; label: string };
      lastUpdated?: string;
    }
  | {
      type: "tennis_match";
      players?: { home: { name: string; country?: string; seed?: number; rank?: number; logo?: string }; away: { name: string; country?: string; seed?: number; rank?: number; logo?: string } };
      tournament?: { name: string; round: string; surface: string; category: string };
      sets?: Array<{ homeGames: number; awayGames: number; winner?: "home"|"away"; tiebreak?: { homePts: number; awayPts: number } }>;
      currentSet?: { gamesHome: number; gamesAway: number; server: "home"|"away" };
      currentPoint?: string;
      stats?: { aces: { h: number; a: number }; doubleFaults: { h: number; a: number }; firstServePct: { h: number; a: number }; breakPointsWon: { h: number; a: number }; breakPointsFaced: { h: number; a: number }; returnGamesWon: { h: number; a: number } };
      elapsedMs?: number;
      status?: "scheduled"|"live"|"finished";
      sources?: AssistantSource[];
    }
  | {
      /**
       * exercise_plan — Plan de entrenamiento activo. Renderiza el detalle con
       * las sesiones del plan (días) y un botón "Empezar sesión" que abre el
       * overlay WorkoutSession para la sesión actual (currentSessionIdx).
       * El plan completo se reutiliza desde el UiBlock; no se consulta state.
       */
      type: "exercise_plan";
      title?: string;
      plan: ExercisePlan;
      /**
       * 🔴 P2 — Cálculo de fuerza (1RM Epley) + delta vs histórico + kcal.
       * Cuando el bloque lleva `workoutLogs` (WorkoutLog[] históricos), el
       * presentation mapper puede calcular 1RM por ejercicio, delta vs hace
       * 4 semanas, y estimación de kcal con la tabla MET.
       */
      workoutLogs?: WorkoutLog[];
      userWeightKg?: number;
    }

export type AssistantActionStatus = "proposed" | "approved" | "executed" | "rejected";

export type AssistantActionPayload = {
  title?: string;
  body?: string;
  uiBlock?: UiBlock;
  semanticIntent?: SemanticIntent;
  draft?: string;
  recipient?: string;
  dueHint?: string;
  startsAt?: string;
  location?: string;
  note?: string;
  webMode?: "news" | "shopping" | "research" | "weather" | "traffic" | "market" | "world";
  files?: AssistantArtifact[];
  sources?: AssistantSource[];
  verifiedAt?: string;
  externalStatus?: "not_configured" | "pending" | "verified" | "partial" | "failed";
  comparisonItems?: Array<{
    title: string;
    price?: string;
    vendor?: string;
    url?: string;
    evidence?: string;
    score?: number;
    details?: Array<{ label: string; positive?: boolean }>;
  }>;
  planItems?: AssistantPlanItem[];
  steps?: string[];
  contextReview?: ContextReviewItem[];
  questions?: string[];
  missingContext?: string[];
  searchQueries?: string[];
  researchCriteria?: string[];
  records?: Array<Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">>;
  summaryItems?: Array<{ label: string; value: string; detail?: string }>;
  totalAmount?: number;
  currency?: string;
  recommendation?: string;
  decisionVote?: "go" | "wait" | "missing";
  decisionAssumption?: string;
};

export type AssistantAction = {
  id: string;
  kind: AssistantActionKind;
  title: string;
  body: string;
  status: AssistantActionStatus;
  approvalRequired: boolean;
  createdAt: string;
  updatedAt?: string;
  executedAt?: string;
  sourceEntryId: string;
  sourceCommitmentId?: string;
  payload: AssistantActionPayload;
  result?: string;
};

export type LearningPreference = {
  type: string;
  acceptedCount: number;
  rejectedCount: number;
  lastInteractionAt: string;
};

// ═══════════════════════════════════════════════════════════════
// TIER S — Nuevas entidades funcionales (v2 funcionalidades)
// ═══════════════════════════════════════════════════════════════

/** Plan durable — reemplaza la generación efímera de planFromState */
export type PlanStep = {
  id: string;
  title: string;
  detail?: string;
  icon?: string;
  time?: string;
  durationMinutes?: number;
  priority?: "alta" | "media" | "baja";
  phase?: string;
  estimatedDays?: number;
  done?: boolean;
  doneAt?: string;
  order: number;
};

export type Plan = {
  id: string;
  title: string;
  goalId?: string;
  steps: PlanStep[];
  estimatedWeeks?: number;
  status: "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  strategyNotes?: Array<{ text: string; at: string }>;
};

/** Checklist durable — reemplaza smart_checklist efímero */
export type ChecklistItem = {
  id: string;
  label: string;
  detail?: string;
  urgency: "normal" | "urgent" | "blocked";
  dueAt?: string;
  doneAt?: string;
  source?: "manual" | "extracted" | "record";
  order: number;
};

export type Checklist = {
  id: string;
  title: string;
  items: ChecklistItem[];
  dueAt?: string;
  collection?: string;
  status: "active" | "completed" | "archived";
  createdAt: string;
  completedAt?: string;
};

/** Habit + HabitLog — para rutinas y streaks */
export type Habit = {
  id: string;
  label: string;
  icon: string;
  cadence: "daily" | "weekly" | "mon-fri" | "custom";
  target: number;
  unit?: string;
  anchorTime?: string;
  active: boolean;
  createdAt: string;
  archivedAt?: string;
  routineId?: string;
};

export type HabitLog = {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  value: number;
  completedAt: string;
};

export type Routine = {
  id: string;
  name: string;
  anchorTime: string;
  habitIds: string[];
  daysOfWeek: number[]; // 0=Dom, 1=Lun, ..., 6=Sáb
  createdAt: string;
};

/** ExercisePlan — para planes de fuerza */
export type ExerciseSet = {
  exercise: string;
  sets: number;
  reps: number;
  weight?: number;
  durationSec?: number;
  restSec?: number;
  notes?: string;
};

export type ExerciseSession = {
  id: string;
  dayLabel: string;
  exercises: ExerciseSet[];
  completedAt?: string;
  order: number;
};

export type ExercisePlan = {
  id: string;
  name: string;
  weeksTotal: number;
  sessions: ExerciseSession[];
  currentSessionIdx: number;
  createdAt: string;
  status: "active" | "completed" | "archived";
};

export type WorkoutLog = {
  id: string;
  planId: string;
  sessionId: string;
  date: string;
  exercises: ExerciseSet[];
  durationMin: number;
  kcal?: number;
};

/** ShoppingList durable — reemplaza shopping_item records sueltos */
export type ShoppingItem = {
  id: string;
  name: string;
  qty?: string;
  unit?: string;
  price?: number;
  currency?: string;
  checked: boolean;
  checkedAt?: string;
  category?: string;
  order: number;
};

export type ShoppingList = {
  id: string;
  title: string;
  store?: string;
  items: ShoppingItem[];
  dueAt?: string;
  status: "active" | "completed" | "archived";
  totalSpent?: number;
  totalEstimate?: number;
  createdAt: string;
  completedAt?: string;
};

/** WellbeingLog — para métricas de salud */
export type WellbeingLog = {
  id: string;
  date: string;
  metric: "sleep" | "steps" | "hr" | "hrv" | "water" | "meditation" | "mood";
  value: number;
  unit: string;
  source: "manual" | "healthkit" | "healthconnect" | "fitbit";
};

export type WellbeingStreak = {
  meditation: { current: number; best: number; lastDate?: string };
  water: { current: number; best: number; lastDate?: string };
  sleep: { current: number; best: number; lastDate?: string };
};

/** Person — para recordatorios de personas */
export type Person = {
  id: string;
  name: string;
  relationship?: string;
  birthday?: string;
  giftPreferences?: string[];
  lastContactedAt?: string;
  phone?: string;
};

/** UserProfile — para Home dashboard y Settings */
export type UserProfile = {
  name?: string;
  birthday?: string;
  location?: string;
  timezone?: string;
  homeCity?: string;
  homeLat?: number;
  homeLng?: number;
  /** 🔴 Moneda principal del usuario (código ISO 4217, ej: "EUR", "USD", "ARS").
   *  Se usa para conversión de presupuestos de viaje y otros montos. Default EUR. */
  currency?: string;
  /** 🔴 P2 — peso del usuario en kg; usado por strengthEngine para estimar kcal (MET). */
  weightKg?: number;
};

/** UserPreferences — para Settings */
export type UserPreferences = {
  theme: "light" | "dark" | "auto";
  fontScale: "small" | "medium" | "large";
  haptics: boolean;
  sounds: boolean;
  dndStartHour?: number;
  dndEndHour?: number;
  reducedMotion: boolean;
  highContrast: boolean;
  /** 🔴 KORU 3.0 — Voz de Koru: cuando está activo, Koru "habla" sus respuestas
   * usando TTS del navegador (Web Speech API SpeechSynthesis). */
  koruVoiceEnabled?: boolean;
  /** Velocidad de voz de Koru (0.5 a 2.0, default 1.0). */
  koruVoiceRate?: number;
};

/** Memory edit history */
export type MemoryEdit = {
  at: string;
  field: string;
  before?: string;
  after?: string;
  reason?: string;
};

/** Note attachment */
export type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  blobKey: string;
};

/** Decision support */
export type DecisionOption = {
  id: string;
  label: string;
  factorScores: Record<string, number>;
  priorProbability?: number;
  riskProfile?: "low" | "medium" | "high";
};

export type DecisionFactor = {
  id: string;
  label: string;
  icon?: string;
  direction: "higherIsBetter" | "lowerIsBetter";
};

export type Decision = {
  id: string;
  question: string;
  deadline?: string;
  options: DecisionOption[];
  factors: DecisionFactor[];
  weights: Record<string, number>;
  algorithm?: "wadd" | "ttb" | "montecarlo";
  result?: {
    perOptionScore: Record<string, number>;
    perOptionProbability: Record<string, number>;
    recommendation: string;
    confidenceInterval?: [number, number];
  };
  outcome?: {
    chosenOptionId: string;
    decidedAt: string;
    satisfaction1to5: number;
    followUpAt?: string;
    notes?: string;
  };
  linkedMemoryIds: string[];
  createdAt: string;
};

/** Weather cache */
export type WeatherCache = {
  city: string;
  fetchedAt: string;
  payload: {
    now: string;
    condition: string;
    hourly?: Array<{ hour: string; temp: string; conditionIcon: string; rainPct: number; uv: number }>;
    daily?: Array<{ dayAbbrev: string; hi: string; lo: string; conditionIcon: string }>;
  };
};

export type KoruState = {
  userId: string;
  userName?: string;
  stage: KoruStage;
  trustedEnergy: number;
  totalEnergy: number;
  createdAt: string;
  updatedAt: string;
  voicePreference: VoicePreference;
  runtime: RuntimeSettings;
  heartbeat: HeartbeatSettings;
  memories: MemoryFact[];
  commitments: Commitment[];
  actions: AssistantAction[];
  calendarEvents: CalendarEvent[];
  records: LifeRecord[];
  entries: DailyEntry[];
  energyEvents: EnergyEvent[];
  nudges: ProactiveNudge[];
  modelCalls: ModelCall[];
  ephemeralMode: boolean;
  durableMemoryEnabled: boolean;
  actionPreparationEnabled: boolean;
  worldSignalsEnabled: boolean;
  learningPreferences: LearningPreference[];
  language?: "es" | "en";

  // ═══ TIER S — Nuevos slices de estado ═══
  plans?: Plan[];
  checklists?: Checklist[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  routines?: Routine[];
  exercisePlans?: ExercisePlan[];
  workoutLogs?: WorkoutLog[];
  shoppingLists?: ShoppingList[];
  wellbeingLogs?: WellbeingLog[];
  wellbeingStreaks?: WellbeingStreak;
  people?: Person[];
  userProfile?: UserProfile;
  preferences?: UserPreferences;
  decisions?: Decision[];
  weatherCache?: WeatherCache;
  lastBriefDate?: string;
  lastBriefBlock?: UiBlock;
};

export type KoruAnalysis = {
  summary: string;
  response: string;
  energyAwarded: number;
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
  commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  actionProposals: Omit<AssistantAction, "id" | "createdAt" | "sourceEntryId">[];
  nudges: Omit<ProactiveNudge, "id" | "createdAt">[];
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  sentiment: DailyEntry["sentiment"];
  activeMemoryIds: string[];
  activeMemorySummary?: string;
  provider: BrainProvider;
  model?: string;
};

export type KoruConversationMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};
