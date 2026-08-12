/**
 * Wipe every trace of the signed-in user from this device.
 *
 * The service worker caches authenticated HTML (/dashboard, /expenses, …) so
 * the app can open offline. On a shared device that cache would otherwise stay
 * readable after sign-out, so it must be purged as part of signing out — not
 * as a nice-to-have.
 */

export const OFFLINE_DB_NAME = 'subtrack'

/** Ask the active service worker to drop its cache. Resolves either way. */
function purgeServiceWorkerCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    // Don't let a wedged worker block sign-out.
    const timer = setTimeout(resolve, 1500)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        const worker = registration.active
        if (!worker) return done()

        const channel = new MessageChannel()
        channel.port1.onmessage = done
        worker.postMessage({ type: 'PURGE' }, [channel.port2])
      })
      .catch(done)
  })
}

/** Delete the local outbox/shadow database. No-op if it was never created. */
function purgeIndexedDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve()

  return new Promise((resolve) => {
    // `blocked` fires when another tab still holds the DB open; resolve anyway
    // rather than hanging sign-out on a tab the user may never close.
    const timer = setTimeout(resolve, 1500)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.deleteDatabase(OFFLINE_DB_NAME)
    } catch {
      return done()
    }
    request.onsuccess = done
    request.onerror = done
    request.onblocked = done
  })
}

/** Purge cached pages and local data. Safe to call when neither exists yet. */
export async function purgeLocalData(): Promise<void> {
  await Promise.all([purgeServiceWorkerCache(), purgeIndexedDb()])
}
