import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter, Types } from 'mongoose';
import { toPopulatedClassroomDto } from '../../common/dto/classroom.dto';
import type { ClassroomWithCountDto } from '../../common/dto/classroom.dto';
import { STUDENT_SORT, toStudentDto } from '../../common/dto/student.dto';
import type { MyStudentsDto, StudentDto } from '../../common/dto/student.dto';
import type { AgeGroup } from '../../common/utils/age';
import { CI_COLLATION } from '../../common/utils/collation';
import type { ClassroomDocument } from '../../database/schemas/classroom.schema';
import {
  Guardian,
  GuardianDocument,
} from '../../database/schemas/guardian.schema';
import {
  Student,
  StudentDocument,
} from '../../database/schemas/student.schema';
import type { SessionUser } from '../auth/session-user.type';
import { ClassroomsService } from '../classrooms/classrooms.service';
import type { DashboardDto, StaffDashboardDto } from './dto/dashboard.dto';

/** Legacy "in rooms" formula: sum per-classroom counts by the CLASSROOM's ageGroup. */
function sumStudentCounts(
  classrooms: ClassroomWithCountDto[],
  ageGroup: AgeGroup,
): number {
  return classrooms
    .filter((classroom) => classroom.ageGroup === ageGroup)
    .reduce((total, classroom) => total + classroom.studentCount, 0);
}

@Injectable()
export class DashboardService {
  private readonly classroomsService: ClassroomsService;
  private readonly studentModel: Model<StudentDocument>;
  private readonly guardianModel: Model<GuardianDocument>;

  constructor(
    classroomsService: ClassroomsService,
    @InjectModel(Student.name) studentModel: Model<StudentDocument>,
    @InjectModel(Guardian.name) guardianModel: Model<GuardianDocument>,
  ) {
    this.classroomsService = classroomsService;
    this.studentModel = studentModel;
    this.guardianModel = guardianModel;
  }

  /**
   * GET /api/dashboard — role-aware content per API-CONTRACT.md.
   * Unregistered users get 403 `REGISTRATION_REQUIRED` (the frontend
   * redirects to /register); a registered user with an unknown role gets
   * a plain 403 (fixes the legacy hang — auth-dashboards.md ledger #11).
   */
  async getDashboard(user: SessionUser): Promise<DashboardDto> {
    if (!user.registrationStatus) {
      throw new ForbiddenException('REGISTRATION_REQUIRED');
    }
    if (user.role === 'admin' || user.role === 'teacher') {
      return this.getStaffDashboard(user.role);
    }
    if (user.role === 'parent') {
      return { role: 'parent', students: await this.getMyStudents(user.id) };
    }
    throw new ForbiddenException();
  }

  /**
   * Stats computed server-side (never by shipping all students —
   * auth-dashboards.md ledger #22): the in-rooms numbers derive from the
   * classrooms-with-counts aggregation (so a student pointing at a
   * DELETED classroom counts as active but in no room, exactly like the
   * legacy template math), active/inactive from two counts.
   */
  private async getStaffDashboard(
    role: 'admin' | 'teacher',
  ): Promise<StaffDashboardDto> {
    const [classrooms, activeStudents, inactiveStudents] = await Promise.all([
      this.classroomsService.list(),
      this.studentModel.countDocuments({ classroom: { $ne: null } }).exec(),
      this.studentModel.countDocuments({ classroom: null }).exec(),
    ]);
    return {
      role,
      stats: {
        infantsInRooms: sumStudentCounts(classrooms, 'infant'),
        toddlersInRooms: sumStudentCounts(classrooms, 'toddler'),
        preschoolersInRooms: sumStudentCounts(classrooms, 'preschool'),
        activeStudents,
        inactiveStudents,
      },
      classrooms,
    };
  }

  /**
   * Same linkage rule as GET /api/students/mine (DESIGN.md decision 2),
   * implemented independently here: students created by this user OR
   * linked via a guardian carrying this user's id. Split registered/
   * pending on applicationApprovalStatus (missing = approved). Sorted
   * first-name asc, classroom populated for the dashboard cards.
   */
  private async getMyStudents(userId: string): Promise<MyStudentsDto> {
    const guardians = await this.guardianModel.find({ userId }).exec();
    const linkedIds = new Set<string>();
    for (const guardian of guardians) {
      for (const link of guardian.students) {
        // Tolerate dangling/malformed legacy links (guardians.md parity).
        if (link.student && isValidObjectId(link.student)) {
          linkedIds.add(link.student.toString());
        }
      }
    }

    const conditions: QueryFilter<Student>[] = [{ createdByUserId: userId }];
    if (linkedIds.size > 0) {
      conditions.push({
        _id: { $in: [...linkedIds].map((value) => new Types.ObjectId(value)) },
      });
    }

    const students = await this.studentModel
      .find({ $or: conditions })
      .collation(CI_COLLATION)
      .sort(STUDENT_SORT)
      .populate<{ classroom: ClassroomDocument | null }>('classroom')
      .exec();

    const registered: StudentDto[] = [];
    const pending: StudentDto[] = [];
    for (const student of students) {
      const dto = toStudentDto(
        student,
        toPopulatedClassroomDto(student.classroom),
      );
      (dto.applicationApprovalStatus ? registered : pending).push(dto);
    }
    return { registered, pending };
  }
}
