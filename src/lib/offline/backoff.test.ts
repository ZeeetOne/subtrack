import { describe, it, expect } from 'vitest'
import {
  nextAttemptDelay,
  hasExhaustedRetries,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  MAX_ATTEMPTS,
} from './backoff'

// Mid-range random => no jitter, so the base schedule is exact.
const noJitter = () => 0.5

describe('nextAttemptDelay', () => {
  it('starts at the base delay', () => {
    expect(nextAttemptDelay(1, noJitter)).toBe(BASE_DELAY_MS)
  })

  it('doubles each attempt', () => {
    expect(nextAttemptDelay(2, noJitter)).toBe(BASE_DELAY_MS * 2)
    expect(nextAttemptDelay(3, noJitter)).toBe(BASE_DELAY_MS * 4)
  })

  it('caps so a stuck write still retries periodically', () => {
    expect(nextAttemptDelay(50, noJitter)).toBe(MAX_DELAY_MS)
  })

  it('stays within +/-20% jitter bounds', () => {
    const low = nextAttemptDelay(1, () => 0)
    const high = nextAttemptDelay(1, () => 1)

    expect(low).toBe(Math.round(BASE_DELAY_MS * 0.8))
    expect(high).toBe(Math.round(BASE_DELAY_MS * 1.2))
  })

  it('spreads a backlog instead of retrying in lockstep', () => {
    const delays = new Set([
      nextAttemptDelay(3, () => 0.1),
      nextAttemptDelay(3, () => 0.5),
      nextAttemptDelay(3, () => 0.9),
    ])

    expect(delays.size).toBe(3)
  })

  it('never returns a negative delay', () => {
    expect(nextAttemptDelay(0, () => 0)).toBeGreaterThan(0)
  })
})

describe('hasExhaustedRetries', () => {
  it('keeps retrying below the ceiling', () => {
    expect(hasExhaustedRetries(MAX_ATTEMPTS - 1)).toBe(false)
  })

  it('gives up at the ceiling so the user is told rather than looped on', () => {
    expect(hasExhaustedRetries(MAX_ATTEMPTS)).toBe(true)
  })
})
