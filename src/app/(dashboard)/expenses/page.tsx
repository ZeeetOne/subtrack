import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { EntryList } from '@/components/spend/entry-list'
import { SubscriptionCard } from '@/components/spend/subscription-card'
import { batchGetExchangeRates } from '@/lib/currency'
import { getCurrentUserId } from '@/lib/current-user'
import { monthlyEstimate } from '@/lib/spend-utils'
import { toLocalDateString } from '@/lib/expense-utils'
import { cn } from '@/lib/utils'
import type { SpendEntry, SpendRule, SpendCategory, ProcessedSpendEntry, SpendRuleStatus } from '@/lib/types'

type View = 'all' | 'subscriptions'

type SpendEntryRow = SpendEntry & { spend_categories: { name: string } | null }

interface RuleSection {
  key: SpendRuleStatus
  label: string
  accent: string
  rules: SpendRule[]
}

const ruleStatusOrder: { key: SpendRuleStatus; label: string; accent: string }[] = [
  { key: 'active', label: 'Active', accent: '#1c3210' },
  { key: 'paused', label: 'Paused', accent: '#c89e2a' },
  { key: 'ended', label: 'Ended', accent: '#94a3b8' },
]

const pillClass = (active: boolean) =>
  active
    ? 'px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--primary)] text-white border border-[var(--primary)]'
    : 'px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-transparent text-[var(--muted-foreground)] border border-[var(--border)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)] transition-colors'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; cat?: string }>
}) {
  const supabase = await createClient()

  // Already verified by middleware; re-checking would cost another round trip.
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const { view: viewParam, month: monthParam, cat } = await searchParams
  const view: View = viewParam === 'subscriptions' ? 'subscriptions' : 'all'

  // Independent queries — one round trip instead of two.
  const [{ data: profile }, { data: categoriesData }] = await Promise.all([
    supabase.from('profiles').select('base_currency').eq('id', userId).single(),
    supabase.from('spend_categories').select('*').eq('user_id', userId).order('name'),
  ])

  const baseCurrency = profile?.base_currency || 'IDR'
  const categories = (categoriesData || []) as SpendCategory[]
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

  // Month window: ?month=YYYY-MM, defaults to the current month
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    if (m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }
  const monthStart = toLocalDateString(new Date(year, month, 1))
  const monthEnd = toLocalDateString(new Date(year, month + 1, 0))
  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthParamStr = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
  const currentMonthParam = monthParamStr(year, month)
  const prevHref = `/expenses?month=${monthParamStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)}`
  const nextHref = `/expenses?month=${monthParamStr(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)}`

  let entries: ProcessedSpendEntry[] = []

  if (view === 'all') {
    let query = supabase
      .from('spend_entries')
      .select('*, spend_categories(name)')
      .eq('user_id', userId)
      .gte('spent_on', monthStart)
      .lte('spent_on', monthEnd)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })

    if (cat) query = query.eq('category_id', cat)

    const { data } = await query
    const rows = (data || []) as SpendEntryRow[]
    // Grouping now happens in EntryList, after local pending rows are merged in.
    entries = rows.map((row) => {
      const { spend_categories, ...entry } = row
      return {
        ...entry,
        categoryName: spend_categories?.name ?? null,
        amountInBase: Number(entry.amount) * Number(entry.exchange_rate),
      }
    })
  }

  let ruleSections: RuleSection[] = []
  let ruleEstimates = new Map<string, number | null>()
  let subscriptionsEmpty = false

  if (view === 'subscriptions') {
    const { data: rulesData } = await supabase
      .from('spend_rules')
      .select('*')
      .eq('user_id', userId)
      .order('next_due', { ascending: true })
    const rules = (rulesData || []) as SpendRule[]
    subscriptionsEmpty = rules.length === 0

    const uniqueCurrencies = [...new Set(rules.map((r) => r.default_currency))]
    const { rates } = await batchGetExchangeRates(uniqueCurrencies, baseCurrency)

    for (const rule of rules) {
      const rate = rates[rule.default_currency]
      ruleEstimates.set(rule.id, rate == null ? null : monthlyEstimate(rule.default_amount, rule.cycle) * rate)
    }

    ruleSections = ruleStatusOrder
      .map(({ key, label, accent }) => ({
        key,
        label,
        accent,
        rules: rules.filter((r) => r.status === key),
      }))
      .filter((s) => s.rules.length > 0)
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center p-16 text-center bg-[var(--card)] rounded-2xl border border-[var(--border)]">
      <div className="bg-[var(--background)] p-6 rounded-full mb-6">
        <span className="text-4xl">💸</span>
      </div>
      <p className="text-[var(--foreground)] font-heading font-semibold text-xl mb-2">No expenses yet</p>
      <p className="text-[var(--muted-foreground)] text-sm max-w-[240px] font-medium">
        Log your first expense with the plus button.
      </p>
    </div>
  )

  return (
    <div className="pb-24 font-sans text-[var(--foreground)]">
      {/* Header */}
      <div className="mb-8 px-1">
        <h1 className="text-4xl font-heading font-bold tracking-tight">Expenses</h1>
        <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">
          Track everything you spend.
        </p>
      </div>

      {/* View toggle */}
      <div className="mb-6 px-1 flex gap-2">
        <Link href="/expenses" className={pillClass(view === 'all')}>
          All
        </Link>
        <Link href="/expenses?view=subscriptions" className={pillClass(view === 'subscriptions')}>
          Subscriptions
        </Link>
      </div>

      {view === 'all' && (
        <>
          {/* Month switcher */}
          <div className="mb-4 px-1 flex items-center justify-between">
            <Link
              href={prevHref}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="text-[13px] font-bold text-[var(--foreground)] tabular-nums">{monthLabel}</span>
            <Link
              href={nextHref}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="mb-6 px-1 flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <Link href={`/expenses?month=${currentMonthParam}`} className={cn('flex-none', pillClass(!cat))}>
                All categories
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/expenses?month=${currentMonthParam}&cat=${c.id}`}
                  className={cn('flex-none', pillClass(cat === c.id))}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          <EntryList
            entries={entries}
            baseCurrency={baseCurrency}
            windowStart={monthStart}
            windowEnd={monthEnd}
            categoryId={cat}
            emptyState={emptyState}
          />
        </>
      )}

      {view === 'subscriptions' && (
        subscriptionsEmpty ? (
          <div className="flex flex-col items-center justify-center p-16 text-center bg-[var(--card)] rounded-2xl border border-[var(--border)]">
            <div className="bg-[var(--background)] p-6 rounded-full mb-6">
              <span className="text-4xl">💸</span>
            </div>
            <p className="text-[var(--foreground)] font-heading font-semibold text-xl mb-2">No subscriptions yet</p>
            <p className="text-[var(--muted-foreground)] text-sm max-w-[240px] font-medium">
              Mark an expense as a subscription when adding it.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {ruleSections.map((section) => (
              <section key={section.key}>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: section.accent }}
                  >
                    {section.label}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
                    {section.rules.length} {section.rules.length === 1 ? 'subscription' : 'subscriptions'}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)] opacity-40" />
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                  {section.rules.map((rule) => (
                    <SubscriptionCard
                      key={rule.id}
                      rule={rule}
                      categoryName={rule.category_id ? categoryNameById.get(rule.category_id) : null}
                      monthlyEstimateInBase={ruleEstimates.get(rule.id) ?? null}
                      baseCurrency={baseCurrency}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  )
}
