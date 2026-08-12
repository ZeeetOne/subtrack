'use client'

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  initStore,
  enqueue,
  dropShadows,
  type OutboxState,
} from '@/lib/offline/store'
import { startSync } from '@/lib/offline/sync'
import type { OutboxMutation, ShadowEntry } from '@/lib/offline/types'

export interface OutboxContextValue extends OutboxState {
  /** Entry ids with a queued delete — hidden from the list immediately. */
  pendingDeletes: Set<string>
  /** Entry id -> its sync state, for the row's visual treatment. */
  pendingById: Map<string, 'queued' | 'failed'>
  pendingCount: number
  failedCount: number
  enqueue: (mutation: OutboxMutation, shadow: ShadowEntry | null) => Promise<void>
  dropShadows: (ids: readonly string[]) => Promise<void>
}

const OutboxContext = createContext<OutboxContextValue | null>(null)

export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => initStore(), [])
  useEffect(() => startSync(), [])

  const pendingDeletes = new Set<string>()
  const pendingById = new Map<string, 'queued' | 'failed'>()
  let failedCount = 0

  for (const mutation of state.mutations) {
    if (mutation.kind === 'entry.delete') pendingDeletes.add(mutation.entityId)
    if (mutation.status === 'failed') {
      failedCount++
      pendingById.set(mutation.entityId, 'failed')
    } else if (!pendingById.has(mutation.entityId)) {
      pendingById.set(mutation.entityId, 'queued')
    }
  }

  const value: OutboxContextValue = {
    ...state,
    pendingDeletes,
    pendingById,
    pendingCount: state.mutations.length,
    failedCount,
    enqueue,
    dropShadows,
  }

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
}

/**
 * Returns null outside the provider so components that render on both the
 * marketing pages and inside the dashboard don't have to branch.
 */
export function useOutbox(): OutboxContextValue | null {
  return useContext(OutboxContext)
}
