import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { US_STATE_CODES } from '../../../common/utils/age';

/** Legacy phone entry/display convention (guardians.md §6.8). */
const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

/** ZIP is a 5-digit STRING (fixes the legacy number-input quirk, Q9). */
const ZIP_REGEX = /^\d{5}$/;

/** Trims string inputs before validation runs. */
const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * One entry of `links[]`: may only retarget the relationship/pickup of a
 * link whose student still exists. Entries for unknown or dangling
 * student ids are silently ignored (legacy R5 parity — the edit flow can
 * never add or remove links).
 */
export class UpdateGuardianLinkDto {
  @IsMongoId()
  studentId: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  relationshipToStudent: string;

  @IsBoolean()
  authorizedToPickUp: boolean;
}

/**
 * PATCH /api/guardians/:id — the 7 personal fields are ALL required
 * (full replace, legacy R5 parity), validated per guardians.md §6.8:
 * phone NNN-NNN-NNNN, ZIP 5-digit string, state within the legacy
 * 57-code list; every string trimmed.
 */
export class UpdateGuardianDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  guardianFirstName: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  guardianLastName: string;

  @Trim()
  @Matches(PHONE_REGEX, {
    message: 'phoneNumber must match NNN-NNN-NNNN',
  })
  phoneNumber: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  guardianStreetAddress: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  guardianCity: string;

  @Trim()
  @IsIn(US_STATE_CODES)
  guardianState: string;

  @Trim()
  @Matches(ZIP_REGEX, {
    message: 'guardianZIP must be a 5-digit ZIP code',
  })
  guardianZIP: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateGuardianLinkDto)
  links?: UpdateGuardianLinkDto[];
}
