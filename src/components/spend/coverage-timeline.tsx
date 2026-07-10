'use client'

import { format } from 'date-fns'
import { parseLocalDate } from '@/lib/expense-utils'
import type { CoveragePeriod, CoverageGap } from '@/lib/spend-utils'

interface CoverageTimelineProps {
  periods: CoveragePeriod[]
  gaps: CoverageGap[]
}

type TimelineItem =
  | { type: 'period'; key: string; period: CoveragePeriod }
  | { type: 'gap'; key: string; gap: CoverageGap }

function fmt(date: string) {
  return format(parseLocalDate(date), 'MMM d, yyyy')
}

/** Newest-first vertical list interleaving subscribed streaks and breaks between them. */
export function CoverageTimeline({ periods, gaps }: CoverageTimelineProps) {
  if (periods.length === 0) return null

  const items: TimelineItem[] = []
  for (let i = periods.length - 1; i >= 0; i--) {
    items.push({ type: 'period', key: `period-${i}`, period: periods[i] })
    if (i > 0) items.push({ type: 'gap', key: `gap-${i - 1}`, gap: gaps[i - 1] })
  }

  return (
    <div className="space-y-2">
      {items.map((item) =>
        item.type === 'period' ? (
          <div
            key={item.key}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent)]"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0" />
            <p className="text-[13px] font-semibold text-[var(--foreground)]">
              Subscribed {fmt(item.period.start)} &rarr; {fmt(item.period.end)}
              <span className="text-[var(--muted-foreground)] font-medium">
                {' '}
                &middot; {item.period.payments} payment{item.period.payments === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        ) : (
          <div
            key={item.key}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
            <p className="text-[13px] font-semibold text-orange-700">
              Break &middot; {item.gap.days} days
            </p>
          </div>
        )
      )}
    </div>
  )
}
