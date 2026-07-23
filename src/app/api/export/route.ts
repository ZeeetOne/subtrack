import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SpendEntry } from '@/lib/types'

type ExportRow = SpendEntry & {
  spend_categories: { name: string } | null
  spend_rules: { name: string } | null
}

function csvEscape(v: string) {
  return `"${v.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('spend_entries')
    .select('*, spend_categories(name), spend_rules(name)')
    .eq('user_id', user.id)
    .order('spent_on', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as ExportRow[]

  const headers = [
    'date',
    'name',
    'amount',
    'currency',
    'exchange_rate',
    'amount_in_base',
    'category',
    'subscription',
    'notes',
  ]

  const csvRows = rows.map((row) => {
    const amountInBase = Number(row.amount) * Number(row.exchange_rate)
    return [
      csvEscape(row.spent_on ?? ''),
      csvEscape(row.name ?? ''),
      csvEscape(String(row.amount ?? '')),
      csvEscape(row.currency ?? ''),
      csvEscape(String(row.exchange_rate ?? '')),
      csvEscape(String(amountInBase)),
      csvEscape(row.spend_categories?.name ?? ''),
      csvEscape(row.spend_rules?.name ?? ''),
      csvEscape(row.notes ?? ''),
    ].join(',')
  })

  const csv = [headers.join(','), ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="expenses.csv"',
    },
  })
}
