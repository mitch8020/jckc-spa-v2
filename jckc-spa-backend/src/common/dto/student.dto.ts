import type { ClassroomDto } from './classroom.dto';

/**
 * Student list ordering per DESIGN.md decision 8: first name ascending
 * (case-insensitive via the shared CI_COLLATION), lastName then _id
 * tiebreakers.
 */
export const STUDENT_SORT = {
  studentFirstName: 1,
  studentLastName: 1,
  _id: 1,
} as const;

/** API-CONTRACT.md shared shape. */
export interface StudentDto {
  id: string;
  studentFirstName: string;
  studentLastName: string;
  /** `YYYY-MM-DD` string (legacy format preserved). */
  dateOfBirth: string;
  studentStreetAddress: string;
  studentCity: string;
  studentState: string;
  studentZIP: string;
  ageGroup: string | null;
  classroom: ClassroomDto | null;
  /** Missing on legacy docs -> serialized as true (DESIGN.md decision 2). */
  applicationApprovalStatus: boolean;
  createdAt: string;
}

/**
 * GET /api/students/mine and the parent dashboard's registered/pending
 * split (DESIGN.md decision 2; legacy parent summary tables).
 */
export interface MyStudentsDto {
  registered: StudentDto[];
  pending: StudentDto[];
}

/** Minimal doc shape consumed by the StudentDto serializer (hydrated or lean). */
export interface StudentLike {
  _id: { toString(): string };
  studentFirstName: string;
  studentLastName: string;
  dateOfBirth: string;
  studentStreetAddress: string;
  studentCity: string;
  studentState: string;
  studentZIP: string;
  ageGroup?: string | null;
  createdAt?: Date;
  applicationApprovalStatus?: boolean;
}

/**
 * Maps a student doc to the wire shape. `applicationApprovalStatus`
 * missing (all legacy docs) serializes as true — DESIGN.md decision 2.
 * The caller supplies the (already serialized) classroom, or null.
 */
export function toStudentDto(
  student: StudentLike,
  classroom: ClassroomDto | null,
): StudentDto {
  return {
    id: student._id.toString(),
    studentFirstName: student.studentFirstName,
    studentLastName: student.studentLastName,
    dateOfBirth: student.dateOfBirth,
    studentStreetAddress: student.studentStreetAddress,
    studentCity: student.studentCity,
    studentState: student.studentState,
    studentZIP: student.studentZIP,
    ageGroup: student.ageGroup ?? null,
    classroom,
    applicationApprovalStatus: student.applicationApprovalStatus !== false,
    createdAt:
      student.createdAt instanceof Date ? student.createdAt.toISOString() : '',
  };
}
