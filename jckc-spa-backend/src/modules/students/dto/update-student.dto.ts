import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { US_STATE_CODES } from '../../../common/utils/age';
import { IsDateOfBirth } from '../../../common/validators/is-date-of-birth.validator';

/**
 * PATCH /api/students/:id — any subset of the 7 student fields (each
 * validated exactly like POST when present) plus the admin approve
 * action `applicationApprovalStatus` (DESIGN.md decision 2).
 */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentFirstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentLastName?: string;

  @IsOptional()
  @IsDateOfBirth()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentStreetAddress?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentCity?: string;

  @IsOptional()
  @IsIn(US_STATE_CODES)
  studentState?: string;

  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'studentZIP must be a 5-digit ZIP code' })
  studentZIP?: string;

  @IsOptional()
  @IsBoolean()
  applicationApprovalStatus?: boolean;
}
