import { describe, it, expect } from 'vitest'
import { advanceCycle, monthlyEstimate, deriveCoverage } from './spend-utils'

describe('advanceCycle', () => {
  it('adds one cycle', () => {
    expect(advanceCycle('2026-07-10', 'weekly')).toBe('2026-07-17')
    expect(advanceCycle('2026-07-10', 'monthly')).toBe('2026-08-10')
    expect(advanceCycle('2026-07-10', 'quarterly')).toBe('2026-10-10')
    expect(advanceCycle('2026-07-10', 'yearly')).toBe('2027-07-10')
  })
  it('clamps month-end correctly', () => {
    expect(advanceCycle('2026-01-31', 'monthly')).toBe('2026-02-28')
  })
})

describe('monthlyEstimate', () => {
  it('normalizes to monthly', () => {
    expect(monthlyEstimate(10, 'weekly')).toBeCloseTo(43.3)
    expect(monthlyEstimate(10, 'monthly')).toBe(10)
    expect(monthlyEstimate(30, 'quarterly')).toBe(10)
    expect(monthlyEstimate(120, 'yearly')).toBe(10)
  })
})

describe('deriveCoverage', () => {
  it('merges consecutive payments into one period', () => {
    const { periods, gaps } = deriveCoverage(['2026-01-05', '2026-02-05', '2026-03-05'], 'monthly')
    expect(periods).toEqual([{ start: '2026-01-05', end: '2026-04-05', payments: 3 }])
    expect(gaps).toEqual([])
  })
  it('detects a gap and a second streak', () => {
    const { periods, gaps } = deriveCoverage(['2026-01-05', '2026-03-20'], 'monthly')
    expect(periods).toEqual([
      { start: '2026-01-05', end: '2026-02-05', payments: 1 },
      { start: '2026-03-20', end: '2026-04-20', payments: 1 },
    ])
    expect(gaps).toEqual([{ start: '2026-02-05', end: '2026-03-20', days: 43 }])
  })
  it('handles overlap (early renewal) without a gap', () => {
    const { periods, gaps } = deriveCoverage(['2026-01-05', '2026-01-28'], 'monthly')
    expect(periods).toEqual([{ start: '2026-01-05', end: '2026-02-28', payments: 2 }])
    expect(gaps).toEqual([])
  })
  it('sorts unsorted input and ignores empty', () => {
    expect(deriveCoverage([], 'monthly')).toEqual({ periods: [], gaps: [] })
    const { periods } = deriveCoverage(['2026-02-05', '2026-01-05'], 'monthly')
    expect(periods[0].start).toBe('2026-01-05')
  })
})
