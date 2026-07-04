import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { AgeGroup } from '../../../common/utils/age';

export const AGE_GROUPS: AgeGroup[] = ['infant', 'toddler', 'preschool'];

/**
 * POST /api/classrooms and PATCH /api/classrooms/:id — all three fields
 * are required on BOTH (API-CONTRACT.md; fixes the legacy missing
 * runValidators / no-enum quirks, classrooms.md ledger #9/#10/#13).
 */
export class UpsertClassroomDto {
  @IsString()
  @IsNotEmpty()
  classroomName: string;

  @IsIn(AGE_GROUPS)
  ageGroup: AgeGroup;

  @IsString()
  @IsNotEmpty()
  teacherName: string;
}
