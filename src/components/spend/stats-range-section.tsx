import Link from 'next/link'
import { CalendarRange } from 'lucide-react'
import { UNCATEGORIZED, type RangeSummary, type BreakdownRow, type StatsRange } from '@/lib/stats-range'

interface Preset {
  label: string
  from: string
  to: string
}

interface StatsRangeSectionProps {
  baseCurrency: string
  categories: { id: string; name: string }[]
  presets: Preset[]
  /** Raw form values, echoed back into the inputs. */
  values: { from: string; to: string; cat: string; q: string }
  range: StatsRange | null
  summary: RangeSummary | null
  /** True when the row cap was hit and the totals are therefore partial. */
  truncated: boolean
  invalid: boolean
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

const fieldClass =
  'h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]'
const labelClass =
  'block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5'

function BreakdownList({ rows, currency, limit }: { rows: BreakdownRow[]; currency: string; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows
  return (
    <div className="space-y-4">
      {shown.map((r) => (
        <div key={r.name}>
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-[var(--foreground)] truncate">{r.name}</span>
              <span className="text-[11px] font-medium text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full shrink-0">
                {r.count}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                {formatCurrency(r.total, currency)}
              </span>
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)] ml-2 tabular-nums">
                {r.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full"
              style={{ width: `${Math.min(100, r.percentage)}%` }}
            />
          </div>
        </div>
      ))}
      {limit && rows.length > limit && (
        <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
          +{rows.length - limit} more. Narrow the title filter to see them.
        </p>
      )}
    </div>
  )
}

export function StatsRangeSection({
  baseCurrency,
  categories,
  presets,
  values,
  range,
  summary,
  truncated,
  invalid,
}: StatsRangeSectionProps) {
  const filtered = Boolean(values.cat || values.q)

  return (
    <div className="mb-8">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <CalendarRange className="w-3.5 h-3.5 text-[var(--primary)]" />
          </div>
          <h2 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
            Custom range
          </h2>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={`/stats?from=${p.from}&to=${p.to}`}
              className="flex-none px-3.5 py-1.5 rounded-full text-[12px] font-semibold border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)] transition-colors"
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form action="/stats" method="get" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="range-from" className={labelClass}>From</label>
              <input id="range-from" type="date" name="from" required defaultValue={values.from} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="range-to" className={labelClass}>To</label>
              <input id="range-to" type="date" name="to" required defaultValue={values.to} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="range-cat" className={labelClass}>Category</label>
              <select id="range-cat" name="cat" defaultValue={values.cat} className={fieldClass}>
                <option value="">All categories</option>
                <option value={UNCATEGORIZED}>Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="range-q" className={labelClass}>Title contains</label>
              <input
                id="range-q"
                type="search"
                name="q"
                maxLength={100}
                placeholder="e.g. coffee"
                defaultValue={values.q}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/stats"
              className="flex-1 h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center justify-center transition-colors"
            >
              Reset
            </Link>
            <button
              type="submit"
              className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold hover:opacity-80 transition-opacity cursor-pointer"
            >
              Apply
            </button>
          </div>
        </form>

        {invalid && (
          <p className="mt-4 text-[12px] font-medium text-[var(--destructive)]">
            That date range isn&apos;t valid. Pick both a start and an end date.
          </p>
        )}

        {range && summary && (
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            {truncated && (
              <p className="mb-4 text-[12px] font-medium text-[var(--destructive)]">
                This range has more entries than can be loaded, so these totals are partial. Try a shorter range.
              </p>
            )}

            <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
              {range.from} → {range.to}
              {filtered && ' · filtered'}
            </p>
            <p className="text-3xl font-heading font-bold text-[var(--foreground)] tracking-tight break-words">
              {formatCurrency(summary.total, baseCurrency)}
            </p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">
              {summary.count} {summary.count === 1 ? 'entry' : 'entries'} &middot;{' '}
              {formatCurrency(summary.perDay, baseCurrency)} per day
            </p>

            {summary.count === 0 ? (
              <div className="mt-6 flex items-center justify-center h-24 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
                No expenses match this range and filter.
              </div>
            ) : (
              <div className="mt-8 space-y-8">
                <div>
                  <h3 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-4">
                    By category
                  </h3>
                  <BreakdownList rows={summary.byCategory} currency={baseCurrency} />
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-4">
                    By title
                  </h3>
                  <BreakdownList rows={summary.byTitle} currency={baseCurrency} limit={15} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
