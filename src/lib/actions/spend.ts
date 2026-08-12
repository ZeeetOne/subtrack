'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { spendEntrySchema, spendEntryInputSchema, confirmPaymentSchema, type SpendEntryFormValues, type SpendEntryInput, type ConfirmPaymentValues } from '@/lib/schemas/spend'
import { getLiveExchangeRate, batchGetExchangeRates } from '@/lib/currency'
import { advanceCycle, type SpendCycle } from '@/lib/spend-utils'
import type { SpendRule, SpendRateStatus } from '@/lib/types'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Postgres unique_violation. A replayed write hitting its own row is success. */
const DUPLICATE_KEY = '23505'

/** A third-party FX API must never hold a user's expense hostage this long. */
const RATE_TIMEOUT_MS = 2500

/** Shapes accepted by syncOutbox — the wire form of the client's outbox. */
type SyncMutation =
  | { id: string; entityId: string; kind: 'entry.create'; input: SpendEntryInput }
  | { id: string; entityId: string; kind: 'entry.update'; input: SpendEntryFormValues }
  | { id: string; entityId: string; kind: 'entry.delete' }
  | { id: string; entityId: string; kind: 'category.create'; name: string }

interface SyncResultRow {
  id: string
  ok: boolean
  terminal?: boolean
  error?: string
}

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

async function getBaseCurrency(supabase: Supabase, userId: string): Promise<string> {
  const { data: profile } = await supabase.from('profiles').select('base_currency').eq('id', userId).single()
  return profile?.base_currency || 'IDR'
}

/**
 * Work out an entry's exchange rate without ever blocking the save.
 *
 * Three tiers, cheapest first:
 *  1. same currency as the user's base — no HTTP at all (the common case)
 *  2. a live rate, but only if it arrives inside RATE_TIMEOUT_MS
 *  3. otherwise a provisional rate flagged 'pending', backfilled later
 *
 * This never throws. Losing an expense because a third-party FX API was slow
 * is far worse than showing an approximate conversion for a few minutes.
 */
async function resolveRate(
  supabase: Supabase,
  userId: string,
  currency: string,
  fallback?: number
): Promise<{ exchange_rate: number; rate_status: SpendRateStatus }> {
  const baseCurrency = await getBaseCurrency(supabase, userId)
  if (currency === baseCurrency) return { exchange_rate: 1, rate_status: 'resolved' }

  try {
    const rate = await getLiveExchangeRate(currency, baseCurrency, AbortSignal.timeout(RATE_TIMEOUT_MS))
    return { exchange_rate: rate, rate_status: 'resolved' }
  } catch {
    return {
      exchange_rate: fallback && fallback > 0 ? fallback : 1,
      rate_status: 'pending',
    }
  }
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
  const { data: created, error } = await supabase
    .from('spend_categories')
    .insert({ name: data.name.trim(), user_id: user.id })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidateAll()
  return { data: created }
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

export async function createSpendEntry(data: SpendEntryInput) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = spendEntryInputSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid fields' }
  const v = parsed.data

  const { exchange_rate, rate_status } = await resolveRate(supabase, user.id, v.currency, v.exchange_rate)

  let ruleId: string | null = null
  if (v.is_subscription && v.cycle) {
    ruleId = v.rule_id ?? globalThis.crypto.randomUUID()
    const { error: ruleError } = await supabase.from('spend_rules').insert({
      id: ruleId,
      user_id: user.id,
      name: v.name,
      default_amount: parseFloat(v.amount),
      default_currency: v.currency,
      cycle: v.cycle,
      category_id: v.category_id || null,
      notes: v.notes || null,
      next_due: advanceCycle(v.spent_on, v.cycle),
      status: 'active',
    })
    // A replay finds the rule its own earlier attempt created. That's success.
    if (ruleError && ruleError.code !== DUPLICATE_KEY) return { error: ruleError.message }
  }

  const { error } = await supabase.from('spend_entries').insert({
    id: v.id,
    user_id: user.id,
    name: v.name,
    amount: parseFloat(v.amount),
    currency: v.currency,
    exchange_rate,
    rate_status,
    category_id: v.category_id || null,
    notes: v.notes || null,
    spent_on: v.spent_on,
    rule_id: ruleId,
    ...(v.created_at ? { created_at: v.created_at } : {}),
  })
  // The primary key is the idempotency key: flushing a queued create twice
  // must leave exactly one row. Deliberately no compensating delete of the
  // rule — on a retry that would destroy what the first attempt succeeded at.
  if (error && error.code !== DUPLICATE_KEY) return { error: error.message }

  revalidateAll()
  return { success: true }
}

export async function updateSpendEntry(id: string, data: SpendEntryFormValues) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = spendEntrySchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid fields' }
  const v = parsed.data

  const { data: existing } = await supabase.from('spend_entries').select('rule_id, currency, exchange_rate, rate_status').match({ id, user_id: user.id }).single()

  let exchangeRate = Number(existing?.exchange_rate ?? 1)
  let rateStatus: SpendRateStatus = (existing?.rate_status as SpendRateStatus) ?? 'resolved'
  if (!existing || existing.currency !== v.currency) {
    // A failed lookup keeps the edit rather than rejecting it; the rate is
    // marked pending and picked up by the backfill sweep.
    const resolved = await resolveRate(supabase, user.id, v.currency, exchangeRate)
    exchangeRate = resolved.exchange_rate
    rateStatus = resolved.rate_status
  }

  const { error } = await supabase.from('spend_entries').update({
    name: v.name,
    amount: parseFloat(v.amount),
    currency: v.currency,
    exchange_rate: exchangeRate,
    rate_status: rateStatus,
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

/**
 * Resolve the real exchange rate for entries that were saved without one.
 *
 * Cheap by construction: the partial index idx_spend_entries_rate_pending only
 * contains the stragglers, and batchGetExchangeRates dedupes by source
 * currency, so a backlog of twenty IDR expenses costs zero HTTP calls.
 *
 * Safe to call speculatively — it's a no-op when nothing is pending.
 */
export async function backfillPendingRates() {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: pending, error } = await supabase
    .from('spend_entries')
    .select('id, currency')
    .match({ user_id: user.id, rate_status: 'pending' })
    .limit(200)
  if (error) return { error: error.message }
  if (!pending?.length) return { updated: 0 }

  const baseCurrency = await getBaseCurrency(supabase, user.id)
  const { rates } = await batchGetExchangeRates(pending.map((e) => e.currency), baseCurrency)

  // One UPDATE per distinct currency rather than per row.
  const idsByCurrency = new Map<string, string[]>()
  for (const entry of pending) {
    const ids = idsByCurrency.get(entry.currency)
    if (ids) ids.push(entry.id)
    else idsByCurrency.set(entry.currency, [entry.id])
  }

  let updated = 0
  for (const [currency, ids] of idsByCurrency) {
    const rate = rates[currency]
    // Still unavailable — leave it pending and try again next time.
    if (typeof rate !== 'number') continue

    const { error: updateError } = await supabase
      .from('spend_entries')
      .update({ exchange_rate: rate, rate_status: 'resolved' })
      .eq('user_id', user.id)
      .in('id', ids)
    if (!updateError) updated += ids.length
  }

  if (updated > 0) revalidateAll()
  return { updated }
}

/**
 * Flush a batch of queued client writes.
 *
 * Batched rather than N calls because the moment this runs — connectivity just
 * returned, link still marginal — is exactly when per-call overhead and partial
 * failures multiply. One auth check, one deduped FX pass, one revalidate, one
 * round trip.
 *
 * Returns a per-item verdict so the client knows what to retry and what to
 * surface. `terminal` means never retry.
 */
export async function syncOutbox(
  mutations: SyncMutation[]
): Promise<{ results: SyncResultRow[] }> {
  const { supabase, user } = await requireUser()
  // Not terminal: an expired session offline must keep its queue, not drop it.
  if (!user) {
    return { results: mutations.map((m) => ({ id: m.id, ok: false, error: 'Unauthorized' })) }
  }

  const results: SyncResultRow[] = []
  let mutated = false

  const record = (id: string, outcome: { error?: string; success?: boolean }) => {
    if (outcome.error) {
      // Only a validation failure is hopeless; everything else may yet succeed.
      results.push({ id, ok: false, error: outcome.error, terminal: outcome.error === 'Invalid fields' })
    } else {
      results.push({ id, ok: true })
      mutated = true
    }
  }

  for (const mutation of mutations) {
    try {
      switch (mutation.kind) {
        case 'entry.create':
          record(mutation.id, await createSpendEntry(mutation.input))
          break
        case 'entry.update':
          record(mutation.id, await updateSpendEntry(mutation.entityId, mutation.input))
          break
        case 'entry.delete':
          record(mutation.id, await deleteSpendEntry(mutation.entityId))
          break
        case 'category.create': {
          // id supplied so the entry referencing this category resolves.
          const { error } = await supabase
            .from('spend_categories')
            .insert({ id: mutation.entityId, name: mutation.name.trim(), user_id: user.id })
          record(mutation.id, error && error.code !== DUPLICATE_KEY ? { error: error.message } : {})
          break
        }
      }
    } catch (err) {
      results.push({
        id: mutation.id,
        ok: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      })
    }
  }

  if (mutated) {
    revalidateAll()
    // Anything that landed without a real rate gets one now, while we're online.
    void backfillPendingRates()
  }

  return { results }
}

// ---------- rule lifecycle ----------

export async function confirmRulePayment(ruleId: string, data: ConfirmPaymentValues) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = confirmPaymentSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid fields' }

  const rule = await getOwnedRule(supabase, ruleId, user.id)
  if (!rule) return { error: 'Subscription not found' }

  const { exchange_rate, rate_status } = await resolveRate(supabase, user.id, rule.default_currency)

  const amount = parseFloat(parsed.data.amount)
  const { data: insertedEntry, error: insertError } = await supabase.from('spend_entries').insert({
    user_id: user.id,
    name: rule.name,
    amount,
    currency: rule.default_currency,
    exchange_rate,
    rate_status,
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
