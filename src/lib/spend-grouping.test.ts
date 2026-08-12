import { describe, it, expect } from 'vitest'
import { groupByDay } from './spend-grouping'
import type { ProcessedSpendEntry } from './types'

function entry(id: string, spent_on: string, amountInBase: number): ProcessedSpendEntry {
  return {
    id,
    user_id: 'u1',
    name: 'Coffee',
    amount: amountInBase,
    currency: 'IDR',
    exchange_rate: 1,
    rate_status: 'resolved',
    category_id: null,
    notes: null,
    spent_on,
    rule_id: null,
    created_at: `${spent_on}T09:00:00.000Z`,
    categoryName: null,
    amountInBase,
  }
}

describe('groupByDay', () => {
  it('returns nothing for an empty list', () => {
    expect(groupByDay([])).toEqual([])
  })

  it('groups entries sharing a date and totals them', () => {
    const sections = groupByDay([
      entry('a', '2026-08-10', 10),
      entry('b', '2026-08-10', 15),
    ])

    expect(sections).toHaveLength(1)
    expect(sections[0].entries).toHaveLength(2)
    expect(sections[0].total).toBe(25)
  })

  it('orders days newest first', () => {
    const sections = groupByDay([
      entry('a', '2026-08-01', 10),
      entry('b', '2026-08-20', 10),
      entry('c', '2026-08-10', 10),
    ])

    expect(sections.map((s) => s.date)).toEqual(['2026-08-20', '2026-08-10', '2026-08-01'])
  })

  it('totals in base currency, not the entered amount', () => {
    const converted = { ...entry('a', '2026-08-10', 0), amount: 5, amountInBase: 80_000 }
    expect(groupByDay([converted])[0].total).toBe(80_000)
  })

  it('sorts across month and year boundaries by string date', () => {
    const sections = groupByDay([
      entry('a', '2026-09-01', 1),
      entry('b', '2025-12-31', 1),
      entry('c', '2026-08-31', 1),
    ])

    expect(sections.map((s) => s.date)).toEqual(['2026-09-01', '2026-08-31', '2025-12-31'])
  })
})
