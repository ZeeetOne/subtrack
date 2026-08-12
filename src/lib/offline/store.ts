import {
  readOutbox,
  readShadows,
  enqueueWithShadow,
  deleteShadows,
  isOfflineStorageAvailable,
} from './db'
import { coalesceOutbox } from './reducer'
import type { OutboxMutation, ShadowEntry } from './types'

/**
 * Module-level store behind useSyncExternalStore.
 *
 * Deliberately not useOptimistic: that state is scoped to the transition that
 * set it and is dropped once the action settles. An optimistic expense has to
 * survive minutes offline, plus reloads and navigation, so it lives in
 * IndexedDB with this as the in-memory mirror.
 */

export interface OutboxState {
  mutations: OutboxMutation[]
  shadows: ShadowEntry[]
  hydrated: boolean
  online: boolean
  flushing: boolean
}

const EMPTY_STATE: OutboxState = {
  mutations: [],
  shadows: [],
  hydrated: false,
  online: true,
  flushing: false,
}

let state: OutboxState = EMPTY_STATE
const listeners = new Set<() => void>()

const CHANNEL_NAME = 'subtrack-outbox'
let channel: BroadcastChannel | null = null

function emit() {
  for (const listener of listeners) listener()
}

function setState(patch: Partial<OutboxState>) {
  state = { ...state, ...patch }
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): OutboxState {
  return state
}

/** Must be referentially stable or React loops during hydration. */
export function getServerSnapshot(): OutboxState {
  return EMPTY_STATE
}

function broadcast() {
  channel?.postMessage({ type: 'changed' })
}

/** Re-read both stores from IndexedDB. Also picks up seqs assigned on write. */
export async function hydrate(): Promise<void> {
  if (!isOfflineStorageAvailable()) {
    setState({ hydrated: true })
    return
  }
  try {
    const [mutations, shadows] = await Promise.all([readOutbox(), readShadows()])
    setState({ mutations, shadows, hydrated: true })
  } catch {
    // A blocked or unavailable IDB must not take the app down; the user simply
    // loses offline queueing, not the ability to add expenses online.
    setState({ hydrated: true })
  }
}

export function initStore(): () => void {
  if (typeof window === 'undefined') return () => {}

  setState({ online: navigator.onLine })

  if (typeof BroadcastChannel !== 'undefined' && !channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = () => {
      void hydrate()
    }
  }

  const onOnline = () => setState({ online: true })
  const onOffline = () => setState({ online: false })
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  void hydrate()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

function upsertShadow(shadows: ShadowEntry[], shadow: ShadowEntry): ShadowEntry[] {
  const index = shadows.findIndex((s) => s.id === shadow.id)
  if (index === -1) return [...shadows, shadow]
  const next = [...shadows]
  next[index] = shadow
  return next
}

/**
 * Queue a write and paint its optimistic row.
 *
 * The in-memory update happens synchronously and before any await, so the row
 * is on screen in the same frame the user submits. Persisting to IndexedDB
 * follows; if that fails the row still shows and the mutation is retried.
 */
export async function enqueue(
  mutation: OutboxMutation,
  shadow: ShadowEntry | null
): Promise<void> {
  const { next, removedSeqs, appended } = coalesceOutbox(state.mutations, mutation)

  setState({
    mutations: next,
    shadows: shadow ? upsertShadow(state.shadows, shadow) : state.shadows,
  })

  if (!isOfflineStorageAvailable()) return

  try {
    // When coalescing folded this into an existing record there is nothing new
    // to append — only the superseded rows to clear.
    await enqueueWithShadow(
      appended ? mutation : { ...mutation, seq: undefined },
      shadow,
      removedSeqs
    )
    await hydrate()
    broadcast()
  } catch {
    // Keep the optimistic row: losing the queue entry is recoverable, silently
    // losing the user's expense from the screen is not.
  }
}

export async function dropShadows(ids: readonly string[]): Promise<void> {
  if (!ids.length) return
  setState({ shadows: state.shadows.filter((s) => !ids.includes(s.id)) })
  try {
    await deleteShadows(ids)
    broadcast()
  } catch {
    /* the in-memory drop already happened */
  }
}

export function setFlushing(flushing: boolean) {
  setState({ flushing })
}

export function notifyChanged() {
  broadcast()
}

/** Test seam. */
export function __resetStore() {
  state = EMPTY_STATE
  listeners.clear()
}
