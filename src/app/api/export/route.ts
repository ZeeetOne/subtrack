import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'csv'

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('name, amount, currency, billing_cycle, category, notes, next_billing_date, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(expenses, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="subtrack-expenses.json"',
      },
    })
  }

  // CSV
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`

  const headers = ['Name', 'Amount', 'Currency', 'Billing Cycle', 'Category', 'Notes', 'Next Billing Date', 'Active', 'Created At']
  const rows = (expenses ?? []).map(e => [
    q(e.name ?? ''),
    q(String(e.amount ?? '')),
    q(e.currency ?? ''),
    q(e.billing_cycle ?? ''),
    q(e.category ?? ''),
    q(e.notes ?? ''),
    q(e.next_billing_date ?? ''),
    q(e.is_active ? 'Yes' : 'No'),
    q(e.created_at ? e.created_at.slice(0, 10) : ''),
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="subtrack-expenses.csv"',
    },
  })
}
