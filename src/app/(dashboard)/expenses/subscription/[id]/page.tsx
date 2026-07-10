import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { deriveCoverage } from '@/lib/spend-utils'
import { parseLocalDate } from '@/lib/expense-utils'
import { SubscriptionDetail } from '@/components/spend/subscription-detail'
import { CoverageTimeline } from '@/components/spend/coverage-timeline'
import { cn } from '@/lib/utils'
import type { SpendRule, SpendEntry, SpendRuleStatus } from '@/lib/types'

const statusConfig: Record<SpendRuleStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[var(--accent)] text-[var(--primary)]' },
  paused: { label: 'Paused', className: 'bg-yellow-50 text-[#c89e2a]' },
  ended: { label: 'Ended', className: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
}

const cycleLabel: Record<SpendRule['cycle'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount)
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: ruleData, error: ruleError } = await supabase
    .from('spend_rules')
    .select('*')
    .match({ id, user_id: user.id })
    .single()

  if (ruleError || !ruleData) notFound()
  const rule = ruleData as SpendRule

  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()
  const baseCurrency = profile?.base_currency || 'IDR'

  const { data: entriesData } = await supabase
    .from('spend_entries')
    .select('*')
    .match({ rule_id: id, user_id: user.id })
    .order('spent_on', { ascending: false })
  const entries = (entriesData || []) as SpendEntry[]

  const { periods, gaps } = deriveCoverage(entries.map((e) => e.spent_on), rule.cycle)

  const totalPaidInBase = entries.reduce((sum, e) => sum + Number(e.amount) * Number(e.exchange_rate), 0)

  const status = statusConfig[rule.status]

  return (
    <div className="pb-24 font-sans text-[var(--foreground)]">
      {/* Back link */}
      <div className="mb-6 px-1">
        <Link
          href="/expenses?view=subscriptions"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Subscriptions
        </Link>
      </div>

      {/* Name + status */}
      <div className="mb-6 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl font-heading font-bold tracking-tight">{rule.name}</h1>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full',
              status.className
            )}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 mb-8 px-1">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
            Amount
          </p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {formatCurrency(Number(rule.default_amount), rule.default_currency)}
          </p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
            Cycle
          </p>
          <p className="text-lg font-heading font-semibold">{cycleLabel[rule.cycle]}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
            Next due
          </p>
          <p className="text-lg font-heading font-semibold">{format(parseLocalDate(rule.next_due), 'MMM d, yyyy')}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
            Total paid
          </p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {formatCurrency(totalPaidInBase, baseCurrency)}
          </p>
        </div>
      </div>

      {/* Coverage timeline */}
      {periods.length > 0 && (
        <div className="mb-8 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
            Coverage
          </h2>
          <CoverageTimeline periods={periods} gaps={gaps} />
        </div>
      )}

      {/* Payment history */}
      <div className="mb-8 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
          Payment history
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] px-1">No payments logged yet.</p>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[13px] font-semibold text-[var(--foreground)]">
                  {format(parseLocalDate(entry.spent_on), 'MMM d, yyyy')}
                </span>
                <div className="text-right">
                  <div className="text-[13px] font-semibold tabular-nums">
                    {formatCurrency(Number(entry.amount), entry.currency)}
                  </div>
                  {entry.currency !== baseCurrency && (
                    <div className="text-[11px] font-bold text-[var(--primary)] tabular-nums">
                      &asymp; {formatCurrency(Number(entry.amount) * Number(entry.exchange_rate), baseCurrency)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-1">
        <SubscriptionDetail rule={rule} />
      </div>
    </div>
  )
}
