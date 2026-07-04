import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';
import { US_STATE_CODES } from '../../../common/utils/age';
import { IsDateOfBirth } from '../../../common/validators/is-date-of-birth.validator';

/**
 * POST /api/students — the 7 legacy student fields, all required
 * (students.md §3-R2 with the Q16 fix: full server-side validation).
 * State must come from the legacy 57-code list; DOB is a real,
 * non-future `YYYY-MM-DD` string; ZIP is a 5-digit STRING.
 */
export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  studentFirstName: string;

  @IsString()
  @IsNotEmpty()
  studentLastName: string;

  @IsDateOfBirth()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  studentStreetAddress: string;

  @IsString()
  @IsNotEmpty()
  studentCity: string;

  @IsIn(US_STATE_CODES)
  studentState: string;

  @Matches(/^\d{5}$/, { message: 'studentZIP must be a 5-digit ZIP code' })
  studentZIP: string;
}
