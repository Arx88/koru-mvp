/**
 * 🐱 Migración de namespace koru.* → michi.* — la capa técnica que sobrevivió
 * al rebrand como deuda consciente. Esta es la migración prometida: mueve los
 * DATOS del usuario (localStorage + IndexedDB) al nuevo namespace sin
 * perderlos, y corre ANTES de que la app lea storage (main.tsx la awaited
 * antes del primer render).
 *
 * Propiedades:
 * - Idempotente: si no queda nada bajo koru.*, no hace nada.
 * - Conservadora: si una clave/DB michi.* ya tiene datos, gana la nueva
 *   (escenario downgrade) y la vieja se descarta.
 * - Los endpoints /api/koru/* quedan como ALIAS en el servidor (compat),
 *   por eso acá solo migran storage y DBs, no llamadas de red.
 */

const OLD_PREFIX = "koru.";
const NEW_PREFIX = "michi.";

type LegacyDbMigration = {
  /** Nombre viejo (koru-*) a copiar y eliminar. */
  from: string;
  /** Nombre nuevo (michi-*) dueño del schema actual. */
  to: string;
  /** Versión con que la app abre la DB nueva (debe crear el schema completo). */
  version: number;
  /** Crea los object stores si faltan (el mismo upgrade del módulo dueño). */
  upgrade: (db: IDBDatabase) => void;
};

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request error"));
  });
}

// ── localStorage: swap genérico de prefijo ─────────────────────────────
// Genérico a propósito: cubre claves dinámicas (koru.create.lastCollection.*,
// koru.plan.progress.*) sin enumerarlas. Si michi.* ya existe, gana la nueva.

export function migrateLocalStorageNamespace(): string[] {
  const migrated: string[] = [];
  if (typeof localStorage === "undefined") return migrated;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (!key.startsWith(OLD_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value === null) continue;
      const nextKey = NEW_PREFIX + key.slice(OLD_PREFIX.length);
      if (localStorage.getItem(nextKey) === null) {
        localStorage.setItem(nextKey, value);
      }
      localStorage.removeItem(key);
      migrated.push(key);
    }
  } catch {
    // storage bloqueado (modo privado, permisos) — la app sigue su curso.
  }
  return migrated;
}

// ── IndexedDB: copia store por store y borrado de la vieja ────────────

function openLegacySource(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      // Sin versión: abre la DB existente tal cual (nunca dispara upgrade).
      const req = indexedDB.open(name);
      req.onupgradeneeded = () => {
        // No existía: open está creando una v1 vacía. Abortar el versionchange
        // descarta la DB recién creada (comportamiento del spec de IndexedDB),
        // sin dejar residuo.
        try {
          req.transaction?.abort();
        } catch {
          /* noop */
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function openTarget(spec: LegacyDbMigration): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(spec.to, spec.version);
    req.onupgradeneeded = () => spec.upgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`No pude abrir ${spec.to}`));
  });
}

function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  return requestAsPromise(tx.objectStore(storeName).count());
}

function copyStore(source: IDBDatabase, target: IDBDatabase, storeName: string): Promise<number> {
  // Lecturas: ambas requests se emiten sincrónicas en la MISMA transacción.
  const readTx = source.transaction(storeName, "readonly");
  const readStore = readTx.objectStore(storeName);
  const recordsPromise = requestAsPromise(readStore.getAll());
  const keysPromise = readStore.keyPath === null ? requestAsPromise(readStore.getAllKeys()) : Promise.resolve(null);
  // Escrituras: transacción propia en el target, puts sincrónicos.
  return Promise.all([recordsPromise, keysPromise]).then(([records, keys]) => {
    return new Promise<number>((resolve, reject) => {
      const writeTx = target.transaction(storeName, "readwrite");
      const writeStore = writeTx.objectStore(storeName);
      records.forEach((record, index) => {
        // keyPath stores llevan la clave adentro del registro; out-of-line
        // (attachments) la reciben explícita para preservar identidades.
        if (keys) writeStore.put(record, keys[index]);
        else writeStore.put(record);
      });
      writeTx.oncomplete = () => resolve(records.length);
      writeTx.onerror = () => reject(writeTx.error ?? new Error(`No pude copiar ${storeName}`));
      writeTx.onabort = () => reject(writeTx.error ?? new Error(`Copia abortada: ${storeName}`));
    });
  });
}

function deleteLegacyDb(name: string): void {
  // Fire-and-forget deliberado: si otra pestaña vieja retiene la conexión,
  // el delete queda encolado (onblocked) y se completa cuando la cierren.
  // No puede bloquear el boot de esta pestaña.
  try {
    const req = indexedDB.deleteDatabase(name);
    req.onblocked = () => console.warn(`[michi] DB vieja ${name} retenida por otra pestaña; se borra al cerrarla.`);
  } catch {
    /* noop */
  }
}

async function migrateOneDb(spec: LegacyDbMigration): Promise<boolean> {
  const source = await openLegacySource(spec.from);
  if (!source) return false;
  const storeNames = Array.from(source.objectStoreNames);
  if (storeNames.length === 0) {
    source.close();
    deleteLegacyDb(spec.from);
    return false;
  }
  const target = await openTarget(spec);
  let copied = 0;
  for (const storeName of storeNames) {
    if (!target.objectStoreNames.contains(storeName)) {
      console.warn(`[michi] ${spec.from} tiene el store "${storeName}" que ya no existe en ${spec.to}; se descarta.`);
      continue;
    }
    // Conservador: si el store nuevo ya tiene datos, gana lo nuevo.
    if ((await countStore(target, storeName)) > 0) continue;
    copied += await copyStore(source, target, storeName);
  }
  source.close();
  target.close();
  deleteLegacyDb(spec.from);
  if (copied > 0) console.info(`[michi] ${spec.from} → ${spec.to}: ${copied} registros migrados.`);
  return true;
}

export async function migrateIndexedDbNamespaces(specs: LegacyDbMigration[]): Promise<string[]> {
  const migrated: string[] = [];
  if (typeof indexedDB === "undefined") return migrated;
  for (const spec of specs) {
    try {
      if (await migrateOneDb(spec)) migrated.push(spec.from);
    } catch (error) {
      console.warn(`[michi] migración de ${spec.from} falló (se reintenta en el próximo boot):`, error);
    }
  }
  return migrated;
}
