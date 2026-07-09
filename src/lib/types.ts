export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'
export type RenewalType = 'automatic' | 'manual'
export type ExpenseStatus = 'active' | 'lapsed'
export type PaymentStatus = 'paid' | 'skipped'

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
  renewal_type: RenewalType
  status: ExpenseStatus
  exchange_rate: number | null
  created_at: string
}

export interface ExpensePayment {
  id: string
  user_id: string
  expense_id: string
  due_date: string
  paid_date: string | null
  amount: number
  currency: string
  exchange_rate: number
  status: PaymentStatus
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
