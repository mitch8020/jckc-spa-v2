// Shared DTO types — mirror of API-CONTRACT.md "Shared DTO shapes" (BINDING).
// Every resource exposes `id` (string, never `_id`); `createdAt` is an ISO
// string; `dateOfBirth` is ALWAYS a `YYYY-MM-DD` string.

/** `''` = authenticated but not yet registered. */
export type Role = '' | 'parent' | 'teacher' | 'admin'

/** Roles a registered user can hold. */
export type RegisteredRole = 'parent' | 'teacher' | 'admin'

export type AgeGroup = 'infant' | 'toddler' | 'preschool'

export type StudentStatusFilter = 'active' | 'inactive' | 'all'

export type SortOrder = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Pagination (page size 10 everywhere — legacy math parity)
// ---------------------------------------------------------------------------

export interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  startIndex: number
  endIndex: number
  hasPrevious: boolean
  hasNext: boolean
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserDto {
  id: string
  email: string
  name: string
  image: string | null
  role: Role
  registrationStatus: boolean
  firstName: string
  lastName: string
  phoneNumber: string
  dateOfBirth: string
  createdAt: string
}

/** Body for POST /api/users/register (all required). */
export interface RegisterUserBody {
  firstName: string
  lastName: string
  role: 'parent' | 'teacher'
  dateOfBirth: string
  phoneNumber: string
}

/** Body for PATCH /api/users/me (all optional). */
export interface UpdateMeBody {
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  phoneNumber?: string
}

/** Body for PATCH /api/users/:id (admin role change). */
export interface UpdateUserRoleBody {
  role: RegisteredRole
}

// ---------------------------------------------------------------------------
// Classrooms
// ---------------------------------------------------------------------------

export interface ClassroomDto {
  id: string
  classroomName: string
  ageGroup: AgeGroup
  teacherName: string
  createdAt: string
}

export interface ClassroomWithCountDto extends ClassroomDto {
  studentCount: number
}

/** Body for POST/PATCH /api/classrooms (all required). */
export interface ClassroomInput {
  classroomName: string
  ageGroup: AgeGroup
  teacherName: string
}

/** Response of GET /api/classrooms/:id. */
export interface ClassroomDetailDto {
  classroom: ClassroomDto
  students: StudentDto[]
}

/** Response of GET /api/classrooms/:id/roster. */
export interface ClassroomRosterDto {
  add: Paginated<StudentDto>
  remove: Paginated<StudentDto>
}

/** Body for POST /api/classrooms/:id/students and .../students/remove. */
export interface RosterStudentIdsBody {
  studentIds: string[]
}

/** Response of POST /api/classrooms/:id/students. */
export interface RosterAssignResultDto {
  added: number
  notFound: string[]
}

/** Response of POST /api/classrooms/:id/students/remove. */
export interface RosterRemoveResultDto {
  removed: number
  skipped: string[]
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface StudentDto {
  id: string
  studentFirstName: string
  studentLastName: string
  dateOfBirth: string
  studentStreetAddress: string
  studentCity: string
  studentState: string
  studentZIP: string
  ageGroup: string | null
  classroom: ClassroomDto | null
  /** Missing in legacy docs → serialized as true. */
  applicationApprovalStatus: boolean
  createdAt: string
}

/** The 7 student fields. */
export interface StudentInput {
  studentFirstName: string
  studentLastName: string
  dateOfBirth: string
  studentStreetAddress: string
  studentCity: string
  studentState: string
  studentZIP: string
}

/** Body for POST /api/students. Provide guardianId or guardian with link fields. */
export interface CreateStudentBody extends StudentInput {
  guardianId?: string
  guardian?: GuardianInput
  relationshipToStudent?: string
  authorizedToPickUp?: boolean
}

/** Body for PATCH /api/students/:id (any subset + approve action). */
export interface UpdateStudentBody extends Partial<StudentInput> {
  applicationApprovalStatus?: boolean
}

/** Response of GET /api/students/mine (parent). */
export interface MyStudentsDto {
  registered: StudentDto[]
  pending: StudentDto[]
}

// ---------------------------------------------------------------------------
// Guardians
// ---------------------------------------------------------------------------

export interface GuardianLinkDto {
  studentId: string
  relationshipToStudent: string
  authorizedToPickUp: boolean
  /** null = dangling legacy link (student deleted / unresolvable). */
  student: {
    id: string
    studentFirstName: string
    studentLastName: string
    dateOfBirth: string
  } | null
}

export interface GuardianDto {
  id: string
  guardianFirstName: string
  guardianLastName: string
  phoneNumber: string
  guardianStreetAddress: string
  guardianCity: string
  guardianState: string
  guardianZIP: string
  createdAt: string
  students: GuardianLinkDto[]
}

/** GET /api/students/:id/guardians item. */
export interface GuardianForStudentDto {
  id: string
  guardianFirstName: string
  guardianLastName: string
  phoneNumber: string
  guardianStreetAddress: string
  guardianCity: string
  guardianState: string
  guardianZIP: string
  relationshipToStudent: string
  authorizedToPickUp: boolean
}

/** GET /api/guardians item (the "add guardian to student" picker). */
export interface GuardianSummaryDto {
  id: string
  guardianFirstName: string
  guardianLastName: string
  studentIds: string[]
}

/** The 7 guardian personal fields. */
export interface GuardianInput {
  guardianFirstName: string
  guardianLastName: string
  phoneNumber: string
  guardianStreetAddress: string
  guardianCity: string
  guardianState: string
  guardianZIP: string
}

/** Body for POST /api/students/:studentId/guardians (exactly one of guardianId/guardian). */
export interface AddGuardianToStudentBody {
  guardianId?: string
  guardian?: GuardianInput
  relationshipToStudent: string
  authorizedToPickUp: boolean
}

/** Body for PATCH /api/guardians/:id (7 fields full replace + optional link edits). */
export interface UpdateGuardianBody extends GuardianInput {
  links?: {
    studentId: string
    relationshipToStudent: string
    authorizedToPickUp: boolean
  }[]
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  infantsInRooms: number
  toddlersInRooms: number
  preschoolersInRooms: number
  activeStudents: number
  inactiveStudents: number
}

export interface AdminDashboardDto {
  role: 'admin' | 'teacher'
  stats: DashboardStats
  classrooms: ClassroomWithCountDto[]
}

export interface ParentDashboardDto {
  role: 'parent'
  students: MyStudentsDto
}

export type DashboardDto = AdminDashboardDto | ParentDashboardDto
