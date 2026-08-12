import type { OutboxMutation } from './types'

/**
 * Collapse redundant queued writes for the same row.
 *
 * Without this, going offline and editing one expense four times sends four
 * round-trips when the network returns, and — worse — a create followed by a
 * delete would push a row to the server only to immediately remove it.
 *
 * The rules:
 *   create + update  -> fold the update into the create (one insert, final values)
 *   create + delete  -> annihilate both; the row never existed on the server
 *   update + update  -> keep only the newer
 *   update + delete  -> drop the updates, keep the delete
 *
 * A mutation that is already in flight is never touched: the server may have
 * applied it, so rewriting or dropping it would desync us from the truth.
 */

export interface CoalesceResult {
  /** The queue as it should now be persisted. */
  next: OutboxMutation[]
  /** seqs to delete from IndexedDB (superseded or annihilated records). */
  removedSeqs: number[]
  /** false when the incoming mutation was folded away instead of appended. */
  appended: boolean
}

function isCoalescable(
  mutation: OutboxMutation,
  entityId: string,
  inFlight: ReadonlySet<number>
): boolean {
  if (mutation.entityId !== entityId) return false
  // A failed record is the user's to resolve; silently folding it would hide it.
  if (mutation.status !== 'pending') return false
  if (mutation.seq !== undefined && inFlight.has(mutation.seq)) return false
  return true
}

export function coalesceOutbox(
  queue: readonly OutboxMutation[],
  incoming: OutboxMutation,
  inFlight: ReadonlySet<number> = new Set()
): CoalesceResult {
  const targets = queue.filter((m) => isCoalescable(m, incoming.entityId, inFlight))
  const removedSeqs: number[] = []
  const collect = (m: OutboxMutation) => {
    if (m.seq !== undefined) removedSeqs.push(m.seq)
  }

  if (incoming.kind === 'entry.update') {
    const create = targets.find((m) => m.kind === 'entry.create')
    if (create && create.kind === 'entry.create') {
      // Fold into the pending insert: same id, final values, still one row.
      const merged: OutboxMutation = {
        ...create,
        input: { ...create.input, ...incoming.input },
      }
      return {
        next: queue.map((m) => (m === create ? merged : m)),
        removedSeqs,
        appended: false,
      }
    }

    const priorUpdates = new Set<OutboxMutation>(targets.filter((m) => m.kind === 'entry.update'))
    priorUpdates.forEach(collect)
    return {
      next: [...queue.filter((m) => !priorUpdates.has(m)), incoming],
      removedSeqs,
      appended: true,
    }
  }

  if (incoming.kind === 'entry.delete') {
    const create = targets.find((m) => m.kind === 'entry.create')
    if (create) {
      // Never created server-side, so there is nothing to delete. Drop it all.
      const doomed = new Set<OutboxMutation>(
        targets.filter((m) => m.kind === 'entry.create' || m.kind === 'entry.update')
      )
      doomed.forEach(collect)
      return {
        next: queue.filter((m) => !doomed.has(m)),
        removedSeqs,
        appended: false,
      }
    }

    const priorUpdates = new Set<OutboxMutation>(targets.filter((m) => m.kind === 'entry.update'))
    priorUpdates.forEach(collect)
    return {
      next: [...queue.filter((m) => !priorUpdates.has(m)), incoming],
      removedSeqs,
      appended: true,
    }
  }

  // Creates and category writes always append — nothing precedes them.
  return { next: [...queue, incoming], removedSeqs, appended: true }
}

/** Records eligible to flush now, oldest first. */
export function dueMutations(
  queue: readonly OutboxMutation[],
  now: number,
  limit = 25
): OutboxMutation[] {
  return queue
    .filter((m) => m.status === 'pending' && m.nextAttemptAt <= now)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .slice(0, limit)
}
