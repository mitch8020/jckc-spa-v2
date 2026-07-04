import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsDateOfBirth } from '../../../common/validators/is-date-of-birth.validator';

/** PATCH /api/users/me — any subset of the profile fields. */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsDateOfBirth()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;
}
