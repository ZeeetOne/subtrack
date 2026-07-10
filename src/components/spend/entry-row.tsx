'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { EntryForm } from './entry-form'
import { deleteSpendEntry } from '@/lib/actions/spend'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProcessedSpendEntry } from '@/lib/types'

interface EntryRowProps {
  entry: ProcessedSpendEntry
  baseCurrency: string
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

export function EntryRow({ entry, baseCurrency }: EntryRowProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function closeModal() {
    setIsEditOpen(false)
    setConfirmingDelete(false)
  }

  async function onDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
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
        onClick={() => setIsEditOpen(true)}
        className="group w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--muted)] transition-colors cursor-pointer"
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
          </div>
          {entry.categoryName && (
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] mt-0.5 block truncate">
              {entry.categoryName}
            </span>
          )}
        </div>

        <div className="text-right flex-shrink-0 min-w-[90px]">
          <div className="text-[15px] font-heading font-semibold text-[var(--foreground)] tracking-tight tabular-nums leading-tight">
            {formatCurrency(entry.amount, entry.currency)}
          </div>
          {entry.currency !== baseCurrency && (
            <div className="text-[11px] font-bold text-[var(--primary)] tabular-nums mt-0.5">
              &asymp; {formatCurrency(entry.amountInBase, baseCurrency)}
            </div>
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
