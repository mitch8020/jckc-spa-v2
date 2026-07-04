// EXACT legacy display logic (legacy app.js `app.locals` helpers — core.md §5).
// Ages use 365-day-year math and the 11/30-month thresholds; dates of birth
// are `YYYY-MM-DD` strings end to end. Preserved quirks are noted inline; the
// only sanctioned fixes are the '0 weeks old' pluralization and robustness on
// empty input (legacy threw).

export type AgeGroupName = 'infant' | 'toddler' | 'preschool'

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365

function ageInYears(birthday: string): number {
  const today = new Date()
  const dateOfBirth = new Date(birthday)
  return (today.getTime() - dateOfBirth.getTime()) / MS_PER_YEAR
}

/**
 * Age-group business rule (legacy `calcAgeGroup`):
 * < 11 months → infant; 11–<30 months → toddler; ≥ 30 months → preschool.
 * "Months" = 365-day years × 12 (not calendar months). Invalid/empty birthday
 * yields NaN comparisons → 'preschool' (legacy hidden default, preserved).
 */
export function calcAgeGroup(birthday: string): AgeGroupName {
  const age = ageInYears(birthday)
  if (age * 12 < 11) return 'infant'
  else if (age * 12 < 30) return 'toddler'
  else return 'preschool'
}

/**
 * Human-readable age (legacy `convertAge`): weeks when under 1 month,
 * otherwise ALWAYS months (never years — a 3-year-old is "36 months old").
 * Only fix vs legacy: newborns under 7 days read "0 weeks old" (legacy
 * dropped the 's').
 */
export function convertAge(birthday: string): string {
  const age = ageInYears(birthday)
  if (age * 12 < 1) {
    const weeks = Math.floor(age * 52)
    return `${weeks} week${weeks === 1 ? '' : 's'} old`
  }
  const months = Math.floor(age * 12)
  return `${months} month${months === 1 ? '' : 's'} old`
}

/**
 * Stored-date display (legacy `formatDate(string)`): 'YYYY-MM-DD' →
 * 'MM/DD/YYYY' with the zero-padding preserved from the stored string.
 * Empty input returns '' (legacy threw on non-string input).
 */
export function formatDateString(date: string): string {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return `${month}/${day}/${year}`
}

/**
 * Today's date for the greeting header (legacy `formatDate()` no-arg branch):
 * 'M/D/YYYY' with NO zero padding (e.g. 7/2/2026).
 */
export function formatToday(): string {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
}

/**
 * Legacy `properNoun`: lowercase the whole string, then capitalize ONLY the
 * first character ('McDONALD' → 'Mcdonald'). Fixed to return '' instead of
 * throwing on empty input.
 */
export function properNoun(name: string): string {
  if (!name) return ''
  const ans = name.toLowerCase()
  return ans[0].toUpperCase() + ans.substring(1)
}

/**
 * Total-order rank for age groups (fixes the legacy non-transitive
 * comparator): infant → 0, toddler → 1, preschool → 2, anything else → 3.
 */
export function ageGroupRank(ageGroup: string | null | undefined): number {
  switch (ageGroup) {
    case 'infant':
      return 0
    case 'toddler':
      return 1
    case 'preschool':
      return 2
    default:
      return 3
  }
}

/**
 * The exact 57-option state list from the legacy student registration form
 * (students.md §6.1) — includes territories AS, GU, PR, VI, DC plus the
 * archaic CM and TT codes, in the legacy order.
 */
export const US_STATE_CODES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'AS',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'GU',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'CM',
  'OH',
  'OK',
  'OR',
  'PA',
  'PR',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'TT',
  'UT',
  'VT',
  'VA',
  'VI',
  'WA',
  'WV',
  'WI',
  'WY',
] as const

export type StateCode = (typeof US_STATE_CODES)[number]

/** Legacy default selection (Tennessee daycare). */
export const DEFAULT_STATE: StateCode = 'TN'
