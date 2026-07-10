'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { parseLocalDate, toLocalDateString } from '@/lib/expense-utils'
import type { SpendRule } from '@/lib/types'

const statusConfig = {
  active: { label: 'Active', className: 'bg-[var(--accent)] text-[var(--primary)]' },
  paused: { label: 'Paused', className: 'bg-yellow-50 text-[#c89e2a]' },
  ended: { label: 'Ended', className: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
}

interface SubscriptionCardProps {
  rule: SpendRule
  categoryName?: string | null
  monthlyEstimateInBase: number | null
  baseCurrency: string
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

export function SubscriptionCard({ rule, categoryName, monthlyEstimateInBase, baseCurrency }: SubscriptionCardProps) {
  const today = toLocalDateString(new Date())
  const isOverdue = rule.status === 'active' && rule.next_due < today
  const status = statusConfig[rule.status]

  return (
    <Link
      href={`/expenses/subscription/${rule.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--muted)] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-heading font-semibold text-[15px] tracking-tight text-[var(--foreground)] leading-tight truncate">
            {rule.name}
          </span>
          <span className={cn('text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full', status.className)}>
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {categoryName && (
            <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
              {categoryName}
            </span>
          )}
          <span className={cn('text-[11px] font-semibold', isOverdue ? 'text-orange-600' : 'text-[var(--muted-foreground)]')}>
            Due {format(parseLocalDate(rule.next_due), 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        {monthlyEstimateInBase !== null ? (
          <div className="text-[15px] font-heading font-semibold text-[var(--foreground)] tracking-tight tabular-nums leading-tight">
            &asymp; {formatCurrency(monthlyEstimateInBase, baseCurrency)}
            <span className="text-[11px] text-[var(--muted-foreground)] font-medium">/mo</span>
          </div>
        ) : (
          <div className="text-[11px] text-[var(--muted-foreground)] font-medium">rate unavailable</div>
        )}
      </div>
    </Link>
  )
}
