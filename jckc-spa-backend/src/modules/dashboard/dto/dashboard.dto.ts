import type { ClassroomWithCountDto } from '../../../common/dto/classroom.dto';
import type { MyStudentsDto } from '../../../common/dto/student.dto';

/**
 * Admin/teacher stat block (auth-dashboards.md §4.6): the three
 * "in rooms" counts group students by their CLASSROOM's ageGroup (not
 * the student's own field — legacy semantics, ledger #20); active =
 * assigned to any classroom, inactive = unassigned (ledger #21).
 */
export interface DashboardStatsDto {
  infantsInRooms: number;
  toddlersInRooms: number;
  preschoolersInRooms: number;
  activeStudents: number;
  inactiveStudents: number;
}

export interface StaffDashboardDto {
  role: 'admin' | 'teacher';
  stats: DashboardStatsDto;
  classrooms: ClassroomWithCountDto[];
}

/** Same linkage rule + registered/pending split as GET /api/students/mine. */
export interface ParentDashboardDto {
  role: 'parent';
  students: MyStudentsDto;
}

export type DashboardDto = StaffDashboardDto | ParentDashboardDto;
