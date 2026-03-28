'use client'

import { useState } from 'react'
import { updateProfile } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const currencies = [
  { value: 'IDR', label: 'IDR - Rupiah' },
  { value: 'USD', label: 'USD - Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Pound' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
]

interface CurrencySettingsInitialData {
  base_currency: string
}

export function CurrencySettingsForm({ initialData }: { initialData: CurrencySettingsInitialData }) {
  const [currency, setCurrency] = useState(initialData.base_currency)
  const [isLoading, setIsLoading] = useState(false)

  async function handleUpdateCurrency() {
    setIsLoading(true)
    const result = await updateProfile({ 
      base_currency: currency 
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Currency updated!')
    }
    setIsLoading(false)
  }

  return (
    <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Base Currency</CardTitle>
        <CardDescription className="text-xs font-medium text-[var(--muted-foreground)] leading-relaxed">
          All your expenses will be normalized to this currency on the dashboard for consistent tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0 space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {currencies.map((curr) => {
            const isSelected = currency === curr.value
            return (
              <button
                key={curr.value}
                onClick={() => setCurrency(curr.value)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all duration-300 text-left group",
                  isSelected 
                    ? "border-[var(--primary)] bg-[var(--accent)]" 
                    : "border-[var(--background)] bg-[var(--background)] hover:border-[var(--muted)]"
                )}
              >
                <p className={cn(
                  "text-xs font-semibold uppercase tracking-widest",
                  isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                )}>
                  {curr.value}
                </p>
                <p className={cn(
                  "text-[10px] font-bold mt-1",
                  isSelected ? "text-[var(--primary)]/70" : "text-[var(--muted-foreground)]/60"
                )}>
                  {curr.label.split('-')[1].trim()}
                </p>
              </button>
            )
          })}
        </div>

        <Button
          className="w-full h-11 rounded-xl bg-[var(--primary)] text-white font-sans font-semibold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
          onClick={handleUpdateCurrency}
          disabled={isLoading || currency === initialData.base_currency}
        >
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  )
}
