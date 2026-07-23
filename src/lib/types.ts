import type { SpendCycle } from './spend-utils'

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
