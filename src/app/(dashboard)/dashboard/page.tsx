import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Calendar, History, LayoutDashboard } from 'lucide-react'
import { batchGetExchangeRates } from '@/lib/currency'
import { startOfMonth, endOfMonth } from 'date-fns'
import { ExpenseCard } from '@/components/expenses/expense-card'
import { getOccurrencesInMonth } from '@/lib/expense-utils'
import type { Expense, ProcessedExpense, ExpenseOccurrenceWithExpense } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile to get base currency
  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()

  const baseCurrency = profile?.base_currency || 'IDR'

  // Fetch all active expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const activeExpenses = expenses || []

  // Batch-fetch all needed exchange rates in one pass (one call per unique currency)
  const uniqueCurrencies = [...new Set((activeExpenses as Expense[]).map(e => e.currency))]
  const { rates: rateMap, usingSecondary, unavailablePairs } = await batchGetExchangeRates(uniqueCurrencies, baseCurrency)

  const processExpense = (e: Expense): ProcessedExpense => {
    const rate = rateMap[e.currency] ?? null
    if (rate === null) {
      return { ...e, amountInBase: 0, monthlyInBase: 0, currentRate: null, rateUnavailable: true }
    }
    const amountInBase = Number(e.amount) * rate
    let monthlyInBase = 0
    switch (e.billing_cycle) {
      case 'weekly':    monthlyInBase = amountInBase * 4.33; break
      case 'monthly':   monthlyInBase = amountInBase;        break
      case 'quarterly': monthlyInBase = amountInBase / 3;    break
      case 'yearly':    monthlyInBase = amountInBase / 12;   break
      case 'one-time':  monthlyInBase = 0;                   break
    }
    return { ...e, amountInBase, monthlyInBase, currentRate: rate, rateUnavailable: false }
  }

  const processedExpenses: ProcessedExpense[] = (activeExpenses as Expense[]).map(processExpense)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  // Calculate current month's specific occurrences
  const allOccurrencesInMonth: ExpenseOccurrenceWithExpense[] = []
  processedExpenses.forEach(e => {
    const occurrences = getOccurrencesInMonth(
      e, 
      baseCurrency, 
      now.getFullYear(), 
      now.getMonth(),
      e.currentRate ?? undefined
    )
    occurrences.forEach(occ => {
      allOccurrencesInMonth.push({
        ...e,
        occurrenceDate: occ.date,
        occurrenceAmountInBase: occ.amountInBase
      })
    })
  })

  // Split current month occurrences into Past and Upcoming
  const pastMonthBills = allOccurrencesInMonth.filter(occ => occ.occurrenceDate < today)
  const upcomingMonthBills = allOccurrencesInMonth.filter(occ => occ.occurrenceDate >= today)

  // Future bills (beyond this month)
  const parseLocalDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
  const futureBills = processedExpenses.filter(e => {
    if (!e.next_billing_date) return true // Show unscheduled
    return parseLocalDate(e.next_billing_date) > monthEnd
  })

  // Sort logic for lists
  const sortByDate = (a: ExpenseOccurrenceWithExpense, b: ExpenseOccurrenceWithExpense) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime()
  
  const sortedPastMonth = [...pastMonthBills].sort((a, b) => b.occurrenceDate.getTime() - a.occurrenceDate.getTime()) // Newest first
  const sortedUpcomingMonth = [...upcomingMonthBills].sort(sortByDate)

  // Metrics calculation
  const totalMonthlyRecurringBurn = processedExpenses
    .filter(e => e.billing_cycle !== 'one-time')
    .reduce((acc, e) => acc + e.monthlyInBase, 0)
    
  const totalYearlyRecurringBurn = totalMonthlyRecurringBurn * 12
  
  // Real Outflow components for this month
  const totalPaidSoFar = pastMonthBills.reduce((acc, occ) => acc + occ.occurrenceAmountInBase, 0)
  const totalRemainingToPay = upcomingMonthBills.reduce((acc, occ) => acc + occ.occurrenceAmountInBase, 0)
  const totalActualMonthOutflow = totalPaidSoFar + totalRemainingToPay

  const paidPercent = totalActualMonthOutflow > 0
    ? Math.round((totalPaidSoFar / totalActualMonthOutflow) * 100)
    : 0

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'IDR' ? 0 : 2,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount)
  }

  return (
    <div className="pb-24 font-sans">
      <div className="mb-10 px-1">
        <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight">Dashboard</h1>
        <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">
          Tracking in <span className="font-bold text-[var(--primary)]">{baseCurrency}</span> • Live rates
        </p>
      </div>

      {/* Rate source warning */}
      {unavailablePairs.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--tertiary-container)] border border-[var(--tertiary)]/20 mb-6">
          <span className="text-[var(--tertiary)] mt-0.5 text-sm shrink-0">⚠</span>
          <p className="text-xs font-medium text-[var(--on-tertiary-container)] leading-relaxed">
            Live rates unavailable for <strong>{unavailablePairs.join(', ')}</strong>. Expenses in these currencies are excluded from totals. Both rate sources are unreachable.
          </p>
        </div>
      )}
      {usingSecondary && unavailablePairs.length === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--muted)] border border-[var(--border)] mb-6">
          <span className="text-[var(--muted-foreground)] mt-0.5 text-sm shrink-0">ℹ</span>
          <p className="text-xs font-medium text-[var(--muted-foreground)] leading-relaxed">
            Using Frankfurter (ECB) as rate source — primary source is currently unavailable.
          </p>
        </div>
      )}

      {/* Main Metrics */}
      <div className="grid grid-cols-1 gap-6 mb-10">

        {/* Hero card */}
        <Card className="border-none shadow-xl relative rounded-[1.5rem] overflow-hidden">
          {/* Deep forest gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#141e0c] via-[#1a2a10] to-[#213510]" />
          {/* Decorative lime rings */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-[var(--primary)]/10 pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full border border-[var(--primary)]/8 pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-[var(--primary)]/[0.04] pointer-events-none" />

          <CardContent className="p-7 sm:p-8 relative z-10">
            {/* Top row: label + progress pill */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.22em] mb-0.5">Total spending</p>
                <p className="text-sm font-bold text-white/60 tracking-wide">
                  {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#aee865]/15 rounded-full px-3 py-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#aee865]" />
                <span className="text-[10px] font-bold text-[#aee865] tabular-nums">{paidPercent}% paid</span>
              </div>
            </div>

            {/* Main amount — lime */}
            <div className="text-[2.75rem] sm:text-5xl font-heading font-bold text-[#aee865] tracking-tighter leading-none mb-7">
              {formatCurrency(totalActualMonthOutflow, baseCurrency)}
            </div>

            {/* Progress track */}
            <div className="w-full h-[3px] rounded-full bg-white/10 mb-6 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#aee865]/75 transition-all duration-700 ease-out"
                style={{ width: `${paidPercent}%` }}
              />
            </div>

            {/* Paid / Remaining cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.06] rounded-xl p-3 sm:p-3.5">
                <p className="text-[9px] font-semibold text-white/30 uppercase tracking-[0.2em] mb-1.5">Paid</p>
                <p className="text-base sm:text-lg font-heading font-bold text-white/55 tracking-tight tabular-nums leading-tight">
                  {formatCurrency(totalPaidSoFar, baseCurrency)}
                </p>
              </div>
              <div className="bg-white/[0.06] rounded-xl p-3 sm:p-3.5">
                <p className="text-[9px] font-semibold text-white/30 uppercase tracking-[0.2em] mb-1.5">Remaining</p>
                <p className="text-base sm:text-lg font-heading font-bold text-white/85 tracking-tight tabular-nums leading-tight">
                  {formatCurrency(totalRemainingToPay, baseCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[var(--card)] border border-[var(--border)] shadow-none rounded-2xl p-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">costs you per month</span>
                <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <div className="text-3xl font-heading font-bold text-[var(--foreground)] tracking-tight">
                ~{formatCurrency(totalMonthlyRecurringBurn, baseCurrency)}<span className="text-lg font-bold text-[var(--muted-foreground)] ml-1">/mo</span>
              </div>
              <p className="text-[var(--muted-foreground)] text-xs mt-2 font-medium">average across all your subscriptions</p>
            </CardContent>
          </Card>

          <Card className="bg-[var(--card)] border border-[var(--border)] shadow-none rounded-2xl p-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">per year if nothing changes</span>
                <Calendar className="w-4 h-4 text-[var(--tertiary)]" />
              </div>
              <div className="text-3xl font-heading font-bold text-[var(--foreground)] tracking-tight">
                ~{formatCurrency(totalYearlyRecurringBurn, baseCurrency)}<span className="text-lg font-bold text-[var(--muted-foreground)] ml-1">/yr</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-12">
        {/* Current Month: Upcoming */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <LayoutDashboard className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="text-2xl font-heading font-bold text-[var(--foreground)]">Remaining this month</h2>
            </div>
            <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest bg-[var(--muted)] px-3 py-1 rounded-full">
              {now.toLocaleString('default', { month: 'long' })}
            </span>
          </div>
          
          <div className="space-y-4">
            {sortedUpcomingMonth.map((occ, idx) => (
              <ExpenseCard
                key={`${occ.id}-${idx}`}
                expense={occ}
                convertedAmount={occ.occurrenceAmountInBase}
                baseCurrency={baseCurrency}
                showActions={false}
                displayDate={occ.occurrenceDate}
              />
            ))}
            {sortedUpcomingMonth.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] font-medium px-1">No remaining bills for this month.</p>
            )}
          </div>
        </div>

        {/* Current Month: Past */}
        {sortedPastMonth.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-[var(--muted-foreground)]" />
                <h2 className="text-2xl font-heading font-bold text-[var(--foreground)] opacity-70">Paid this month</h2>
              </div>
            </div>
            
            <div className="space-y-4">
              {sortedPastMonth.map((occ, idx) => (
                <div key={`${occ.id}-${idx}`} className="opacity-70">
                  <ExpenseCard
                    expense={occ}
                    convertedAmount={occ.occurrenceAmountInBase}
                    baseCurrency={baseCurrency}
                    showActions={false}
                    displayDate={occ.occurrenceDate}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Beyond This Month */}
        <div className="space-y-6 pt-4 border-t border-[var(--background)]">
          <h2 className="text-xl font-heading font-bold text-[var(--muted-foreground)] px-1">Beyond {now.toLocaleString('default', { month: 'long' })}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {futureBills.map(e => (
              <ExpenseCard
                key={e.id}
                expense={e}
                convertedAmount={e.amountInBase}
                baseCurrency={baseCurrency}
                showActions={false}
              />
            ))}
          </div>
          {futureBills.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)] font-medium px-1">No subscriptions scheduled beyond this month.</p>
          )}
        </div>

        {activeExpenses.length === 0 && (
          <div className="p-8 text-center bg-[var(--card)] rounded-2xl border-2 border-dashed border-[var(--border)]">
            <p className="text-[var(--muted-foreground)] font-bold text-sm">
              No expenses yet. Add one to see the breakdown.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
