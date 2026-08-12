import { describe, it, expect } from 'vitest'
import { mergePending, reconcilableShadows } from './merge'
import type { ShadowEntry } from './types'
import type { ProcessedSpendEntry } from '@/lib/types'

function entry(id: string, spent_on: string, overrides = {}): ProcessedSpendEntry {
  return {
    id,
    user_id: 'u1',
    name: 'Coffee',
    amount: 10,
    currency: 'IDR',
    exchange_rate: 1,
    rate_status: 'resolved',
    category_id: null,
    notes: null,
    spent_on,
    rule_id: null,
    created_at: `${spent_on}T09:00:00.000Z`,
    categoryName: null,
    amountInBase: 10,
    ...overrides,
  }
}

function shadow(id: string, spent_on: string, overrides = {}): ShadowEntry {
  return { ...entry(id, spent_on), syncedAt: null, ...overrides }
}

describe('mergePending', () => {
  it('shows a locally-queued row alongside server rows', () => {
    const merged = mergePending({
      entries: [entry('a', '2026-08-10')],
      shadows: [shadow('b', '2026-08-11')],
    })

    expect(merged.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('never renders the same expense twice once it syncs', () => {
    // Both sides key on the client-minted id, so the server row simply wins.
    const merged = mergePending({
      entries: [entry('a', '2026-08-10')],
      shadows: [shadow('a', '2026-08-10')],
    })

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('a')
  })

  it('hides rows with a queued delete', () => {
    const merged = mergePending({
      entries: [entry('a', '2026-08-10'), entry('b', '2026-08-11')],
      shadows: [],
      deletes: new Set(['a']),
    })

    expect(merged.map((e) => e.id)).toEqual(['b'])
  })

  it('excludes a shadow outside the visible month', () => {
    const merged = mergePending({
      entries: [],
      shadows: [shadow('b', '2026-07-20')],
      windowStart: '2026-08-01',
      windowEnd: '2026-08-31',
    })

    expect(merged).toHaveLength(0)
  })

  it('respects the active category filter', () => {
    const merged = mergePending({
      entries: [],
      shadows: [shadow('b', '2026-08-10', { category_id: 'cat-1' }), shadow('c', '2026-08-10')],
      categoryId: 'cat-1',
    })

    expect(merged.map((e) => e.id)).toEqual(['b'])
  })

  it('orders by spent_on then created_at, matching the SQL', () => {
    const merged = mergePending({
      entries: [
        entry('old', '2026-08-01'),
        entry('early', '2026-08-10', { created_at: '2026-08-10T08:00:00.000Z' }),
      ],
      shadows: [shadow('late', '2026-08-10', { created_at: '2026-08-10T18:00:00.000Z' })],
    })

    expect(merged.map((e) => e.id)).toEqual(['late', 'early', 'old'])
  })

  it('applies the limit after merging, not before', () => {
    const merged = mergePending({
      entries: [entry('a', '2026-08-01'), entry('b', '2026-08-02')],
      shadows: [shadow('c', '2026-08-30')],
      limit: 2,
    })

    expect(merged.map((e) => e.id)).toEqual(['c', 'b'])
  })
})

describe('reconcilableShadows', () => {
  it('keeps an unsynced shadow', () => {
    expect(reconcilableShadows([shadow('a', '2026-08-10')], [], Date.now())).toHaveLength(0)
  })

  it('drops a synced shadow once the server list carries it', () => {
    const now = Date.now()
    const synced = shadow('a', '2026-08-10', { syncedAt: now })

    expect(reconcilableShadows([synced], [entry('a', '2026-08-10')], now)).toEqual(['a'])
  })

  it('keeps a synced shadow the server list has not caught up on yet', () => {
    const now = Date.now()
    const synced = shadow('a', '2026-08-10', { syncedAt: now })

    expect(reconcilableShadows([synced], [], now)).toHaveLength(0)
  })

  it('sweeps a stale synced shadow that never reconciled', () => {
    const now = Date.now()
    const synced = shadow('a', '2026-08-10', { syncedAt: now - 10 * 60 * 1000 })

    expect(reconcilableShadows([synced], [], now)).toEqual(['a'])
  })
})
