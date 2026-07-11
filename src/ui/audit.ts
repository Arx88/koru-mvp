/**
 * Fase 2.6 — Audit extraído de KoruProvider.tsx.
 *
 * Funciones de auditoría QA para reproducir sesiones completas.
 * Se activan con ?koruAudit=1 en la URL.
 */
import type { KoruState } from "../domain/types";
import type { KoruTurnItem } from "../domain/turn";

const AUDIT_FLAG_KEY = "koru.audit.enabled";
const AUDIT_SESSION_KEY = "koru.audit.session";

export function auditEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("koruAudit") === "1") {
      sessionStorage.setItem(AUDIT_FLAG_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(AUDIT_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function auditSessionId(): string {
  try {
    const existing = sessionStorage.getItem(AUDIT_SESSION_KEY);
    if (existing) return existing;
    const next = `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(AUDIT_SESSION_KEY, next);
    return next;
  } catch {
    return `audit_${Date.now().toString(36)}`;
  }
}

export function writeAuditEvent(event: Record<string, unknown>) {
  if (!auditEnabled()) return;
  void fetch("/koru-audit/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: auditSessionId(),
      clientAt: new Date().toISOString(),
      ...event,
    }),
  }).catch(() => undefined);
}

export function auditStateSnapshot(state: KoruState) {
  return {
    userName: state.userName,
    stage: state.stage,
    trustedEnergy: state.trustedEnergy,
    totalEnergy: state.totalEnergy,
    counts: {
      memories: state.memories.length,
      confirmedMemories: state.memories.filter((memory) => memory.status === "confirmed").length,
      commitments: state.commitments.length,
      openCommitments: state.commitments.filter((commitment) => commitment.status === "open").length,
      actions: state.actions.length,
      records: state.records.length,
      entries: state.entries.length,
      nudges: state.nudges.length,
      modelCalls: state.modelCalls.length,
    },
    latest: {
      memories: state.memories.slice(0, 8).map((memory) => ({
        id: memory.id,
        kind: memory.kind,
        status: memory.status,
        sensitivity: memory.sensitivity,
        confidence: memory.confidence,
        text: memory.text,
        rootQuote: memory.rootQuote,
      })),
      commitments: state.commitments.slice(0, 8).map((commitment) => ({
        id: commitment.id,
        title: commitment.title,
        dueHint: commitment.dueHint,
        dueAt: commitment.dueAt,
        status: commitment.status,
        recurrence: commitment.recurrence,
      })),
      actions: state.actions.slice(0, 8).map((action) => ({
        id: action.id,
        kind: action.kind,
        title: action.title,
        status: action.status,
        approvalRequired: action.approvalRequired,
        uiBlockType: action.payload.uiBlock?.type,
        webMode: action.payload.webMode,
        externalStatus: action.payload.externalStatus,
        result: action.result,
      })),
      records: state.records.slice(0, 8).map((record) => ({
        id: record.id,
        domain: record.domain,
        kind: record.kind,
        title: record.title,
        value: record.value,
        dueHint: record.dueHint,
        amount: record.amount,
        currency: record.currency,
        person: record.person,
        url: record.url,
      })),
      modelCalls: state.modelCalls.slice(0, 5).map((call) => ({
        provider: call.provider,
        model: call.model,
        success: call.success,
        latencyMs: call.latencyMs,
        summary: call.summary,
        error: call.error,
      })),
    },
    runtime: {
      freeLlmApiEnabled: state.runtime.freeLlmApiEnabled,
      openModelEnabled: state.runtime.openModelEnabled,
      embeddingsEnabled: state.runtime.embeddingsEnabled,
      freeLlmApiModel: state.runtime.freeLlmApiModel,
      openModelModel: state.runtime.openModelModel,
    },
  };
}

export function auditTurnItems(items?: KoruTurnItem[]) {
  return (items ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    tag: item.tag,
    text: item.text,
    status: item.status,
    actionKind: item.actionKind,
    uiBlockType: item.uiBlock?.type,
    webMode: item.webMode,
    externalStatus: item.externalStatus,
    result: item.result,
    records: item.records,
    questions: item.questions,
    missingContext: item.missingContext,
    searchQueries: item.searchQueries,
    researchCriteria: item.researchCriteria,
    sources: item.sources,
    planItems: item.planItems,
  }));
}

export function auditStateDelta(previous: KoruState, next: KoruState) {
  return {
    addedMemories: next.memories
      .filter((memory) => !previous.memories.some((existing) => existing.id === memory.id))
      .map((memory) => ({
        id: memory.id,
        kind: memory.kind,
        status: memory.status,
        sensitivity: memory.sensitivity,
        confidence: memory.confidence,
        text: memory.text,
        rootQuote: memory.rootQuote,
      })),
    addedCommitments: next.commitments
      .filter((commitment) => !previous.commitments.some((existing) => existing.id === commitment.id))
      .map((commitment) => ({
        id: commitment.id,
        title: commitment.title,
        dueHint: commitment.dueHint,
        dueAt: commitment.dueAt,
        status: commitment.status,
        recurrence: commitment.recurrence,
      })),
    addedActions: next.actions
      .filter((action) => !previous.actions.some((existing) => existing.id === action.id))
      .map((action) => ({
        id: action.id,
        kind: action.kind,
        title: action.title,
        status: action.status,
        approvalRequired: action.approvalRequired,
        uiBlockType: action.payload.uiBlock?.type,
        webMode: action.payload.webMode,
        externalStatus: action.payload.externalStatus,
        result: action.result,
      })),
    addedRecords: next.records
      .filter((record) => !previous.records.some((existing) => existing.id === record.id))
      .map((record) => ({
        id: record.id,
        domain: record.domain,
        kind: record.kind,
        title: record.title,
        value: record.value,
        dueHint: record.dueHint,
        amount: record.amount,
        currency: record.currency,
        person: record.person,
        url: record.url,
      })),
    addedEntries: next.entries
      .filter((entry) => !previous.entries.some((existing) => existing.id === entry.id))
      .map((entry) => ({
        id: entry.id,
        text: entry.text,
        summary: entry.summary,
        sentiment: entry.sentiment,
        energyAwarded: entry.energyAwarded,
        memoryIds: entry.memoryIds,
        commitmentIds: entry.commitmentIds,
        actionIds: entry.actionIds,
        recordIds: entry.recordIds,
        activeMemoryIds: entry.activeMemoryIds,
        brainProvider: entry.brainProvider,
        brainModel: entry.brainModel,
      })),
  };
}
