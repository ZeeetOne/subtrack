import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach } from 'vitest'

/**
 * A real IndexedDB implementation in Node, so the offline storage layer can be
 * tested without a browser — and therefore without a logged-in session.
 *
 * Each test gets a fresh factory. Sharing one across tests would let a queued
 * mutation from an earlier case leak in and make the "nothing was deleted"
 * assertions pass for the wrong reason.
 */
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  const { __resetDbForTests } = await import('./src/lib/offline/db')
  __resetDbForTests()
})
