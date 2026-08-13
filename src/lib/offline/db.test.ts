import { describe, it, expect } from 'vitest'
import {
  readOutbox,
  readShadows,
  enqueueWithShadow,
  completeMutations,
  putMutation,
  deleteShadows,
  commitOutbox,
  readMeta,
  writeMeta,
} from './db'
import type { OutboxMutation, ShadowEntry } from './types'

const ENTRY = 'e0000000-0000-4000-8000-000000000001'

function mutation(entityId = ENTRY, id = 'm-1'): OutboxMutation {
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
  } as OutboxMutation
}

function shadow(id = ENTRY): ShadowEntry {
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

describe('enqueueWithShadow', () => {
  it('persists the queued write and its optimistic row together', async () => {
    await enqueueWithShadow(mutation(), shadow())

    expect(await readOutbox()).toHaveLength(1)
    expect(await readShadows()).toHaveLength(1)
  })

  it('assigns an incrementing seq so flush order is FIFO', async () => {
    await enqueueWithShadow(mutation('e1', 'm-1'), shadow('e1'))
    await enqueueWithShadow(mutation('e2', 'm-2'), shadow('e2'))
    await enqueueWithShadow(mutation('e3', 'm-3'), shadow('e3'))

    const seqs = (await readOutbox()).map((m) => m.seq)
    expect(seqs).toEqual([1, 2, 3])
  })

  it('clears superseded records in the same transaction', async () => {
    await enqueueWithShadow(mutation('e1', 'm-1'), shadow('e1'))
    const [first] = await readOutbox()

    await enqueueWithShadow(mutation('e1', 'm-2'), shadow('e1'), [first.seq!])

    const remaining = await readOutbox()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('m-2')
  })
})

describe('completeMutations', () => {
  it('deletes the acked record and stamps its shadow in one transaction', async () => {
    await enqueueWithShadow(mutation(), shadow())
    const [queued] = await readOutbox()

    await completeMutations([queued.seq!], [ENTRY], 1_800_000_000_000)

    expect(await readOutbox()).toHaveLength(0)
    const [row] = await readShadows()
    // The shadow survives the ack on purpose: it must stay on screen until the
    // server-rendered list actually contains the row.
    expect(row.syncedAt).toBe(1_800_000_000_000)
  })

  it('does not throw when the shadow was already reconciled away', async () => {
    await enqueueWithShadow(mutation(), null)
    const [queued] = await readOutbox()

    await expect(completeMutations([queued.seq!], [ENTRY])).resolves.toBeUndefined()
    expect(await readOutbox()).toHaveLength(0)
  })

  it('only removes the records it was given', async () => {
    await enqueueWithShadow(mutation('e1', 'm-1'), shadow('e1'))
    await enqueueWithShadow(mutation('e2', 'm-2'), shadow('e2'))
    const [first] = await readOutbox()

    await completeMutations([first.seq!], ['e1'])

    const remaining = await readOutbox()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('m-2')
  })
})

describe('putMutation', () => {
  it('updates a record in place without removing it', async () => {
    await enqueueWithShadow(mutation(), shadow())
    const [queued] = await readOutbox()

    await putMutation({ ...queued, attempts: 3, lastError: 'boom', status: 'failed' })

    const updatedAll = await readOutbox()
    expect(updatedAll).toHaveLength(1)
    expect(updatedAll[0].attempts).toBe(3)
    expect(updatedAll[0].status).toBe('failed')
    expect(updatedAll[0].seq).toBe(queued.seq)
  })
})

describe('commitOutbox', () => {
  it('appends without a shadow', async () => {
    await commitOutbox(mutation())
    expect(await readOutbox()).toHaveLength(1)
    expect(await readShadows()).toHaveLength(0)
  })

  it('removes superseded records when appending nothing', async () => {
    await commitOutbox(mutation('e1', 'm-1'))
    const [first] = await readOutbox()

    await commitOutbox(null, [first.seq!])
    expect(await readOutbox()).toHaveLength(0)
  })
})

describe('deleteShadows', () => {
  it('drops reconciled rows and tolerates an empty list', async () => {
    await enqueueWithShadow(mutation('e1', 'm-1'), shadow('e1'))
    await enqueueWithShadow(mutation('e2', 'm-2'), shadow('e2'))

    await deleteShadows([])
    expect(await readShadows()).toHaveLength(2)

    await deleteShadows(['e1'])
    const remaining = await readShadows()
    expect(remaining.map((s) => s.id)).toEqual(['e2'])
  })
})

describe('meta', () => {
  it('round-trips cached values used by the offline form', async () => {
    await writeMeta('base_currency', 'IDR')
    expect(await readMeta<string>('base_currency')).toBe('IDR')
  })

  it('returns undefined for a key never written', async () => {
    expect(await readMeta('nope')).toBeUndefined()
  })
})
