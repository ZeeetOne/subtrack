import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { subMonths, format } from 'date-fns'
import { CalendarClock, History, ChevronLeft, ChevronRight } from 'lucide-react'
import { DueCard } from '@/components/spend/due-card'
import { EntryList } from '@/components/spend/entry-list'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { SyncStatus } from '@/components/offline/sync-status'
import { batchGetExchangeRates } from '@/lib/currency'
import { monthlyEstimate } from '@/lib/spend-utils'
import { parseLocalDate, toLocalDateString } from '@/lib/expense-utils'
import type { SpendEntry, SpendRule, ProcessedSpendEntry } from '@/lib/types'

type SpendEntryRow = SpendEntry & { spend_categories: { name: string } | null }

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
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

  // Month window: ?month=YYYY-MM, defaults to the current month
  const { month: monthParam } = await searchParams
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    if (m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayStr = toLocalDateString(today)

  const monthStartDate = new Date(year, month, 1)
  const monthEndDate = new Date(year, month + 1, 0)
  const monthStart = toLocalDateString(monthStartDate)
  const monthEnd = toLocalDateString(monthEndDate)
  const monthLabel = monthStartDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthParamStr = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
  const prevHref = `/dashboard?month=${monthParamStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)}`
  const nextHref = `/dashboard?month=${monthParamStr(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)}`

  // 6-month window ending at the viewed month — one query covers the month's
  // own entries (sliced below), the trailing-6-months chart, and "recent".
  const sixMonthStartDate = subMonths(monthStartDate, 5)
  const sixMonthStart = toLocalDateString(sixMonthStartDate)

  const { data: entriesData } = await supabase
    .from('spend_entries')
    .select('*, spend_categories(name)')
    .eq('user_id', user.id)
    .gte('spent_on', sixMonthStart)
    .lte('spent_on', monthEnd)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })

  const sixMonthRows = (entriesData || []) as SpendEntryRow[]
  const sixMonthEntries: ProcessedSpendEntry[] = sixMonthRows.map((row) => {
    const { spend_categories, ...entry } = row
    return {
      ...entry,
      categoryName: spend_categories?.name ?? null,
      amountInBase: Number(entry.amount) * Number(entry.exchange_rate),
    }
  })

  // The month slice, the totals and "Recent" are all derived downstream, after
  // locally-queued rows are merged in — see DashboardStats and EntryList.

  // Bucket the 6-month window into per-month totals for the bar chart.
  // The totals themselves are derived in DashboardStats, over merged entries.
  const monthBuckets: { key: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(monthStartDate, i)
    monthBuckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
    })
  }

  // Active subscription rules
  const { data: rulesData } = await supabase
    .from('spend_rules')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('next_due', { ascending: true })

  const activeRules = (rulesData || []) as SpendRule[]

  const uniqueRuleCurrencies = [...new Set(activeRules.map((r) => r.default_currency))]
  const { rates: ruleRates, usingSecondary, unavailablePairs } = await batchGetExchangeRates(
    uniqueRuleCurrencies,
    baseCurrency
  )

  const in30Days = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))
  const dueRules = activeRules.filter((r) => r.next_due <= todayStr)
  const upcomingRules = activeRules.filter((r) => r.next_due > todayStr && r.next_due <= in30Days)

  const estMonthlySubscriptions = activeRules.reduce((sum, r) => {
    const rate = ruleRates[r.default_currency]
    if (rate == null) return sum
    return sum + monthlyEstimate(r.default_amount, r.cycle) * rate
  }, 0)

  return (
    <div className="pb-24 font-sans">
      <div className="mb-8 px-1 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">
            Tracking in <span className="font-bold text-[var(--primary)]">{baseCurrency}</span>
          </p>
          <div className="mt-3">
            <SyncStatus />
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-1 py-1">
          <Link
            href={prevHref}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="text-[13px] font-bold text-[var(--foreground)] tabular-nums px-2 min-w-[130px] text-center">
            {monthLabel}
          </span>
          <Link
            href={nextHref}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Rate source warnings (subscription estimates only) */}
      {unavailablePairs.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--tertiary-container)] border border-[var(--tertiary)]/20 mb-6">
          <span className="text-[var(--tertiary)] mt-0.5 text-sm shrink-0">⚠</span>
          <p className="text-xs font-medium text-[var(--on-tertiary-container)] leading-relaxed">
            Live rates unavailable for <strong>{unavailablePairs.join(', ')}</strong>. Subscription estimates in these currencies are excluded. Both rate sources are unreachable.
          </p>
        </div>
      )}
      {usingSecondary && unavailablePairs.length === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--muted)] border border-[var(--border)] mb-6">
          <span className="text-[var(--muted-foreground)] mt-0.5 text-sm shrink-0">ℹ</span>
          <p className="text-xs font-medium text-[var(--muted-foreground)] leading-relaxed">
            Using Frankfurter (ECB) as rate source for subscription estimates — primary source is currently unavailable.
          </p>
        </div>
      )}

      <div className="space-y-12">
        {/* Due confirmations */}
        {dueRules.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tertiary)] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--tertiary)]" />
                </span>
                <h2 className="text-2xl font-heading font-bold text-[var(--foreground)]">Needs confirmation</h2>
              </div>
              <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest bg-[var(--muted)] px-3 py-1 rounded-full">
                {dueRules.length} due
              </span>
            </div>
            <div className="space-y-4">
              {dueRules.map((rule) => (
                <DueCard key={rule.id} rule={rule} />
              ))}
            </div>
          </div>
        )}

        {/* Stat cards, calendar and charts — all recomputed client-side over
            server rows merged with anything still queued locally. */}
        <DashboardStats
          entries={sixMonthEntries}
          monthStart={monthStart}
          monthEnd={monthEnd}
          sixMonthStart={sixMonthStart}
          monthBuckets={monthBuckets}
          baseCurrency={baseCurrency}
          estMonthlySubscriptions={estMonthlySubscriptions}
          monthLabel={monthLabel}
          year={year}
          month={month}
          prevHref={prevHref}
          nextHref={nextHref}
          todayStr={todayStr}
        />

        {/* Upcoming (next 30 days) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <CalendarClock className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="text-2xl font-heading font-bold text-[var(--foreground)]">Upcoming</h2>
            </div>
            <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest bg-[var(--muted)] px-3 py-1 rounded-full">
              next 30 days
            </span>
          </div>

          {upcomingRules.length > 0 ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              {upcomingRules.map((rule) => {
                const rate = ruleRates[rule.default_currency]
                const estimate = rate == null ? null : rule.default_amount * rate
                return (
                  <div key={rule.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-[15px] tracking-tight text-[var(--foreground)] truncate">
                        {rule.name}
                      </p>
                      <p className="text-[11px] font-semibold text-[var(--muted-foreground)] mt-0.5">
                        Due {format(parseLocalDate(rule.next_due), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {estimate !== null ? (
                        <span className="text-[15px] font-heading font-semibold text-[var(--foreground)] tracking-tight tabular-nums">
                          &asymp; {formatCurrency(estimate, baseCurrency)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--muted-foreground)] font-medium">rate unavailable</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] font-medium px-1">No subscriptions due in the next 30 days.</p>
          )}
        </div>

        {/* Recent entries */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-[var(--muted-foreground)]" />
              <h2 className="text-2xl font-heading font-bold text-[var(--foreground)]">Recent</h2>
            </div>
            <Link
              href="/expenses"
              className="text-[11px] font-semibold text-[var(--primary)] uppercase tracking-widest hover:opacity-70"
            >
              View all
            </Link>
          </div>

          <EntryList
            entries={sixMonthEntries}
            baseCurrency={baseCurrency}
            windowStart={sixMonthStart}
            windowEnd={monthEnd}
            limit={5}
            flat
            emptyState={
              <div className="p-8 text-center bg-[var(--card)] rounded-2xl border-2 border-dashed border-[var(--border)]">
                <p className="text-[var(--muted-foreground)] font-bold text-sm">
                  No expenses yet. Add one to see the breakdown.
                </p>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
