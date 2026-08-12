import type { ProcessedSpendEntry } from '@/lib/types'
import type { ShadowEntry } from './types'

export interface MergeOptions {
  /** Server-rendered rows for the current view. */
  entries: readonly ProcessedSpendEntry[]
  /** Locally-added rows not yet reflected in `entries`. */
  shadows: readonly ShadowEntry[]
  /** Entry ids deleted locally but still present server-side. */
  deletes?: ReadonlySet<string>
  /** Inclusive spent_on bounds of the view, as YYYY-MM-DD. */
  windowStart?: string
  windowEnd?: string
  /** Category filter currently applied to the view, if any. */
  categoryId?: string
  limit?: number
}

/** Newest first, matching the SQL `spent_on desc, created_at desc`. */
function byRecency(a: ProcessedSpendEntry, b: ProcessedSpendEntry): number {
  if (a.spent_on !== b.spent_on) return a.spent_on < b.spent_on ? 1 : -1
  if (a.created_at === b.created_at) return 0
  return a.created_at < b.created_at ? 1 : -1
}

/**
 * Fold local pending state into the server-rendered list.
 *
 * The dedupe is the important part. Both sides key on the same id because the
 * client mints it, so once a write syncs and the page re-renders, the server
 * row simply replaces the shadow — there is no window in which the expense can
 * appear twice, which is the classic optimistic-UI failure.
 */
export function mergePending({
  entries,
  shadows,
  deletes,
  windowStart,
  windowEnd,
  categoryId,
  limit,
}: MergeOptions): ProcessedSpendEntry[] {
  const serverIds = new Set(entries.map((e) => e.id))

  const visible: ProcessedSpendEntry[] = deletes?.size
    ? entries.filter((e) => !deletes.has(e.id))
    : [...entries]

  for (const shadow of shadows) {
    // Server wins: it's the same row, already rendered.
    if (serverIds.has(shadow.id)) continue
    if (deletes?.has(shadow.id)) continue
    if (windowStart && shadow.spent_on < windowStart) continue
    if (windowEnd && shadow.spent_on > windowEnd) continue
    if (categoryId && shadow.category_id !== categoryId) continue
    visible.push(shadow)
  }

  visible.sort(byRecency)
  return typeof limit === 'number' ? visible.slice(0, limit) : visible
}

/**
 * Shadows safe to drop: the write is confirmed and the server list now carries
 * the row, or it aged out (a stale shadow from a session that never reconciled).
 */
export function reconcilableShadows(
  shadows: readonly ShadowEntry[],
  serverEntries: readonly ProcessedSpendEntry[],
  now: number,
  maxAgeMs = 5 * 60 * 1000
): string[] {
  const serverIds = new Set(serverEntries.map((e) => e.id))
  return shadows
    .filter((s) => {
      if (s.syncedAt === null) return false
      return serverIds.has(s.id) || now - s.syncedAt > maxAgeMs
    })
    .map((s) => s.id)
}
