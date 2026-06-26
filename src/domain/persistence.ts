import type { KoruState } from "./types";

const DB_NAME = "koru-local-first";
const DB_VERSION = 1;
const STATE_STORE = "state";
const SNAPSHOT_KEY = "current";
export const LEGACY_STORAGE_KEY = "koru.mvp.state.v1";

type PersistedSnapshot = {
  key: string;
  state: KoruState;
  updatedAt: string;
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No pude abrir IndexedDB."));
  });
}

function runStoreTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STATE_STORE, mode);
        const store = transaction.objectStore(STATE_STORE);
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

export async function readPersistedState(): Promise<KoruState | null> {
  const snapshot = await runStoreTransaction<PersistedSnapshot | undefined>("readonly", (store) =>
    store.get(SNAPSHOT_KEY),
  );
  return snapshot?.state ?? null;
}

export async function writePersistedState(state: KoruState): Promise<void> {
  const snapshot: PersistedSnapshot = {
    key: SNAPSHOT_KEY,
    state,
    updatedAt: state.updatedAt,
  };
  await runStoreTransaction<IDBValidKey>("readwrite", (store) => store.put(snapshot));
}

export async function clearPersistedState(): Promise<void> {
  await runStoreTransaction<undefined>("readwrite", (store) => store.delete(SNAPSHOT_KEY));
}

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
