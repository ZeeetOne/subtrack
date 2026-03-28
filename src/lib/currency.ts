/**
 * Currency utility.
 * Primary source:   open.er-api.com
 * Secondary source: frankfurter.app (ECB data, automatic fallback)
 * No hardcoded rates — if both sources fail, an error is thrown.
 */

async function fetchRatesFromBase(base: string): Promise<{
  rates: Record<string, number> | null
  source: 'primary' | 'secondary' | null
}> {
  // Primary: open.er-api.com
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.result === 'success' && data.rates && typeof data.rates === 'object') {
        return { rates: { ...data.rates, [base]: 1 }, source: 'primary' }
      }
    }
  } catch {}

  // Secondary: frankfurter.app
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.rates && typeof data.rates === 'object') {
        return { rates: { ...data.rates, [base]: 1 }, source: 'secondary' }
      }
    }
  } catch {}

  return { rates: null, source: null }
}

/**
 * Fetch a single exchange rate.
 * Tries primary (open.er-api.com) then secondary (frankfurter.app).
 * Throws if both sources are unavailable.
 */
export async function getLiveExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1.0

  const { rates } = await fetchRatesFromBase(from)

  if (rates && typeof rates[to] === 'number') {
    return rates[to]
  }

  throw new Error(`Exchange rate unavailable for ${from} → ${to}`)
}

/**
 * Batch-fetch exchange rates for multiple source currencies to a single target.
 * Makes one API call per unique source currency instead of one per expense.
 * Returns null for any pair where both sources are unavailable.
 */
export async function batchGetExchangeRates(
  fromCurrencies: string[],
  toCurrency: string
): Promise<{
  rates: Record<string, number | null>
  usingSecondary: boolean
  unavailablePairs: string[]
}> {
  const uniqueFroms = [...new Set(fromCurrencies)].filter(c => c !== toCurrency)
  const rates: Record<string, number | null> = { [toCurrency]: 1 }
  let usingSecondary = false
  const unavailablePairs: string[] = []

  await Promise.all(
    uniqueFroms.map(async (from) => {
      const { rates: fetchedRates, source } = await fetchRatesFromBase(from)

      if (fetchedRates && typeof fetchedRates[toCurrency] === 'number') {
        rates[from] = fetchedRates[toCurrency]
        if (source === 'secondary') usingSecondary = true
      } else {
        rates[from] = null
        unavailablePairs.push(from)
      }
    })
  )

  return { rates, usingSecondary, unavailablePairs }
}
