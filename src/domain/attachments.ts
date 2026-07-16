/**
 * Koru note attachments — IndexedDB-backed blob store for files attached to
 * LifeRecords (images, PDFs, audio, etc.).
 *
 * Why a standalone DB? The existing `koru-offline` DB (see offlineCache.ts)
 * uses version 1 and would need a version bump + migration to add a new
 * object store. Bumping that version risks breaking already-deployed caches
 * in users' browsers (the onupgradeneeded handler runs once per version and
 * is hard to test retroactively). A separate DB keeps attachments isolated
 * and lets this module evolve independently.
 *
 * Storage layout:
 *   DB name    : "koru-attachments"
 *   DB version : 1
 *   Store      : "attachments"  (out-of-line keys)
 *   Key        : `attachment_${id}`   (matches the `blobKey` field on Attachment)
 *   Value      : Blob  (the raw file bytes, with its native mimeType)
 *
 * All operations are best-effort: if IndexedDB is unavailable (private mode
 * in some browsers) the public functions resolve to no-ops / null. The UI
 * continues to work — attachments just don't persist across reloads.
 */

const DB_NAME = "koru-attachments";
const DB_VERSION = 1;
const STORE_ATTACHMENTS = "attachments";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Out-of-line keys: we pass the key explicitly on put() instead of
        // using a keyPath. This lets us store the Blob directly as the value
        // (Blobs aren't structured-clonable through keyPath indirection
        // in older browsers — direct put() is the safe path).
        if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
          db.createObjectStore(STORE_ATTACHMENTS);
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

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Wait for a transaction to fully commit (used after put/delete). */
function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

function blobKey(id: string): string {
  return `attachment_${id}`;
}

/**
 * Persist a file (as a Blob) under `attachment_${id}`. Resolves void on
 * success or when IndexedDB is unavailable (best-effort).
 */
export async function saveAttachmentBlob(id: string, file: File): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_ATTACHMENTS, "readwrite");
    tx.objectStore(STORE_ATTACHMENTS).put(file, blobKey(id));
    await waitForTx(tx);
  } catch {
    // best-effort — UI keeps the Attachment metadata even if blob fails
  }
}

/**
 * Retrieve a stored Blob by attachment id. Returns null if not found or if
 * IndexedDB is unavailable.
 */
export async function getAttachmentBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_ATTACHMENTS, "readonly");
    const result = (await promisifyRequest(
      tx.objectStore(STORE_ATTACHMENTS).get(blobKey(id)),
    )) as Blob | undefined;
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a stored Blob by attachment id. No-op if missing or if IndexedDB
 * is unavailable.
 */
export async function deleteAttachmentBlob(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_ATTACHMENTS, "readwrite");
    tx.objectStore(STORE_ATTACHMENTS).delete(blobKey(id));
    await waitForTx(tx);
  } catch {
    // best-effort
  }
}

/**
 * Build an object URL for an attachment's blob. Returns null if the blob
 * can't be fetched. The caller is responsible for revoking the URL when
 * done (URL.revokeObjectURL) to avoid memory leaks.
 */
export async function getAttachmentObjectURL(id: string): Promise<string | null> {
  const blob = await getAttachmentBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
