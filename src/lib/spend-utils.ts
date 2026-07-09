import { addWeeks, addMonths, addYears, differenceInCalendarDays } from 'date-fns'
import { parseLocalDate, toLocalDateString } from '@/lib/expense-utils'

export type SpendCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

/** Advance a YYYY-MM-DD date by one subscription cycle. */
export function advanceCycle(dateStr: string, cycle: SpendCycle): string {
  const date = parseLocalDate(dateStr)
  switch (cycle) {
    case 'weekly':    return toLocalDateString(addWeeks(date, 1))
    case 'monthly':   return toLocalDateString(addMonths(date, 1))
    case 'quarterly': return toLocalDateString(addMonths(date, 3))
    case 'yearly':    return toLocalDateString(addYears(date, 1))
  }
}

/** Normalize a per-cycle amount to a monthly estimate. */
export function monthlyEstimate(amount: number, cycle: SpendCycle): number {
  switch (cycle) {
    case 'weekly':    return amount * 4.33
    case 'monthly':   return amount
    case 'quarterly': return amount / 3
    case 'yearly':    return amount / 12
  }
}

export interface CoveragePeriod { start: string; end: string; payments: number } // end exclusive
export interface CoverageGap { start: string; end: string; days: number }

/**
 * Each payment covers [date, date + cycle). Overlapping/adjacent windows merge
 * into subscribed streaks; the space between streaks is a break.
 */
export function deriveCoverage(
  paymentDates: string[],
  cycle: SpendCycle
): { periods: CoveragePeriod[]; gaps: CoverageGap[] } {
  const sorted = [...paymentDates].sort()
  const periods: CoveragePeriod[] = []
  for (const d of sorted) {
    const end = advanceCycle(d, cycle)
    const last = periods[periods.length - 1]
    if (last && d <= last.end) {
      last.end = end > last.end ? end : last.end
      last.payments += 1
    } else {
      periods.push({ start: d, end, payments: 1 })
    }
  }
  const gaps: CoverageGap[] = []
  for (let i = 1; i < periods.length; i++) {
    const start = periods[i - 1].end
    const end = periods[i].start
    gaps.push({ start, end, days: differenceInCalendarDays(parseLocalDate(end), parseLocalDate(start)) })
  }
  return { periods, gaps }
}
