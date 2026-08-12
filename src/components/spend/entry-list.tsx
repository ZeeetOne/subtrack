'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { EntryRow } from './entry-row'
import { useOutbox } from '@/components/offline/outbox-provider'
import { mergePending, reconcilableShadows } from '@/lib/offline/merge'
import { groupByDay } from '@/lib/spend-grouping'
import { parseLocalDate } from '@/lib/expense-utils'
import type { ProcessedSpendEntry } from '@/lib/types'

interface EntryListProps {
  entries: ProcessedSpendEntry[]
  baseCurrency: string
  /** Inclusive spent_on bounds of this view, so a local row only shows if it belongs. */
  windowStart?: string
  windowEnd?: string
  categoryId?: string
  limit?: number
  /** Rendered when the merged list is empty (server rows + local rows). */
  emptyState?: React.ReactNode
  /** Flat list without day headers — used for the dashboard's "Recent". */
  flat?: boolean
}

/**
 * The one presentational leaf that knows about local state.
 *
 * Everything above it stays server-rendered: auth, the profile lookup and the
 * spend_entries query are untouched. This only folds queued local rows into
 * what the server already sent.
 */
export function EntryList({
  entries,
  baseCurrency,
  windowStart,
  windowEnd,
  categoryId,
  limit,
  emptyState,
  flat = false,
}: EntryListProps) {
  const outbox = useOutbox()
  const router = useRouter()

  const merged = outbox
    ? mergePending({
        entries,
        shadows: outbox.shadows,
        deletes: outbox.pendingDeletes,
        windowStart,
        windowEnd,
        categoryId,
        limit,
      })
    : typeof limit === 'number'
      ? entries.slice(0, limit)
      : entries

  // Once the server list carries a synced row, its shadow has done its job.
  // Keyed on `entries` so this runs exactly when fresh server data arrives.
  useEffect(() => {
    if (!outbox || !outbox.shadows.length) return
    const stale = reconcilableShadows(outbox.shadows, entries, Date.now())
    if (stale.length) void outbox.dropShadows(stale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  // A flush triggered by regaining connectivity (rather than by a submit) has
  // no other way to repaint the server-rendered list. Only refresh on the
  // true->false transition; refreshing on mount would refetch every page load.
  const flushing = outbox?.flushing ?? false
  const wasFlushing = useRef(false)
  useEffect(() => {
    if (wasFlushing.current && !flushing) router.refresh()
    wasFlushing.current = flushing
  }, [flushing, router])

  if (!merged.length) return <>{emptyState ?? null}</>

  const pendingFor = (id: string) => outbox?.pendingById.get(id)

  if (flat) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        {merged.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            baseCurrency={baseCurrency}
            pending={pendingFor(entry.id)}
          />
        ))}
      </div>
    )
  }

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: baseCurrency,
      minimumFractionDigits: baseCurrency === 'IDR' ? 0 : 2,
      maximumFractionDigits: baseCurrency === 'IDR' ? 0 : 2,
    }).format(amount)

  return (
    <div className="space-y-6">
      {groupByDay(merged).map((section) => (
        <section key={section.date}>
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {format(parseLocalDate(section.date), 'EEEE, MMM d')}
            </span>
            <div className="flex-1 h-px bg-[var(--border)] opacity-40" />
            <span className="text-[11px] font-bold text-[var(--foreground)] tabular-nums">
              {fmt(section.total)}
            </span>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {section.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                baseCurrency={baseCurrency}
                pending={pendingFor(entry.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
