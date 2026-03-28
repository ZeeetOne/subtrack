'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, type ExpenseFormValues } from '@/lib/schemas/expense'
import { createExpense, updateExpense, getCategories } from '@/lib/actions/expense'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2 } from 'lucide-react'

const billingCycles = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one-time', label: 'One-time' },
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
  name: string
  icon?: string
  color?: string
  user_id?: string
}

interface ExpenseFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  initialData?: ExpenseFormValues & { id: string }
}

const fieldClass = "h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-0"

const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5"

export function ExpenseForm({ onSuccess, onCancel, initialData }: ExpenseFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: initialData || {
      currency: 'IDR',
      billing_cycle: 'monthly',
      is_active: true,
    },
  })

  const selectedCategoryId = watch('category_id')
  const selectedBillingCycle = watch('billing_cycle')
  const isActive = watch('is_active')

  useEffect(() => {
    async function loadCategories() {
      const result = await getCategories()
      if (result.data) setCategories(result.data)
    }
    loadCategories()
  }, [])

  async function onSubmit(data: ExpenseFormValues) {
    setIsLoading(true)

    if (data.category_id) {
      const cat = categories.find(c => c.id === data.category_id)
      if (cat) data.category = cat.name
    }

    const result = initialData
      ? await updateExpense(initialData.id, data)
      : await createExpense(data)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(initialData ? 'Expense updated!' : 'Expense added!')
      if (!initialData) reset()
      onSuccess?.()
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 font-sans">

      {/* Name */}
      <div>
        <label className={labelClass}>Service Name</label>
        <Input
          placeholder="Netflix, Spotify, AWS…"
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

      {/* Billing Cycle — pill row */}
      <div>
        <label className={labelClass}>Billing Cycle</label>
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {billingCycles.map((cycle) => (
            <button
              key={cycle.value}
              type="button"
              onClick={() => setValue('billing_cycle', cycle.value as ExpenseFormValues['billing_cycle'])}
              className={cn(
                "flex-none px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-150 border",
                selectedBillingCycle === cycle.value
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)]"
              )}
            >
              {cycle.label}
            </button>
          ))}
        </div>
        {errors.billing_cycle && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.billing_cycle.message}</p>}
      </div>

      {/* Next Billing Date */}
      <div>
        <label className={labelClass}>Next Billing Date</label>
        <Input
          type="date"
          min={new Date().toISOString().split('T')[0]}
          className={fieldClass}
          {...register('next_billing_date')}
        />
        {errors.next_billing_date && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.next_billing_date.message}</p>}
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <label className={labelClass}>Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setValue('category_id', cat.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 border",
                    isSelected
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
                  )}
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </button>
              )
            })}
          </div>
          {errors.category_id && <p className="text-[10px] text-[var(--destructive)] font-medium mt-1">{errors.category_id.message}</p>}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className={labelClass}>
          Notes{' '}
          <span className="normal-case tracking-normal font-normal opacity-50">— optional</span>
        </label>
        <textarea
          placeholder="Any notes about this subscription…"
          rows={2}
          className="w-full rounded-xl border border-[var(--border)] bg-white p-3.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)]"
          {...register('notes')}
        />
      </div>

      {/* Active toggle */}
      <div
        className="flex items-center justify-between p-4 rounded-xl bg-[var(--muted)] cursor-pointer select-none"
        onClick={() => setValue('is_active', !isActive)}
      >
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Active</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Uncheck to exclude from totals</p>
        </div>
        <div
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4",
            isActive ? "bg-[var(--primary)]" : "bg-[var(--border)]"
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              isActive ? "translate-x-5" : "translate-x-1"
            )}
          />
        </div>
        <input type="checkbox" {...register('is_active')} className="sr-only" aria-hidden="true" />
      </div>

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
          {isLoading ? 'Saving…' : initialData ? 'Update' : 'Add Subscription'}
        </button>
      </div>
    </form>
  )
}
