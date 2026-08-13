'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { spendEntrySchema, type SpendEntryFormValues, type SpendEntryInput } from '@/lib/schemas/spend'
import { createSpendEntry, updateSpendEntry, getSpendCategories, createSpendCategory } from '@/lib/actions/spend'
import { advanceCycle, type SpendCycle } from '@/lib/spend-utils'
import { toLocalDateString, toLocalTimeString, parseLocalDate } from '@/lib/expense-utils'
import { useOutbox } from '@/components/offline/outbox-provider'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, Plus } from 'lucide-react'

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

interface Category {
  id: string
  user_id: string
  name: string
  created_at: string
}

interface EntryFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  initialData?: SpendEntryFormValues & { id: string }
}

const fieldClass = "h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-0"

const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5"

export function EntryForm({ onSuccess, onCancel, initialData }: EntryFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const submittedRef = useRef(false)
  const outbox = useOutbox()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SpendEntryFormValues>({
    resolver: zodResolver(spendEntrySchema),
    defaultValues: initialData || {
      currency: 'IDR',
      spent_on: toLocalDateString(new Date()),
      spent_time: toLocalTimeString(new Date()),
      is_subscription: false,
    },
  })

  const selectedCategoryId = watch('category_id')
  const isSubscription = watch('is_subscription')
  const selectedCycle = watch('cycle')
  const spentOn = watch('spent_on')

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    const result = await getSpendCategories()
    if (result.data) setCategories(result.data)
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    setIsSavingCategory(true)
    const result = await createSpendCategory({ name })
    if (result.error) {
      toast.error(result.error)
    } else {
      await loadCategories()
      if (result.data) setValue('category_id', result.data.id)
      setNewCategoryName('')
      setIsAddingCategory(false)
    }
    setIsSavingCategory(false)
  }

  let nextPaymentHint: string | null = null
  if (isSubscription && selectedCycle && spentOn && /^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
    try {
      nextPaymentHint = format(parseLocalDate(advanceCycle(spentOn, selectedCycle)), 'MMM d, yyyy')
    } catch {
      nextPaymentHint = null
    }
  }

  async function onSubmit(data: SpendEntryFormValues) {
    if (initialData) {
      // Edit mode: simple blocking submit — rule membership isn't editable here.
      setIsLoading(true)
      const result = await updateSpendEntry(initialData.id, data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Expense updated!')
        onSuccess?.()
      }
      setIsLoading(false)
      return
    }

    // Create mode: instant optimistic close — the modal shouldn't wait on the
    // server round-trip. Fire the action in the background and reconcile via toast.
    if (submittedRef.current) return
    submittedRef.current = true

    // Ids are minted here, not by Postgres. Re-sending this exact payload can
    // then only ever produce one row, which is what makes a retry (or a queued
    // offline write) safe to replay.
    const input: SpendEntryInput = {
      ...data,
      id: crypto.randomUUID(),
      rule_id: data.is_subscription ? crypto.randomUUID() : null,
      created_at: new Date().toISOString(),
    }

    reset()
    onSuccess?.()

    if (outbox) {
      // Queue it. The optimistic row paints from this call synchronously,
      // before any network work, and survives a reload if we're offline.
      const amount = parseFloat(input.amount)
      void outbox.enqueue(
        {
          id: crypto.randomUUID(),
          userId: '',
          entityId: input.id,
          kind: 'entry.create',
          input,
          createdAt: input.created_at!,
          attempts: 0,
          nextAttemptAt: Date.now(),
          lastError: null,
          status: 'pending',
        },
        {
          ...input,
          user_id: '',
          amount,
          category_id: input.category_id ?? null,
          notes: input.notes ?? null,
          spent_time: input.spent_time || null,
          rule_id: input.rule_id ?? null,
          created_at: input.created_at!,
          exchange_rate: 1,
          rate_status: 'pending',
          categoryName: categories.find((c) => c.id === input.category_id)?.name ?? null,
          amountInBase: amount,
          syncedAt: null,
        }
      )
      return
    }

    const toastId = toast.loading('Adding…')
    createSpendEntry(input)
      .then((result) => {
        if (result.error) {
          submittedRef.current = false
          toast.error(result.error, { id: toastId })
        } else {
          toast.success('Expense added!', { id: toastId })
        }
      })
      .catch(() => {
        submittedRef.current = false
        toast.error('Something went wrong. Please try again.', { id: toastId })
      })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 font-sans">

      {/* Name */}
      <div>
        <label className={labelClass}>Name</label>
        <Input
          placeholder="Coffee, Netflix, groceries…"
          className={fieldClass}
          {...register('name')}
        />
        {errors.name && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.name.message}</p>}
      </div>

      {/* Amount + Currency */}
      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div>
          <label className={labelClass}>Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            className={fieldClass}
            {...register('amount')}
          />
          {errors.amount && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.amount.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <div className="relative">
            <select
              {...register('currency')}
              className="h-11 w-[86px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] pl-3 pr-7 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--primary)] appearance-none cursor-pointer"
            >
              {currencies.map((curr) => (
                <option key={curr.value} value={curr.value}>{curr.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date</label>
          <Input
            type="date"
            max={toLocalDateString(new Date())}
            className={fieldClass}
            {...register('spent_on')}
          />
          {errors.spent_on && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.spent_on.message}</p>}
        </div>
        <div>
          <label className={labelClass}>
            Time <span className="normal-case tracking-normal font-normal opacity-50">— optional</span>
          </label>
          <Input
            type="time"
            className={fieldClass}
            {...register('spent_time')}
          />
          {errors.spent_time && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.spent_time.message}</p>}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className={labelClass}>Category</label>
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setValue('category_id', isSelected ? undefined : cat.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 border",
                  isSelected
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
                )}
              >
                {cat.name}
              </button>
            )
          })}

          {isAddingCategory ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCategory()
                  } else if (e.key === 'Escape') {
                    setIsAddingCategory(false)
                    setNewCategoryName('')
                  }
                }}
                placeholder="Category name"
                className="h-8 w-36 rounded-full border border-[var(--border)] bg-white px-3 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={isSavingCategory || !newCategoryName.trim()}
                className="h-8 px-3 rounded-full text-[12px] font-semibold bg-[var(--primary)] text-white disabled:opacity-50 cursor-pointer"
              >
                {isSavingCategory ? '…' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCategory(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] transition-all duration-150"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          )}
        </div>
        {errors.category_id && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.category_id.message}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>
          Notes{' '}
          <span className="normal-case tracking-normal font-normal opacity-50">— optional</span>
        </label>
        <textarea
          placeholder="Any notes about this expense…"
          rows={2}
          className="w-full rounded-xl border border-[var(--border)] bg-white p-3.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)]"
          {...register('notes')}
        />
        {errors.notes && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.notes.message}</p>}
      </div>

      {/* Subscription toggle — rule membership isn't editable from the entry, so hide when editing */}
      {!initialData && (
        <>
          <div
            className="flex items-center justify-between p-4 rounded-xl bg-[var(--muted)] cursor-pointer select-none"
            onClick={() => setValue('is_subscription', !isSubscription)}
          >
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Is this a subscription?</p>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Repeats on a schedule — I&apos;ll ask you to confirm each payment</p>
            </div>
            <div
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4",
                isSubscription ? "bg-[var(--primary)]" : "bg-[var(--border)]"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  isSubscription ? "translate-x-5" : "translate-x-1"
                )}
              />
            </div>
            <input type="checkbox" {...register('is_subscription')} className="sr-only" aria-hidden="true" />
          </div>

          {isSubscription && (
            <div>
              <label className={labelClass}>Billing Cycle</label>
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {cycles.map((cycle) => (
                  <button
                    key={cycle.value}
                    type="button"
                    onClick={() => setValue('cycle', cycle.value)}
                    className={cn(
                      "flex-none px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-150 border",
                      selectedCycle === cycle.value
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)]"
                    )}
                  >
                    {cycle.label}
                  </button>
                ))}
              </div>
              {errors.cycle && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.cycle.message}</p>}
              {nextPaymentHint && (
                <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                  Next payment expected {nextPaymentHint}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "h-11 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer",
            onCancel ? "flex-1" : "w-full"
          )}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? 'Saving…' : initialData ? 'Update' : 'Add Expense'}
        </button>
      </div>
    </form>
  )
}
