import { syncOutbox } from '@/lib/actions/spend'
import { completeMutations, putMutation, isOfflineStorageAvailable } from './db'
import { dueMutations } from './reducer'
import { nextAttemptDelay, hasExhaustedRetries } from './backoff'
import { getSnapshot, hydrate, setFlushing, notifyChanged } from './store'
import type { OutboxMutation, SyncResult } from './types'

/**
 * Foreground flush loop.
 *
 * Deliberately not in the service worker. Calling a Server Action means POSTing
 * a build-specific Next-Action id with a React-flight body; replaying that from
 * a worker means hand-forging Next internals that change between releases. And
 * iOS Safari has no Background Sync API, so a foreground path is required
 * anyway — building both would mean maintaining two engines.
 */

const BATCH_SIZE = 25
const POLL_INTERVAL_MS = 60_000
const LOCK_NAME = 'subtrack-outbox'

let inFlight: Promise<void> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

/** Ask the browser to keep our data; iOS evicts non-persisted storage. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    /* best effort only */
  }
}

export async function applyResults(batch: OutboxMutation[], results: SyncResult[]): Promise<void> {
  const byId = new Map(results.map((r) => [r.id, r]))
  const ackedSeqs: number[] = []
  const syncedEntityIds: string[] = []

  for (const mutation of batch) {
    const result = byId.get(mutation.id)
    if (!result) continue

    if (result.ok) {
      if (mutation.seq !== undefined) ackedSeqs.push(mutation.seq)
      syncedEntityIds.push(mutation.entityId)
      continue
    }

    const attempts = mutation.attempts + 1
    const terminal = result.terminal || hasExhaustedRetries(attempts)

    // Never delete on failure. A write we couldn't apply stays queued and stays
    // visible — silently dropping the user's expense is the one unforgivable bug.
    await putMutation({
      ...mutation,
      attempts,
      lastError: result.error ?? 'Sync failed',
      status: terminal ? 'failed' : 'pending',
      nextAttemptAt: terminal ? mutation.nextAttemptAt : Date.now() + nextAttemptDelay(attempts),
    })
  }

  if (ackedSeqs.length || syncedEntityIds.length) {
    await completeMutations(ackedSeqs, syncedEntityIds)
  }
}

/** Mark every item in a failed batch for retry without dropping any. */
export async function penalizeBatch(batch: OutboxMutation[], message: string): Promise<void> {
  for (const mutation of batch) {
    const attempts = mutation.attempts + 1
    await putMutation({
      ...mutation,
      attempts,
      lastError: message,
      // A transport failure says nothing about the write's validity, so it
      // never becomes terminal on its own — only the attempt ceiling does.
      status: hasExhaustedRetries(attempts) ? 'failed' : 'pending',
      nextAttemptAt: Date.now() + nextAttemptDelay(attempts),
    })
  }
}

async function runFlush(): Promise<void> {
  if (!isOfflineStorageAvailable() || !isOnline()) return

  setFlushing(true)
  try {
    // Loop so a large backlog drains in BATCH_SIZE chunks.
    for (;;) {
      await hydrate()
      const batch = dueMutations(getSnapshot().mutations, Date.now(), BATCH_SIZE)
      if (!batch.length) break

      try {
        const { results } = await syncOutbox(batch)
        await applyResults(batch, results)
      } catch {
        // Network died mid-flight. Nothing is removed; everything retries.
        await penalizeBatch(batch, 'Could not reach the server')
        break
      }

      if (batch.length < BATCH_SIZE) break
    }

    await hydrate()
    notifyChanged()
  } finally {
    setFlushing(false)
  }
}

/** Flush the queue. Concurrent calls (and other tabs) share one run. */
export function flush(): Promise<void> {
  if (inFlight) return inFlight

  const run = async () => {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      // Cross-tab mutex on top of server-side idempotency, not instead of it.
      await navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, () => runFlush())
    } else {
      await runFlush()
    }
  }

  inFlight = run().finally(() => {
    inFlight = null
  })
  return inFlight
}

/** Wire up every trigger. Returns a teardown for the provider's effect. */
export function startSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  const kick = () => {
    if (isOnline()) void flush()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') kick()
  }

  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', onVisibility)

  pollTimer = setInterval(() => {
    // Only while the tab is visible and there is actually something waiting.
    if (document.visibilityState !== 'visible') return
    if (!getSnapshot().mutations.length) return
    kick()
  }, POLL_INTERVAL_MS)

  void requestPersistence()
  kick()

  return () => {
    window.removeEventListener('online', kick)
    document.removeEventListener('visibilitychange', onVisibility)
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }
}
