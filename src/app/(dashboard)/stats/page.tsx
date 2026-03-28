import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { batchGetExchangeRates } from '@/lib/currency'
import { AnalyticsCharts } from '@/components/dashboard/analytics-charts'
import { TrendingUp, Calendar, Layers, Award } from 'lucide-react'
import { InfoButton } from '@/components/ui/info-button'
import type { Expense, ProcessedExpense } from '@/lib/types'

export default async function StatsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()

  const baseCurrency = profile?.base_currency || 'IDR'

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const activeExpenses = expenses || []

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
  const recurringExpenses = processedExpenses.filter(e => e.billing_cycle !== 'one-time')

  const totalMonthlyRecurringBurn = recurringExpenses.reduce((acc, e) => acc + e.monthlyInBase, 0)
  const totalYearlyRecurringBurn = totalMonthlyRecurringBurn * 12

  const cycles = ['weekly', 'monthly', 'quarterly', 'yearly', 'one-time'] as const
  const cycleLabels: Record<string, string> = {
    weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
    yearly: 'Yearly', 'one-time': 'One-time',
  }
  const cycleStats = cycles
    .map(cycle => {
      const group = processedExpenses.filter(e => e.billing_cycle === cycle)
      return { cycle, label: cycleLabels[cycle], count: group.length, totalMonthly: group.reduce((a, e) => a + e.monthlyInBase, 0) }
    })
    .filter(s => s.count > 0)

  const top5 = [...processedExpenses]
    .filter(e => e.billing_cycle !== 'one-time')
    .sort((a, b) => b.monthlyInBase - a.monthlyInBase)
    .slice(0, 5)

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: baseCurrency,
      minimumFractionDigits: baseCurrency === 'IDR' ? 0 : 2,
      maximumFractionDigits: baseCurrency === 'IDR' ? 0 : 2,
    }).format(amount)

  return (
    <div className="pb-24 font-sans">

      {/* Rate source warnings */}
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

      {/* Header */}
      <div className="mb-10 px-1 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight">Stats</h1>
          <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">
            Tracking in <span className="font-bold text-[var(--primary)]">{baseCurrency}</span> • Live rates
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-full px-4 py-2 mt-1">
          <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span className="text-[12px] font-semibold text-[var(--foreground)]">{activeExpenses.length}</span>
          <span className="text-[11px] text-[var(--muted-foreground)] font-medium">active</span>
        </div>
      </div>

      {/* Metric Cards — 2 columns to prevent number overflow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

        {/* Monthly */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 relative">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--primary)] rounded-t-2xl" />
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Monthly burn</span>
            <InfoButton text="Total recurring cost per month across all active subscriptions, normalized to your base currency using live exchange rates (refreshed hourly via exchangerate-api.com)." />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-heading font-bold text-[var(--foreground)] tracking-tight leading-snug break-words">
              ~{fmt(totalMonthlyRecurringBurn)}
            </p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">per month, recurring</p>
          </div>
        </div>

        {/* Yearly */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 relative">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--tertiary)] rounded-t-2xl" />
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-[var(--tertiary)]" />
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Yearly projection</span>
            <InfoButton text="Estimated annual spend if your current subscriptions stay unchanged. Calculated as monthly burn × 12. Does not account for one-time expenses." />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-heading font-bold text-[var(--foreground)] tracking-tight leading-snug break-words">
              ~{fmt(totalYearlyRecurringBurn)}
            </p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">if nothing changes</p>
          </div>
        </div>
      </div>

      {/* Doughnut Chart */}
      <div className="mb-8">
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-6">
            Monthly Burn by Category
          </h2>
          <AnalyticsCharts expenses={processedExpenses} baseCurrency={baseCurrency} />
        </div>
      </div>

      {/* Bottom two panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* By Billing Cycle */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-5">
            By Billing Cycle
          </h2>
          {cycleStats.length > 0 ? (
            <div className="space-y-3">
              {cycleStats.map(({ cycle, label, count, totalMonthly }) => (
                <div key={cycle} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-semibold text-[var(--foreground)] truncate">{label}</span>
                    <span className="text-[11px] font-medium text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full shrink-0">
                      {count}
                    </span>
                  </div>
                  {cycle !== 'one-time' && (
                    <span className="text-sm font-bold text-[var(--foreground)] shrink-0 tabular-nums">
                      {fmt(totalMonthly)}<span className="text-[var(--muted-foreground)] font-medium text-xs">/mo</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] font-medium">No expenses yet.</p>
          )}
        </div>

        {/* Top 5 Expenses */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-5 flex items-center gap-2">
            <Award className="w-3.5 h-3.5" />
            Top Expenses
          </h2>
          {top5.length > 0 ? (
            <div className="space-y-3.5">
              {top5.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[var(--muted-foreground)] w-4 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">{e.name}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">{e.category || 'Uncategorized'}</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--foreground)] shrink-0 tabular-nums">
                    {fmt(e.monthlyInBase)}<span className="text-[var(--muted-foreground)] font-medium text-xs">/mo</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] font-medium">No recurring expenses yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
