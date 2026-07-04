import { IsIn } from 'class-validator';
import type { AppRole } from '../../../common/decorators/roles.decorator';

/** PATCH /api/users/:id (admin) — role change only. */
export class UpdateUserRoleDto {
  @IsIn(['parent', 'teacher', 'admin'])
  role: AppRole;
}
