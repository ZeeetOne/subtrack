import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseCard } from '@/components/expenses/expense-card'

type BillingCycle = 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'one-time'

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

export default async function ExpensesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const allExpenses = expenses || []
  const active = allExpenses.filter((e) => e.is_active)
  const paused = allExpenses.filter((e) => !e.is_active)

  // Group active expenses by billing cycle, preserving cycleOrder
  const grouped = cycleOrder.reduce<Record<string, typeof allExpenses>>((acc, cycle) => {
    const group = active.filter((e) => e.billing_cycle === cycle)
    if (group.length > 0) acc[cycle] = group
    return acc
  }, {})

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

      {/* Summary strip */}
      {!isEmpty && (
        <div className="flex items-center gap-3 mb-8 px-1 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            {active.length} active
          </span>
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
          {/* Active, grouped by cycle */}
          {Object.entries(grouped).map(([cycle, group]) => (
            <section key={cycle}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3 px-1">
                <span
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: cycleAccent[cycle as BillingCycle] }}
                >
                  {cycleLabels[cycle as BillingCycle]}
                </span>
                <span className="text-[10px] font-bold text-[var(--muted-foreground)]">
                  {group.length} {group.length === 1 ? 'subscription' : 'subscriptions'}
                </span>
                <div className="flex-1 h-px bg-[var(--border)] opacity-40" />
              </div>

              {/* Rows */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                {group.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </div>
            </section>
          ))}

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
