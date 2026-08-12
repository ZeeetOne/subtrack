import { describe, it, expect } from 'vitest'
import { coalesceOutbox, dueMutations } from './reducer'
import type { OutboxMutation } from './types'

const ENTRY = 'e0000000-0000-4000-8000-000000000001'
const OTHER = 'e0000000-0000-4000-8000-000000000002'

function base(seq: number, id: string) {
  return {
    seq,
    id: `m-${seq}`,
    userId: 'u1',
    entityId: id,
    createdAt: '2026-08-10T09:00:00.000Z',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    status: 'pending' as const,
  }
}

function create(seq: number, id = ENTRY, overrides = {}): OutboxMutation {
  return {
    ...base(seq, id),
    kind: 'entry.create',
    input: {
      id,
      name: 'Coffee',
      amount: '10',
      currency: 'IDR',
      spent_on: '2026-08-10',
      is_subscription: false,
      rule_id: null,
      created_at: '2026-08-10T09:00:00.000Z',
      ...overrides,
    },
  } as OutboxMutation
}

function update(seq: number, id = ENTRY, overrides = {}): OutboxMutation {
  return {
    ...base(seq, id),
    kind: 'entry.update',
    input: {
      name: 'Coffee',
      amount: '20',
      currency: 'IDR',
      spent_on: '2026-08-10',
      is_subscription: false,
      ...overrides,
    },
  } as OutboxMutation
}

function remove(seq: number, id = ENTRY): OutboxMutation {
  return { ...base(seq, id), kind: 'entry.delete' } as OutboxMutation
}

describe('coalesceOutbox', () => {
  it('folds an update into a pending create instead of queuing both', () => {
    const result = coalesceOutbox([create(1)], update(2, ENTRY, { amount: '99' }))

    expect(result.appended).toBe(false)
    expect(result.next).toHaveLength(1)
    expect(result.next[0].kind).toBe('entry.create')
    // The insert now carries the final value, and still only inserts once.
    expect((result.next[0] as { input: { amount: string } }).input.amount).toBe('99')
  })

  it('annihilates a create followed by a delete — the server never hears about it', () => {
    const result = coalesceOutbox([create(1)], remove(2))

    expect(result.appended).toBe(false)
    expect(result.next).toHaveLength(0)
    expect(result.removedSeqs).toContain(1)
  })

  it('annihilates a create plus its updates when deleted', () => {
    const result = coalesceOutbox([create(1), update(2)], remove(3))

    expect(result.next).toHaveLength(0)
    expect(result.removedSeqs).toEqual(expect.arrayContaining([1, 2]))
  })

  it('keeps only the newer of two updates', () => {
    const result = coalesceOutbox([update(1, ENTRY, { amount: '10' })], update(2, ENTRY, { amount: '30' }))

    expect(result.next).toHaveLength(1)
    expect((result.next[0] as { input: { amount: string } }).input.amount).toBe('30')
    expect(result.removedSeqs).toContain(1)
  })

  it('drops pending updates but keeps the delete', () => {
    const result = coalesceOutbox([update(1)], remove(2))

    expect(result.next).toHaveLength(1)
    expect(result.next[0].kind).toBe('entry.delete')
    expect(result.removedSeqs).toContain(1)
  })

  it('never coalesces across different entities', () => {
    const result = coalesceOutbox([create(1, ENTRY)], remove(2, OTHER))

    expect(result.next).toHaveLength(2)
    expect(result.removedSeqs).toHaveLength(0)
  })

  it('leaves an in-flight mutation alone', () => {
    // The server may already have applied it; rewriting it would desync us.
    const result = coalesceOutbox([create(1)], update(2), new Set([1]))

    expect(result.appended).toBe(true)
    expect(result.next).toHaveLength(2)
    expect(result.removedSeqs).toHaveLength(0)
  })

  it('leaves a failed mutation alone so it stays visible to the user', () => {
    const failed = { ...create(1), status: 'failed' as const }
    const result = coalesceOutbox([failed], update(2))

    expect(result.next).toHaveLength(2)
    expect(result.removedSeqs).toHaveLength(0)
  })

  it('appends creates and category writes unconditionally', () => {
    const category: OutboxMutation = {
      ...base(2, 'c1'),
      kind: 'category.create',
      name: 'Food',
    } as OutboxMutation

    expect(coalesceOutbox([create(1)], category).next).toHaveLength(2)
  })
})

describe('dueMutations', () => {
  it('returns pending records in seq order', () => {
    const queue = [create(3), create(1, OTHER), create(2)]
    expect(dueMutations(queue, Date.now()).map((m) => m.seq)).toEqual([1, 2, 3])
  })

  it('skips records still backing off', () => {
    const later = { ...create(1), nextAttemptAt: Date.now() + 60_000 }
    expect(dueMutations([later], Date.now())).toHaveLength(0)
  })

  it('skips failed records — they need the user, not a retry', () => {
    const failed = { ...create(1), status: 'failed' as const }
    expect(dueMutations([failed], Date.now())).toHaveLength(0)
  })

  it('caps the batch size', () => {
    const queue = Array.from({ length: 40 }, (_, i) => create(i + 1, `e${i}`))
    expect(dueMutations(queue, Date.now(), 25)).toHaveLength(25)
  })
})
