import type { SpendCycle } from './spend-utils'

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

export type SpendRuleStatus = 'active' | 'paused' | 'ended'

export interface SpendCategory {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface SpendRule {
  id: string
  user_id: string
  name: string
  default_amount: number
  default_currency: string
  cycle: SpendCycle
  category_id: string | null
  notes: string | null
  next_due: string
  status: SpendRuleStatus
  created_at: string
}

export interface SpendEntry {
  id: string
  user_id: string
  name: string
  amount: number
  currency: string
  exchange_rate: number
  category_id: string | null
  notes: string | null
  spent_on: string
  rule_id: string | null
  created_at: string
}

/** Entry joined with its category name and converted to base currency via stored rate. */
export interface ProcessedSpendEntry extends SpendEntry {
  categoryName: string | null
  amountInBase: number
}
