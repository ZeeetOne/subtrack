'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Check, SkipForward, CircleStop, Coffee, Loader2 } from 'lucide-react'
import { confirmRulePayment, skipRulePayment, pauseRule, endRule } from '@/lib/actions/spend'
import { parseLocalDate, toLocalDateString } from '@/lib/expense-utils'
import { cn } from '@/lib/utils'
import type { SpendRule } from '@/lib/types'

interface DueCardProps {
  rule: SpendRule
}

type Expanded = 'paid' | 'stopped' | null

export function DueCard({ rule }: DueCardProps) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Expanded>(null)

  const today = toLocalDateString(new Date())
  const [paidDate, setPaidDate] = useState(rule.next_due <= today ? rule.next_due : today)
  const [paidAmount, setPaidAmount] = useState(String(rule.default_amount))

  async function run(action: string, fn: () => Promise<{ success?: boolean; error?: string }>, successMsg: string) {
    setPending(action)
    const result = await fn()
    setPending(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(successMsg)
      setExpanded(null)
      router.refresh()
    }
  }

  const btnClass =
    'flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer'

  return (
    <div className="rounded-2xl border border-[var(--tertiary)]/30 bg-[var(--card)] p-4 sm:p-5">
      {/* Headline */}
      <p className="text-[13px] font-medium text-[var(--foreground)] leading-snug mb-4">
        <span className="font-heading font-semibold">{rule.name}</span> was due{' '}
        {format(parseLocalDate(rule.next_due), 'MMM d, yyyy')} — is this subscription still active?
      </p>

      {/* Primary choices */}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending !== null}
          onClick={() => setExpanded((v) => (v === 'paid' ? null : 'paid'))}
          className={cn(
            btnClass,
            'flex-1 sm:flex-none',
            expanded === 'paid'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--primary)] text-white hover:opacity-80'
          )}
        >
          <Check className="w-3.5 h-3.5" />
          Yes, I paid
        </button>
        <button
          disabled={pending !== null}
          onClick={() => run('skip', () => skipRulePayment(rule.id), `${rule.name}: cycle skipped.`)}
          className={cn(
            btnClass,
            'border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex-1 sm:flex-none'
          )}
        >
          {pending === 'skip' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
          Skipped this one
        </button>
        <button
          disabled={pending !== null}
          onClick={() => setExpanded((v) => (v === 'stopped' ? null : 'stopped'))}
          className={cn(
            btnClass,
            'border flex-1 sm:flex-none',
            expanded === 'stopped'
              ? 'border-[var(--destructive)] text-[var(--destructive)] bg-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--destructive)]'
          )}
        >
          <CircleStop className="w-3.5 h-3.5" />
          No, I stopped
        </button>
      </div>

      {/* "Yes, I paid" panel */}
      {expanded === 'paid' && (
        <div className="mt-3 p-3.5 rounded-xl bg-[var(--muted)] flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
              Paid date
            </label>
            <input
              type="date"
              max={today}
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
              Amount ({rule.default_currency})
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
                'confirm',
                () => confirmRulePayment(rule.id, { paid_date: paidDate, amount: paidAmount }),
                `${rule.name} marked as paid.`
              )
            }
            className={cn(btnClass, 'h-10 bg-[var(--primary)] text-white hover:opacity-80')}
          >
            {pending === 'confirm' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      )}

      {/* "No, I stopped" panel */}
      {expanded === 'stopped' && (
        <div className="mt-3 p-3.5 rounded-xl bg-[var(--muted)] flex flex-wrap gap-2">
          <button
            disabled={pending !== null}
            onClick={() => run('pause', () => pauseRule(rule.id), `${rule.name} paused.`)}
            className={cn(
              btnClass,
              'flex-1 sm:flex-none border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/40 bg-white'
            )}
          >
            {pending === 'pause' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coffee className="w-3.5 h-3.5" />}
            Taking a break
          </button>
          <button
            disabled={pending !== null}
            onClick={() => run('end', () => endRule(rule.id), `${rule.name} cancelled.`)}
            className={cn(
              btnClass,
              'flex-1 sm:flex-none border border-[var(--destructive)]/30 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 bg-white'
            )}
          >
            {pending === 'end' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CircleStop className="w-3.5 h-3.5" />}
            Cancelled for good
          </button>
        </div>
      )}
    </div>
  )
}
