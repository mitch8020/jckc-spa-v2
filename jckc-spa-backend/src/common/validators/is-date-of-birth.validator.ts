import { registerDecorator } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DOB rule per DESIGN.md decision 7: a `YYYY-MM-DD` string that is a
 * real calendar date and not in the future.
 */
export function isValidDateOfBirth(value: unknown): boolean {
  if (typeof value !== 'string' || !DOB_REGEX.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  return date.getTime() <= Date.now();
}

/** class-validator decorator wrapping {@link isValidDateOfBirth}. */
export function IsDateOfBirth(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDateOfBirth',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid, non-future date in YYYY-MM-DD format`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isValidDateOfBirth(value),
      },
    });
  };
}
