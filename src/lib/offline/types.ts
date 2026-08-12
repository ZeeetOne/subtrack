import type { SpendEntryInput, SpendEntryFormValues } from '@/lib/schemas/spend'
import type { ProcessedSpendEntry } from '@/lib/types'

/** 'failed' is terminal: the server rejected it and only the user can resolve it. */
export type MutationStatus = 'pending' | 'failed'

interface MutationBase {
  /** Assigned by IndexedDB (autoIncrement). Absent until the record is stored. */
  seq?: number
  /** This mutation's own id, stable across retries. */
  id: string
  userId: string
  /** The row this mutation targets — the coalescing key. */
  entityId: string
  createdAt: string
  attempts: number
  /** Epoch ms; the flush loop skips records until this passes. */
  nextAttemptAt: number
  lastError: string | null
  status: MutationStatus
}

/**
 * A queued write.
 *
 * `entry.create` carries the whole payload including the subscription fields,
 * so one record covers both the spend_rules and spend_entries inserts. Splitting
 * them into two records would create a half-flushed state we can't reason about.
 */
export type OutboxMutation = MutationBase &
  (
    | { kind: 'entry.create'; input: SpendEntryInput }
    | { kind: 'entry.update'; input: SpendEntryFormValues }
    | { kind: 'entry.delete' }
    | { kind: 'category.create'; name: string }
  )

export type OutboxMutationKind = OutboxMutation['kind']

/**
 * The optimistic row.
 *
 * Kept separate from the outbox record because it has to outlive the ack: the
 * row must stay on screen until the server-rendered list actually contains it,
 * which is a later event than "the write succeeded".
 */
export interface ShadowEntry extends ProcessedSpendEntry {
  /** null while unsynced; set once the server confirmed the write. */
  syncedAt: number | null
}

/** Locally cached values so the form can paint correctly with no connection. */
export interface OfflineMeta {
  key: string
  value: unknown
}

export interface SyncResult {
  id: string
  ok: boolean
  /** true => never retry; surface it to the user instead. */
  terminal?: boolean
  error?: string
}
