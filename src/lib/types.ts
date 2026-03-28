export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'

export interface Expense {
  id: string
  user_id: string
  name: string
  amount: number
  currency: string
  billing_cycle: BillingCycle
  category: string | null
  category_id: string | null
  notes: string | null
  next_billing_date: string | null
  is_active: boolean
  exchange_rate: number | null
  created_at: string
}

export interface ProcessedExpense extends Expense {
  amountInBase: number
  monthlyInBase: number
  currentRate: number | null
  rateUnavailable: boolean
}

export interface ExpenseOccurrenceWithExpense extends ProcessedExpense {
  occurrenceDate: Date
  occurrenceAmountInBase: number
}
