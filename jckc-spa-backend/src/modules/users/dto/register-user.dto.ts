import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { IsDateOfBirth } from '../../../common/validators/is-date-of-birth.validator';

/**
 * POST /api/users/register — all fields required. The form offers ONLY
 * parent/teacher (DESIGN.md decision 1); admin is granted via
 * ADMIN_EMAILS bootstrap or by an existing admin.
 */
export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsIn(['parent', 'teacher'])
  role: 'parent' | 'teacher';

  @IsDateOfBirth()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
