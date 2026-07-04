/**
 * Legacy JCKC business helpers (see core.md §5). The math is EXACT legacy
 * behavior: 365-day years, months = years * 12 (not calendar months),
 * age-group thresholds at 11 and 30 "months". Only deliberate fixes:
 * - convertAge pluralizes "0 weeks old" (legacy printed "0 week old"),
 * - properNoun no longer throws on the empty string,
 * - sortClassrooms uses a total-order rank map (legacy comparator was
 *   non-transitive) while preserving the intended
 *   infant -> toddler -> preschool then name A->Z order without mutating
 *   the input array.
 */

export type AgeGroup = 'infant' | 'toddler' | 'preschool';

export const AGE_GROUP_RANK: Record<AgeGroup, number> = {
  infant: 0,
  toddler: 1,
  preschool: 2,
};

function ageInYears(birthday: string, now: Date): number {
  return (
    (now.getTime() - new Date(birthday).getTime()) / 1000 / 60 / 60 / 24 / 365
  );
}

/**
 * Age group from a `YYYY-MM-DD` date-of-birth string.
 * < 11 months -> infant; < 30 months -> toddler; else preschool.
 * Invalid input yields NaN comparisons -> 'preschool' (legacy quirk,
 * unreachable in practice because DTOs validate dates).
 */
export function calcAgeGroup(
  birthday: string,
  now: Date = new Date(),
): AgeGroup {
  const months = ageInYears(birthday, now) * 12;
  if (months < 11) {
    return 'infant';
  }
  if (months < 30) {
    return 'toddler';
  }
  return 'preschool';
}

/**
 * Human-readable age: under ~1 month -> floor(weeks) "week(s) old",
 * otherwise ALWAYS floor(months) "month(s) old" (never years — a
 * 3-year-old is "36 months old").
 */
export function convertAge(birthday: string, now: Date = new Date()): string {
  const age = ageInYears(birthday, now);
  if (age * 12 < 1) {
    const weeks = Math.floor(age * 52);
    return `${weeks} week${weeks === 1 ? '' : 's'} old`;
  }
  const months = Math.floor(age * 12);
  return `${months} month${months === 1 ? '' : 's'} old`;
}

/**
 * `YYYY-MM-DD` -> `MM/DD/YYYY`, preserving the stored zero-padding
 * (e.g. '2023-04-05' -> '04/05/2023'). Callers must pass pure
 * `YYYY-MM-DD` strings (DOBs are stored in that format).
 */
export function formatDateString(date: string): string {
  const [year, month, day] = date.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Today's date as unpadded `M/D/YYYY` (legacy greeting-header format,
 * e.g. '7/2/2026').
 */
export function formatToday(now: Date = new Date()): string {
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
}

/**
 * Lowercases the whole string then capitalizes ONLY the first character
 * ('infant' -> 'Infant', 'McDONALD' -> 'Mcdonald'). Empty input returns
 * '' instead of throwing (legacy threw a TypeError).
 */
export function properNoun(name: string): string {
  if (!name) {
    return '';
  }
  const lower = name.toLowerCase();
  return lower[0].toUpperCase() + lower.substring(1);
}

/** Rank for classroom ordering; unknown age groups sort last. */
export function ageGroupRank(ageGroup: string): number {
  return ageGroup in AGE_GROUP_RANK
    ? AGE_GROUP_RANK[ageGroup as AgeGroup]
    : Number.MAX_SAFE_INTEGER;
}

/**
 * Classrooms ordered infant -> toddler -> preschool, then by
 * classroomName A->Z. Returns a NEW array (does not mutate the input).
 */
export function sortClassrooms<
  T extends { classroomName: string; ageGroup: string },
>(classrooms: readonly T[]): T[] {
  return [...classrooms].sort(
    (a, b) =>
      ageGroupRank(a.ageGroup) - ageGroupRank(b.ageGroup) ||
      a.classroomName.localeCompare(b.classroomName),
  );
}

/**
 * The exact 57-code state/territory list from the legacy `<select>`s,
 * in its original order — includes AS, GU, PR, VI, DC and the archaic
 * CM and TT codes (value set kept verbatim for data compatibility).
 * Single source of truth for BOTH the student forms (students.md §6.1)
 * and the guardian forms (guardians.md §4.2). Default selection 'TN'.
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
] as const;

export type UsStateCode = (typeof US_STATE_CODES)[number];
