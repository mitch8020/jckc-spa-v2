import {
  calcAgeGroup,
  convertAge,
  formatDateString,
  formatToday,
  properNoun,
  sortClassrooms,
  US_STATE_CODES,
} from './age';

/**
 * Fixed "now" at UTC midnight so `YYYY-MM-DD` DOB strings (parsed as UTC
 * midnight) sit at exact whole-day offsets — the legacy math uses
 * 365-day years and months = years * 12.
 */
const NOW = new Date('2026-07-02T00:00:00Z');

function dobDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

describe('calcAgeGroup', () => {
  it('returns infant for a newborn', () => {
    expect(calcAgeGroup(dobDaysAgo(0), NOW)).toBe('infant');
  });

  it('returns infant just under the 11-month threshold (334 days = 10.98 months)', () => {
    expect(calcAgeGroup(dobDaysAgo(334), NOW)).toBe('infant');
  });

  it('returns toddler just over the 11-month threshold (335 days = 11.01 months)', () => {
    expect(calcAgeGroup(dobDaysAgo(335), NOW)).toBe('toddler');
  });

  it('returns toddler just under the 30-month threshold (912 days = 29.98 months)', () => {
    expect(calcAgeGroup(dobDaysAgo(912), NOW)).toBe('toddler');
  });

  it('returns preschool just over the 30-month threshold (913 days = 30.02 months)', () => {
    expect(calcAgeGroup(dobDaysAgo(913), NOW)).toBe('preschool');
  });

  it('returns preschool for a 5-year-old', () => {
    expect(calcAgeGroup(dobDaysAgo(365 * 5), NOW)).toBe('preschool');
  });

  it('falls back to preschool for invalid input (legacy quirk)', () => {
    expect(calcAgeGroup('not-a-date', NOW)).toBe('preschool');
    expect(calcAgeGroup('', NOW)).toBe('preschool');
  });
});

describe('convertAge', () => {
  it('uses weeks under one month, with the 0-weeks pluralization FIXED', () => {
    // 7 days -> floor(7/365*52) = 0 -> "0 weeks old" (legacy said "0 week old")
    expect(convertAge(dobDaysAgo(7), NOW)).toBe('0 weeks old');
  });

  it('says "1 week old" (singular) at 8 days', () => {
    expect(convertAge(dobDaysAgo(8), NOW)).toBe('1 week old');
  });

  it('says "2 weeks old" at 21 days', () => {
    expect(convertAge(dobDaysAgo(21), NOW)).toBe('2 weeks old');
  });

  it('still uses weeks at 30 days (0.986 months)', () => {
    // floor(30/365*52) = 4
    expect(convertAge(dobDaysAgo(30), NOW)).toBe('4 weeks old');
  });

  it('switches to months at 31 days (singular)', () => {
    expect(convertAge(dobDaysAgo(31), NOW)).toBe('1 month old');
  });

  it('pluralizes months at 61 days', () => {
    expect(convertAge(dobDaysAgo(61), NOW)).toBe('2 months old');
  });

  it('NEVER uses years — a 3-year-old is "36 months old"', () => {
    expect(convertAge(dobDaysAgo(365 * 3), NOW)).toBe('36 months old');
  });

  it('a 5-year-old is "60 months old"', () => {
    expect(convertAge(dobDaysAgo(365 * 5), NOW)).toBe('60 months old');
  });
});

describe('formatDateString', () => {
  it('converts YYYY-MM-DD to MM/DD/YYYY preserving zero-padding', () => {
    expect(formatDateString('2023-04-05')).toBe('04/05/2023');
    expect(formatDateString('2020-05-09')).toBe('05/09/2020');
    expect(formatDateString('2022-06-06')).toBe('06/06/2022');
  });

  it('keeps double-digit parts intact', () => {
    expect(formatDateString('1999-12-31')).toBe('12/31/1999');
  });
});

describe('formatToday', () => {
  it('renders unpadded M/D/YYYY', () => {
    expect(formatToday(new Date(2026, 6, 2))).toBe('7/2/2026');
    expect(formatToday(new Date(2026, 0, 9))).toBe('1/9/2026');
  });

  it('keeps double-digit parts intact', () => {
    expect(formatToday(new Date(2026, 11, 25))).toBe('12/25/2026');
  });
});

describe('properNoun', () => {
  it('lowercases everything then capitalizes only the first character', () => {
    expect(properNoun('infant')).toBe('Infant');
    expect(properNoun('McDONALD')).toBe('Mcdonald');
    expect(properNoun('mary ann')).toBe('Mary ann');
    expect(properNoun("o'brien")).toBe("O'brien");
  });

  it('returns "" for the empty string instead of throwing (legacy threw)', () => {
    expect(properNoun('')).toBe('');
  });
});

describe('sortClassrooms', () => {
  const rooms = [
    { classroomName: 'Bumblebees', ageGroup: 'preschool' },
    { classroomName: 'Anchors', ageGroup: 'preschool' },
    { classroomName: 'Seahorses', ageGroup: 'infant' },
    { classroomName: 'Dolphins', ageGroup: 'toddler' },
    { classroomName: 'Starfish', ageGroup: 'infant' },
  ];

  it('orders infant -> toddler -> preschool, then name A->Z', () => {
    expect(sortClassrooms(rooms).map((room) => room.classroomName)).toEqual([
      'Seahorses',
      'Starfish',
      'Dolphins',
      'Anchors',
      'Bumblebees',
    ]);
  });

  it('is a total order: infant sorts before preschool even when adjacent', () => {
    const pair = [
      { classroomName: 'Zebras', ageGroup: 'preschool' },
      { classroomName: 'Ants', ageGroup: 'infant' },
    ];
    expect(sortClassrooms(pair).map((room) => room.ageGroup)).toEqual([
      'infant',
      'preschool',
    ]);
  });

  it('sorts unknown age groups last and does not mutate the input', () => {
    const input = [
      { classroomName: 'Mystery', ageGroup: 'unknown' },
      { classroomName: 'Seahorses', ageGroup: 'infant' },
    ];
    const sorted = sortClassrooms(input);
    expect(sorted.map((room) => room.classroomName)).toEqual([
      'Seahorses',
      'Mystery',
    ]);
    expect(input[0].classroomName).toBe('Mystery');
  });
});

describe('US_STATE_CODES', () => {
  it('is the exact 57-code legacy list', () => {
    expect(US_STATE_CODES).toHaveLength(57);
    expect(US_STATE_CODES[0]).toBe('AL');
    expect(US_STATE_CODES[56]).toBe('WY');
  });

  it('keeps the legacy ordering landmarks (AS, CM, TN, TT)', () => {
    expect(US_STATE_CODES[4]).toBe('AS');
    expect(US_STATE_CODES[37]).toBe('CM');
    expect(US_STATE_CODES[46]).toBe('TN');
    expect(US_STATE_CODES[48]).toBe('TT');
  });

  it('includes the territories and DC', () => {
    for (const code of ['AS', 'GU', 'PR', 'VI', 'DC', 'CM', 'TT']) {
      expect(US_STATE_CODES).toContain(code);
    }
  });
});
