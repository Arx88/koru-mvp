import type { BrainProvider, VoicePreference } from "./types";

export const koruSoulCapsule = {
  version: "0.2.0",
  identity: {
    name: "Koru",
    metaphor: "semilla que crece con confianza confirmada",
    role: "asistente personal de IA, cercano y practico; no terapeuta ni persona humana",
  },
  voice: {
    traits: ["calido", "claro", "curioso", "discreto", "resolutivo", "honesto"],
    forbiddenPhrases: [
      "te extrane",
      "no me abandones",
      "soy la unica persona que te entiende",
      "cuentame mas para que pueda crecer",
      "si no vuelves me marchito",
      "siempre estare aqui para ti",
      "yo se lo que necesitas mejor que tu",
      "separe hechos",
      "clasifique",
    ],
  },
  defaults: {
    warmth: 7,
    directness: 6,
    humor: 3,
    detail: 5,
    proactivity: 3,
  } satisfies VoicePreference,
};

export function sanitizeKoruVoice(text: string): string {
  let safe = text;
  for (const phrase of koruSoulCapsule.voice.forbiddenPhrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    safe = safe.replace(new RegExp(escaped, "gi"), "puedo ayudarte con eso");
  }
  return safe;
}

const EMPATHY_MAP: Record<string, string> = {
  heavy: "Te bajo esto a algo manejable.",
  busy: "Hay varias cosas mezcladas; voy por lo concreto.",
  good: "Bien. Lo dejo claro y usable.",
  calm: "Lo tomo.",
};

const CLOSERS: Array<{ match: (p: { directness: number }) => boolean; text: string }> = [
  { match: (p) => p.directness >= 8, text: "Dime el siguiente dato y avanzo." },
  { match: (p) => p.directness >= 6, text: "Podemos seguir desde ahi." },
  { match: () => true, text: "Estoy aca para seguir." },
];

/**
 * ⚠️ DEPRECATED: Do not use for the main chat reply path.
 * Only use as an ultimate fallback if the Composer LLM returns an empty reply.
 */
export function renderKoruResponse(params: {
  summary: string;
  memoryCount: number;
  commitmentCount: number;
  actionCount: number;
  primaryActionTitle?: string;
  primaryActionKind?: string;
  sensitiveCount: number;
  sentiment: "calm" | "heavy" | "busy" | "good";
  activeMemoryCount: number;
  activeMemorySummary?: string;
  provider: BrainProvider;
  preference: VoicePreference;
}): string {
  if (typeof window !== "undefined") {
    console.warn("[DEPRECATED] renderKoruResponse was called for the main chat path. " +
      "The LLM Composer should generate replies. " +
      "Only use renderKoruResponse as an ultimate fallback.");
  }
  const total = params.memoryCount + params.commitmentCount + params.actionCount;
  const pieces: string[] = [];
  const shortSummary = params.summary.length > 90 ? params.summary.slice(0, 90).trimEnd() + "..." : params.summary;

  if (params.primaryActionKind) {
    const actionCopy: Record<string, string> = {
      clarifying_question: "Necesito un dato para hacerlo bien.",
      web_research: "Claro. Lo miro y te dejo solo lo importante.",
      world_signal: "Te traigo senales recientes, con fuentes y sin ruido.",
      morning_brief: "Te arme un brief corto con lo que se y lo que falta.",
      meeting_brief: "Puedo dejar la reunion ordenada en puntos accionables.",
      day_plan: "Te lo ordene en pasos concretos.",
      structured_note: "Guardado.",
      money_summary: "Te dejo el numero y el criterio, sin vueltas.",
      decision_support: "Te doy mi voto con el supuesto visible.",
      file_bundle: "Te prepare el archivo para revisar.",
      reminder: "Lo dejo visible para que no se pierda.",
      restock_note: "Lo pase a lista para resolverlo facil.",
      draft_message: "Te deje un borrador corto para revisar.",
      calendar_event: "Lo preparo como evento local.",
      daily_brief: "Te dejo una salida chica y accionable.",
    };
    const copy = actionCopy[params.primaryActionKind] ?? "Te lo dejo ordenado.";
    const memoryAwareActions = new Set([
      "day_plan",
      "structured_note",
      "money_summary",
      "morning_brief",
      "meeting_brief",
      "decision_support",
      "reminder",
      "restock_note",
      "draft_message",
      "calendar_event",
      "daily_brief",
    ]);
    return sanitizeKoruVoice(
      params.activeMemoryCount > 0 && memoryAwareActions.has(params.primaryActionKind)
        ? `Ate cabos con lo que ya me contaste. ${copy}`
        : copy,
    );
  }

  const empathy = EMPATHY_MAP[params.sentiment] ?? EMPATHY_MAP.calm;
  pieces.push(empathy);

  if (params.primaryActionKind === "clarifying_question") {
    pieces.push("No voy a inventarte un plan. Te pido un poco de contexto y lo ordeno desde ahí.");
  } else if (params.actionCount > 0) {
    pieces.push(params.primaryActionTitle ? `Puedo avanzar con "${params.primaryActionTitle}".` : "Puedo avanzar con eso.");
  } else if (params.commitmentCount > 0) {
    pieces.push("Lo dejo visible para que no tengas que sostenerlo solo en la cabeza.");
  } else if (params.memoryCount > 0) {
    pieces.push(`Me quedo con esto: ${shortSummary}`);
  } else {
    pieces.push("No detecte una tarea clara ni un dato para guardar. Si queres, lo convertimos en proximo paso.");
  }

  if (params.sensitiveCount > 0) {
    pieces.push("Hay algo delicado que prefiero que revises antes de guardarlo.");
  }

  if (params.activeMemoryCount > 0) {
    pieces.push("Ate cabos con algo que ya me habias contado.");
  }

  if (total > 0 && params.actionCount === 0 && params.memoryCount === 0) {
    pieces.push("Lo tengo a mano.");
  }

  const closer = CLOSERS.find((c) => c.match(params.preference)) ?? CLOSERS[CLOSERS.length - 1];
  pieces.push(closer.text);

  return sanitizeKoruVoice(pieces.join(" "));
}
