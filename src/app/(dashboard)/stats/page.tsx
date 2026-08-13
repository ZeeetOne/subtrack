import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/current-user'
import { redirect } from 'next/navigation'
import { subMonths } from 'date-fns'
import { TrendingUp, Calendar, Layers, Repeat, Receipt } from 'lucide-react'
import { StatsMonthlyChart } from '@/components/spend/stats-monthly-chart'
import { toLocalDateString } from '@/lib/expense-utils'
import type { SpendEntry, ProcessedSpendEntry } from '@/lib/types'

type SpendEntryRow = SpendEntry & { spend_categories: { name: string } | null }

interface CategoryBreakdown {
  name: string
  total: number
  count: number
  percentage: number
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

export default async function StatsPage() {
  const supabase = await createClient()

  // Already verified by middleware; re-checking would cost another round trip.
  const userId = await getCurrentUserId()
  if (!userId) {
    redirect('/login')
  }

  // 12-month window ending at the current month — one query covers the
  // month-over-month chart, this month's category breakdown, and the
  // subscription vs one-time split.
  const now = new Date()
  const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const twelveMonthStartDate = subMonths(monthStartDate, 11)
  const twelveMonthStart = toLocalDateString(twelveMonthStartDate)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Independent queries — one round trip instead of two.
  const [{ data: profile }, { data: entriesData }] = await Promise.all([
    supabase.from('profiles').select('base_currency').eq('id', userId).single(),
    supabase
      .from('spend_entries')
      .select('*, spend_categories(name)')
      .eq('user_id', userId)
      .gte('spent_on', twelveMonthStart)
      .lte('spent_on', monthEnd)
      .order('spent_on', { ascending: false }),
  ])

  const baseCurrency = profile?.base_currency || 'IDR'
  const rows = (entriesData || []) as SpendEntryRow[]

  // Base conversion always uses the stored rate captured at entry time —
  // never a live rate — since these are actuals, not projections.
  const entries: ProcessedSpendEntry[] = rows.map((row) => {
    const { spend_categories, ...entry } = row
    return {
      ...entry,
      categoryName: spend_categories?.name ?? null,
      amountInBase: Number(entry.amount) * Number(entry.exchange_rate),
    }
  })

  const currentMonthEntries = entries.filter((e) => e.spent_on.slice(0, 7) === currentMonthKey)
  const currentMonthTotal = currentMonthEntries.reduce((sum, e) => sum + e.amountInBase, 0)
  const twelveMonthTotal = entries.reduce((sum, e) => sum + e.amountInBase, 0)
  const monthlyAverage = twelveMonthTotal / 12

  // ── Section 1: category breakdown for the current month ──────────────────
  const categoryTotals = new Map<string, { total: number; count: number }>()
  currentMonthEntries.forEach((e) => {
    const name = e.categoryName || 'Uncategorized'
    const existing = categoryTotals.get(name) ?? { total: 0, count: 0 }
    existing.total += e.amountInBase
    existing.count += 1
    categoryTotals.set(name, existing)
  })
  const categoryBreakdown: CategoryBreakdown[] = [...categoryTotals.entries()]
    .map(([name, { total, count }]) => ({
      name,
      total,
      count,
      percentage: currentMonthTotal > 0 ? (total / currentMonthTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── Section 2: month-over-month totals across the 12-month window ────────
  const monthBuckets: { key: string; label: string }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(monthStartDate, i)
    monthBuckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
    })
  }
  const bucketTotals = new Map<string, number>(monthBuckets.map((b) => [b.key, 0]))
  entries.forEach((e) => {
    const key = e.spent_on.slice(0, 7)
    if (bucketTotals.has(key)) {
      bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + e.amountInBase)
    }
  })
  const monthlyTotals = monthBuckets.map((b) => ({ month: b.label, total: bucketTotals.get(b.key) ?? 0 }))

  // ── Section 3: subscription vs one-time split for the current month ──────
  const subscriptionEntries = currentMonthEntries.filter((e) => e.rule_id !== null)
  const oneTimeEntries = currentMonthEntries.filter((e) => e.rule_id === null)
  const subscriptionsTotal = subscriptionEntries.reduce((sum, e) => sum + e.amountInBase, 0)
  const oneTimeTotal = oneTimeEntries.reduce((sum, e) => sum + e.amountInBase, 0)
  const splitTotal = subscriptionsTotal + oneTimeTotal
  const subscriptionsPct = splitTotal > 0 ? (subscriptionsTotal / splitTotal) * 100 : 0
  const oneTimePct = splitTotal > 0 ? (oneTimeTotal / splitTotal) * 100 : 0

  const monthLabel = monthStartDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="pb-24 font-sans">
      {/* Header */}
      <div className="mb-10 px-1 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight">Stats</h1>
          <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">
            Tracking in <span className="font-bold text-[var(--primary)]">{baseCurrency}</span> &middot; from your expense log
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-full px-4 py-2 mt-1">
          <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span className="text-[12px] font-semibold text-[var(--foreground)]">{currentMonthEntries.length}</span>
          <span className="text-[11px] text-[var(--muted-foreground)] font-medium">entries this month</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 relative">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--primary)] rounded-t-2xl" />
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
              {monthLabel}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-heading font-bold text-[var(--foreground)] tracking-tight leading-snug break-words">
              {formatCurrency(currentMonthTotal, baseCurrency)}
            </p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">spent so far this month</p>
          </div>
        </div>

        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 relative">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--tertiary)] rounded-t-2xl" />
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-[var(--tertiary)]" />
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
              Monthly average
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-heading font-bold text-[var(--foreground)] tracking-tight leading-snug break-words">
              {formatCurrency(monthlyAverage, baseCurrency)}
            </p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">over the last 12 months</p>
          </div>
        </div>
      </div>

      {/* Section 1: category breakdown */}
      <div className="mb-8">
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-6">
            {monthLabel} by category
          </h2>
          {categoryBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
              No expenses logged this month yet.
            </div>
          ) : (
            <div className="space-y-4">
              {categoryBreakdown.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-[var(--foreground)] truncate">{c.name}</span>
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full shrink-0">
                        {c.count}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                        {formatCurrency(c.total, baseCurrency)}
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--muted-foreground)] ml-2 tabular-nums">
                        {c.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] rounded-full"
                      style={{ width: `${Math.min(100, c.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: month-over-month totals */}
      <div className="mb-8">
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-6">
            Last 12 months
          </h2>
          <StatsMonthlyChart monthlyTotals={monthlyTotals} baseCurrency={baseCurrency} />
        </div>
      </div>

      {/* Section 3: subscription vs one-time split */}
      <div className="mb-8">
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-6">
            {monthLabel}: subscriptions vs one-time
          </h2>
          {splitTotal === 0 ? (
            <div className="flex items-center justify-center h-20 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
              No expenses logged this month yet.
            </div>
          ) : (
            <>
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-[var(--muted)]">
                {subscriptionsTotal > 0 && (
                  <div
                    className="h-full bg-[var(--primary)]"
                    style={{ width: `${subscriptionsPct}%` }}
                  />
                )}
                {oneTimeTotal > 0 && (
                  <div
                    className="h-full bg-[var(--tertiary)]"
                    style={{ width: `${oneTimePct}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-6 mt-5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span className="text-sm font-semibold text-[var(--foreground)]">Subscriptions</span>
                  <span className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                    {formatCurrency(subscriptionsTotal, baseCurrency)}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--muted-foreground)] tabular-nums">
                    {subscriptionsPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-[var(--tertiary)]" />
                  <span className="text-sm font-semibold text-[var(--foreground)]">One-time</span>
                  <span className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                    {formatCurrency(oneTimeTotal, baseCurrency)}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--muted-foreground)] tabular-nums">
                    {oneTimePct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
