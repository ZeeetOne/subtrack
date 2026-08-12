'use client'

import { TrendingUp, Repeat, Receipt, CalendarClock } from 'lucide-react'
import { SpendingHeatmap } from './spending-heatmap'
import { SpendCharts } from '@/components/spend/spend-charts'
import { useOutbox } from '@/components/offline/outbox-provider'
import { mergePending } from '@/lib/offline/merge'
import { deriveDashboardStats, type MonthBucket } from '@/lib/dashboard-stats'
import type { ProcessedSpendEntry } from '@/lib/types'

interface DashboardStatsProps {
  entries: ProcessedSpendEntry[]
  monthStart: string
  monthEnd: string
  sixMonthStart: string
  monthBuckets: MonthBucket[]
  baseCurrency: string
  estMonthlySubscriptions: number
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
  estMonthlySubscriptions,
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
        <StatCard
          icon={<CalendarClock className="w-3.5 h-3.5 text-[var(--tertiary)]" />}
          label="Est. monthly subs"
          value={`≈ ${formatCurrency(estMonthlySubscriptions, baseCurrency)}`}
        />
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
