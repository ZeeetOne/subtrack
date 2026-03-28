import {
  addWeeks, addMonths, addYears,
  subWeeks, subMonths, subYears,
  startOfMonth, endOfMonth, isWithinInterval,
} from 'date-fns'

/** Parse a YYYY-MM-DD string as local midnight to avoid UTC timezone shift. */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export interface ExpenseOccurrence {
  date: Date
  amount: number
  amountInBase: number
}

export function getOccurrencesInMonth(
  expense: {
    amount: number
    billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'
    next_billing_date: string | null
    created_at: string
  },
  baseCurrency: string,
  year: number,
  month: number, // 0-indexed
  rate: number = 1.0
): ExpenseOccurrence[] {
  if (!expense.next_billing_date) return []

  const targetMonthStart = startOfMonth(new Date(year, month))
  const targetMonthEnd = endOfMonth(new Date(year, month))
  const createdAt = parseLocalDate(expense.created_at.slice(0, 10))
  const nextBillingDate = parseLocalDate(expense.next_billing_date)
  
  const occurrences: ExpenseOccurrence[] = []
  const amountInBase = expense.amount * rate

  if (expense.billing_cycle === 'one-time') {
    if (isWithinInterval(nextBillingDate, { start: targetMonthStart, end: targetMonthEnd })) {
      occurrences.push({ date: nextBillingDate, amount: expense.amount, amountInBase })
    }
    return occurrences
  }

  // Helper to add occurrences if they fall in month and after created_at
  const addIfInMonth = (date: Date) => {
    if (date < createdAt) return false
    if (isWithinInterval(date, { start: targetMonthStart, end: targetMonthEnd })) {
      occurrences.push({ date, amount: expense.amount, amountInBase })
      return true
    }
    return false
  }

  // Recurring logic:
  // Move backwards from next_billing_date until we are before targetMonthStart
  let current = nextBillingDate
  const stepBack = (d: Date): Date | null => {
    switch (expense.billing_cycle) {
      case 'weekly': return subWeeks(d, 1)
      case 'monthly': return subMonths(d, 1)
      case 'quarterly': return subMonths(d, 3)
      case 'yearly': return subYears(d, 1)
      default: return null
    }
  }
  const stepForward = (d: Date): Date | null => {
    switch (expense.billing_cycle) {
      case 'weekly': return addWeeks(d, 1)
      case 'monthly': return addMonths(d, 1)
      case 'quarterly': return addMonths(d, 3)
      case 'yearly': return addYears(d, 1)
      default: return null
    }
  }

  // Start with nextBillingDate and move back to find any occurrences in target month or earlier
  while (current >= targetMonthStart) {
    addIfInMonth(current)
    const prev = stepBack(current)
    if (!prev) break
    current = prev
  }

  // Also move forward from nextBillingDate in case next_billing_date is in the past
  // but we want to see occurrences in the current/future month
  current = stepForward(nextBillingDate) ?? nextBillingDate
  while (current <= targetMonthEnd) {
    addIfInMonth(current)
    const next = stepForward(current)
    if (!next) break
    current = next
  }

  return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime())
}
