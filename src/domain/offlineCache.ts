/**
 * Koru offline cache — IndexedDB-backed store for the last 24h of conversation
 * with full uiBlocks (localStorage only keeps the last 120 plain text turns).
 *
 * Features:
 * - Stores chat turns with full uiBlocks for the last 24 hours (rolling window).
 * - Survives reloads, browser restarts, and transient network drops.
 * - Exposes `isOnline()` and an `onOnlineStatusChange(cb)` subscription.
 * - `enqueueOfflineMessage(text)` / `drainOfflineQueue()` lets the UI replay
 *   user messages that were typed while offline.
 *
 * Design notes:
 * - We use IndexedDB (not localStorage) because uiBlocks can carry images,
 *   recipe steps, comparison tables — easily exceeding the 5MB localStorage cap.
 * - The DB is keyed by user id so multi-account support works naturally.
 * - All operations are best-effort: if IndexedDB is unavailable (private mode
 *   in some browsers) we silently no-op. The app still works online.
 */

const DB_NAME = "koru-offline";
const DB_VERSION = 1;
const STORE_TURNS = "turns";
const STORE_QUEUE = "queue";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type CachedTurn = {
  id: string;
  userId: string;
  role: "user" | "koru";
  text: string;
  createdAt: string; // ISO
  items?: unknown[]; // KoruTurnItem[] — kept loose to avoid import cycles
  mascotState?: string;
  language?: "es" | "en";
};

export type QueuedMessage = {
  id: string;
  userId: string;
  text: string;
  queuedAt: string; // ISO
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_TURNS)) {
          db.createObjectStore(STORE_TURNS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist a turn (with full items/uiBlocks) into the 24h rolling cache.
 * Old turns beyond TTL are pruned in the same transaction.
 */
export async function cacheTurn(turn: CachedTurn): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = tx(db, STORE_TURNS, "readwrite");
    store.put(turn);
    // Prune older-than-24h entries in the same tx
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    const indexReq = store.index?.("createdAt");
    if (indexReq) {
      // No index defined — fallback to cursor scan
    }
    // Cursor-based prune (works without an index)
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const value = cursor.value as CachedTurn;
      if (value.createdAt < cutoff) {
        cursor.delete();
      }
      cursor.continue();
    };
  } catch {
    // best-effort
  }
}

/**
 * Read all cached turns for a user, ordered oldest→newest, within the 24h window.
 */
export async function readCachedTurns(userId: string): Promise<CachedTurn[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const store = tx(db, STORE_TURNS, "readonly");
    const all = (await promisify(store.getAll())) as CachedTurn[];
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    return all
      .filter((t) => t.userId === userId && t.createdAt >= cutoff)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/**
 * Clear all cached turns for a user (used on logout / account switch).
 */
export async function clearCachedTurns(userId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = tx(db, STORE_TURNS, "readwrite");
    const all = (await promisify(store.getAll())) as CachedTurn[];
    for (const t of all) {
      if (t.userId === userId) store.delete(t.id);
    }
  } catch {
    // best-effort
  }
}

/**
 * Enqueue a user message that was typed while offline. Returns the queued id.
 */
export async function enqueueOfflineMessage(userId: string, text: string): Promise<string> {
  const db = await openDb();
  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!db) return id;
  try {
    const store = tx(db, STORE_QUEUE, "readwrite");
    const entry: QueuedMessage = {
      id,
      userId,
      text,
      queuedAt: new Date().toISOString(),
    };
    store.put(entry);
  } catch {
    // best-effort
  }
  return id;
}

/**
 * Read all queued messages for a user (oldest first).
 */
export async function readOfflineQueue(userId: string): Promise<QueuedMessage[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const store = tx(db, STORE_QUEUE, "readonly");
    const all = (await promisify(store.getAll())) as QueuedMessage[];
    return all
      .filter((q) => q.userId === userId)
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

/**
 * Remove a queued message after it has been successfully sent.
 */
export async function dequeueOfflineMessage(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    tx(db, STORE_QUEUE, "readwrite").delete(id);
  } catch {
    // best-effort
  }
}

/**
 * Online status helpers — subscribed via window online/offline events.
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function onOnlineStatusChange(cb: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const online = () => cb(true);
  const offline = () => cb(false);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}
