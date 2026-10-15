import { parseLocalDate } from './expense-utils'
import type { ProcessedSpendEntry } from './types'

/** Filter value meaning "entries with no category". */
export const UNCATEGORIZED = 'none'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface StatsRange {
  from: string
  to: string
}

function isValidDate(value: string | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false
  // Reject rolled-over dates like 2026-02-31.
  const d = parseLocalDate(value)
  const [y, m, day] = value.split('-').map(Number)
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day
}

/**
 * Turn raw query params into a usable range, or null when there isn't one.
 * Both ends are required; if they arrive reversed they are swapped rather than
 * rejected, since "from later than to" is almost always a slip, not intent.
 */
export function parseRange(from?: string, to?: string): StatsRange | null {
  if (!isValidDate(from) || !isValidDate(to)) return null
  return from <= to ? { from, to } : { from: to, to: from }
}

/** Inclusive number of calendar days in the range. */
export function daysInRange({ from, to }: StatsRange): number {
  const ms = parseLocalDate(to).getTime() - parseLocalDate(from).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Escape LIKE wildcards so a user typing "50%" or "a_b" matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export interface RangeFilter {
  /** Category id, UNCATEGORIZED, or undefined for all. */
  categoryId?: string
  /** Case-insensitive substring of the entry title. */
  query?: string
}

export interface BreakdownRow {
  name: string
  total: number
  count: number
  percentage: number
}

export interface RangeSummary {
  total: number
  count: number
  perDay: number
  byCategory: BreakdownRow[]
  byTitle: BreakdownRow[]
}

function breakdown(
  entries: ProcessedSpendEntry[],
  keyOf: (e: ProcessedSpendEntry) => { key: string; label: string },
  total: number
): BreakdownRow[] {
  const groups = new Map<string, { name: string; total: number; count: number }>()
  for (const e of entries) {
    const { key, label } = keyOf(e)
    const g = groups.get(key) ?? { name: label, total: 0, count: 0 }
    g.total += e.amountInBase
    g.count += 1
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, percentage: total > 0 ? (g.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Apply the filters and roll the result up. Done here (not only in SQL) so the
 * same rules are testable, and so the title grouping can be case-insensitive:
 * "Coffee" and "coffee " are one line, labelled with the first spelling seen.
 */
export function summarizeRange(
  entries: ProcessedSpendEntry[],
  range: StatsRange,
  filter: RangeFilter = {}
): RangeSummary {
  const q = filter.query?.trim().toLowerCase()

  const matched = entries.filter((e) => {
    if (e.spent_on < range.from || e.spent_on > range.to) return false
    if (filter.categoryId === UNCATEGORIZED) {
      if (e.category_id) return false
    } else if (filter.categoryId && e.category_id !== filter.categoryId) {
      return false
    }
    if (q && !e.name.toLowerCase().includes(q)) return false
    return true
  })

  const total = matched.reduce((sum, e) => sum + e.amountInBase, 0)

  return {
    total,
    count: matched.length,
    perDay: total / daysInRange(range),
    byCategory: breakdown(
      matched,
      (e) => ({ key: e.category_id ?? UNCATEGORIZED, label: e.categoryName || 'Uncategorized' }),
      total
    ),
    byTitle: breakdown(
      matched,
      (e) => ({ key: e.name.trim().toLowerCase(), label: e.name.trim() }),
      total
    ),
  }
}
