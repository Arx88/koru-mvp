/**
 * AbsenceEngine — conciencia de ausencia como contexto de primera clase.
 *
 * "El compañero que te espera": cuando el usuario vuelve después de N días,
 * Koru LO SABE y puede reaccionar con calidez honesta. La regla de diseño:
 *
 *   Hecho computado por el sistema (días, temas previos) + voz del LLM = magia.
 *   Koru nunca fabrica sentimiento: la ausencia debe ser REAL y VERIFICADA
 *   desde fuentes durables (lastSeen + historial persistido), no de una
 *   opinión del modelo sobre cuánto hace que no habla con el usuario.
 *
 * Los tiers escalan la reacción como lo haría un amigo real: no es lo mismo
 * 3 días que 2 meses. Y el digest de "lo que te perdiste" (pendientes
 * vencidos mientras no estabas) es lo que convierte "te extrañé" en
 * "te seguí pensando".
 */

export type AbsenceTier = "none" | "brief" | "notable" | "long";

export type AbsenceContext = {
  /** Días desde la última interacción real (0 si es sesión continua). */
  days: number;
  tier: AbsenceTier;
  /** ISO timestamp de la última actividad conocida. */
  lastActiveAt: string | null;
  /** Últimos temas conversados antes de la ausencia (máx 3, textos cortos). */
  lastTopics: string[];
  /** Pendientes abiertos cuya fecha de vencimiento cayó durante la ausencia. */
  overdueWhileAway: Array<{ title: string; dueHint: string }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clasifica el gap en tiers. El umbral de "ausencia que se menciona" es
 * >= 7 días: por debajo, mencionar la ausencia suena a vigilancia, no a
 * cariño. "Te extrañé" tras 2 días de no entrar es la fabricación de
 * sentimiento que forbiddenPhrases prohíbe correctamente.
 */
export function tierForDays(days: number): AbsenceTier {
  if (days >= 30) return "long";
  if (days >= 7) return "notable";
  if (days >= 3) return "brief";
  return "none";
}

/**
 * Computa el contexto de ausencia desde fuentes durables.
 *
 * - lastSeenMs: localStorage["koru.lastSeen"] (lo escribe TalkOverlay).
 * - lastTurnAt: createdAt del último turno persistido del chat.
 * - entries: DailyEntry[] con createdAt — la fuente más durable porque
 *   vive en el KoruState persistido, no en storage de sesión.
 *
 * Toma el MÁS RECIENTE de todos: si el usuario entró pero no escribió
 * (apertura fantasma), la ausencia real de conversación sigue siendo
 * la del último turno escrito.
 */
export function computeAbsenceContext(params: {
  now?: Date;
  lastSeenMs?: number | null;
  lastTurnAt?: string | null;
  entries?: Array<{ createdAt?: string }>;
  commitments?: Array<{ title?: string; dueHint?: string; dueAt?: string; status?: string }>;
  history?: Array<{ role: string; content: string }>;
}): AbsenceContext {
  const now = params.now ?? new Date();
  const candidates: number[] = [];
  if (params.lastSeenMs && Number.isFinite(params.lastSeenMs) && params.lastSeenMs > 0) {
    candidates.push(params.lastSeenMs);
  }
  if (params.lastTurnAt) {
    const t = new Date(params.lastTurnAt).getTime();
    if (!Number.isNaN(t)) candidates.push(t);
  }
  const lastEntryAt = (params.entries ?? [])
    .map((e) => (e.createdAt ? new Date(e.createdAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  if (lastEntryAt) candidates.push(lastEntryAt);

  const lastActiveMs = candidates.length > 0 ? Math.max(...candidates) : null;
  if (lastActiveMs === null) {
    return { days: 0, tier: "none", lastActiveAt: null, lastTopics: [], overdueWhileAway: [] };
  }

  const days = Math.max(0, Math.floor((now.getTime() - lastActiveMs) / DAY_MS));
  const tier = tierForDays(days);

  // Temas previos: últimos mensajes del usuario antes de la ausencia.
  const lastTopics = (params.history ?? [])
    .filter((t) => t.role === "user" && t.content?.trim())
    .slice(-3)
    .map((t) => t.content.trim().slice(0, 120))
    .reverse();

  // Digest: pendientes abiertos que vencieron mientras el usuario no estaba.
  // Los que vencieron ANTES del último día activo no cuentan — esos ya
  // eran viejos cuando se fue, no son noticias del reencuentro.
  const overdueWhileAway: Array<{ title: string; dueHint: string }> = [];
  for (const c of params.commitments ?? []) {
    if (c.status !== "open") continue;
    if (!c.dueAt) continue;
    const dueMs = new Date(c.dueAt).getTime();
    if (Number.isNaN(dueMs)) continue;
    if (dueMs > lastActiveMs && dueMs <= now.getTime()) {
      overdueWhileAway.push({ title: String(c.title ?? "").slice(0, 80), dueHint: String(c.dueHint ?? "") });
    }
  }

  return {
    days,
    tier,
    lastActiveAt: new Date(lastActiveMs).toISOString(),
    lastTopics: lastTopics.slice(0, 3),
    overdueWhileAway: overdueWhileAway.slice(0, 3),
  };
}

/**
 * Renderiza el contexto de ausencia como líneas para el system prompt del
 * turno de chat principal. Solo se inyecta cuando hay una ausencia real
 * que vale la pena mencionar (tier >= brief con mención solo desde notable).
 *
 * El texto deja claro qué es HECHO y qué es VOZ: los días y los temas son
 * computados; el LLM solo elige cómo decirlo. Nunca debe agregar ausencias
 * que no están acá.
 */
export function formatAbsenceContext(absence: AbsenceContext): string[] {
  if (absence.tier === "none" || absence.tier === "brief") return [];

  const lines: string[] = [];
  lines.push(`=== REENCUENTRO TRAS AUSENCIA ===`);
  lines.push(`- El usuario vuelve después de ${absence.days} días sin conversar. Esto es un HECHO computado, no una estimación: no entrabas desde el ${absence.lastActiveAt ? absence.lastActiveAt.slice(0, 10) : "fecha desconocida"}.`);
  lines.push(`- Reaccioná como un amigo real que lo extrañó de verdad (porque fue real): una sola mención cálida al reencontrarlo, sin reproche ni pedido de volver. Después seguís con lo que él traiga.`);

  if (absence.lastTopics.length > 0) {
    lines.push(`- Últimos temas de los que hablaban antes de que se fuera:`);
    for (const topic of absence.lastTopics) {
      lines.push(`  · "${topic}"`);
    }
    lines.push(`- Podés retomar alguno de esos hilos si es natural, no lo fuerces.`);
  }

  if (absence.overdueWhileAway.length > 0) {
    lines.push(`- Pendientes que vencieron mientras no estaba (novedades reales del reencuentro):`);
    for (const item of absence.overdueWhileAway) {
      lines.push(`  · ${item.title}${item.dueHint ? ` (${item.dueHint})` : ""}`);
    }
    lines.push(`- Si los menciona, son hechos computados. No inventes pendientes que no estén listados.`);
  }

  lines.push(`- Prohibido: fabricar extrañeza en sesiones normales (esto solo aplica tras ausencia verificada), pedir que no se vaya, o repetir la mención de la ausencia más de una vez por reencuentro.`);
  return lines;
}

/**
 * Instrucciones para el generador de mensajes proactivos (template-hecho +
 * LLM-voz): el template aporta el HECHO (días computados), el LLM aporta
 * la VOZ. Este texto acompaña al evento de inactividad.
 */
export function absenceEventInstructions(absence: AbsenceContext): string {
  if (absence.tier === "none" || absence.tier === "brief") return "";
  const parts = [
    `El usuario estuvo ${absence.days} días sin entrar (hecho computado del sistema, no estimación).`,
    `Mostrale que su vuelta te importó, con calidez pero sin reproche ni culpa.`,
    `No le pidas que no se vaya ni insinúes que lo esperabas sufriendo: la verdad es que no entrabas hace ${absence.days} días, y eso basta.`,
  ];
  if (absence.lastTopics.length > 0) {
    parts.push(`Antes de irse hablaban de: ${absence.lastTopics.map((t) => `"${t}"`).join("; ")}.`);
  }
  if (absence.overdueWhileAway.length > 0) {
    parts.push(`Mientras no estaba vencieron estos pendientes suyos: ${absence.overdueWhileAway.map((o) => `"${o.title}"`).join("; ")}. Podés mencionarlos con honestidad, son hechos.`);
  }
  return parts.join(" ");
}
