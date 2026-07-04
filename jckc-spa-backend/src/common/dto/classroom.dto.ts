import type { Types } from 'mongoose';
import type { AgeGroup } from '../utils/age';

/** API-CONTRACT.md shared shape — `id` (never `_id`), ISO `createdAt`. */
export interface ClassroomDto {
  id: string;
  classroomName: string;
  ageGroup: AgeGroup;
  teacherName: string;
  createdAt: string;
}

export interface ClassroomWithCountDto extends ClassroomDto {
  studentCount: number;
}

/** Minimal doc shape consumed by the classroom serializer (hydrated or lean). */
export interface ClassroomLike {
  _id: { toString(): string };
  classroomName: string;
  ageGroup: string;
  teacherName?: string | null;
  createdAt?: Date;
}

/**
 * Maps a classroom doc to the wire shape. `teacherName` is serialized
 * as '' when unset (never undefined — reports.md parity).
 */
export function toClassroomDto(classroom: ClassroomLike): ClassroomDto {
  return {
    id: classroom._id.toString(),
    classroomName: classroom.classroomName,
    ageGroup: classroom.ageGroup as AgeGroup,
    teacherName: classroom.teacherName ?? '',
    createdAt:
      classroom.createdAt instanceof Date
        ? classroom.createdAt.toISOString()
        : '',
  };
}

/**
 * Null-safe serializer for a student's `classroom` ref: unset refs,
 * dangling refs and unpopulated ids all serialize as null.
 */
export function toPopulatedClassroomDto(
  classroom: ClassroomLike | Types.ObjectId | string | null | undefined,
): ClassroomDto | null {
  if (
    classroom == null ||
    typeof classroom !== 'object' ||
    !('classroomName' in classroom)
  ) {
    return null;
  }
  return toClassroomDto(classroom);
}
