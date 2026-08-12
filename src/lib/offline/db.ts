import { OFFLINE_DB_NAME } from './purge'
import type { OutboxMutation, ShadowEntry } from './types'

/**
 * Minimal promise wrapper over IndexedDB.
 *
 * Hand-rolled rather than pulling in idb/Dexie: this needs open, getAll, put,
 * delete and one keyed lookup, and the repo carries no data-layer library.
 *
 * The one real IDB trap is that a transaction auto-closes the moment the event
 * loop yields with no pending request. So the rule here is absolute: every
 * exported function opens its own transaction and awaits nothing except that
 * transaction's own requests. Never await anything else mid-transaction.
 */

const DB_VERSION = 1

export const STORE_OUTBOX = 'outbox'
export const STORE_SHADOW = 'shadow'
export const STORE_META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        // autoIncrement gives FIFO ordering for free, which is what guarantees
        // a category insert flushes before the entry that references it.
        const outbox = db.createObjectStore(STORE_OUTBOX, { keyPath: 'seq', autoIncrement: true })
        outbox.createIndex('by_entity', 'entityId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SHADOW)) {
        db.createObjectStore(STORE_SHADOW, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      // Another tab upgrading the schema would otherwise block it forever.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  }).catch((err) => {
    dbPromise = null
    throw err
  })

  return dbPromise
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Run `fn` inside one transaction and resolve when the transaction commits. */
async function withStores<T>(
  names: string[],
  mode: IDBTransactionMode,
  fn: (stores: Record<string, IDBObjectStore>) => T | Promise<T>
): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(names, mode)
  const stores: Record<string, IDBObjectStore> = {}
  for (const name of names) stores[name] = tx.objectStore(name)

  const settled = fn(stores)

  return new Promise<T>((resolve, reject) => {
    tx.oncomplete = () => Promise.resolve(settled).then(resolve, reject)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

// ---------- outbox ----------

export async function readOutbox(): Promise<OutboxMutation[]> {
  return withStores([STORE_OUTBOX], 'readonly', async (s) => {
    const all = await promisify(s[STORE_OUTBOX].getAll() as IDBRequest<OutboxMutation[]>)
    return all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  })
}

/** Append a mutation and delete any it supersedes, atomically. */
export async function commitOutbox(
  append: OutboxMutation | null,
  removeSeqs: readonly number[] = []
): Promise<void> {
  await withStores([STORE_OUTBOX], 'readwrite', (s) => {
    for (const seq of removeSeqs) s[STORE_OUTBOX].delete(seq)
    if (append) {
      // seq is assigned by the store; sending undefined would fail the keyPath.
      const { seq: _ignored, ...record } = append
      void _ignored
      s[STORE_OUTBOX].add(record)
    }
  })
}

export async function putMutation(mutation: OutboxMutation): Promise<void> {
  await withStores([STORE_OUTBOX], 'readwrite', (s) => {
    s[STORE_OUTBOX].put(mutation)
  })
}

/**
 * Delete acked mutations and stamp their shadows synced in ONE transaction.
 *
 * Atomicity matters: a crash between the two halves would either resurrect a
 * write that already landed, or leave an optimistic row that never clears.
 */
export async function completeMutations(
  seqs: readonly number[],
  syncedEntityIds: readonly string[],
  syncedAt: number = Date.now()
): Promise<void> {
  await withStores([STORE_OUTBOX, STORE_SHADOW], 'readwrite', (s) => {
    for (const seq of seqs) s[STORE_OUTBOX].delete(seq)
    for (const id of syncedEntityIds) {
      const getRequest = s[STORE_SHADOW].get(id) as IDBRequest<ShadowEntry | undefined>
      getRequest.onsuccess = () => {
        const shadow = getRequest.result
        if (shadow) s[STORE_SHADOW].put({ ...shadow, syncedAt })
      }
    }
  })
}

// ---------- shadow rows ----------

export async function readShadows(): Promise<ShadowEntry[]> {
  return withStores([STORE_SHADOW], 'readonly', (s) =>
    promisify(s[STORE_SHADOW].getAll() as IDBRequest<ShadowEntry[]>)
  )
}

/** Write the optimistic row and enqueue its mutation together. */
export async function enqueueWithShadow(
  mutation: OutboxMutation,
  shadow: ShadowEntry | null,
  removeSeqs: readonly number[] = []
): Promise<void> {
  await withStores([STORE_OUTBOX, STORE_SHADOW], 'readwrite', (s) => {
    for (const seq of removeSeqs) s[STORE_OUTBOX].delete(seq)
    const { seq: _ignored, ...record } = mutation
    void _ignored
    s[STORE_OUTBOX].add(record)
    if (shadow) s[STORE_SHADOW].put(shadow)
  })
}

export async function deleteShadows(ids: readonly string[]): Promise<void> {
  if (!ids.length) return
  await withStores([STORE_SHADOW], 'readwrite', (s) => {
    for (const id of ids) s[STORE_SHADOW].delete(id)
  })
}

// ---------- meta ----------

export async function readMeta<T>(key: string): Promise<T | undefined> {
  return withStores([STORE_META], 'readonly', async (s) => {
    const row = await promisify(
      s[STORE_META].get(key) as IDBRequest<{ key: string; value: T } | undefined>
    )
    return row?.value
  })
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await withStores([STORE_META], 'readwrite', (s) => {
    s[STORE_META].put({ key, value })
  })
}

/** Test seam: drop the cached connection so each test opens a fresh database. */
export function __resetDbForTests() {
  dbPromise = null
}
