'use client'

import { useState } from 'react'
import { Trash2, Edit2, Pause, Play, RotateCcw, Loader2 } from 'lucide-react'
import { deleteExpense, toggleExpenseStatus, resubscribeExpense } from '@/lib/actions/expense'
import { cn } from '@/lib/utils'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { ExpenseForm } from './expense-form'

const cycleConfig = {
  weekly:     { label: 'Weekly',    color: '#c89e2a', bg: '#fbeaa5', text: '#452f00' },
  monthly:    { label: 'Monthly',   color: '#aee865', bg: '#eaf5d0', text: '#1e3200' },
  quarterly:  { label: 'Quarterly', color: '#6da030', bg: '#d5f5a0', text: '#1e3800' },
  yearly:     { label: 'Yearly',    color: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6' },
  'one-time': { label: 'One-time',  color: '#94a3b8', bg: '#f1f5f9', text: '#475569' },
}

interface ExpenseCardProps {
  expense: {
    id: string
    name: string
    amount: number
    currency: string
    billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'
    renewal_type?: 'automatic' | 'manual'
    status?: 'active' | 'lapsed'
    next_billing_date: string | null
    is_active: boolean
    category: string | null
  }
  convertedAmount?: number
  baseCurrency?: string
  showActions?: boolean
  displayDate?: Date
}

export function ExpenseCard({
  expense,
  convertedAmount,
  baseCurrency,
  showActions = true,
  displayDate,
}: ExpenseCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isResubOpen, setIsResubOpen] = useState(false)
  const [resubDate, setResubDate] = useState(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })
  const [isResubLoading, setIsResubLoading] = useState(false)

  const cycle = cycleConfig[expense.billing_cycle]
  const isLapsed = expense.status === 'lapsed'

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'IDR' ? 0 : 2,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount)

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const targetDate = displayDate || (expense.next_billing_date ? parseLocalDate(expense.next_billing_date) : null)
  let dueDays: number | null = null
  if (targetDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(targetDate)
    target.setHours(0, 0, 0, 0)
    dueDays = differenceInDays(target, today)
  }

  async function onDelete() {
    toast.error('Are you sure?', {
      description: `This will permanently remove ${expense.name}.`,
      action: {
        label: 'Delete',
        onClick: async () => {
          const result = await deleteExpense(expense.id)
          if (result.success) toast.success(`${expense.name} deleted.`)
          else toast.error('Failed to delete.')
        },
      },
    })
  }

  async function onResubscribe() {
    setIsResubLoading(true)
    const result = await resubscribeExpense(expense.id, resubDate)
    setIsResubLoading(false)
    if (result.success) {
      toast.success(`${expense.name} resubscribed.`)
      setIsResubOpen(false)
    } else {
      toast.error(result.error || 'Failed to resubscribe.')
    }
  }

  async function onToggle() {
    const nextState = !expense.is_active
    const result = await toggleExpenseStatus(expense.id, nextState)
    if (result.success)
      toast.success(nextState ? `${expense.name} resumed.` : `${expense.name} paused.`)
    else toast.error('Failed to update status.')
  }

  return (
    <>
      <div
        className={cn(
          'group relative flex items-center gap-3 sm:gap-4 pl-5 pr-3 sm:pr-4 py-3.5',
          'rounded-2xl bg-[var(--card)] transition-colors duration-150 hover:bg-[var(--muted)]',
          !expense.is_active && 'opacity-50'
        )}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-300 group-hover:top-2 group-hover:bottom-2"
          style={{ backgroundColor: cycle.color }}
        />

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-semibold flex-shrink-0 font-heading tracking-wider"
          style={{ backgroundColor: cycle.bg, color: cycle.text }}
        >
          {expense.name.substring(0, 2).toUpperCase()}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'font-heading font-semibold text-[15px] tracking-tight text-[var(--foreground)] leading-tight',
                !expense.is_active && 'line-through decoration-[var(--muted-foreground)]'
              )}
            >
              {expense.name}
            </span>
            {!expense.is_active && (
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                Paused
              </span>
            )}
            {expense.is_active && isLapsed && (
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
                Lapsed
              </span>
            )}
            {expense.is_active && !isLapsed && expense.renewal_type === 'manual' && (
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--primary)]">
                Manual
              </span>
            )}
          </div>
          {expense.category && (
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] mt-0.5 block">
              {expense.category}
            </span>
          )}
        </div>

        {/* Due date */}
        {targetDate && (
          <div className="flex flex-col items-end flex-shrink-0 min-w-[64px]">
            <span className="text-[11px] font-bold text-[var(--muted-foreground)] tabular-nums">
              {displayDate ? format(displayDate, 'MMM d') : format(targetDate, 'MMM d')}
            </span>
            {expense.is_active && !isLapsed && dueDays !== null && dueDays >= 0 && dueDays <= 7 && (
              <span
                className={cn(
                  'text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 whitespace-nowrap',
                  dueDays === 0
                    ? 'bg-red-100 text-red-700'
                    : dueDays <= 2
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-yellow-50 text-yellow-700'
                )}
              >
                {dueDays === 0 ? 'Today' : dueDays === 1 ? 'Tmrw' : `${dueDays}d`}
              </span>
            )}
          </div>
        )}

        {/* Amount */}
        <div className="text-right flex-shrink-0 min-w-[90px]">
          <div className="text-[15px] font-heading font-semibold text-[var(--foreground)] tracking-tight tabular-nums leading-tight">
            {formatCurrency(expense.amount, expense.currency)}
          </div>
          {convertedAmount !== undefined && baseCurrency && expense.currency !== baseCurrency && (
            <div className="text-[11px] font-bold text-[var(--primary)] tabular-nums mt-0.5">
              ≈ {formatCurrency(convertedAmount, baseCurrency)}
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:translate-x-1 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-150">
            {isLapsed && expense.is_active && (
              <button
                onClick={() => setIsResubOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-semibold text-[var(--primary)] bg-[var(--accent)] hover:opacity-80 transition-opacity mr-1"
                aria-label="Resubscribe"
              >
                <RotateCcw className="w-3 h-3" />
                Resubscribe
              </button>
            )}
            <button
              onClick={() => setIsEditOpen(true)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--accent)] transition-colors"
              aria-label="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggle}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--accent)] transition-colors"
              aria-label={expense.is_active ? 'Pause' : 'Resume'}
            >
              {expense.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive-foreground)] transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Expense">
        <ExpenseForm
          onSuccess={() => setIsEditOpen(false)}
          onCancel={() => setIsEditOpen(false)}
          initialData={{
            ...expense,
            amount: String(expense.amount),
            renewal_type: expense.renewal_type || 'automatic',
            category: expense.category || undefined,
            next_billing_date: expense.next_billing_date || undefined,
          }}
        />
      </Modal>

      <Modal isOpen={isResubOpen} onClose={() => setIsResubOpen(false)} title={`Resubscribe ${expense.name}`}>
        <div className="space-y-5 font-sans">
          <p className="text-sm text-[var(--muted-foreground)] font-medium leading-relaxed">
            When did you subscribe again? The billing cycle restarts from this date, and the payment is added to your history.
          </p>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
              Resubscribed on
            </label>
            <input
              type="date"
              value={resubDate}
              onChange={(e) => setResubDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsResubOpen(false)}
              disabled={isResubLoading}
              className="flex-1 h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onResubscribe}
              disabled={isResubLoading || !resubDate}
              className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isResubLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
