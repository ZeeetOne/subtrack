'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { confirmPaymentSchema, type ConfirmPaymentValues } from '@/lib/schemas/spend'
import {
  confirmRulePayment,
  pauseRule,
  resumeRule,
  endRule,
  updateRule,
  deleteRule,
  getSpendCategories,
} from '@/lib/actions/spend'
import type { SpendCycle } from '@/lib/spend-utils'
import { toLocalDateString } from '@/lib/expense-utils'
import { cn } from '@/lib/utils'
import type { SpendRule, SpendCategory } from '@/lib/types'

interface SubscriptionDetailProps {
  rule: SpendRule
}

const cycles: { value: SpendCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const currencies = [
  { value: 'IDR', label: 'IDR' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'SGD', label: 'SGD' },
]

const fieldClass =
  'h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-0'

const labelClass = 'block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5'

export function SubscriptionDetail({ rule }: SubscriptionDetailProps) {
  const router = useRouter()

  const [isLogOpen, setIsLogOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register: registerLog,
    handleSubmit: handleLogSubmit,
    formState: { errors: logErrors },
  } = useForm<ConfirmPaymentValues>({
    resolver: zodResolver(confirmPaymentSchema),
    defaultValues: {
      paid_date: toLocalDateString(new Date()),
      amount: String(rule.default_amount),
    },
  })

  async function onLogPayment(data: ConfirmPaymentValues) {
    setIsLogging(true)
    const result = await confirmRulePayment(rule.id, data)
    setIsLogging(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Payment logged!')
      setIsLogOpen(false)
      router.refresh()
    }
  }

  async function onPauseResume() {
    setIsPausing(true)
    const result = rule.status === 'paused' ? await resumeRule(rule.id) : await pauseRule(rule.id)
    setIsPausing(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(rule.status === 'paused' ? 'Subscription resumed.' : 'Subscription paused.')
      router.refresh()
    }
  }

  async function onEnd() {
    if (!confirmingEnd) {
      setConfirmingEnd(true)
      return
    }
    setIsEnding(true)
    const result = await endRule(rule.id)
    setIsEnding(false)
    if (result.error) {
      toast.error(result.error)
      setConfirmingEnd(false)
    } else {
      toast.success('Subscription ended.')
      router.refresh()
    }
  }

  async function onDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setIsDeleting(true)
    const result = await deleteRule(rule.id)
    setIsDeleting(false)
    if (result.error) {
      toast.error(result.error)
      setConfirmingDelete(false)
    } else {
      toast.success('Subscription deleted. Past payments are kept in your history.')
      router.push('/expenses?view=subscriptions')
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsLogOpen(true)}
        className="w-full h-12 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold hover:opacity-80 transition-opacity cursor-pointer"
      >
        {rule.status === 'ended' ? 'Resubscribe' : 'Log payment'}
      </button>

      <div className="grid grid-cols-2 gap-3">
        {rule.status !== 'ended' && (
          <button
            type="button"
            onClick={onPauseResume}
            disabled={isPausing}
            className="h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)]/30 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isPausing && <Loader2 className="w-4 h-4 animate-spin" />}
            {rule.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsEditOpen(true)}
          className={cn(
            'h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)]/30 transition-colors cursor-pointer',
            rule.status === 'ended' && 'col-span-2'
          )}
        >
          Edit
        </button>
      </div>

      {rule.status !== 'ended' && (
        <button
          type="button"
          onClick={onEnd}
          disabled={isEnding}
          className={cn(
            'w-full h-11 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer',
            confirmingEnd
              ? 'bg-[#c89e2a] text-white'
              : 'bg-transparent text-[#c89e2a] border border-[var(--border)] hover:border-[#c89e2a]/40'
          )}
        >
          {isEnding && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEnding ? 'Ending…' : confirmingEnd ? 'Tap again to confirm ending' : 'End subscription'}
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className={cn(
          'w-full h-11 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer',
          confirmingDelete
            ? 'bg-[var(--destructive)] text-white'
            : 'bg-transparent text-[var(--destructive)] border border-[var(--border)] hover:border-[var(--destructive)]/40'
        )}
      >
        {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
        {isDeleting ? 'Deleting…' : confirmingDelete ? 'Tap again to confirm — history is kept' : 'Delete subscription'}
      </button>

      {/* Log payment modal */}
      <Modal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} title="Log payment">
        <form onSubmit={handleLogSubmit(onLogPayment)} className="space-y-5">
          {rule.status === 'ended' && (
            <p className="text-[12px] font-medium text-[var(--muted-foreground)]">
              Logging a payment reactivates this subscription.
            </p>
          )}
          <div>
            <label className={labelClass}>Date</label>
            <Input
              type="date"
              max={toLocalDateString(new Date())}
              className={fieldClass}
              {...registerLog('paid_date')}
            />
            {logErrors.paid_date && (
              <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{logErrors.paid_date.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Amount</label>
            <Input type="number" step="0.01" className={fieldClass} {...registerLog('amount')} />
            {logErrors.amount && (
              <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{logErrors.amount.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLogging}
            className="w-full h-11 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLogging && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogging ? 'Saving…' : 'Confirm payment'}
          </button>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit subscription">
        <EditRuleForm
          rule={rule}
          onSuccess={() => {
            setIsEditOpen(false)
            router.refresh()
          }}
          onCancel={() => setIsEditOpen(false)}
        />
      </Modal>
    </div>
  )
}

interface EditRuleFormProps {
  rule: SpendRule
  onSuccess: () => void
  onCancel: () => void
}

function EditRuleForm({ rule, onSuccess, onCancel }: EditRuleFormProps) {
  const [categories, setCategories] = useState<SpendCategory[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState(rule.name)
  const [amount, setAmount] = useState(String(rule.default_amount))
  const [currency, setCurrency] = useState(rule.default_currency)
  const [cycle, setCycle] = useState<SpendCycle>(rule.cycle)
  const [categoryId, setCategoryId] = useState(rule.category_id || '')
  const [notes, setNotes] = useState(rule.notes || '')
  const [nextDue, setNextDue] = useState(rule.next_due)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSpendCategories().then((result) => {
      if (result.data) setCategories(result.data)
    })
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const amountNum = Number(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) {
      setError('Invalid next due date')
      return
    }

    setIsSaving(true)
    const result = await updateRule(rule.id, {
      name,
      default_amount: amount,
      default_currency: currency,
      cycle,
      category_id: categoryId || undefined,
      notes: notes || undefined,
      next_due: nextDue,
    })
    setIsSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Subscription updated!')
      onSuccess()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 font-sans">
      <div>
        <label className={labelClass}>Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div>
          <label className={labelClass}>Amount</label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 w-[86px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] pl-3 pr-7 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--primary)] appearance-none cursor-pointer"
            >
              {currencies.map((curr) => (
                <option key={curr.value} value={curr.value}>
                  {curr.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)] pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Billing cycle</label>
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {cycles.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCycle(c.value)}
              className={cn(
                'flex-none px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-150 border',
                cycle === c.value
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)]'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Next due</label>
        <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={fieldClass} />
      </div>

      {categories.length > 0 && (
        <div>
          <label className={labelClass}>Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(isSelected ? '' : cat.id)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 border',
                    isSelected
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                  )}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>
          Notes <span className="normal-case tracking-normal font-normal opacity-50">— optional</span>
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-white p-3.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      {error && <p className="text-[10px] text-[var(--destructive)] font-medium">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving…' : 'Update'}
        </button>
      </div>
    </form>
  )
}
