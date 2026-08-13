import { describe, it, expect } from 'vitest'
import { deriveDashboardStats } from './dashboard-stats'
import type { ProcessedSpendEntry } from './types'

function entry(
  id: string,
  spent_on: string,
  amountInBase: number,
  rule_id: string | null = null
): ProcessedSpendEntry {
  return {
    id,
    user_id: 'u1',
    name: `Item ${id}`,
    amount: amountInBase,
    currency: 'IDR',
    exchange_rate: 1,
    rate_status: 'resolved',
    category_id: null,
    notes: null,
    spent_on,
    spent_time: null,
    rule_id,
    created_at: `${spent_on}T09:00:00.000Z`,
    categoryName: null,
    amountInBase,
  }
}

const options = {
  monthStart: '2026-08-01',
  monthEnd: '2026-08-31',
  monthBuckets: [
    { key: '2026-07', label: 'Jul 2026' },
    { key: '2026-08', label: 'Aug 2026' },
  ],
}

describe('deriveDashboardStats', () => {
  it('returns zeroed figures for no entries', () => {
    const stats = deriveDashboardStats([], options)

    expect(stats.thisMonthTotal).toBe(0)
    expect(stats.heatmapDays).toEqual([])
    // Empty months still render a bar rather than vanishing from the chart.
    expect(stats.monthlyTotals).toEqual([
      { month: 'Jul 2026', total: 0 },
      { month: 'Aug 2026', total: 0 },
    ])
  })

  it('counts only the selected month in the month total', () => {
    const stats = deriveDashboardStats(
      [entry('a', '2026-08-10', 100), entry('b', '2026-07-15', 500)],
      options
    )

    expect(stats.thisMonthTotal).toBe(100)
    expect(stats.monthEntries).toHaveLength(1)
  })

  it('splits subscriptions from one-time spend', () => {
    const stats = deriveDashboardStats(
      [
        entry('a', '2026-08-10', 100, 'rule-1'),
        entry('b', '2026-08-11', 40),
        entry('c', '2026-08-12', 60),
      ],
      options
    )

    expect(stats.subscriptionsTotal).toBe(100)
    expect(stats.oneTimeTotal).toBe(100)
    // The split must always reconstruct the whole.
    expect(stats.subscriptionsTotal + stats.oneTimeTotal).toBe(stats.thisMonthTotal)
  })

  it('collapses same-day entries into one heatmap cell', () => {
    const stats = deriveDashboardStats(
      [entry('a', '2026-08-10', 10), entry('b', '2026-08-10', 15)],
      options
    )

    expect(stats.heatmapDays).toHaveLength(1)
    expect(stats.heatmapDays[0].total).toBe(25)
    expect(stats.heatmapDays[0].items).toHaveLength(2)
  })

  it('buckets the full window, not just the selected month', () => {
    const stats = deriveDashboardStats(
      [entry('a', '2026-08-10', 100), entry('b', '2026-07-15', 500)],
      options
    )

    expect(stats.monthlyTotals).toEqual([
      { month: 'Jul 2026', total: 500 },
      { month: 'Aug 2026', total: 100 },
    ])
  })

  it('ignores entries outside every bucket', () => {
    const stats = deriveDashboardStats([entry('old', '2025-01-01', 999)], options)

    expect(stats.monthlyTotals.every((m) => m.total === 0)).toBe(true)
  })

  it('moves every figure when a queued expense is merged in', () => {
    // This is the whole point of the extraction: one locally-queued row has to
    // shift the month total, the split, the heatmap and the chart together.
    const server = [entry('a', '2026-08-10', 100)]
    const withPending = [...server, entry('queued', '2026-08-11', 50)]

    const before = deriveDashboardStats(server, options)
    const after = deriveDashboardStats(withPending, options)

    expect(after.thisMonthTotal).toBe(before.thisMonthTotal + 50)
    expect(after.oneTimeTotal).toBe(before.oneTimeTotal + 50)
    expect(after.heatmapDays).toHaveLength(before.heatmapDays.length + 1)
    expect(after.monthlyTotals[1].total).toBe(before.monthlyTotals[1].total + 50)
  })
})
