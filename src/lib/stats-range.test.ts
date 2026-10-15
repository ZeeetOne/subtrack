import { describe, it, expect } from 'vitest'
import { parseRange, daysInRange, escapeLike, summarizeRange, UNCATEGORIZED } from './stats-range'
import type { ProcessedSpendEntry } from './types'

function entry(
  id: string,
  name: string,
  spent_on: string,
  amountInBase: number,
  category: { id: string; name: string } | null = null
): ProcessedSpendEntry {
  return {
    id,
    user_id: 'u1',
    name,
    amount: amountInBase,
    currency: 'IDR',
    exchange_rate: 1,
    rate_status: 'resolved',
    category_id: category?.id ?? null,
    notes: null,
    spent_on,
    spent_time: null,
    rule_id: null,
    created_at: `${spent_on}T09:00:00.000Z`,
    categoryName: category?.name ?? null,
    amountInBase,
  }
}

const food = { id: 'c-food', name: 'Food' }
const fun = { id: 'c-fun', name: 'Fun' }

const entries = [
  entry('1', 'Coffee', '2026-03-01', 30, food),
  entry('2', 'coffee ', '2026-03-05', 20, food),
  entry('3', 'Netflix', '2026-03-10', 100, fun),
  entry('4', 'Taxi', '2026-03-15', 50),
  entry('5', 'Coffee', '2026-04-01', 999, food), // outside the range below
]
const range = { from: '2026-03-01', to: '2026-03-31' }

describe('parseRange', () => {
  it('accepts a valid range', () => {
    expect(parseRange('2026-03-01', '2026-03-31')).toEqual(range)
  })
  it('swaps a reversed range', () => {
    expect(parseRange('2026-03-31', '2026-03-01')).toEqual(range)
  })
  it('rejects missing, malformed or impossible dates', () => {
    expect(parseRange(undefined, '2026-03-31')).toBeNull()
    expect(parseRange('2026-3-1', '2026-03-31')).toBeNull()
    expect(parseRange('2026-02-31', '2026-03-31')).toBeNull()
    expect(parseRange('nope', 'nope')).toBeNull()
  })
})

describe('daysInRange', () => {
  it('counts both ends', () => {
    expect(daysInRange({ from: '2026-03-01', to: '2026-03-01' })).toBe(1)
    expect(daysInRange(range)).toBe(31)
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })
})

describe('summarizeRange', () => {
  it('totals only entries inside the range, inclusive of both ends', () => {
    const s = summarizeRange(entries, range)
    expect(s.count).toBe(4)
    expect(s.total).toBe(200)
    expect(s.perDay).toBeCloseTo(200 / 31)
  })

  it('groups by category, largest first, with percentages', () => {
    const s = summarizeRange(entries, range)
    expect(s.byCategory.map((r) => [r.name, r.total])).toEqual([
      ['Fun', 100],
      ['Food', 50],
      ['Uncategorized', 50],
    ])
    expect(s.byCategory[0].percentage).toBeCloseTo(50)
  })

  it('merges titles case-insensitively', () => {
    const s = summarizeRange(entries, range)
    const coffee = s.byTitle.find((r) => r.name === 'Coffee')
    expect(coffee).toMatchObject({ total: 50, count: 2 })
  })

  it('filters by category id', () => {
    const s = summarizeRange(entries, range, { categoryId: food.id })
    expect(s.total).toBe(50)
    expect(s.count).toBe(2)
  })

  it('filters to uncategorized entries', () => {
    const s = summarizeRange(entries, range, { categoryId: UNCATEGORIZED })
    expect(s.byTitle.map((r) => r.name)).toEqual(['Taxi'])
  })

  it('filters by title substring, ignoring case', () => {
    const s = summarizeRange(entries, range, { query: ' COFF ' })
    expect(s.total).toBe(50)
  })

  it('combines category and title filters', () => {
    const s = summarizeRange(entries, range, { categoryId: fun.id, query: 'coffee' })
    expect(s.count).toBe(0)
    expect(s.total).toBe(0)
    expect(s.byCategory).toEqual([])
  })
})
