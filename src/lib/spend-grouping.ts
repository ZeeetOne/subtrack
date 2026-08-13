import type { ProcessedSpendEntry } from '@/lib/types'

export interface DaySection {
  date: string
  entries: ProcessedSpendEntry[]
  total: number
}

/**
 * Group entries into newest-first day sections with a per-day total.
 *
 * Lifted out of the expenses page so the same grouping runs after optimistic
 * rows are merged in — a locally-added expense has to land in the right day
 * section and move that day's total, not just appear at the bottom.
 */
export function groupByDay(entries: readonly ProcessedSpendEntry[]): DaySection[] {
  const byDate = new Map<string, ProcessedSpendEntry[]>()
  for (const entry of entries) {
    const list = byDate.get(entry.spent_on) ?? []
    list.push(entry)
    byDate.set(entry.spent_on, list)
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayEntries]) => ({
      date,
      entries: [...dayEntries].sort(byTimeOfDay),
      total: dayEntries.reduce((sum, e) => sum + e.amountInBase, 0),
    }))
}

/**
 * Latest time of day first. Entries with no recorded time (legacy rows, or
 * ones the user left blank) sort after every timed entry, falling back to
 * created_at so their relative order still matches "most recent first".
 */
function byTimeOfDay(a: ProcessedSpendEntry, b: ProcessedSpendEntry): number {
  if (a.spent_time && b.spent_time) {
    if (a.spent_time === b.spent_time) return 0
    return a.spent_time < b.spent_time ? 1 : -1
  }
  if (a.spent_time) return -1
  if (b.spent_time) return 1
  if (a.created_at === b.created_at) return 0
  return a.created_at < b.created_at ? 1 : -1
}
