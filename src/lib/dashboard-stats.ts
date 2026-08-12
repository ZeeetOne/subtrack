import type { ProcessedSpendEntry } from '@/lib/types'
import type { HeatmapDay } from '@/components/dashboard/spending-heatmap'

export interface MonthBucket {
  key: string
  label: string
}

export interface DashboardStats {
  monthEntries: ProcessedSpendEntry[]
  thisMonthTotal: number
  subscriptionsTotal: number
  oneTimeTotal: number
  heatmapDays: HeatmapDay[]
  monthlyTotals: { month: string; total: number }[]
}

/**
 * Derive every figure the dashboard shows from a single list of entries.
 *
 * Pulled out of the page so the exact same derivation can run again on the
 * client over entries merged with locally-queued rows. Without that, adding an
 * expense offline shows the row under "Recent" while "This month" stays put —
 * which reads as a bug even though the write is safely queued.
 */
export function deriveDashboardStats(
  entries: readonly ProcessedSpendEntry[],
  options: { monthStart: string; monthEnd: string; monthBuckets: readonly MonthBucket[] }
): DashboardStats {
  const { monthStart, monthEnd, monthBuckets } = options

  const monthEntries = entries.filter((e) => e.spent_on >= monthStart && e.spent_on <= monthEnd)

  let thisMonthTotal = 0
  let subscriptionsTotal = 0
  let oneTimeTotal = 0
  const dayMap = new Map<string, HeatmapDay>()

  for (const entry of monthEntries) {
    thisMonthTotal += entry.amountInBase
    if (entry.rule_id !== null) subscriptionsTotal += entry.amountInBase
    else oneTimeTotal += entry.amountInBase

    const day = dayMap.get(entry.spent_on) ?? { date: entry.spent_on, total: 0, items: [] }
    day.total += entry.amountInBase
    day.items.push({ name: entry.name, amountInBase: entry.amountInBase, kind: 'paid' })
    dayMap.set(entry.spent_on, day)
  }

  // Buckets start at zero so a month with no spending still renders a bar.
  const bucketTotals = new Map<string, number>(monthBuckets.map((b) => [b.key, 0]))
  for (const entry of entries) {
    const key = entry.spent_on.slice(0, 7)
    if (bucketTotals.has(key)) {
      bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + entry.amountInBase)
    }
  }

  return {
    monthEntries,
    thisMonthTotal,
    subscriptionsTotal,
    oneTimeTotal,
    heatmapDays: [...dayMap.values()],
    monthlyTotals: monthBuckets.map((b) => ({ month: b.label, total: bucketTotals.get(b.key) ?? 0 })),
  }
}
