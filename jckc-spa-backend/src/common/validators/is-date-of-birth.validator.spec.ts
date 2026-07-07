import { validateSync } from 'class-validator';
import {
  IsDateOfBirth,
  isValidDateOfBirth,
} from './is-date-of-birth.validator';

class BirthDateHolder {
  @IsDateOfBirth()
  dateOfBirth: unknown;
}

class CustomMessageHolder {
  @IsDateOfBirth({ message: 'custom dob message' })
  dateOfBirth: unknown;
}

describe('isValidDateOfBirth', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-07T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([undefined, null, 123, '', '07/07/2026', '2026-7-7'])(
    'rejects non-YYYY-MM-DD values: %p',
    (value) => {
      expect(isValidDateOfBirth(value)).toBe(false);
    },
  );

  it('rejects impossible calendar dates and future dates', () => {
    expect(isValidDateOfBirth('2026-02-30')).toBe(false);
    expect(isValidDateOfBirth('2027-01-01')).toBe(false);
  });

  it('accepts real dates that are today or in the past', () => {
    expect(isValidDateOfBirth('2026-07-07')).toBe(true);
    expect(isValidDateOfBirth('1990-04-05')).toBe(true);
  });
});

describe('IsDateOfBirth', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-07T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers a class-validator decorator with the default message', () => {
    const holder = new BirthDateHolder();
    holder.dateOfBirth = 'not-a-date';

    const errors = validateSync(holder);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isDateOfBirth:
        'dateOfBirth must be a valid, non-future date in YYYY-MM-DD format',
    });
  });

  it('allows validation options to override the default message', () => {
    const holder = new CustomMessageHolder();
    holder.dateOfBirth = 'not-a-date';

    const errors = validateSync(holder);

    expect(errors[0].constraints).toEqual({
      isDateOfBirth: 'custom dob message',
    });
  });
});
