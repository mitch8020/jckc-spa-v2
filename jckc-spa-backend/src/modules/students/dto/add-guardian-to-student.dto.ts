import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { US_STATE_CODES } from '../../../common/utils/age';

/** The 7 guardian personal fields (guardians.md §1.1), all required. */
export class GuardianFieldsDto {
  @IsString()
  @IsNotEmpty()
  guardianFirstName: string;

  @IsString()
  @IsNotEmpty()
  guardianLastName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{3}-\d{3}-\d{4}$/, {
    message: 'phoneNumber must match NNN-NNN-NNNN',
  })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  guardianStreetAddress: string;

  @IsString()
  @IsNotEmpty()
  guardianCity: string;

  @IsIn(US_STATE_CODES)
  guardianState: string;

  @Matches(/^\d{5}$/, { message: 'guardianZIP must be a 5-digit ZIP code' })
  guardianZIP: string;
}

/**
 * POST /api/students/:studentId/guardians — link an EXISTING guardian
 * (`guardianId`) or create a NEW one (`guardian`); exactly one of the
 * two must be provided (enforced in the service). `authorizedToPickUp`
 * honors the submitted value (fixes the legacy hardcoded-true bug,
 * guardians.md Q2).
 */
export class AddGuardianToStudentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  guardianId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianFieldsDto)
  guardian?: GuardianFieldsDto;

  @IsString()
  @IsNotEmpty()
  relationshipToStudent: string;

  @IsBoolean()
  authorizedToPickUp: boolean;
}
