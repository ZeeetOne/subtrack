'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { EntryForm } from './entry-form'
import { deleteSpendEntry } from '@/lib/actions/spend'
import { useOutbox } from '@/components/offline/outbox-provider'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProcessedSpendEntry } from '@/lib/types'

interface EntryRowProps {
  entry: ProcessedSpendEntry
  baseCurrency: string
  /**
   * Set when this row has an unflushed local write.
   * 'queued'  — waiting to sync; editing it would race the flush, so it's inert.
   * 'failed'  — the server rejected it. The row stays visible on purpose:
   *             a write we can't apply must never disappear silently.
   */
  pending?: 'queued' | 'failed'
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

/** "14:05" -> "2:05 PM". Falls back to the raw value if it's ever malformed. */
function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function EntryRow({ entry, baseCurrency, pending }: EntryRowProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const outbox = useOutbox()

  function closeModal() {
    setIsEditOpen(false)
    setConfirmingDelete(false)
  }

  async function onDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    // Queue it rather than calling the server directly: a delete must work
    // offline too, and the coalescer turns "created then deleted while offline"
    // into nothing at all instead of a pointless round trip.
    if (outbox) {
      closeModal()
      toast.success(`${entry.name} deleted.`)
      void outbox.enqueue(
        {
          id: crypto.randomUUID(),
          userId: entry.user_id,
          entityId: entry.id,
          kind: 'entry.delete',
          createdAt: new Date().toISOString(),
          attempts: 0,
          nextAttemptAt: Date.now(),
          lastError: null,
          status: 'pending',
        },
        null
      )
      return
    }

    setIsDeleting(true)
    const result = await deleteSpendEntry(entry.id)
    setIsDeleting(false)
    if (result.error) {
      toast.error(result.error)
      setConfirmingDelete(false)
    } else {
      toast.success(`${entry.name} deleted.`)
      closeModal()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { if (!pending) setIsEditOpen(true) }}
        aria-disabled={pending ? true : undefined}
        className={cn(
          'group w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
          pending
            ? 'opacity-60 cursor-default'
            : 'hover:bg-[var(--muted)] cursor-pointer'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading font-semibold text-[15px] tracking-tight text-[var(--foreground)] leading-tight truncate">
              {entry.name}
            </span>
            {entry.rule_id && (
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--primary)]">
                Subscription
              </span>
            )}
            {pending === 'queued' && (
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                Queued
              </span>
            )}
            {pending === 'failed' && (
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)]">
                Not synced
              </span>
            )}
          </div>
          {(entry.categoryName || entry.spent_time) && (
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] mt-0.5 block truncate">
              {[entry.categoryName, entry.spent_time && formatTime(entry.spent_time)].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        <div className="text-right flex-shrink-0 min-w-[90px]">
          <div className="text-[15px] font-heading font-semibold text-[var(--foreground)] tracking-tight tabular-nums leading-tight">
            {formatCurrency(entry.amount, entry.currency)}
          </div>
          {entry.currency !== baseCurrency && (
            entry.rate_status === 'pending' ? (
              // Saved before a real rate could be fetched. Showing the
              // provisional conversion would just be a confidently wrong number.
              <div className="text-[11px] font-bold text-[var(--muted-foreground)] mt-0.5">
                rate pending
              </div>
            ) : (
              <div className="text-[11px] font-bold text-[var(--primary)] tabular-nums mt-0.5">
                &asymp; {formatCurrency(entry.amountInBase, baseCurrency)}
              </div>
            )
          )}
        </div>
      </button>

      <Modal isOpen={isEditOpen} onClose={closeModal} title="Edit Expense">
        <div className="space-y-5">
          <EntryForm
            onSuccess={closeModal}
            onCancel={closeModal}
            initialData={{
              id: entry.id,
              name: entry.name,
              amount: String(entry.amount),
              currency: entry.currency,
              spent_on: entry.spent_on,
              spent_time: entry.spent_time || undefined,
              category_id: entry.category_id || undefined,
              notes: entry.notes || undefined,
              is_subscription: false,
            }}
          />

          <div className="pt-1 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className={cn(
                'w-full h-11 mt-4 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer',
                confirmingDelete
                  ? 'bg-[var(--destructive)] text-white'
                  : 'bg-transparent text-[var(--destructive)] border border-[var(--border)] hover:border-[var(--destructive)]/40'
              )}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {isDeleting ? 'Deleting…' : confirmingDelete ? 'Tap again to confirm delete' : 'Delete expense'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
