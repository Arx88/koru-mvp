import { useEffect, useState, useCallback } from "react";
import type { Commitment } from "../domain/types";

// ═══════════════════════════════════════════════════════════════════════════
// NotificationManager — gestiona notificaciones del navegador para recordatorios
// Mobile-first: funciona en PWA (Chrome/Samsung/iOS 16.4+)
// Multi-cuenta: cada usuario tiene sus propios recordatorios programados
// ═══════════════════════════════════════════════════════════════════════════

const SCHEDULED_KEY = "koru.scheduledReminders";

type ScheduledReminder = {
  commitmentId: string;
  userId: string;
  title: string;
  dueAt: string;
  notified: boolean;
};

function loadScheduled(): ScheduledReminder[] {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScheduled(reminders: ScheduledReminder[]): void {
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(reminders));
}

function hasNotificationSupport(): boolean {
  return typeof Notification !== "undefined";
}

export function getNotificationPermission(): NotificationPermission {
  if (!hasNotificationSupport()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!hasNotificationSupport()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNotification(title: string, body: string, options?: { tag?: string; icon?: string }): void {
  if (!hasNotificationSupport() || Notification.permission !== "granted") return;
  try {
    const notif = new Notification(title, {
      body,
      tag: options?.tag,
      icon: options?.icon ?? "/favicon.svg",
      badge: "/favicon.svg",
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch {
    // Fallback: some browsers require service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, { body, tag: options?.tag, icon: options?.icon ?? "/favicon.svg" });
      }).catch(() => {});
    }
  }
}

// Schedule a reminder notification for a commitment
export function scheduleReminderNotification(commitment: Commitment, userId: string): void {
  if (!commitment.dueAt) return;
  const reminders = loadScheduled();
  // Remove existing for this commitment
  const filtered = reminders.filter(r => r.commitmentId !== commitment.id);
  filtered.push({
    commitmentId: commitment.id,
    userId,
    title: commitment.title,
    dueAt: commitment.dueAt,
    notified: false,
  });
  saveScheduled(filtered);
}

// Check and fire due reminders — called from heartbeat
export function checkDueReminders(userId: string): { fired: ScheduledReminder[]; overdue: ScheduledReminder[] } {
  const reminders = loadScheduled().filter(r => r.userId === userId);
  const now = Date.now();
  const fired: ScheduledReminder[] = [];
  const overdue: ScheduledReminder[] = [];

  for (const r of reminders) {
    if (r.notified) continue;
    const dueTime = new Date(r.dueAt).getTime();
    if (isNaN(dueTime)) continue;

    const diffMs = dueTime - now;
    // 🔴 FIX CRÍTICO: solo disparar si YA venció (diffMs <= 0).
    // NO disparar si está "por vencer en 2 min" — eso causaba que se disparara
    // inmediatamente al crear el reminder.
    if (diffMs <= 0) {
      const isOverdue = diffMs < -60 * 1000; // more than 1 min overdue
      showNotification(
        isOverdue ? "Se te pasó" : "Recordatorio",
        r.title,
        { tag: r.commitmentId }
      );
      r.notified = true;
      if (isOverdue) overdue.push(r);
      else fired.push(r);
    }
  }

  // Update notified state
  saveScheduled(reminders);
  return { fired, overdue };
}

// 🔴 NUEVO: programar setTimeout preciso para que la notificación dispare EXACTO
// cuando llega la hora, no esperar al próximo heartbeat tick (que puede tardar 60s).
const activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function schedulePreciseTimeout(commitmentId: string, dueAt: string, title: string, userId: string): void {
  // Cancelar timeout existente para este reminder
  const existing = activeTimeouts.get(commitmentId);
  if (existing) clearTimeout(existing);

  const dueTime = new Date(dueAt).getTime();
  const now = Date.now();
  const delay = dueTime - now;

  if (delay <= 0) {
    // Ya venció — disparar inmediatamente
    showNotification("Recordatorio", title, { tag: commitmentId });
    // Marcar como notificado
    const reminders = loadScheduled();
    const r = reminders.find(r => r.commitmentId === commitmentId);
    if (r) { r.notified = true; saveScheduled(reminders); }
    return;
  }

  // Programar notificación precisa
  const timeout = setTimeout(() => {
    showNotification("Recordatorio", title, { tag: commitmentId });
    // Marcar como notificado
    const reminders = loadScheduled();
    const r = reminders.find(r => r.commitmentId === commitmentId);
    if (r) { r.notified = true; saveScheduled(reminders); }
    activeTimeouts.delete(commitmentId);
  }, delay);

  activeTimeouts.set(commitmentId, timeout);
}

// Re-sync scheduled reminders with current commitments (on app load)
export function syncScheduledReminders(commitments: Commitment[], userId: string): void {
  const existing = loadScheduled().filter(r => r.userId === userId);
  const commitmentIds = new Set(commitments.filter(c => c.status === "open").map(c => c.id));

  // Remove scheduled reminders for commitments that no longer exist or are done
  const filtered = existing.filter(r => commitmentIds.has(r.commitmentId));

  // Add new commitments that have dueAt but aren't scheduled
  for (const c of commitments) {
    if (c.status !== "open" || !c.dueAt) continue;
    if (!filtered.find(r => r.commitmentId === c.id)) {
      filtered.push({
        commitmentId: c.id,
        userId,
        title: c.title,
        dueAt: c.dueAt,
        notified: false,
      });
    }
  }

  saveScheduled(filtered);

  // 🔴 Programar timeouts precisos para todos los reminders no notificados
  for (const r of filtered) {
    if (!r.notified) {
      schedulePreciseTimeout(r.commitmentId, r.dueAt, r.title, userId);
    }
  }
}

// Hook for React components
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission());

  const request = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");
    return granted;
  }, []);

  // Auto-request on first reminder (called when user creates first reminder)
  const ensurePermission = useCallback(async () => {
    if (permission === "default") {
      return await request();
    }
    return permission === "granted";
  }, [permission, request]);

  return { permission, request, ensurePermission, showNotification };
}
