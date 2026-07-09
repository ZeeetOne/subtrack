'use client'

import { useState } from 'react'
import { Check, CalendarClock, SkipForward, CircleStop, Loader2 } from 'lucide-react'
import { confirmPayment, skipPayment, lapseExpense } from '@/lib/actions/expense'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface PaymentConfirmCardProps {
  expense: {
    id: string
    name: string
    amount: number
    currency: string
    category: string | null
    next_billing_date: string | null
  }
  convertedAmount?: number
  baseCurrency?: string
}

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function PaymentConfirmCard({ expense, convertedAmount, baseCurrency }: PaymentConfirmCardProps) {
  const [pending, setPending] = useState<string | null>(null)
  const [isDateOpen, setIsDateOpen] = useState(false)
  const [paidDate, setPaidDate] = useState(todayStr())
  const [paidAmount, setPaidAmount] = useState(String(expense.amount))

  const dueDate = expense.next_billing_date ? parseLocalDate(expense.next_billing_date) : null

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'IDR' ? 0 : 2,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount)

  async function run(action: string, fn: () => Promise<{ success?: boolean; error?: string }>, successMsg: string) {
    setPending(action)
    const result = await fn()
    setPending(null)
    if (result.success) {
      toast.success(successMsg)
      setIsDateOpen(false)
    } else {
      toast.error(result.error || 'Something went wrong.')
    }
  }

  const btnClass =
    'flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer'

  return (
    <div className="rounded-2xl border border-[var(--tertiary)]/30 bg-[var(--card)] p-4 sm:p-5">
      {/* Top row: info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-semibold flex-shrink-0 font-heading tracking-wider bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]">
          {expense.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-[15px] tracking-tight text-[var(--foreground)] leading-tight truncate">
            {expense.name}
          </p>
          <p className="text-[11px] font-bold text-[var(--muted-foreground)] mt-0.5">
            {dueDate ? <>Due {format(dueDate, 'MMM d')}</> : 'Due'}
            {expense.category && <> • {expense.category}</>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[15px] font-heading font-semibold text-[var(--foreground)] tracking-tight tabular-nums">
            {formatCurrency(expense.amount, expense.currency)}
          </p>
          {convertedAmount !== undefined && baseCurrency && expense.currency !== baseCurrency && (
            <p className="text-[11px] font-bold text-[var(--primary)] tabular-nums mt-0.5">
              ≈ {formatCurrency(convertedAmount, baseCurrency)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending !== null}
          onClick={() =>
            run('paid', () => confirmPayment(expense.id, todayStr()), `${expense.name} marked as paid.`)
          }
          className={cn(btnClass, 'bg-[var(--primary)] text-white hover:opacity-80 flex-1 sm:flex-none')}
        >
          {pending === 'paid' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Paid
        </button>
        <button
          disabled={pending !== null}
          onClick={() => setIsDateOpen((v) => !v)}
          className={cn(
            btnClass,
            'border flex-1 sm:flex-none',
            isDateOpen
              ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/40'
          )}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Paid on…
        </button>
        <button
          disabled={pending !== null}
          onClick={() => run('skip', () => skipPayment(expense.id), `${expense.name}: cycle skipped.`)}
          className={cn(btnClass, 'border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex-1 sm:flex-none')}
        >
          {pending === 'skip' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
          Skip cycle
        </button>
        <button
          disabled={pending !== null}
          onClick={() => run('lapse', () => lapseExpense(expense.id), `${expense.name} stopped — resubscribe anytime.`)}
          className={cn(btnClass, 'border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--destructive)] flex-1 sm:flex-none')}
        >
          {pending === 'lapse' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CircleStop className="w-3.5 h-3.5" />}
          Stopped for now
        </button>
      </div>

      {/* Paid on… panel */}
      {isDateOpen && (
        <div className="mt-3 p-3.5 rounded-xl bg-[var(--muted)] flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
              Actual date
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
              Amount ({expense.currency})
            </label>
            <input
              type="number"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
            />
          </div>
          <button
            disabled={pending !== null || !paidDate}
            onClick={() =>
              run(
                'paid-on',
                () => confirmPayment(expense.id, paidDate, paidAmount),
                `${expense.name} marked as paid.`
              )
            }
            className={cn(btnClass, 'h-10 bg-[var(--primary)] text-white hover:opacity-80')}
          >
            {pending === 'paid-on' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      )}
    </div>
  )
}
