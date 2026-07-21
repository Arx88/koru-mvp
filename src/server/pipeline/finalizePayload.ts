/**
 * Finalize Payload Pipeline — extraído de koruBackend.ts (Task 11-PARTITION).
 *
 * Contiene:
 *  - normalizeUiBlock: normaliza un UiBlock crudo del LLM a tipado seguro.
 *  - normalizeSources / normalizeUnderstanding: normalizadores de sub-campos.
 *  - cleanReplyText: stripa reasoning + cleanup del reply del LLM.
 *  - replyFromBlocks: genera un reply textual sintético desde UiBlocks.
 *  - isGenericAgentReply: detecta replies genéricos a descartar.
 *  - hasUsefulBlockContent / mergeModelAndToolBlocks: merge de blocks.
 *  - normalizeFinalPayload: arma el KoruBackendTurnResponse final.
 *  - finalizeFromPlainText / finalizePayload / finalizePayloadWithFastModel:
 *    orquestan extractor de memoria + normalizeFinalPayload.
 *
 * Sin cambios de comportamiento respecto al original.
 */
import type {
  AssistantSource,
  AssistantPlanItem,
  Commitment,
  KoruState,
  LifeRecord,
  MemoryFact,
  MascotState,
  ToolCall,
  ToolResult,
  UiBlock,
} from "../../domain/types";
import { VALID_MASCOT_STATES } from "../../domain/types";
import { logger } from "../logger";
import {
  asArray,
  asRecord,
  cleanText,
  plainLower,
  extractJsonBlock,
  stripReasoning,
  sourceFromUrl,
  formatMatchDate,
  formatCompactNumber,
  formatRouteDistance,
  formatRouteDuration,
  initialsFromName,
  isTrivialInput,
  cityMemorySuggestion,
  buildMessages,
  buildEnhancementInstruction,
  callProvider,
  blocksFromToolResults,
  type ChatMessage,
  type KoruBackendTurnRequest,
  type KoruBackendTurnResponse,
  type KoruSuggestedAction,
  type KoruUnderstanding,
  type LocalActionData,
  type MemoryCaptureData,
  type PersonalCaptureData,
  type PersonalQueryData,
  type PlanData,
  type ProviderConfig,
  type ProviderToolCall,
  type SearchData,
  type ToolExecution,
  type WeatherData,
} from "../koruBackend";
import {
  extractMemoryWithJsonPrompt,
  normalizeMemoryCandidates,
  normalizeCommitments,
  normalizeRecords,
  normalizeSuggestedActions,
  uniqueCommitments,
  uniqueRecords,
  personalCapturesFromTools,
  localActionsFromTools,
  memoryCapturesFromTools,
} from "../memoryExtractor";

export function cleanReplyText(value: unknown): string {
  // 🔴 FIX P0: stripar reasoning PRIMERO, antes de cualquier otra limpieza
  return stripReasoning(cleanText(value))
    .replace(/\*?\s*uiBlock\s*:\s*[a-z_]+\s*\*?/gi, "")
    .replace(/\buiBlocks?\b\s*[:=]\s*\[[\s\S]*$/i, "")
    .replace(/\b(Hola|Gracias|Perfecto|Listo)(?=[A-ZÁÉÍÓÚÑ])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnderstanding(raw: unknown, input: string): KoruUnderstanding {
  const value = asRecord(raw);
  return {
    literalRequest: cleanText(value.literalRequest, input),
    userGoal: cleanText(value.userGoal, "Resolver el pedido con el menor esfuerzo posible."),
    unstatedNeeds: asArray(value.unstatedNeeds).map((item) => cleanText(item)).filter(Boolean),
    assumptions: asArray(value.assumptions).map((item) => cleanText(item)).filter(Boolean),
    confidence: typeof value.confidence === "number" ? Math.max(0, Math.min(1, value.confidence)) : 0.65,
  };
}

export function normalizeSources(value: unknown): AssistantSource[] {
  return asArray(value)
    .map(asRecord)
    .map((item) => {
      const title = cleanText(item.title);
      const url = cleanText(item.url);
      if (!title || !url) return null;
      return sourceFromUrl(title, url, cleanText(item.snippet));
    })
    .filter((item): item is AssistantSource => Boolean(item))
    .slice(0, 8);
}

export function normalizeUiBlock(value: unknown): UiBlock | null {
  const block = asRecord(value);
  const type = cleanText(block.type);
  if (type === "reminder") {
    const title = cleanText(block.title);
    return title ? {
      type: "reminder",
      title,
      dueText: cleanText(block.dueText ?? block.due_text),
      note: cleanText(block.note),
    } : null;
  }
  if (type === "alarm") {
    const title = cleanText(block.title, "Alarma");
    const time = cleanText(block.time);
    return time ? {
      type: "alarm",
      title,
      time,
      repeat: cleanText(block.repeat),
      note: cleanText(block.note),
    } : null;
  }
  if (type === "shopping_list") {
    const items = asArray(block.items).map((item) => cleanText(item)).filter(Boolean).slice(0, 20);
    return items.length ? {
      type: "shopping_list",
      title: cleanText(block.title, "Lista de compras"),
      items,
      dueText: cleanText(block.dueText ?? block.due_text),
      note: cleanText(block.note),
    } : null;
  }
  if (type === "saved_record") {
    const records = normalizeRecords(block.records);
    return records.length ? {
      type: "saved_record",
      title: cleanText(block.title, "Guardado"),
      records,
    } : null;
  }
  if (type === "money_summary") {
    return {
      type: "money_summary",
      title: cleanText(block.title, "Dinero"),
      total: typeof block.total === "number" ? block.total : undefined,
      currency: cleanText(block.currency),
      summaryItems: asArray(block.summaryItems ?? block.summary_items).map(asRecord).map((item) => ({
        label: cleanText(item.label, "Dato"),
        value: cleanText(item.value),
        detail: cleanText(item.detail),
      })).filter((item) => item.value).slice(0, 6),
      recommendation: cleanText(block.recommendation),
    };
  }
  if (type === "weather") {
    return {
      type: "weather",
      title: cleanText(block.title, "Clima"),
      city: cleanText(block.city),
      now: cleanText(block.now),
      range: cleanText(block.range),
      rain: cleanText(block.rain),
      wind: cleanText(block.wind),
      advice: cleanText(block.advice),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus))
        ? cleanText(block.sourceStatus) as Extract<UiBlock, { type: "weather" }>["sourceStatus"]
        : undefined,
      sources: normalizeSources(block.sources),
    };
  }
  if (type === "plan") {
    const items = asArray(block.items).map(asRecord).map((item): AssistantPlanItem => ({
      time: cleanText(item.time),
      title: cleanText(item.title, "Paso"),
      priority: ["Alta", "Media", "Baja"].includes(cleanText(item.priority)) ? cleanText(item.priority) as AssistantPlanItem["priority"] : undefined,
      durationMinutes: typeof item.durationMinutes === "number" ? item.durationMinutes : undefined,
      mode: ["focus", "quick", "admin", "recovery"].includes(cleanText(item.mode)) ? cleanText(item.mode) as AssistantPlanItem["mode"] : undefined,
      rationale: cleanText(item.rationale),
    })).slice(0, 6);
    return items.length ? { type: "plan", title: cleanText(block.title, "Plan"), items, note: cleanText(block.note) } : null;
  }
  if (type === "comparison") {
    const items = asArray(block.items).map(asRecord).map((item) => ({
      title: cleanText(item.title, "Opcion"),
      price: cleanText(item.price),
      vendor: cleanText(item.vendor),
      url: cleanText(item.url),
      evidence: cleanText(item.evidence),
      score: typeof item.score === "number" ? item.score : undefined,
    })).slice(0, 6);
    return items.length ? {
      type: "comparison",
      title: cleanText(block.title, "Comparativa"),
      items,
      criteria: asArray(block.criteria).map((item) => cleanText(item)).filter(Boolean),
      recommendation: cleanText(block.recommendation),
      sources: normalizeSources(block.sources),
    } : null;
  }
  if (type === "research_sources") {
    return {
      type: "research_sources",
      title: cleanText(block.title, "Fuentes"),
      summary: cleanText(block.summary, "Fuentes revisadas."),
      mode: ["news", "shopping", "research", "weather", "traffic", "market", "world"].includes(cleanText(block.mode))
        ? cleanText(block.mode) as Extract<UiBlock, { type: "research_sources" }>["mode"]
        : "research",
      sources: normalizeSources(block.sources),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus))
        ? cleanText(block.sourceStatus) as Extract<UiBlock, { type: "research_sources" }>["sourceStatus"]
        : undefined,
      followUpQuestion: cleanText(block.followUpQuestion),
    };
  }
  if (type === "clarifying_question") {
    return {
      type: "clarifying_question",
      title: cleanText(block.title, "Necesito un dato"),
      question: cleanText(block.question, "Que dato falta?"),
      expectedSlot: cleanText(block.expectedSlot),
      options: asArray(block.options).map((item) => cleanText(item)).filter(Boolean).slice(0, 3),
    };
  }
  if (type === "proactive_signal") {
    const category = cleanText(block.category);
    const severity = cleanText(block.severity);
    const title = cleanText(block.title);
    const body = cleanText(block.body);
    return title && body ? {
      type: "proactive_signal",
      category: ["world", "news", "market", "weather", "traffic", "health", "relationship", "home", "package", "sports", "general"].includes(category)
        ? category as Extract<UiBlock, { type: "proactive_signal" }>["category"]
        : "general",
      severity: ["info", "useful", "important", "urgent"].includes(severity)
        ? severity as Extract<UiBlock, { type: "proactive_signal" }>["severity"]
        : "useful",
      title,
      body,
      timestampLabel: cleanText(block.timestampLabel ?? block.timestamp_label),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus))
        ? cleanText(block.sourceStatus) as Extract<UiBlock, { type: "proactive_signal" }>["sourceStatus"]
        : undefined,
      actionLabel: cleanText(block.actionLabel ?? block.action_label),
      followUpQuestion: cleanText(block.followUpQuestion ?? block.follow_up_question),
      sources: normalizeSources(block.sources),
      summaryItems: asArray(block.summaryItems ?? block.summary_items).map(asRecord).map((item) => ({
        label: cleanText(item.label, "Dato"),
        value: cleanText(item.value),
        detail: cleanText(item.detail),
      })).filter((item) => item.value).slice(0, 4),
    } : null;
  }
  if (type === "web_nav") {
    const results = asArray(block.results).map(asRecord).map((item) => ({
      title: cleanText(item.title, "Resultado"),
      source: cleanText(item.source, "Web"),
      url: cleanText(item.url),
      type: ["article", "pdf", "description", "page"].includes(cleanText(item.type))
        ? cleanText(item.type) as Extract<UiBlock, { type: "web_nav" }>["results"][number]["type"]
        : "page" as const,
      readTime: cleanText(item.readTime ?? item.read_time),
    })).filter((item) => item.title && item.url).slice(0, 6);
    return results.length ? {
      type: "web_nav" as const,
      title: cleanText(block.title, "Web Navigation"),
      status: cleanText(block.status) === "loading" ? "loading" : cleanText(block.status) === "report" ? "report" : "complete",
      query: cleanText(block.query),
      url: cleanText(block.url),
      results,
    } : null;
  }
  return null;
}

export function hasUsefulBlockContent(block: UiBlock): boolean {
  if (block.type === "weather") {
    return Boolean(block.city || block.now || block.range || block.rain || block.wind || block.advice || block.sources?.length);
  }
  // 🔴 V5: a comparison card with `items.length === 0` is still useful if it
  // carries an honest `recommendation` or `sources` (the "Capa 2 honesta" del
  // plan V5). Antes se descartaba silenciosamente y el usuario perdía el note
  // honesto — ahora sobrevive si tiene algo que mostrar.
  if (block.type === "comparison") {
    return block.items.length > 0 || Boolean(block.recommendation || block.sources?.length);
  }
  if (block.type === "research_sources") return Boolean(block.summary || block.sources.length);
  if (block.type === "plan") return block.items.length > 0;
  if (block.type === "saved_record") return block.records.length > 0;
  if (block.type === "money_summary") return Boolean(block.total || block.summaryItems?.length || block.recommendation);
  // 🔴 FIX P2.3: nuevos tipos
  if (block.type === "recipe") return Boolean(block.name || block.title || block.instructions || block.ingredients?.length);
  if (block.type === "movie_review") return Boolean(block.title || block.poster || block.overview || block.rating);
  if (block.type === "book_review") return Boolean(block.title || block.cover || block.synopsis || block.author);
  // 🔴 FIX GAP-1: generation (image_generate) — descarta cards sin imágenes/preview.
  if (block.type === "generation") return Boolean(block.images?.length || block.preview || block.prompt);
  return true;
}

export function mergeModelAndToolBlocks(modelBlocks: UiBlock[], toolBlocks: UiBlock[]): UiBlock[] {
  const usefulModelBlocks = modelBlocks.filter(hasUsefulBlockContent);
  if (!toolBlocks.length) return usefulModelBlocks;
  if (!usefulModelBlocks.length) return toolBlocks;

  const merged: UiBlock[] = [];
  const usedToolIndexes = new Set<number>();
  for (const modelBlock of usefulModelBlocks) {
    const toolIndex = toolBlocks.findIndex((toolBlock, index) => !usedToolIndexes.has(index) && toolBlock.type === modelBlock.type);
    if (toolIndex < 0) {
      merged.push(modelBlock);
      continue;
    }
    const toolBlock = toolBlocks[toolIndex];
    usedToolIndexes.add(toolIndex);
    if (modelBlock.type === "weather" && toolBlock.type === "weather") {
      merged.push({
        ...modelBlock,
        city: modelBlock.city || toolBlock.city,
        now: modelBlock.now || toolBlock.now,
        range: modelBlock.range || toolBlock.range,
        rain: modelBlock.rain || toolBlock.rain,
        wind: modelBlock.wind || toolBlock.wind,
        advice: modelBlock.advice || toolBlock.advice,
        sourceStatus: modelBlock.sourceStatus ?? toolBlock.sourceStatus,
        sources: modelBlock.sources?.length ? modelBlock.sources : toolBlock.sources,
      });
      continue;
    }
    if (modelBlock.type === "comparison" && toolBlock.type === "comparison") {
      merged.push({
        ...modelBlock,
        items: modelBlock.items.length ? modelBlock.items : toolBlock.items,
        recommendation: modelBlock.recommendation || toolBlock.recommendation,
        sources: modelBlock.sources?.length ? modelBlock.sources : toolBlock.sources,
      });
      continue;
    }
    if (modelBlock.type === "research_sources" && toolBlock.type === "research_sources") {
      merged.push({
        ...modelBlock,
        summary: modelBlock.summary || toolBlock.summary,
        sources: modelBlock.sources.length ? modelBlock.sources : toolBlock.sources,
        sourceStatus: modelBlock.sourceStatus ?? toolBlock.sourceStatus,
      });
      continue;
    }
    if (modelBlock.type === "plan" && toolBlock.type === "plan") {
      merged.push({
        ...modelBlock,
        items: modelBlock.items.length ? modelBlock.items : toolBlock.items,
        note: modelBlock.note || toolBlock.note,
      });
      continue;
    }
    merged.push(modelBlock);
  }

  const finalBlocks = [
    ...merged,
    ...toolBlocks.filter((_, index) => !usedToolIndexes.has(index)),
  ];
  const seen = new Set<string>();
  return finalBlocks.filter((block) => {
    if (block.type === "saved_record" && block.records.every((record) => /^dato guardado$/i.test(record.title))) return false;
    const key = `${block.type}|${plainLower("title" in block && typeof block.title === "string" ? block.title : replyFromBlocks([block], ""))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

export function replyFromBlocks(blocks: UiBlock[], input: string): string {
  const first = blocks[0];
  if (!first) return "";
  if (first.type === "weather") {
    const facts = [
      first.city ? `En ${first.city}` : "El clima",
      first.now ? `${first.now} ahora` : undefined,
      first.range ? `rango ${first.range}` : undefined,
      first.rain ? `lluvia ${first.rain}` : undefined,
    ].filter(Boolean).join(", ");
    const outfit = /reuni[oó]n|poner|ropa|vestir|campera|chaqueta|paraguas/i.test(input)
      ? " Para reunion, ve prolijo y en capas; si sales tarde, lleva una chaqueta ligera."
      : "";
    return `${facts}. ${first.advice ?? ""}${outfit}`.replace(/\s+/g, " ").trim();
  }
  if (first.type === "plan") {
    const step = first.items[0];
    return step ? `Empezaria por: ${step.title}${step.durationMinutes ? ` (${step.durationMinutes} min)` : ""}.` : first.title ?? "Te deje un plan accionable.";
  }
  if (first.type === "comparison") {
    const best = first.items[0];
    return best ? `Te deje una comparativa inicial. Miraria primero ${best.title}${best.vendor ? ` en ${best.vendor}` : ""}.` : "Te deje una comparativa inicial con evidencia visible.";
  }
  if (first.type === "research_sources") {
    return first.sources.length
      ? `Traje fuentes para revisar sin inventar conclusiones: ${first.sources[0].domain}.`
      : first.summary;
  }
  if (first.type === "activity_group") {
    const firstSection = first.sections[0];
    const firstRow = firstSection?.rows?.[0];
    const firstTile = firstSection?.tiles?.[0];
    if (firstRow) return firstRow.title;
    if (firstTile) return `${firstTile.label}: ${firstTile.value}`;
    return first.subtitle ?? first.note ?? first.title;
  }
  if (first.type === "clarifying_question") return first.question;
  if (first.type === "reminder") return `Lo dejo como recordatorio: ${first.title}.`;
  if (first.type === "alarm") return `Prepare la alarma para ${first.time}.`;
  if (first.type === "shopping_list") {
    return /que|qué|cual|cu[aá]l|\?/i.test(input)
      ? `Tenes para comprar: ${first.items.join(", ")}.`
      : `Lo deje en compras: ${first.items.join(", ")}.`;
  }
  if (first.type === "saved_record") {
    const titles = first.records.map((record) => record.title).filter(Boolean);
    if (/comida/i.test(first.title ?? "") && titles.length) return `Guarde comida en casa: ${titles.slice(0, 4).join(", ")}.`;
    if (titles.length > 1) return `Guarde ${titles.length} datos: ${titles.slice(0, 3).join(", ")}.`;
    return `Guardado: ${titles[0] ?? "dato importante"}.`;
  }
  if (first.type === "money_summary") return first.recommendation ?? "Te deje el resumen de dinero.";
  if (first.type === "proactive_signal") return first.body;
  // 🔴 FIX: product_analysis (usado por food_info y otros)
  if (first.type === "product_analysis") {
    const name = first.product?.name ?? "Lo que pediste";
    const desc = first.product?.description;
    const rating = first.product?.rating;
    const parts: string[] = [];
    if (rating) parts.push(`Rating: ${rating}/10.`);
    if (desc) parts.push(desc.slice(0, 300));
    return parts.length > 0 ? `${name}. ${parts.join(" ")}` : `Te deje la info de ${name} en la tarjeta.`;
  }
  // 🔴 FIX P2.3: recipe (recipe_find)
  if (first.type === "recipe") {
    const name = first.name ?? first.title ?? "Receta";
    const parts: string[] = [name];
    if (first.category) parts.push(first.category);
    if (first.area) parts.push(first.area);
    if (first.ingredients?.length) parts.push(`${first.ingredients.length} ingredientes`);
    return `Te deje la receta de ${parts.join(" · ")} en la tarjeta.${first.videoUrl ? " Incluye video." : ""}`;
  }
  // 🔴 FIX P2.3: movie_review (movie_info)
  if (first.type === "movie_review") {
    const title = first.title ?? "Película";
    const parts: string[] = [];
    if (first.rating) parts.push(`Rating: ${first.rating}/10`);
    if (first.director) parts.push(`Dir: ${first.director}`);
    if (first.runtime) parts.push(first.runtime);
    return parts.length > 0 ? `${title}. ${parts.join(" · ")}.` : `Te deje la info de ${title} en la tarjeta.`;
  }
  // 🔴 FIX P2.3: book_review (book_info)
  if (first.type === "book_review") {
    const title = first.title ?? "Libro";
    const parts: string[] = [];
    if (first.author) parts.push(first.author);
    if (first.year) parts.push(first.year);
    return parts.length > 0 ? `${title} — ${parts.join(", ")}.` : `Te deje la info de ${title} en la tarjeta.`;
  }
  // 🔴 FIX: data_card (usado por varios tools)
  if (first.type === "data_card") {
    return first.title ?? "Te deje los datos en la tarjeta.";
  }
  // 🔴 FIX: live_match (usado por match_live)
  if (first.type === "live_match") {
    const home = first.homeName ?? first.homeTeam?.name ?? "";
    const away = first.awayName ?? first.awayTeam?.name ?? "";
    const hs = first.homeScore ?? first.homeTeam?.score;
    const as = first.awayScore ?? first.awayTeam?.score;
    if (home && away && hs !== undefined && as !== undefined) {
      return `${home} ${hs} - ${as} ${away}. Te deje el detalle en la tarjeta.`;
    }
    return "Te deje el resultado del partido en la tarjeta.";
  }
  // 🔴 FIX: restaurant_synthesis (usado por restaurant_deep_search)
  if (first.type === "restaurant_synthesis") {
    const topMatch = first.matches?.[0];
    if (topMatch) {
      return `Te deje el cruce de reseñas en la tarjeta. El más mencionado: ${topMatch.name}.`;
    }
    return "Te deje el cruce de reseñas en la tarjeta.";
  }
  // 🔴 FIX: crypto_portfolio (usado por crypto_price)
  if (first.type === "crypto_portfolio") {
    const item = first.items?.[0];
    if (item) {
      const change = item.change !== undefined ? (item.change >= 0 ? ` Subió ${item.change}%` : ` Bajó ${Math.abs(item.change)}%`) : "";
      return `${item.name} está en ${item.price}.${change} Te dejé el detalle en la tarjeta.`;
    }
    return "Te deje la cotización en la tarjeta.";
  }
  // 🔴 FIX: deliverable (usado por web_search y deep_research)
  if (first.type === "deliverable") {
    return first.summary ? `${first.summary.slice(0, 200)}` : "Te dejé el resultado en la tarjeta.";
  }
  return "";
}

export function isGenericAgentReply(reply: string): boolean {
  const normalized = reply.toLowerCase();
  return [
    "listo. te dejo lo importante y el siguiente paso.",
    "listo. te dejo lo importante en la tarjeta.",
    "no pude componer una respuesta util.",
  ].some((item) => normalized === item);
}

export function normalizeFinalPayload(
  raw: Record<string, unknown>,
  input: string,
  toolExecutions: ToolExecution[],
  extractedRaw?: Record<string, unknown>,
  prebuiltToolBlocks?: UiBlock[],
): KoruBackendTurnResponse {
  const modelBlocks = asArray(raw.uiBlocks).map(normalizeUiBlock).filter((block): block is UiBlock => Boolean(block));
  const mascotState = cleanText(raw.mascotState) || "idle";
  const validatedMascotState = VALID_MASCOT_STATES.includes(mascotState as MascotState)
    ? (mascotState as MascotState)
    : "idle";
  if (mascotState !== "idle" && !VALID_MASCOT_STATES.includes(mascotState as MascotState)) {
    console.warn(`[Koru] LLM returned invalid mascotState: "${mascotState}". Falling back to "idle".`);
  }
  // 🔴 FIX: usar toolBlocks pre-construidos si se pasan (ya enriquecidos con síntesis LLM)
  const toolBlocks = prebuiltToolBlocks ?? blocksFromToolResults(toolExecutions);
  // 🔴 FIX CRÍTICO: si hay toolBlocks (datos reales de tools), NO mezclar con modelBlocks
  // del LLM. Los modelBlocks pueden contener pensamiento del LLM en vez de datos reales.
  // Los toolBlocks son la fuente de verdad — los modelBlocks del LLM solo introducen ruido.
  const uiBlocks = toolBlocks.length > 0
    ? toolBlocks
    : mergeModelAndToolBlocks(modelBlocks, toolBlocks);
  const captures = personalCapturesFromTools(toolExecutions);
  const localActions = localActionsFromTools(toolExecutions);
  const memoryCaptures = memoryCapturesFromTools(toolExecutions);
  const toolResults: ToolResult[] = toolExecutions.map((execution, index) => {
    const resultAny = execution.result as Record<string, unknown>;
    const rawStatus = typeof resultAny?.status === "string" ? resultAny.status : "ok";
    const status: ToolResult["status"] = rawStatus === "failed" || rawStatus === "error"
      ? "failed"
      : rawStatus === "partial" || rawStatus === "no_data" || rawStatus === "need_city" || rawStatus === "needs_context"
        ? "needs_context"
        : "ok";
    const toolMap: Record<string, ToolCall["tool"]> = {
      weather: "weather",
      web_search: "web_search",
      shopping_compare: "shopping_compare",
      route_traffic: "route_traffic",
      calendar_reminder: "calendar_reminder",
      alarm: "alarm",
      alarm_set: "alarm",
      reminder_set: "calendar_reminder",
      countdown: "calendar_reminder",
      match_live: "match_live",
      match_schedule: "match_live",
      league_standings: "match_live",
      team_follow: "match_live",
      plan_day: "memory_recall",
      save_memory: "memory_recall",
      save_personal_item: "memory_recall",
      query_personal_context: "memory_recall",
      movie_info: "web_search",
      book_info: "web_search",
      game_info: "web_search",
      person_info: "web_search",
      person_filmography: "web_search",
      wikipedia_lookup: "web_search",
      dictionary_define: "web_search",
      math_calc: "web_search",
      unit_convert: "web_search",
      recipe_find: "web_search",
      recipe_by_ingredients: "web_search",
      food_info: "web_search",
      wine_pairing: "web_search",
      nutrition_calc: "web_search",
      restaurant_deep_search: "shopping_compare",
      restaurant_review_aggregate: "shopping_compare",
      crypto_price: "crypto_price",
      stock_quote: "crypto_price",
      exchange_history: "crypto_price",
      currency_convert: "crypto_price",
      news_topic: "web_search",
      trending_topic: "web_search",
      travel_itinerary: "route_traffic",
      flight_search: "route_traffic",
      hotel_search: "route_traffic",
      deep_research: "web_search",
      price_history: "shopping_compare",
      product_review: "shopping_compare",
    };
    return {
      id: execution.id || `tool_${index + 1}`,
      tool: toolMap[execution.name] ?? "web_search",
      status,
      summary: JSON.stringify(execution.result).slice(0, 500),
      data: execution.result,
      sources: normalizeSources(resultAny?.sources),
    };
  });
  const cleanedReply = cleanReplyText(raw.reply);
  const blockReply = replyFromBlocks(uiBlocks, input);

  // 🔴 FIX CRÍTICO Anti-alucinación: si algún tool marcó __forceHonestReply
  // (ej: match_live no encontró partidos), FORZAR el reply honesto.
  // El LLM tiende a inventar resultados cuando la tool devuelve "no_data".
  const honestForcedReply = toolExecutions
    .map(e => e.result as any)
    .find(r => r && r.__forceHonestReply);

  // 🔴 SAFETY NET FINAL: si después de toda la cadena de strippado el reply todavía
  // parece thinking del LLM (empieza con "The user", "I need to", etc.), reemplazar
  // con blockReply o mensaje de fallback. Esto es la última línea de defensa.
  const looksLikeThinking = /^(the user|i need to|let me|i should|i will|i'll|i am going to|i'm going to|step by step|first,?\s*i|okay,?\s*(so|i|let)|alright,?\s*(so|i|let))\b/i.test(cleanedReply);

  let finalReply: string;
  if (honestForcedReply) {
    // Si hay un honestReply forzado, usarlo SIEMPRE (prioridad máxima)
    finalReply = honestForcedReply.__honestReplyText || "No encontré datos sobre eso en este momento.";
  } else if (!cleanedReply || isGenericAgentReply(cleanedReply) || looksLikeThinking) {
    finalReply = blockReply || "Tuve un problema para armar la respuesta. ¿Me lo repetís de otra forma para ayudarte bien?";
  } else {
    finalReply = cleanedReply;
  }

  // 🔴 FIX CALIDAD: si el LLM dice "guardado/anotado/recordatorio" pero NO se creó
  // ningún commitment ni record, el LLM está mintiendo (dijo que guardó pero no lo hizo).
  // Crear un commitment sintético a partir del input para que al menos quede registrado.
  const saysSaved = /\b(guardado|anotado|recordatorio|avis[oé]|no me olvides|no te olvides|acordate|recuerda)\b/i.test(finalReply);
  const rawCommitments = asArray(raw.commitments);
  const rawRecords = asArray(raw.records);
  const hasCommitments = rawCommitments.length > 0 || captures.some(c => c.commitments?.length) || localActions.some(a => a.commitments?.length) || toolExecutions.some(e => Array.isArray((e.result as any)?.commitments));
  const hasRecords = rawRecords.length > 0 || captures.some(c => c.records?.length) || localActions.some(a => a.records?.length) || toolExecutions.some(e => Array.isArray((e.result as any)?.records));
  const synthCommitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] = [];
  if (saysSaved && !hasCommitments && !hasRecords && toolExecutions.length === 0) {
    synthCommitments.push({
      title: input.slice(0, 100),
      dueHint: "pendiente",
      status: "open" as const,
    });
    if (uiBlocks.length === 0) {
      uiBlocks.push({
        type: "reminder" as const,
        title: input.slice(0, 80),
        dueText: "pendiente",
      } as UiBlock);
    }
  }

  // 🔴 FIX UX: Si el reply es demasiado largo (>100 chars) Y hay un block informativo
  // (movie_review, recipe, book_review, weather, live_match, deliverable, etc.),
  // recortarlo al primer enunciado. Los datos van en la card, no en el texto.
  const informativeBlockTypes = new Set([
    "movie_review", "recipe", "book_review", "weather", "live_match",
    "deliverable", "market", "forex", "data_card", "web_nav",
    "restaurant_synthesis", "research_sources", "comparison",
    "crypto_portfolio", "data_ticker", "product_analysis",
    "generation", // 🔴 FIX GAP-1: image_generate
  ]);
  const hasInformativeBlock = uiBlocks.some(b => informativeBlockTypes.has(b.type));
  if (finalReply.length > 250 && hasInformativeBlock) {
    const firstSentence = finalReply.match(/^.{1,200}?[.!?](\s|$)/)?.[0];
    if (firstSentence && firstSentence.length < finalReply.length) {
      // Solo agregar "Te dejé el detalle en la tarjeta" si no lo dice ya
      const trimmed = firstSentence.trim();
      if (/tarjeta/i.test(trimmed)) {
        finalReply = trimmed;
      } else {
        finalReply = trimmed + " Te dejé el detalle en la tarjeta.";
      }
    }
  }
  // Si el reply menciona "tarjeta" dos veces, limpiar
  if (hasInformativeBlock) {
    finalReply = finalReply.replace(/Te dejé el detalle en la tarjeta\.?\s*$/i, "").trim();
    if (!/tarjeta/i.test(finalReply)) {
      finalReply += " Te dejé el detalle en la tarjeta.";
    }
  }
  const result: KoruBackendTurnResponse = {
    reply: finalReply,
    uiBlocks,
    suggestedActions: normalizeSuggestedActions(raw.suggestedActions),
    understanding: normalizeUnderstanding(raw.understanding, input),
    // 🔴 ARQUITECTURA NUEVA: el LLM es el ÚNICO extractor de memoria.
    // No hay más síntesis determinística con regex. El LLM ve las memorias
    // existentes, decide qué agregar, qué archivar y qué duplicar.
    memoryCandidates: [
      ...normalizeMemoryCandidates(raw.memoryCandidates),
      ...normalizeMemoryCandidates(extractedRaw?.memoryCandidates),
      ...captures.flatMap((capture) => capture.memoryCandidates ?? []),
      ...memoryCaptures.flatMap((capture) => capture.memoryCandidates ?? []),
    ].slice(0, 6),
    // 🔴 NUEVO: IDs de memorias que el LLM decidió archivar (contradicciones/cambios)
    archiveMemoryIds: [
      ...(Array.isArray(extractedRaw?.archiveMemoryIds) ? extractedRaw.archiveMemoryIds : []),
    ].filter((id: any) => typeof id === "string" && id.length > 0).slice(0, 10),
    commitments: uniqueCommitments([
      ...normalizeCommitments(raw.commitments),
      ...normalizeCommitments(extractedRaw?.commitments),
      ...captures.flatMap((capture) => capture.commitments ?? []),
      ...localActions.flatMap((action) => action.commitments ?? []),
      // 🔴 KORU 3.0 — EXTRAER commitments de toolResults.data (no de execution.result).
      // toolResults se construye arriba con data: execution.result, pero a veces
      // execution.result se modifica después. Usar toolResults.data es más confiable.
      ...toolResults.flatMap((tr: any) => {
        const comms = Array.isArray(tr?.data?.commitments) ? tr.data.commitments : [];
        if (comms.length > 0) {
          logger.info("normalizeFinalPayload", "EXTRACTED commitments from toolResults.data", {
            tool: tr.tool, count: comms.length,
          });
        }
        return comms;
      }),
      ...synthCommitments,
    ]).slice(0, 8),
    records: uniqueRecords([
      ...normalizeRecords(raw.records),
      ...normalizeRecords(extractedRaw?.records),
      ...captures.flatMap((capture) => capture.records ?? []),
      ...localActions.flatMap((action) => action.records ?? []),
      // 🔴 KORU 3.0 — EXTRAER records de toolResults.data
      ...toolResults.flatMap((tr: any) => {
        const recs = Array.isArray(tr?.data?.records) ? tr.data.records : [];
        return recs;
      }),
    ]).slice(0, 12),
    toolResults,
    stateEvents: [
      { kind: "thinking", label: "Entendiendo objetivo real" },
      ...(toolExecutions.length ? [{ kind: "searching" as const, label: "Usando herramientas reales" }] : []),
      { kind: "done", label: "Respuesta lista" },
    ],
    provider: "nvidia",
    mascotState: validatedMascotState,
    skippedBecauseBoundary: [...new Set([
      ...asArray(raw.skippedBecauseBoundary).map((v) => cleanText(v)).filter(Boolean),
      ...asArray(extractedRaw?.skippedBecauseBoundary).map((v) => cleanText(v)).filter(Boolean),
    ])],
    behaviorNotes: [...new Set([
      ...asArray(raw.behaviorNotes).map((v) => cleanText(v)).filter(Boolean),
      ...asArray(extractedRaw?.behaviorNotes).map((v) => cleanText(v)).filter(Boolean),
    ])],
  };
  // 🔴 KORU 3.0 — Bug fix: si NO hay uiBlocks Y NO hay toolResults con datos,
  // NO persistir commitments ni records. El memory extractor a veces interpreta
  // la pregunta del usuario ("qué recordás de mí") como un commitment a crear,
  // contaminando el store con basura. Solo persistir si hay cards reales o
  // tools que devolvieron datos.
  // 🔴 FIX: verificar también toolResults.data.commitments/records (no solo
  // execution.result) porque la estructura puede estar anidada.
  const hasUiBlocks = result.uiBlocks.length > 0;
  const hasToolData = toolResults.some((tr: any) => {
    const d = tr?.data;
    return d && (Array.isArray(d.records) && d.records.length > 0 || Array.isArray(d.commitments) && d.commitments.length > 0);
  });
  if (!hasUiBlocks && !hasToolData) {
    result.commitments = [];
    result.records = [];
  }
  // 🔴 KORU 3.0 — FALLBACK FINAL: si por alguna razón los commitments no se
  // extrajeron arriba, extraerlos AHORA de toolResults.data antes de retornar.
  // Esto es una safety net para garantizar que NUNCA se pierdan commitments.
  if (result.commitments.length === 0) {
    for (const tr of toolResults as any[]) {
      if (tr?.data?.commitments && Array.isArray(tr.data.commitments)) {
        result.commitments.push(...tr.data.commitments);
      }
    }
  }
  if (result.records.length === 0) {
    for (const tr of toolResults as any[]) {
      if (tr?.data?.records && Array.isArray(tr.data.records)) {
        result.records.push(...tr.data.records);
      }
    }
  }
  // 🔴 KIMI v6 — Bug fix adicional: si el único uiBlock es un reminder con la
  // pregunta del usuario como title, el commitment correspondiente es basura.
  // Ej: "que recordas de mi" → reminder con title="que recordas de mi" + commitment.
  // 🔴 KORU 3.0 — FIX: solo borrar si el title del reminder ES EXACTAMENTE el
  // input del usuario (no si comparten los primeros 15 chars). Antes borraba
  // recordatorios legítimos como "Llamar a Juan" cuando el input era "recordame
  // llamar a juan mañana a las 10" (comparten "llamar a juan").
  if (result.uiBlocks.length === 1 && result.uiBlocks[0].type === "reminder") {
    const reminderTitle = ((result.uiBlocks[0] as { title?: string }).title ?? "").toLowerCase().trim();
    const userInput = input.toLowerCase().trim();
    // Solo borrar si el title ES el input completo (caso de pregunta mal interpretada)
    const isExactMatch = reminderTitle.length > 5 && (
      reminderTitle === userInput ||
      reminderTitle.startsWith("que record") || // "que recordas de mi"
      reminderTitle.startsWith("recordame ") && reminderTitle === userInput
    );
    if (isExactMatch) {
      result.commitments = [];
      result.records = [];
    }
  }
  return result;
}


export async function finalizeFromPlainText(
  raw: Record<string, unknown>,
  toolCalls: ProviderToolCall[],
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  toolExecutions: ToolExecution[],
  extractorTimeout: number,
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter" | "minimax" | "bluesminds"; memoryModel?: string }> {
  const cityAction = cityMemorySuggestion(toolCalls, request.state);
  if (cityAction) raw.suggestedActions = [...asArray(raw.suggestedActions || []), cityAction];

  if (asArray(raw.suggestedActions || []).length === 0) {
    try {
      const { enhancementActions } = await buildEnhancementInstruction(request, config, toolExecutions);
      raw.suggestedActions = [...asArray(raw.suggestedActions || []), ...enhancementActions];
    } catch { /* ignorar */ }
  }

  return finalizePayload(request, config, raw, toolExecutions, extractorTimeout);
}

export async function finalizePayload(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  raw: Record<string, unknown>,
  toolExecutions: ToolExecution[],
  extractorTimeout: number,
): Promise<KoruBackendTurnResponse & { memoryFallbackReason?: string; memoryProvider?: "nvidia" | "openrouter" | "minimax" | "bluesminds"; memoryModel?: string }> {
  // OPTIMIZACIÓN: solo saltar el memory extractor para inputs triviales
  if (isTrivialInput(request.input)) {
    return normalizeFinalPayload(raw, request.input, toolExecutions);
  }
  try {
    const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, raw, extractorTimeout);
    return {
      ...normalizeFinalPayload(raw, request.input, toolExecutions, extracted.raw),
      memoryProvider: extracted.provider,
      memoryModel: extracted.model,
      memoryFallbackReason: extracted.fallbackReason,
    };
  } catch (error) {
    return {
      ...normalizeFinalPayload(raw, request.input, toolExecutions),
      memoryFallbackReason: error instanceof Error ? error.message : "memory-extractor-failed",
    };
  }
}

/**
 * Versión optimizada de finalizePayload que:
 * 1. Usa Flash model para TODO (síntesis + memory extractor)
 * 2. Si ya hay reply (del tool result), NO hace segunda llamada LLM
 * 3. Memory extractor SECUENCIAL (no paralelo) para evitar OOM
 */
export async function finalizePayloadWithFastModel(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  raw: Record<string, unknown>,
  toolExecutions: ToolExecution[],
  timeout: number,
  prebuiltToolBlocks?: UiBlock[],
): Promise<KoruBackendTurnResponse> {
  // Si el raw ya tiene reply (el tool devolvió respuesta directa), no hacer segunda llamada
  const existingReply = cleanText((raw as any).reply);
  if (existingReply && existingReply.length > 5) {
    // Memory extractor con Flash (secuencial, no paralelo)
    // 🔴 FIX: ejecutar el extractor incluso si NO hay tools, siempre que el input
    // no sea trivial. Esto captura revelaciones pasivas ("me encanta X", "estoy trabajando en Y").
    if (!isTrivialInput(request.input)) {
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, raw, timeout);
        return normalizeFinalPayload(raw, request.input, toolExecutions, extracted.raw, prebuiltToolBlocks);
      } catch {
        // si falla el extractor, igual devolver la respuesta
      }
    }
    return normalizeFinalPayload(raw, request.input, toolExecutions, undefined, prebuiltToolBlocks);
  }

  // Segunda llamada con Flash model para síntesis
  const messages = buildMessages(request);
  messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respondé con JSON puro válido. Sin markdown, sin backticks. El JSON debe empezar con { y terminar con }." });

  try {
    const result = await callProvider(config, messages, timeout, false, undefined, undefined, config.nvidiaModel);
    const content = cleanText(result.message.content, "");
    let parsed: any;
    try {
      parsed = JSON.parse(extractJsonBlock(content));
    } catch {
      parsed = { reply: cleanReplyText(content) || "No pude armar una respuesta clara." };
    }
    // Memory extractor con Flash (secuencial)
    // 🔴 FIX: ejecutar el extractor incluso si NO hay tools, siempre que el input
    // no sea trivial. Esto captura revelaciones pasivas ("me encanta X", "estoy trabajando en Y").
    if (!isTrivialInput(request.input)) {
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, config, toolExecutions, parsed, timeout);
        return normalizeFinalPayload(parsed, request.input, toolExecutions, extracted.raw, prebuiltToolBlocks);
      } catch {
        // si falla el extractor, igual devolver la respuesta
      }
    }
    return normalizeFinalPayload(parsed, request.input, toolExecutions, undefined, prebuiltToolBlocks);
  } catch {
    return normalizeFinalPayload(raw, request.input, toolExecutions);
  }
}
