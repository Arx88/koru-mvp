export type KoruStage = "seed" | "sprout" | "roots" | "born" | "garden";

export type MemorySensitivity = "normal" | "sensitive";

export type MemoryStatus = "candidate" | "confirmed" | "rejected";

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
  createdAt: string;
  sourceEntryId: string;
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

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  source: "manual" | "ics";
  sourceRef?: string;
  createdAt: string;
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

export type BrainProvider = "local" | "freellmapi" | "open-model" | "nvidia" | "openrouter";

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
};

export type AssistantPlanItem = {
  time?: string;
  title: string;
  priority?: "Alta" | "Media" | "Baja";
  icon?: "flag" | "book" | "move" | "message" | "calendar" | "money" | "heart" | "home";
  durationMinutes?: number;
  mode?: "focus" | "quick" | "admin" | "recovery";
  rationale?: string;
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
    | "memory_recall";
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
      mood?: string;
      status: "ok" | "partial" | "failed";
      matches?: Array<{ name: string; sourcesMentioning: number; quote?: string }>;
      topScore?: string;
      pros?: string[];
      cons?: string[];
      synthesis?: string;
      sources?: AssistantSource[];
      note?: string;
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
    }
  | {
      type: "live_match";
      league?: string;
      time?: string;
      status?: string;
      homeTeam?: { name: string; abbrev: string; color?: string; score: number };
      awayTeam?: { name: string; abbrev: string; color?: string; score: number };
      stats?: Array<{
        label: string;
        leftPercent: number;
        rightPercent: number;
        leftColor?: string;
        rightColor?: string;
      }>;
    }
  | {
      type: "urgent_now";
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
      type: "generation";
      title?: string;
      prompt?: string;
      resultType?: "text" | "image" | "code" | "document";
      preview?: string;
      actionLabel?: string;
      actionIcon?: string;
    };

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

export type KoruState = {
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
