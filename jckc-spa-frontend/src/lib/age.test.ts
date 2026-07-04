import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STATE,
  US_STATE_CODES,
  ageGroupRank,
  calcAgeGroup,
  convertAge,
  formatDateString,
  formatToday,
  properNoun,
} from '#/lib/age'

// A fixed UTC-midnight instant so `new Date()` minus a UTC-parsed
// 'YYYY-MM-DD' date-of-birth is an exact whole number of days.
const NOW_UTC = Date.parse('2026-07-02T00:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW_UTC - days * 86_400_000).toISOString().slice(0, 10)
}

describe('calcAgeGroup (11/30-month thresholds, 365-day years)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_UTC))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('classifies a newborn as infant', () => {
    expect(calcAgeGroup(daysAgo(0))).toBe('infant')
  })

  it('is infant just under 11 months (334 days ≈ 10.98 months)', () => {
    expect(calcAgeGroup(daysAgo(334))).toBe('infant')
  })

  it('flips to toddler at 11 months (335 days ≈ 11.01 months)', () => {
    expect(calcAgeGroup(daysAgo(335))).toBe('toddler')
  })

  it('is toddler just under 30 months (912 days ≈ 29.98 months)', () => {
    expect(calcAgeGroup(daysAgo(912))).toBe('toddler')
  })

  it('flips to preschool at 30 months (913 days ≈ 30.02 months)', () => {
    expect(calcAgeGroup(daysAgo(913))).toBe('preschool')
  })

  it('preserves the legacy invalid-date fallback → preschool', () => {
    expect(calcAgeGroup('garbage')).toBe('preschool')
    expect(calcAgeGroup('')).toBe('preschool')
  })
})

describe('convertAge (weeks under 1 month, months forever after)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_UTC))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("says '0 weeks old' for a newborn (the one sanctioned pluralization fix)", () => {
    expect(convertAge(daysAgo(0))).toBe('0 weeks old')
    expect(convertAge(daysAgo(6))).toBe('0 weeks old')
  })

  it("says '1 week old' (no plural) at ~8 days", () => {
    expect(convertAge(daysAgo(8))).toBe('1 week old')
  })

  it('floors weeks with the 52-weeks-per-365-day-year rule', () => {
    expect(convertAge(daysAgo(21))).toBe('2 weeks old')
    expect(convertAge(daysAgo(30))).toBe('4 weeks old')
  })

  it('switches to months at 1 month (31 days ≈ 1.02 months)', () => {
    expect(convertAge(daysAgo(31))).toBe('1 month old')
  })

  it('pluralizes months above one', () => {
    expect(convertAge(daysAgo(75))).toBe('2 months old')
  })

  it('never converts to years — 365 days is 12 months, 3 years is 36 months', () => {
    expect(convertAge(daysAgo(365))).toBe('12 months old')
    expect(convertAge(daysAgo(1095))).toBe('36 months old')
  })
})

describe('formatDateString (stored YYYY-MM-DD → MM/DD/YYYY, padding preserved)', () => {
  it('reorders the stored string parts', () => {
    expect(formatDateString('2023-04-05')).toBe('04/05/2023')
    expect(formatDateString('2020-05-14')).toBe('05/14/2020')
    expect(formatDateString('2022-12-31')).toBe('12/31/2022')
  })

  it('returns empty string for empty input (legacy threw)', () => {
    expect(formatDateString('')).toBe('')
  })
})

describe('formatToday (unpadded M/D/YYYY greeting date)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not zero-pad month or day', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 12, 0, 0)) // local July 2, 2026
    expect(formatToday()).toBe('7/2/2026')
  })

  it('keeps multi-digit parts intact', () => {
    vi.setSystemTime(new Date(2026, 11, 25, 12, 0, 0)) // local Dec 25, 2026
    expect(formatToday()).toBe('12/25/2026')
  })
})

describe('properNoun (lowercase everything, capitalize first char only)', () => {
  it('matches the legacy single-letter capitalization', () => {
    expect(properNoun('infant')).toBe('Infant')
    expect(properNoun('McDONALD')).toBe('Mcdonald')
    expect(properNoun('mary ann')).toBe('Mary ann')
    expect(properNoun("o'brien")).toBe("O'brien")
  })

  it('returns empty string for empty input (legacy threw)', () => {
    expect(properNoun('')).toBe('')
  })
})

describe('ageGroupRank (total order: infant → toddler → preschool)', () => {
  it('ranks the three groups', () => {
    expect(ageGroupRank('infant')).toBe(0)
    expect(ageGroupRank('toddler')).toBe(1)
    expect(ageGroupRank('preschool')).toBe(2)
  })

  it('sorts unknown groups last', () => {
    expect(ageGroupRank('mystery')).toBe(3)
    expect(ageGroupRank(null)).toBe(3)
    expect(ageGroupRank(undefined)).toBe(3)
  })
})

describe('US_STATE_CODES', () => {
  it('is the exact legacy 57-option list', () => {
    expect(US_STATE_CODES).toHaveLength(57)
    expect(US_STATE_CODES[0]).toBe('AL')
    expect(US_STATE_CODES[US_STATE_CODES.length - 1]).toBe('WY')
    // the oddballs that prove the list is the legacy one
    expect(US_STATE_CODES).toContain('CM')
    expect(US_STATE_CODES).toContain('TT')
    expect(US_STATE_CODES).toContain('AS')
  })

  it('defaults to TN', () => {
    expect(DEFAULT_STATE).toBe('TN')
    expect(US_STATE_CODES).toContain(DEFAULT_STATE)
  })
})
