'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { expenseSchema, type ExpenseFormValues } from '@/lib/schemas/expense'
import { getLiveExchangeRate } from '@/lib/currency'
import { advanceByCycle } from '@/lib/expense-utils'
import type { Expense } from '@/lib/types'

export async function getCategories() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function createCategory(data: { name: string, icon?: string, color?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('categories')
    .insert({ ...data, user_id: user.id })

  if (error) return { error: error.message }
  revalidatePath('/more')
  revalidatePath('/expenses')
  return { success: true }
}

export async function updateCategory(id: string, data: { name: string, icon?: string, color?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('categories')
    .update(data)
    .match({ id, user_id: user.id })

  if (error) return { error: error.message }
  revalidatePath('/more')
  revalidatePath('/expenses')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('categories')
    .delete()
    .match({ id, user_id: user.id })

  if (error) return { error: error.message }
  revalidatePath('/more')
  revalidatePath('/expenses')
  return { success: true }
}

export async function createExpense(data: ExpenseFormValues) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch profile to get user's base currency
  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()

  const baseCurrency = profile?.base_currency || 'IDR'

  const validatedFields = expenseSchema.safeParse(data)

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  // Calculate LIVE exchange rate relative to user's current base_currency
  let exchangeRate: number
  try {
    exchangeRate = await getLiveExchangeRate(data.currency, baseCurrency)
  } catch {
    return { error: 'Unable to fetch exchange rate. Please try again.' }
  }

  const { error } = await supabase.from('expenses').insert({
    user_id: user.id,
    name: data.name,
    amount: parseFloat(data.amount),
    currency: data.currency,
    billing_cycle: data.billing_cycle,
    renewal_type: data.renewal_type,
    category: data.category,
    category_id: data.category_id || null,
    notes: data.notes || null,
    next_billing_date: data.next_billing_date || null,
    is_active: data.is_active,
    exchange_rate: exchangeRate,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/expenses')
  return { success: true }
}

export async function updateExpense(id: string, data: ExpenseFormValues) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const validatedFields = expenseSchema.safeParse(data)

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  // Fetch profile to get user's base currency for rate update
  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()

  const baseCurrency = profile?.base_currency || 'IDR'
  let exchangeRate: number
  try {
    exchangeRate = await getLiveExchangeRate(data.currency, baseCurrency)
  } catch {
    return { error: 'Unable to fetch exchange rate. Please try again.' }
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      name: data.name,
      amount: parseFloat(data.amount),
      currency: data.currency,
      billing_cycle: data.billing_cycle,
      renewal_type: data.renewal_type,
      category: data.category,
      category_id: data.category_id || null,
      notes: data.notes || null,
      next_billing_date: data.next_billing_date || null,
      is_active: data.is_active,
      exchange_rate: exchangeRate,
    })
    .match({ id, user_id: user.id })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/expenses')
  return { success: true }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .match({ id, user_id: user.id })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/expenses')
  return { success: true }
}

async function getOwnedExpense(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .match({ id, user_id: userId })
    .single()
  if (error || !data) return null
  return data as Expense
}

function revalidateAll() {
  revalidatePath('/dashboard')
  revalidatePath('/expenses')
  revalidatePath('/stats')
}

/** Confirm a manual renewal as paid. Re-anchors the billing cycle from the actual paid date. */
export async function confirmPayment(
  expenseId: string,
  paidDate: string, // YYYY-MM-DD — actual payment date
  amountOverride?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return { error: 'Invalid date' }

  const expense = await getOwnedExpense(supabase, expenseId, user.id)
  if (!expense) return { error: 'Expense not found' }
  if (!expense.next_billing_date) return { error: 'Expense has no due date' }

  const amount = amountOverride ? parseFloat(amountOverride) : Number(expense.amount)
  if (isNaN(amount) || amount <= 0) return { error: 'Invalid amount' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()
  const baseCurrency = profile?.base_currency || 'IDR'

  let exchangeRate: number
  try {
    exchangeRate = await getLiveExchangeRate(expense.currency, baseCurrency)
  } catch {
    return { error: 'Unable to fetch exchange rate. Please try again.' }
  }

  const { error: insertError } = await supabase.from('expense_payments').insert({
    user_id: user.id,
    expense_id: expenseId,
    due_date: expense.next_billing_date,
    paid_date: paidDate,
    amount,
    currency: expense.currency,
    exchange_rate: exchangeRate,
    status: 'paid',
  })
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase
    .from('expenses')
    .update({ next_billing_date: advanceByCycle(paidDate, expense.billing_cycle) })
    .match({ id: expenseId, user_id: user.id })
  if (updateError) return { error: updateError.message }

  revalidateAll()
  return { success: true }
}

/** Skip one cycle: log a skipped occurrence and advance the due date on the same schedule. */
export async function skipPayment(expenseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const expense = await getOwnedExpense(supabase, expenseId, user.id)
  if (!expense) return { error: 'Expense not found' }
  if (!expense.next_billing_date) return { error: 'Expense has no due date' }

  const { error: insertError } = await supabase.from('expense_payments').insert({
    user_id: user.id,
    expense_id: expenseId,
    due_date: expense.next_billing_date,
    paid_date: null,
    amount: Number(expense.amount),
    currency: expense.currency,
    exchange_rate: expense.exchange_rate ?? 1,
    status: 'skipped',
  })
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase
    .from('expenses')
    .update({ next_billing_date: advanceByCycle(expense.next_billing_date, expense.billing_cycle) })
    .match({ id: expenseId, user_id: user.id })
  if (updateError) return { error: updateError.message }

  revalidateAll()
  return { success: true }
}

/** Stop for now: expense becomes lapsed — no reminders, nothing added to totals. */
export async function lapseExpense(expenseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('expenses')
    .update({ status: 'lapsed' })
    .match({ id: expenseId, user_id: user.id })
  if (error) return { error: error.message }

  revalidateAll()
  return { success: true }
}

/** Resubscribe a lapsed expense: log the payment and re-anchor the cycle from the real date. */
export async function resubscribeExpense(expenseId: string, paidDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return { error: 'Invalid date' }

  const expense = await getOwnedExpense(supabase, expenseId, user.id)
  if (!expense) return { error: 'Expense not found' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', user.id)
    .single()
  const baseCurrency = profile?.base_currency || 'IDR'

  let exchangeRate: number
  try {
    exchangeRate = await getLiveExchangeRate(expense.currency, baseCurrency)
  } catch {
    return { error: 'Unable to fetch exchange rate. Please try again.' }
  }

  const { error: insertError } = await supabase.from('expense_payments').insert({
    user_id: user.id,
    expense_id: expenseId,
    due_date: paidDate,
    paid_date: paidDate,
    amount: Number(expense.amount),
    currency: expense.currency,
    exchange_rate: exchangeRate,
    status: 'paid',
  })
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase
    .from('expenses')
    .update({
      status: 'active',
      next_billing_date: advanceByCycle(paidDate, expense.billing_cycle),
    })
    .match({ id: expenseId, user_id: user.id })
  if (updateError) return { error: updateError.message }

  revalidateAll()
  return { success: true }
}

export async function toggleExpenseStatus(id: string, isActive: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('expenses')
    .update({ is_active: isActive })
    .match({ id, user_id: user.id })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/expenses')
  return { success: true }
}
