import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExpenseCard } from '@/components/expenses/expense-card'
import type { Expense, BillingCycle } from '@/lib/types'

const cycleOrder: BillingCycle[] = ['monthly', 'yearly', 'quarterly', 'weekly', 'one-time']

const cycleLabels: Record<BillingCycle, string> = {
  monthly:    'Monthly',
  yearly:     'Yearly',
  quarterly:  'Quarterly',
  weekly:     'Weekly',
  'one-time': 'One-time',
}

const cycleAccent: Record<BillingCycle, string> = {
  monthly:    '#1c3210',
  yearly:     '#8b5cf6',
  quarterly:  '#6da030',
  weekly:     '#c89e2a',
  'one-time': '#94a3b8',
}

type GroupMode = 'cycle' | 'category' | 'renewal'

const groupModes: { value: GroupMode; label: string }[] = [
  { value: 'cycle', label: 'By cycle' },
  { value: 'category', label: 'By category' },
  { value: 'renewal', label: 'By renewal' },
]

interface Section {
  key: string
  label: string
  accent: string
  expenses: Expense[]
}

function groupExpenses(expenses: Expense[], mode: GroupMode): Section[] {
  if (mode === 'category') {
    const names = [...new Set(expenses.map(e => e.category || 'Uncategorized'))].sort((a, b) =>
      a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)
    )
    return names
      .map(name => ({
        key: name,
        label: name,
        accent: '#6da030',
        expenses: expenses.filter(e => (e.category || 'Uncategorized') === name),
      }))
      .filter(s => s.expenses.length > 0)
  }

  if (mode === 'renewal') {
    return [
      { key: 'automatic', label: 'Automatic', accent: '#1c3210', expenses: expenses.filter(e => e.renewal_type !== 'manual') },
      { key: 'manual', label: 'Ask me (manual)', accent: '#c89e2a', expenses: expenses.filter(e => e.renewal_type === 'manual') },
    ].filter(s => s.expenses.length > 0)
  }

  return cycleOrder
    .map(cycle => ({
      key: cycle,
      label: cycleLabels[cycle],
      accent: cycleAccent[cycle],
      expenses: expenses.filter(e => e.billing_cycle === cycle),
    }))
    .filter(s => s.expenses.length > 0)
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { group } = await searchParams
  const groupMode: GroupMode =
    group === 'category' || group === 'renewal' ? group : 'cycle'

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const allExpenses = (expenses || []) as Expense[]
  const active = allExpenses.filter((e) => e.is_active && e.status !== 'lapsed')
  const lapsed = allExpenses.filter((e) => e.is_active && e.status === 'lapsed')
  const paused = allExpenses.filter((e) => !e.is_active)

  const sections = groupExpenses(active, groupMode)
  const isEmpty = allExpenses.length === 0

  return (
    <div className="pb-24 font-sans text-[var(--foreground)]">
      {/* Header */}
      <div className="mb-8 px-1">
        <h1 className="text-4xl font-heading font-bold tracking-tight">Expenses</h1>
        <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">
          Manage your recurring subscriptions and costs.
        </p>
      </div>

      {/* Summary strip + group selector */}
      {!isEmpty && (
        <div className="mb-8 px-1 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {active.length} active
            </span>
            {lapsed.length > 0 && (
              <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-700">
                {lapsed.length} lapsed
              </span>
            )}
            {cycleOrder.map((cycle) => {
              const count = active.filter((e) => e.billing_cycle === cycle).length
              if (count === 0) return null
              return (
                <span
                  key={cycle}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: cycleAccent[cycle] }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: cycleAccent[cycle] }}
                  />
                  {count} {cycleLabels[cycle]}
                </span>
              )
            })}
          </div>

          <div className="flex gap-2">
            {groupModes.map((mode) => (
              <Link
                key={mode.value}
                href={mode.value === 'cycle' ? '/expenses' : `/expenses?group=${mode.value}`}
                className={
                  groupMode === mode.value
                    ? 'px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--primary)] text-white border border-[var(--primary)]'
                    : 'px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-transparent text-[var(--muted-foreground)] border border-[var(--border)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)] transition-colors'
                }
              >
                {mode.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-[var(--card)] rounded-2xl border border-[var(--border)]">
          <div className="bg-[var(--background)] p-6 rounded-full mb-6">
            <span className="text-4xl">💸</span>
          </div>
          <p className="text-[var(--foreground)] font-heading font-semibold text-xl mb-2">No expenses yet</p>
          <p className="text-[var(--muted-foreground)] text-sm max-w-[240px] font-medium">
            Click the plus button below to add your first subscription.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active, grouped by selected mode */}
          {sections.map((section) => (
            <section key={section.key}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3 px-1">
                <span
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: section.accent }}
                >
                  {section.label}
                </span>
                <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
                  {section.expenses.length} {section.expenses.length === 1 ? 'subscription' : 'subscriptions'}
                </span>
                <div className="flex-1 h-px bg-[var(--border)] opacity-40" />
              </div>

              {/* Rows */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                {section.expenses.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </div>
            </section>
          ))}

          {/* Lapsed section */}
          {lapsed.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-700">
                  Lapsed
                </span>
                <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
                  stopped for now — resubscribe anytime
                </span>
                <div className="flex-1 h-px bg-[var(--border)] opacity-40" />
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                {lapsed.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </div>
            </section>
          )}

          {/* Paused section */}
          {paused.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Paused
                </span>
                <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
                  {paused.length} {paused.length === 1 ? 'subscription' : 'subscriptions'}
                </span>
                <div className="flex-1 h-px bg-[var(--border)] opacity-40" />
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                {paused.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
