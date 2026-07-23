'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { spendEntrySchema, confirmPaymentSchema, type SpendEntryFormValues, type ConfirmPaymentValues } from '@/lib/schemas/spend'
import { getLiveExchangeRate } from '@/lib/currency'
import { advanceCycle, type SpendCycle } from '@/lib/spend-utils'
import type { SpendRule } from '@/lib/types'

type Supabase = Awaited<ReturnType<typeof createClient>>

function revalidateAll() {
  revalidatePath('/dashboard')
  revalidatePath('/expenses')
  revalidatePath('/stats')
  revalidatePath('/settings')
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function rateFor(supabase: Supabase, userId: string, currency: string) {
  const { data: profile } = await supabase.from('profiles').select('base_currency').eq('id', userId).single()
  const baseCurrency = profile?.base_currency || 'IDR'
  return getLiveExchangeRate(currency, baseCurrency)
}

async function getOwnedRule(supabase: Supabase, id: string, userId: string): Promise<SpendRule | null> {
  const { data, error } = await supabase.from('spend_rules').select('*').match({ id, user_id: userId }).single()
  if (error || !data) return null
  return data as SpendRule
}

/** After an entry edit/delete, re-anchor the rule's next_due to its latest remaining payment. Returns error message or null. */
async function recomputeRuleNextDue(supabase: Supabase, ruleId: string, userId: string): Promise<string | null> {
  const rule = await getOwnedRule(supabase, ruleId, userId)
  if (!rule) return null
  const { data } = await supabase
    .from('spend_entries')
    .select('spent_on')
    .match({ rule_id: ruleId, user_id: userId })
    .order('spent_on', { ascending: false })
    .limit(1)
  const latest = data?.[0]?.spent_on
  if (latest) {
    const { error } = await supabase.from('spend_rules')
      .update({ next_due: advanceCycle(latest, rule.cycle) })
      .match({ id: ruleId, user_id: userId })
    if (error) return error.message
  }
  return null
}

// ---------- categories ----------

export async function getSpendCategories() {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }
  const { data, error } = await supabase.from('spend_categories').select('*').eq('user_id', user.id).order('name')
  if (error) return { error: error.message }
  return { data }
}

export async function createSpendCategory(data: { name: string }) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }
  if (!data.name.trim()) return { error: 'Name is required' }
  const { error } = await supabase.from('spend_categories').insert({ name: data.name.trim(), user_id: user.id })
  if (error) return { error: error.message }
  revalidateAll()
  return { success: true }
}

export async function updateSpendCategory(id: string, data: { name: string }) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }
  if (!data.name.trim()) return { error: 'Name is required' }
  const { error } = await supabase.from('spend_categories').update({ name: data.name.trim() }).match({ id, user_id: user.id })
  if (error) return { error: error.message }
  revalidateAll()
  return { success: true }
}

export async function deleteSpendCategory(id: string) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('spend_categories').delete().match({ id, user_id: user.id })
  if (error) return { error: error.message }
  revalidateAll()
  return { success: true }
}

// ---------- entries ----------

export async function createSpendEntry(data: SpendEntryFormValues) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = spendEntrySchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid fields' }
  const v = parsed.data

  let exchangeRate: number
  try {
    exchangeRate = await rateFor(supabase, user.id, v.currency)
  } catch {
    return { error: 'Unable to fetch exchange rate. Please try again.' }
  }

  let ruleId: string | null = null
  if (v.is_subscription && v.cycle) {
    const { data: rule, error: ruleError } = await supabase.from('spend_rules').insert({
      user_id: user.id,
      name: v.name,
      default_amount: parseFloat(v.amount),
      default_currency: v.currency,
      cycle: v.cycle,
      category_id: v.category_id || null,
      notes: v.notes || null,
      next_due: advanceCycle(v.spent_on, v.cycle),
      status: 'active',
    }).select('id').single()
    if (ruleError) return { error: ruleError.message }
    ruleId = rule.id
  }

  const { error } = await supabase.from('spend_entries').insert({
    user_id: user.id,
    name: v.name,
    amount: parseFloat(v.amount),
    currency: v.currency,
    exchange_rate: exchangeRate,
    category_id: v.category_id || null,
    notes: v.notes || null,
    spent_on: v.spent_on,
    rule_id: ruleId,
  })
  if (error) {
    if (ruleId) {
      await supabase.from('spend_rules').delete().match({ id: ruleId, user_id: user.id })
    }
    return { error: error.message }
  }

  revalidateAll()
  return { success: true }
}

export async function updateSpendEntry(id: string, data: SpendEntryFormValues) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = spendEntrySchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid fields' }
  const v = parsed.data

  const { data: existing } = await supabase.from('spend_entries').select('rule_id, currency, exchange_rate').match({ id, user_id: user.id }).single()

  let exchangeRate = Number(existing?.exchange_rate ?? 1)
  if (!existing || existing.currency !== v.currency) {
    try {
      exchangeRate = await rateFor(supabase, user.id, v.currency)
    } catch {
      return { error: 'Unable to fetch exchange rate. Please try again.' }
    }
  }

  const { error } = await supabase.from('spend_entries').update({
    name: v.name,
    amount: parseFloat(v.amount),
    currency: v.currency,
    exchange_rate: exchangeRate,
    category_id: v.category_id || null,
    notes: v.notes || null,
    spent_on: v.spent_on,
  }).match({ id, user_id: user.id })
  if (error) return { error: error.message }

  if (existing?.rule_id) {
    const recomputeError = await recomputeRuleNextDue(supabase, existing.rule_id, user.id)
    if (recomputeError) return { error: recomputeError }
  }

  revalidateAll()
  return { success: true }
}

export async function deleteSpendEntry(id: string) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: existing } = await supabase.from('spend_entries').select('rule_id').match({ id, user_id: user.id }).single()
  const { error } = await supabase.from('spend_entries').delete().match({ id, user_id: user.id })
  if (error) return { error: error.message }

  if (existing?.rule_id) {
    const recomputeError = await recomputeRuleNextDue(supabase, existing.rule_id, user.id)
    if (recomputeError) return { error: recomputeError }
  }

  revalidateAll()
  return { success: true }
}

// ---------- rule lifecycle ----------

export async function confirmRulePayment(ruleId: string, data: ConfirmPaymentValues) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = confirmPaymentSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid fields' }

  const rule = await getOwnedRule(supabase, ruleId, user.id)
  if (!rule) return { error: 'Subscription not found' }

  let exchangeRate: number
  try {
    exchangeRate = await rateFor(supabase, user.id, rule.default_currency)
  } catch {
    return { error: 'Unable to fetch exchange rate. Please try again.' }
  }

  const amount = parseFloat(parsed.data.amount)
  const { data: insertedEntry, error: insertError } = await supabase.from('spend_entries').insert({
    user_id: user.id,
    name: rule.name,
    amount,
    currency: rule.default_currency,
    exchange_rate: exchangeRate,
    category_id: rule.category_id,
    notes: null,
    spent_on: parsed.data.paid_date,
    rule_id: ruleId,
  }).select('id').single()
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase.from('spend_rules').update({
    next_due: advanceCycle(parsed.data.paid_date, rule.cycle),
    default_amount: amount,
    status: 'active',
  }).match({ id: ruleId, user_id: user.id })
  if (updateError) {
    if (insertedEntry) {
      await supabase.from('spend_entries').delete().match({ id: insertedEntry.id, user_id: user.id })
    }
    return { error: updateError.message }
  }

  revalidateAll()
  return { success: true }
}

export async function skipRulePayment(ruleId: string) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const rule = await getOwnedRule(supabase, ruleId, user.id)
  if (!rule) return { error: 'Subscription not found' }

  const { error } = await supabase.from('spend_rules')
    .update({ next_due: advanceCycle(rule.next_due, rule.cycle) })
    .match({ id: ruleId, user_id: user.id })
  if (error) return { error: error.message }

  revalidateAll()
  return { success: true }
}

async function setRuleStatus(ruleId: string, status: 'active' | 'paused' | 'ended') {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('spend_rules').update({ status }).match({ id: ruleId, user_id: user.id })
  if (error) return { error: error.message }
  revalidateAll()
  return { success: true }
}

export async function pauseRule(ruleId: string)  { return setRuleStatus(ruleId, 'paused') }
export async function resumeRule(ruleId: string) { return setRuleStatus(ruleId, 'active') }
export async function endRule(ruleId: string)    { return setRuleStatus(ruleId, 'ended') }

export async function updateRule(ruleId: string, data: {
  name: string; default_amount: string; default_currency: string;
  cycle: SpendCycle; category_id?: string; notes?: string; next_due: string;
}) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const amount = parseFloat(data.default_amount)
  if (!data.name.trim() || isNaN(amount) || amount <= 0) return { error: 'Invalid fields' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.next_due)) return { error: 'Invalid date' }

  const { error } = await supabase.from('spend_rules').update({
    name: data.name.trim(),
    default_amount: amount,
    default_currency: data.default_currency,
    cycle: data.cycle,
    category_id: data.category_id || null,
    notes: data.notes || null,
    next_due: data.next_due,
  }).match({ id: ruleId, user_id: user.id })
  if (error) return { error: error.message }

  revalidateAll()
  return { success: true }
}

export async function deleteRule(ruleId: string) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }
  // spend_entries.rule_id is ON DELETE SET NULL — history survives.
  const { error } = await supabase.from('spend_rules').delete().match({ id: ruleId, user_id: user.id })
  if (error) return { error: error.message }
  revalidateAll()
  return { success: true }
}
