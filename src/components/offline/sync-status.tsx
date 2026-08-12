'use client'

import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useOutbox } from './outbox-provider'

/**
 * Tells the user what the app is holding on their behalf.
 *
 * Without this, an expense added offline looks identical to one already saved,
 * and a write that failed permanently would be invisible. Both cases need to be
 * legible or the user can't trust the app with their data.
 */
export function SyncStatus() {
  const outbox = useOutbox()
  if (!outbox || !outbox.hydrated) return null

  const { pendingCount, failedCount, online, flushing } = outbox
  if (pendingCount === 0 && online) return null

  if (failedCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)]">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-semibold">
          {failedCount} {failedCount === 1 ? 'expense' : 'expenses'} didn&apos;t sync
        </span>
      </div>
    )
  }

  if (flushing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span className="text-[11px] font-semibold">Syncing…</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
      <CloudOff className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[11px] font-semibold">
        {pendingCount > 0
          ? `${pendingCount} saved on this device`
          : 'Offline — showing saved data'}
      </span>
    </div>
  )
}
