import type { KoruState } from "./types";

const DB_NAME = "koru-local-first";
const DB_VERSION = 2; // 🔴 Subido a v2 para agregar el store de cuentas
const STATE_STORE = "state";
const ACCOUNTS_STORE = "accounts";
const LEGACY_SNAPSHOT_KEY = "current"; // backward compat
export const LEGACY_STORAGE_KEY = "koru.mvp.state.v1";
const ACTIVE_USER_KEY = "koru.activeUserId";

type PersistedSnapshot = {
  key: string;
  state: KoruState;
  updatedAt: string;
};

type AccountRecord = {
  userId: string;
  userName: string;
  createdAt: string;
  avatarColor: string;
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB no esta disponible."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: "key" });
      }
      // 🔴 Multi-cuenta: store para listar todas las cuentas
      if (!database.objectStoreNames.contains(ACCOUNTS_STORE)) {
        database.createObjectStore(ACCOUNTS_STORE, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No pude abrir IndexedDB."));
  });
}

function runStoreTransaction<T>(
  mode: IDBTransactionMode,
  storeName: string,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("No pude leer la memoria local."));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("No pude guardar la memoria local."));
        };
      }),
  );
}

// ── State persistence (por userId) ──

function stateKey(userId: string): string {
  return `user:${userId}`;
}

export async function readPersistedState(userId?: string): Promise<KoruState | null> {
  const key = userId ? stateKey(userId) : LEGACY_SNAPSHOT_KEY;
  const snapshot = await runStoreTransaction<PersistedSnapshot | undefined>("readonly", STATE_STORE, (store) =>
    store.get(key),
  );
  // 🔴 Backward compat: si no encuentro por userId, intentar con key legacy "current"
  if (!snapshot && userId) {
    const legacy = await runStoreTransaction<PersistedSnapshot | undefined>("readonly", STATE_STORE, (store) =>
      store.get(LEGACY_SNAPSHOT_KEY),
    );
    return legacy?.state ?? null;
  }
  return snapshot?.state ?? null;
}

export async function writePersistedState(state: KoruState): Promise<void> {
  const key = state.userId ? stateKey(state.userId) : LEGACY_SNAPSHOT_KEY;
  const snapshot: PersistedSnapshot = {
    key,
    state,
    updatedAt: state.updatedAt,
  };
  await runStoreTransaction<IDBValidKey>("readwrite", STATE_STORE, (store) => store.put(snapshot));
}

export async function clearPersistedState(userId?: string): Promise<void> {
  const key = userId ? stateKey(userId) : LEGACY_SNAPSHOT_KEY;
  await runStoreTransaction<undefined>("readwrite", STATE_STORE, (store) => store.delete(key));
}

// ── Account management (multi-cuenta) ──

export async function listAccounts(): Promise<AccountRecord[]> {
  try {
    const records = await runStoreTransaction<AccountRecord[]>("readonly", ACCOUNTS_STORE, (store) =>
      store.getAll(),
    );
    return records ?? [];
  } catch {
    return [];
  }
}

export async function saveAccount(account: AccountRecord): Promise<void> {
  await runStoreTransaction<IDBValidKey>("readwrite", ACCOUNTS_STORE, (store) => store.put(account));
}

export async function deleteAccount(userId: string): Promise<void> {
  await runStoreTransaction<undefined>("readwrite", ACCOUNTS_STORE, (store) => store.delete(userId));
  await clearPersistedState(userId);
}

export function getActiveUserId(): string {
  return localStorage.getItem(ACTIVE_USER_KEY) ?? "default";
}

export function setActiveUserId(userId: string): void {
  localStorage.setItem(ACTIVE_USER_KEY, userId);
}

// ── Legacy state (localStorage fallback) ──

export function readLegacyState(): KoruState | null {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as KoruState) : null;
  } catch {
    return null;
  }
}

export function writeLegacyState(state: KoruState): void {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort fallback cache only.
  }
}

export function clearLegacyState(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Best-effort fallback cache only.
  }
}
