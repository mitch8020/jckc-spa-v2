import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { US_STATE_CODES } from '../../../common/utils/age';
import { IsDateOfBirth } from '../../../common/validators/is-date-of-birth.validator';
import { GuardianFieldsDto } from './add-guardian-to-student.dto';

function hasGuardianLinkFields(dto: {
  guardianId?: unknown;
  guardian?: unknown;
  relationshipToStudent?: unknown;
  authorizedToPickUp?: unknown;
}): boolean {
  return (
    dto.guardianId !== undefined ||
    dto.guardian !== undefined ||
    dto.relationshipToStudent !== undefined ||
    dto.authorizedToPickUp !== undefined
  );
}

function mustProvideGuardianId(dto: {
  guardianId?: unknown;
  guardian?: unknown;
  relationshipToStudent?: unknown;
  authorizedToPickUp?: unknown;
}): boolean {
  return hasGuardianLinkFields(dto) && dto.guardian === undefined;
}

function mustProvideGuardianFields(dto: {
  guardianId?: unknown;
  guardian?: unknown;
  relationshipToStudent?: unknown;
  authorizedToPickUp?: unknown;
}): boolean {
  return hasGuardianLinkFields(dto) && dto.guardianId === undefined;
}

/**
 * POST /api/students — the 7 legacy student fields, all required, plus an
 * optional inline parent/guardian payload for the new-student application.
 * When any guardian-link field is present, all three guardian/link fields are
 * required so a student is never created with a partial guardian link.
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

  @ValidateIf(mustProvideGuardianId)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  guardianId?: string;

  @ValidateIf(mustProvideGuardianFields)
  @IsDefined()
  @ValidateNested()
  @Type(() => GuardianFieldsDto)
  guardian?: GuardianFieldsDto;

  @ValidateIf(hasGuardianLinkFields)
  @IsString()
  @IsNotEmpty()
  relationshipToStudent?: string;

  @ValidateIf(hasGuardianLinkFields)
  @IsBoolean()
  authorizedToPickUp?: boolean;
}
