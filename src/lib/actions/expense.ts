'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { expenseSchema, type ExpenseFormValues } from '@/lib/schemas/expense'
import { getLiveExchangeRate } from '@/lib/currency'

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
