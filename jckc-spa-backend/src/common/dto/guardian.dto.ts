import { isValidObjectId, Types } from 'mongoose';
import type { Model } from 'mongoose';
import type { StudentDocument } from '../../database/schemas/student.schema';

/**
 * Canonical guardian wire shapes per API-CONTRACT.md "Shared DTO
 * shapes", plus the single link-resolution serializer used by BOTH the
 * guardians endpoints and the student-scoped guardian endpoints
 * (GET /api/students/:id/guardians, POST /api/students/:studentId/guardians).
 */

/** Minimal student snippet embedded in a resolved guardian link. */
export interface GuardianLinkStudentDto {
  id: string;
  studentFirstName: string;
  studentLastName: string;
  dateOfBirth: string;
}

export interface GuardianLinkDto {
  studentId: string;
  relationshipToStudent: string;
  authorizedToPickUp: boolean;
  /** `null` = dangling link (student deleted or never migrated). */
  student: GuardianLinkStudentDto | null;
}

export interface GuardianDto {
  id: string;
  guardianFirstName: string;
  guardianLastName: string;
  phoneNumber: string;
  guardianStreetAddress: string;
  guardianCity: string;
  guardianState: string;
  guardianZIP: string;
  createdAt: string;
  students: GuardianLinkDto[];
}

/**
 * GET /api/guardians — lite shape for the "add guardian to student"
 * picker. `studentIds` are String()-normalized link ids (legacy docs may
 * store them as strings instead of ObjectIds).
 */
export interface GuardianLiteDto {
  id: string;
  guardianFirstName: string;
  guardianLastName: string;
  studentIds: string[];
}

/** A guardian row on the student-details page, with THIS student's link fields. */
export interface GuardianForStudentDto {
  id: string;
  guardianFirstName: string;
  guardianLastName: string;
  phoneNumber: string;
  guardianStreetAddress: string;
  guardianCity: string;
  guardianState: string;
  guardianZIP: string;
  relationshipToStudent: string;
  authorizedToPickUp: boolean;
}

/**
 * Link/guardian source shapes tolerant of legacy data: the legacy
 * `students` array was schemaless and the 2026-03-15 import stored
 * `student` ids as plain STRINGS, so every id comparison must
 * String()-normalize both sides and personal fields may be missing.
 * Both hydrated documents and lean/raw reads satisfy these shapes.
 */
export interface GuardianLinkSource {
  student?: Types.ObjectId | string | null;
  relationshipToStudent?: string;
  authorizedToPickUp?: boolean;
}

export interface GuardianLike {
  _id: { toString(): string };
  guardianFirstName?: string;
  guardianLastName?: string;
  phoneNumber?: string;
  guardianStreetAddress?: string;
  guardianCity?: string;
  guardianState?: string;
  guardianZIP?: string;
  students?: GuardianLinkSource[] | null;
  createdAt?: Date;
}

/** Lean student projection returned by {@link findStudentsForLinks}. */
export interface LinkedStudentSnippet {
  _id: Types.ObjectId;
  studentFirstName?: string;
  studentLastName?: string;
  dateOfBirth?: string;
}

/**
 * Batch-fetches the students referenced by a set of links. Ids that
 * cannot be cast to ObjectIds (schemaless legacy surprises) are
 * dangling by definition and are never sent to the query — a raw $in
 * with them would throw a CastError for the whole request.
 */
export async function findStudentsForLinks(
  studentModel: Model<StudentDocument>,
  links: readonly GuardianLinkSource[],
): Promise<LinkedStudentSnippet[]> {
  const candidateIds = [
    ...new Set(
      links
        .filter((link) => link.student != null)
        .map((link) => String(link.student))
        .filter((linkId) => isValidObjectId(linkId)),
    ),
  ].map((linkId) => new Types.ObjectId(linkId));

  if (candidateIds.length === 0) {
    return [];
  }
  return studentModel
    .find(
      { _id: { $in: candidateIds } },
      { studentFirstName: 1, studentLastName: 1, dateOfBirth: 1 },
    )
    .lean<LinkedStudentSnippet[]>()
    .exec();
}

/**
 * Resolves link subdocuments to GuardianLinkDto, batch-fetching the
 * referenced students (fixes the legacy N+1 loop, guardians.md Q17).
 * Every comparison String()-normalizes ids so ObjectId- and
 * string-stored links both resolve; unmatched links come back with
 * `student: null`.
 */
export async function resolveGuardianLinks(
  studentModel: Model<StudentDocument>,
  links: readonly GuardianLinkSource[],
): Promise<GuardianLinkDto[]> {
  const students = await findStudentsForLinks(studentModel, links);
  const byId = new Map(
    students.map((student) => [student._id.toString(), student]),
  );

  return links.map((link) => {
    const studentId = link.student == null ? '' : String(link.student);
    const student = byId.get(studentId);
    return {
      studentId,
      relationshipToStudent:
        typeof link.relationshipToStudent === 'string'
          ? link.relationshipToStudent
          : '',
      authorizedToPickUp: link.authorizedToPickUp === true,
      student: student
        ? {
            id: student._id.toString(),
            studentFirstName: student.studentFirstName ?? '',
            studentLastName: student.studentLastName ?? '',
            dateOfBirth: student.dateOfBirth ?? '',
          }
        : null,
    };
  });
}

/**
 * Serializes a guardian to the canonical GuardianDto, links resolved
 * via ONE batched student query. Personal fields missing on schemaless
 * legacy docs serialize as ''.
 */
export async function toGuardianDto(
  studentModel: Model<StudentDocument>,
  guardian: GuardianLike,
): Promise<GuardianDto> {
  return {
    id: guardian._id.toString(),
    guardianFirstName: guardian.guardianFirstName ?? '',
    guardianLastName: guardian.guardianLastName ?? '',
    phoneNumber: guardian.phoneNumber ?? '',
    guardianStreetAddress: guardian.guardianStreetAddress ?? '',
    guardianCity: guardian.guardianCity ?? '',
    guardianState: guardian.guardianState ?? '',
    guardianZIP: guardian.guardianZIP ?? '',
    createdAt:
      guardian.createdAt instanceof Date
        ? guardian.createdAt.toISOString()
        : '',
    students: await resolveGuardianLinks(studentModel, guardian.students ?? []),
  };
}
