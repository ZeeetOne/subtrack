import { batchGetExchangeRates } from '@/lib/currency'
import { monthlyEstimate } from '@/lib/spend-utils'
import type { SpendRule } from '@/lib/types'

export interface SubscriptionEstimate {
  /** Monthly cost of all active subscriptions, converted to base currency. */
  total: number
  /** Per-currency rates, for callers converting individual rules. */
  rates: Record<string, number | null>
  /** True when the primary rate source was unreachable and ECB data was used. */
  usingSecondary: boolean
  /** Currencies excluded because no rate was available from either source. */
  unavailablePairs: string[]
}

/**
 * Monthly subscription estimate in base currency.
 *
 * Returns a promise on purpose — the caller passes it straight through to a
 * Suspense boundary rather than awaiting it. This work hits a free third-party
 * FX API whose responses are cached for an hour, so on a cache miss it can be
 * slow or fail outright. Awaiting it on the page meant one unreliable external
 * service could hold up every element of the dashboard.
 */
export async function buildSubscriptionEstimate(
  activeRules: readonly SpendRule[],
  baseCurrency: string
): Promise<SubscriptionEstimate> {
  const uniqueCurrencies = [...new Set(activeRules.map((r) => r.default_currency))]
  const { rates, usingSecondary, unavailablePairs } = await batchGetExchangeRates(
    uniqueCurrencies,
    baseCurrency
  )

  const total = activeRules.reduce((sum, rule) => {
    const rate = rates[rule.default_currency]
    // No rate available — leave it out rather than guess at 1:1.
    if (rate == null) return sum
    return sum + monthlyEstimate(rule.default_amount, rule.cycle) * rate
  }, 0)

  return { total, rates, usingSecondary, unavailablePairs }
}
