/** Retry pacing for queued writes. Pure, so the schedule is unit-testable. */

export const BASE_DELAY_MS = 30_000
export const MAX_DELAY_MS = 15 * 60_000
export const MAX_ATTEMPTS = 10

/**
 * Exponential backoff with jitter.
 *
 * Jitter matters because every queued write wakes on the same `online` event;
 * without it a backlog retries in lockstep and hammers the server in waves.
 */
export function nextAttemptDelay(attempts: number, random: () => number = Math.random): number {
  const exponential = BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1))
  const capped = Math.min(exponential, MAX_DELAY_MS)
  const jitter = 1 + (random() * 0.4 - 0.2) // ±20%
  return Math.round(capped * jitter)
}

/** A write that keeps failing becomes the user's problem, not an infinite loop. */
export function hasExhaustedRetries(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS
}
