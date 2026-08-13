import { describe, it, expect, vi } from 'vitest'

// The real module is a Server Action ('use server' + next/cache + the Supabase
// server client) and cannot load in Node. These tests are about what the client
// does with a verdict, not about producing one.
vi.mock('@/lib/actions/spend', () => ({ syncOutbox: vi.fn() }))

import { applyResults, penalizeBatch } from './sync'
import { enqueueWithShadow, readOutbox, readShadows } from './db'
import { MAX_ATTEMPTS } from './backoff'
import type { OutboxMutation, ShadowEntry } from './types'

function mutation(entityId: string, id: string, overrides: Partial<OutboxMutation> = {}): OutboxMutation {
  return {
    id,
    userId: 'u1',
    entityId,
    kind: 'entry.create',
    createdAt: '2026-08-10T09:00:00.000Z',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    status: 'pending',
    input: {
      id: entityId,
      name: 'Coffee',
      amount: '10',
      currency: 'IDR',
      spent_on: '2026-08-10',
      is_subscription: false,
      rule_id: null,
      created_at: '2026-08-10T09:00:00.000Z',
    },
    ...overrides,
  } as OutboxMutation
}

function shadow(id: string): ShadowEntry {
  return {
    id,
    user_id: 'u1',
    name: 'Coffee',
    amount: 10,
    currency: 'IDR',
    exchange_rate: 1,
    rate_status: 'pending',
    category_id: null,
    notes: null,
    spent_on: '2026-08-10',
    spent_time: null,
    rule_id: null,
    created_at: '2026-08-10T09:00:00.000Z',
    categoryName: null,
    amountInBase: 10,
    syncedAt: null,
  }
}

/** Seed the queue and read it back so the records carry their assigned seq. */
async function seed(...specs: [string, string][]): Promise<OutboxMutation[]> {
  for (const [entityId, id] of specs) {
    await enqueueWithShadow(mutation(entityId, id), shadow(entityId))
  }
  return readOutbox()
}

describe('applyResults — success', () => {
  it('removes the record and marks its optimistic row synced', async () => {
    const batch = await seed(['e1', 'm-1'])

    await applyResults(batch, [{ id: 'm-1', ok: true }])

    expect(await readOutbox()).toHaveLength(0)
    const [row] = await readShadows()
    expect(row.syncedAt).not.toBeNull()
  })
})

describe('applyResults — failure must never lose a write', () => {
  it('keeps a failed record queued instead of deleting it', async () => {
    const batch = await seed(['e1', 'm-1'])

    await applyResults(batch, [{ id: 'm-1', ok: false, error: 'boom' }])

    // The invariant: a record is deleted ONLY on confirmed success.
    const [record] = await readOutbox()
    expect(record).toBeDefined()
    expect(record.attempts).toBe(1)
    expect(record.status).toBe('pending')
    expect(record.lastError).toBe('boom')
  })

  it('schedules a retry in the future rather than hot-looping', async () => {
    const batch = await seed(['e1', 'm-1'])

    await applyResults(batch, [{ id: 'm-1', ok: false, error: 'boom' }])

    const [record] = await readOutbox()
    expect(record.nextAttemptAt).toBeGreaterThan(Date.now())
  })

  it('treats Unauthorized as retryable, not terminal', async () => {
    // An expired session while offline must keep the queue so the expenses
    // survive until the user signs back in.
    const batch = await seed(['e1', 'm-1'])

    await applyResults(batch, [{ id: 'm-1', ok: false, error: 'Unauthorized' }])

    const records = await readOutbox()
    expect(records).toHaveLength(1)
    expect(records[0].status).toBe('pending')
  })

  it('marks a server-declared terminal failure as failed, still not deleted', async () => {
    const batch = await seed(['e1', 'm-1'])

    await applyResults(batch, [{ id: 'm-1', ok: false, terminal: true, error: 'Invalid fields' }])

    const [record] = await readOutbox()
    expect(record.status).toBe('failed')
    expect(record.lastError).toBe('Invalid fields')
  })

  it('gives up after the attempt ceiling so the user gets told', async () => {
    await enqueueWithShadow(
      mutation('e1', 'm-1', { attempts: MAX_ATTEMPTS - 1 }),
      shadow('e1')
    )
    const batch = await readOutbox()

    await applyResults(batch, [{ id: 'm-1', ok: false, error: 'boom' }])

    const [record] = await readOutbox()
    expect(record.status).toBe('failed')
  })
})

describe('applyResults — mixed batch', () => {
  it('removes only the acked record and retries the rest', async () => {
    const batch = await seed(['e1', 'm-1'], ['e2', 'm-2'])

    await applyResults(batch, [
      { id: 'm-1', ok: true },
      { id: 'm-2', ok: false, error: 'boom' },
    ])

    const remaining = await readOutbox()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('m-2')
    expect(remaining[0].attempts).toBe(1)
  })

  it('leaves a record alone when the server returned no verdict for it', async () => {
    const batch = await seed(['e1', 'm-1'], ['e2', 'm-2'])

    await applyResults(batch, [{ id: 'm-1', ok: true }])

    const remaining = await readOutbox()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('m-2')
    // Untouched, not penalised — we simply never heard back about it.
    expect(remaining[0].attempts).toBe(0)
  })
})

describe('penalizeBatch — transport failure', () => {
  it('retries the whole batch without deleting anything', async () => {
    const batch = await seed(['e1', 'm-1'], ['e2', 'm-2'])

    await penalizeBatch(batch, 'Could not reach the server')

    const remaining = await readOutbox()
    expect(remaining).toHaveLength(2)
    expect(remaining.every((m) => m.attempts === 1)).toBe(true)
    expect(remaining.every((m) => m.status === 'pending')).toBe(true)
    expect(remaining.every((m) => m.lastError === 'Could not reach the server')).toBe(true)
  })

  it('never makes a write terminal on connectivity alone', async () => {
    // Losing the network says nothing about whether the write is valid.
    await seed(['e1', 'm-1'])

    for (let i = 0; i < 3; i++) {
      await penalizeBatch(await readOutbox(), 'offline')
    }

    const [record] = await readOutbox()
    expect(record.status).toBe('pending')
    expect(record.attempts).toBe(3)
  })

  it('still stops once the attempt ceiling is reached', async () => {
    await enqueueWithShadow(mutation('e1', 'm-1', { attempts: MAX_ATTEMPTS - 1 }), shadow('e1'))

    await penalizeBatch(await readOutbox(), 'offline')

    const [record] = await readOutbox()
    expect(record.status).toBe('failed')
  })
})
