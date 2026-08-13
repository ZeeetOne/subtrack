'use client'

import { Suspense, use } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, Repeat, Receipt, CalendarClock } from 'lucide-react'
import { SpendingHeatmap } from './spending-heatmap'
import { Skeleton } from '@/components/ui/skeleton'
import { useOutbox } from '@/components/offline/outbox-provider'
import { mergePending } from '@/lib/offline/merge'
import { deriveDashboardStats, type MonthBucket } from '@/lib/dashboard-stats'
import type { SubscriptionEstimate } from '@/lib/subscription-estimate'
import type { ProcessedSpendEntry } from '@/lib/types'

// chart.js + react-chartjs-2 are the heaviest thing on this route and the
// charts sit below the fold, so they don't belong in the initial bundle.
const SpendCharts = dynamic(
  () => import('@/components/spend/spend-charts').then((m) => m.SpendCharts),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-2xl" /> }
)

interface DashboardStatsProps {
  entries: ProcessedSpendEntry[]
  monthStart: string
  monthEnd: string
  sixMonthStart: string
  monthBuckets: MonthBucket[]
  baseCurrency: string
  /** Unresolved on purpose — see buildSubscriptionEstimate. */
  subscriptionEstimate: Promise<SubscriptionEstimate>
  monthLabel: string
  year: number
  month: number
  prevHref: string
  nextHref: string
  todayStr: string
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">{icon}</div>
        <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-xl font-heading font-bold text-[var(--foreground)] tracking-tight tabular-nums break-words">
        {value}
      </p>
    </div>
  )
}

/**
 * The one card that waits on the exchange-rate API. Isolated behind Suspense so
 * a slow or unavailable FX provider costs this card alone, not the whole page.
 */
function SubscriptionEstimateCard({
  estimate,
  baseCurrency,
}: {
  estimate: Promise<SubscriptionEstimate>
  baseCurrency: string
}) {
  const { total } = use(estimate)
  return (
    <StatCard
      icon={<CalendarClock className="w-3.5 h-3.5 text-[var(--tertiary)]" />}
      label="Est. monthly subs"
      value={`≈ ${formatCurrency(total, baseCurrency)}`}
    />
  )
}

/** Same skeleton footprint as the real card, so nothing shifts when it lands. */
function SubscriptionEstimateFallback() {
  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
          <CalendarClock className="w-3.5 h-3.5 text-[var(--tertiary)]" />
        </div>
        <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
          Est. monthly subs
        </span>
      </div>
      <Skeleton className="h-7 w-28" />
    </div>
  )
}

/** Rate-source warnings, which also need the FX result. */
function RateWarnings({ estimate }: { estimate: Promise<SubscriptionEstimate> }) {
  const { usingSecondary, unavailablePairs } = use(estimate)

  if (unavailablePairs.length > 0) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--tertiary-container)] border border-[var(--tertiary)]/20">
        <span className="text-[var(--tertiary)] mt-0.5 text-sm shrink-0">⚠</span>
        <p className="text-xs font-medium text-[var(--on-tertiary-container)] leading-relaxed">
          Live rates unavailable for <strong>{unavailablePairs.join(', ')}</strong>. Subscription
          estimates in these currencies are excluded. Both rate sources are unreachable.
        </p>
      </div>
    )
  }

  if (usingSecondary) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--muted)] border border-[var(--border)]">
        <span className="text-[var(--muted-foreground)] mt-0.5 text-sm shrink-0">ℹ</span>
        <p className="text-xs font-medium text-[var(--muted-foreground)] leading-relaxed">
          Using Frankfurter (ECB) as rate source for subscription estimates — primary source is
          currently unavailable.
        </p>
      </div>
    )
  }

  return null
}

/**
 * The dashboard's numbers, recomputed over server rows + locally-queued rows.
 *
 * The totals, the heatmap and the charts all derive from one merged list, so a
 * queued expense moves every figure at once rather than only appearing under
 * "Recent".
 */
export function DashboardStats({
  entries,
  monthStart,
  monthEnd,
  sixMonthStart,
  monthBuckets,
  baseCurrency,
  subscriptionEstimate,
  monthLabel,
  year,
  month,
  prevHref,
  nextHref,
  todayStr,
}: DashboardStatsProps) {
  const outbox = useOutbox()

  const merged = outbox
    ? mergePending({
        entries,
        shadows: outbox.shadows,
        deletes: outbox.pendingDeletes,
        windowStart: sixMonthStart,
        windowEnd: monthEnd,
      })
    : entries

  const stats = deriveDashboardStats(merged, { monthStart, monthEnd, monthBuckets })

  return (
    <>
      {/* Warnings render only once the FX call settles; null until then. */}
      <Suspense fallback={null}>
        <RateWarnings estimate={subscriptionEstimate} />
      </Suspense>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />}
          label="This month"
          value={formatCurrency(stats.thisMonthTotal, baseCurrency)}
        />
        <StatCard
          icon={<Repeat className="w-3.5 h-3.5 text-[var(--primary)]" />}
          label="Subscriptions"
          value={formatCurrency(stats.subscriptionsTotal, baseCurrency)}
        />
        <StatCard
          icon={<Receipt className="w-3.5 h-3.5 text-[var(--tertiary)]" />}
          label="One-time"
          value={formatCurrency(stats.oneTimeTotal, baseCurrency)}
        />
        <Suspense fallback={<SubscriptionEstimateFallback />}>
          <SubscriptionEstimateCard estimate={subscriptionEstimate} baseCurrency={baseCurrency} />
        </Suspense>
      </div>

      <SpendingHeatmap
        monthLabel={monthLabel}
        year={year}
        month={month}
        days={stats.heatmapDays}
        baseCurrency={baseCurrency}
        prevHref={prevHref}
        nextHref={nextHref}
        todayStr={todayStr}
      />

      <SpendCharts
        entries={stats.monthEntries}
        monthlyTotals={stats.monthlyTotals}
        baseCurrency={baseCurrency}
      />
    </>
  )
}
