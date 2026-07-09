'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ordinal ramp validated with the palette validator (2:1+ light end vs white,
// monotone lightness, single hue). Zero-spend days use the neutral muted surface.
const RAMP = ['#84b840', '#639a2c', '#47791f', '#2f5514']

export interface HeatmapDayItem {
  name: string
  amountInBase: number
  kind: 'paid' | 'scheduled'
}

export interface HeatmapDay {
  date: string // YYYY-MM-DD
  total: number
  items: HeatmapDayItem[]
}

interface SpendingHeatmapProps {
  monthLabel: string
  year: number
  month: number // 0-indexed
  days: HeatmapDay[]
  baseCurrency: string
  prevHref: string
  nextHref: string
  todayStr: string
}

export function SpendingHeatmap({
  monthLabel,
  year,
  month,
  days,
  baseCurrency,
  prevHref,
  nextHref,
  todayStr,
}: SpendingHeatmapProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: baseCurrency,
      minimumFractionDigits: baseCurrency === 'IDR' ? 0 : 2,
      maximumFractionDigits: baseCurrency === 'IDR' ? 0 : 2,
    }).format(amount)

  const byDate = new Map(days.map((d) => [d.date, d]))
  const max = Math.max(...days.map((d) => d.total), 0)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday-first column index for the 1st of the month
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7

  const cells: (HeatmapDay & { dayNum: number })[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const data = byDate.get(date)
    cells.push({ date, total: data?.total ?? 0, items: data?.items ?? [], dayNum: d })
  }

  const intensity = (total: number) => {
    if (total <= 0 || max <= 0) return 0
    return Math.min(RAMP.length, Math.max(1, Math.ceil((total / max) * RAMP.length)))
  }

  const selectedDay = selected ? byDate.get(selected) : null

  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
      {/* Header: title + month nav */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
          Spending Calendar
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="text-[12px] font-bold text-[var(--foreground)] min-w-[110px] text-center tabular-nums">
            {monthLabel}
          </span>
          <Link
            href={nextHref}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold text-[var(--muted-foreground)] uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {cells.map((cell) => {
          const level = intensity(cell.total)
          const isSelected = selected === cell.date
          const isToday = cell.date === todayStr
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelected(isSelected ? null : cell.date)}
              title={cell.total > 0 ? `${cell.date}: ${fmt(cell.total)}` : cell.date}
              className={cn(
                'aspect-square rounded-lg flex items-center justify-center text-[11px] font-semibold tabular-nums transition-all cursor-pointer',
                'hover:ring-2 hover:ring-[var(--primary)]/40',
                isSelected && 'ring-2 ring-[var(--primary)]',
                isToday && !isSelected && 'ring-1 ring-[var(--primary)]/60',
                level === 0 && 'bg-[var(--muted)] text-[var(--muted-foreground)]',
                level > 0 && 'text-white'
              )}
              style={level > 0 ? { backgroundColor: RAMP[level - 1] } : undefined}
            >
              {cell.dayNum}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-4">
        <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Less</span>
        <span className="w-3.5 h-3.5 rounded bg-[var(--muted)] inline-block" />
        {RAMP.map((c) => (
          <span key={c} className="w-3.5 h-3.5 rounded inline-block" style={{ backgroundColor: c }} />
        ))}
        <span className="text-[10px] font-medium text-[var(--muted-foreground)]">More</span>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 p-4 rounded-xl bg-[var(--muted)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
              {selectedDay.date}
            </span>
            <span className="text-sm font-bold text-[var(--foreground)] tabular-nums">
              {fmt(selectedDay.total)}
            </span>
          </div>
          {selectedDay.items.length > 0 ? (
            <div className="space-y-1.5">
              {selectedDay.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">
                    {item.name}
                    {item.kind === 'scheduled' && (
                      <span className="text-[10px] font-semibold text-[var(--muted-foreground)] ml-1.5 uppercase tracking-wide">
                        scheduled
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums shrink-0">
                    {fmt(item.amountInBase)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] font-medium">No spending this day.</p>
          )}
        </div>
      )}
    </div>
  )
}
