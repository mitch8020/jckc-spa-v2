import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter, Types } from 'mongoose';
import { toClassroomDto } from '../../common/dto/classroom.dto';
import type {
  ClassroomDto,
  ClassroomWithCountDto,
} from '../../common/dto/classroom.dto';
import { STUDENT_SORT, toStudentDto } from '../../common/dto/student.dto';
import type { StudentDto } from '../../common/dto/student.dto';
import { calcAgeGroup, sortClassrooms } from '../../common/utils/age';
import { CI_COLLATION } from '../../common/utils/collation';
import { escapeRegex } from '../../common/utils/escape-regex';
import { buildPagination, parsePage } from '../../common/utils/pagination';
import type { Paginated } from '../../common/utils/pagination';
import {
  Classroom,
  ClassroomDocument,
} from '../../database/schemas/classroom.schema';
import {
  Student,
  StudentDocument,
} from '../../database/schemas/student.schema';
import type { UpsertClassroomDto } from './dto/upsert-classroom.dto';

/** The four independent UI-state params of the dual-pane roster editor. */
export interface RosterQuery {
  addPage?: string;
  addSearch?: string;
  removePage?: string;
  removeSearch?: string;
}

export interface ClassroomDetailsDto {
  classroom: ClassroomDto;
  students: StudentDto[];
}

export interface RosterDto {
  add: Paginated<StudentDto>;
  remove: Paginated<StudentDto>;
}

export interface AssignResultDto {
  added: number;
  notFound: string[];
}

export interface RemoveResultDto {
  removed: number;
  skipped: string[];
}

@Injectable()
export class ClassroomsService {
  private readonly classroomModel: Model<ClassroomDocument>;
  private readonly studentModel: Model<StudentDocument>;

  constructor(
    @InjectModel(Classroom.name) classroomModel: Model<ClassroomDocument>,
    @InjectModel(Student.name) studentModel: Model<StudentDocument>,
  ) {
    this.classroomModel = classroomModel;
    this.studentModel = studentModel;
  }

  /**
   * GET /api/classrooms — every classroom with its student count. Counts
   * come from ONE aggregation (never from loading all students —
   * classrooms.md ledger #12); ordering is ageGroup rank (infant,
   * toddler, preschool) then classroomName A→Z (ledger #3 fix).
   */
  async list(): Promise<ClassroomWithCountDto[]> {
    const [classrooms, counts] = await Promise.all([
      this.classroomModel.find().exec(),
      this.studentModel
        .aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { classroom: { $ne: null } } },
          { $group: { _id: '$classroom', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);
    const countByClassroomId = new Map<string, number>(
      counts.map((entry) => [String(entry._id), entry.count]),
    );
    return sortClassrooms(classrooms).map((classroom) => ({
      ...toClassroomDto(classroom),
      studentCount: countByClassroomId.get(classroom._id.toString()) ?? 0,
    }));
  }

  /**
   * GET /api/classrooms/:id — classroom info plus ALL of its students
   * (no pagination, legacy parity), first-name ascending.
   */
  async getDetails(id: string): Promise<ClassroomDetailsDto> {
    const classroom = await this.findClassroomOr404(id);
    const classroomDto = toClassroomDto(classroom);
    const students = await this.studentModel
      .find({ classroom: classroom._id })
      .collation(CI_COLLATION)
      .sort(STUDENT_SORT)
      .exec();
    return {
      classroom: classroomDto,
      students: students.map((student) => toStudentDto(student, classroomDto)),
    };
  }

  /** POST /api/classrooms — all three fields required (DTO-validated). */
  async create(dto: UpsertClassroomDto): Promise<ClassroomDto> {
    const classroom = await this.classroomModel.create({
      classroomName: dto.classroomName,
      ageGroup: dto.ageGroup,
      teacherName: dto.teacherName,
    });
    return toClassroomDto(classroom);
  }

  /**
   * PATCH /api/classrooms/:id — same three fields, all required.
   * `runValidators` restores the update-time schema validation the
   * legacy app skipped. Changing ageGroup does NOT cascade to assigned
   * students (legacy parity — classrooms.md ledger #5).
   */
  async update(id: string, dto: UpsertClassroomDto): Promise<ClassroomDto> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Classroom not found');
    }
    const updated = await this.classroomModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            classroomName: dto.classroomName,
            ageGroup: dto.ageGroup,
            teacherName: dto.teacherName,
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Classroom not found');
    }
    return toClassroomDto(updated);
  }

  /**
   * DELETE /api/classrooms/:id — new capability (no legacy route).
   * Unassigns the classroom's students (`classroom: null`) so no
   * dangling refs are left behind (DESIGN.md decision 6).
   */
  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Classroom not found');
    }
    const classroom = await this.classroomModel.findByIdAndDelete(id).exec();
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    await this.studentModel
      .updateMany({ classroom: classroom._id }, { $set: { classroom: null } })
      .exec();
  }

  /**
   * GET /api/classrooms/:id/roster — the dual-pane Add/Remove editor.
   * add = unassigned students (classroom null OR missing), remove = this
   * classroom's students; each pane has independent page + search
   * (trimmed, regex-escaped, case-insensitive) and its own clamped
   * pagination (page size 10).
   */
  async getRoster(id: string, query: RosterQuery): Promise<RosterDto> {
    const classroom = await this.findClassroomOr404(id);
    const classroomDto = toClassroomDto(classroom);
    const add = await this.paginatePane(
      // `null` matches both explicit null and missing field — intentional
      // legacy behavior (classrooms.md §3.7).
      { classroom: null },
      query.addPage,
      query.addSearch,
      null,
    );
    const remove = await this.paginatePane(
      { classroom: classroom._id },
      query.removePage,
      query.removeSearch,
      classroomDto,
    );
    return { add, remove };
  }

  /**
   * POST /api/classrooms/:id/students — assign each EXISTING student:
   * sets `classroom` and recomputes `ageGroup` from DOB at assignment
   * time with the exact legacy 11/30-month thresholds (classrooms.md
   * §3.8). Unknown ids are reported in `notFound`, not fatal. A student
   * already in another classroom is silently moved (legacy parity).
   */
  async assignStudents(
    id: string,
    studentIds: string[],
    now: Date = new Date(),
  ): Promise<AssignResultDto> {
    const classroom = await this.findClassroomOr404(id);
    const uniqueIds = [...new Set(studentIds)];
    const students = await this.findByIds(uniqueIds);
    const foundIds = new Set(students.map((s) => s._id.toString()));
    const notFound = uniqueIds.filter((value) => !foundIds.has(value));
    if (students.length > 0) {
      await this.studentModel.bulkWrite(
        students.map((student) => ({
          updateOne: {
            filter: { _id: student._id },
            update: {
              $set: {
                classroom: classroom._id,
                ageGroup: calcAgeGroup(student.dateOfBirth, now),
              },
            },
          },
        })),
      );
    }
    return { added: students.length, notFound };
  }

  /**
   * POST /api/classrooms/:id/students/remove — unassigns ONLY students
   * actually in THIS classroom (fixes the legacy global-unassign bug,
   * classrooms.md ledger #7); everything else lands in `skipped`.
   * `ageGroup` is deliberately left stale (legacy parity, ledger #4).
   */
  async removeStudents(
    id: string,
    studentIds: string[],
  ): Promise<RemoveResultDto> {
    const classroom = await this.findClassroomOr404(id);
    const uniqueIds = [...new Set(studentIds)];
    const members = await this.findByIds(uniqueIds, {
      classroom: classroom._id,
    });
    const memberIds = new Set(members.map((m) => m._id.toString()));
    const skipped = uniqueIds.filter((value) => !memberIds.has(value));
    if (members.length > 0) {
      await this.studentModel
        .updateMany(
          {
            _id: { $in: members.map((m) => m._id) },
            classroom: classroom._id,
          },
          { $set: { classroom: null } },
        )
        .exec();
    }
    return { removed: members.length, skipped };
  }

  private async findClassroomOr404(id: string): Promise<ClassroomDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Classroom not found');
    }
    const classroom = await this.classroomModel.findById(id).exec();
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    return classroom;
  }

  /** One roster pane: count → clamp → page slice, serialized. */
  private async paginatePane(
    baseFilter: QueryFilter<Student>,
    pageRaw: string | undefined,
    searchRaw: string | undefined,
    classroom: ClassroomDto | null,
  ): Promise<Paginated<StudentDto>> {
    const filter: QueryFilter<Student> = { ...baseFilter };
    const search = (searchRaw ?? '').trim();
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = [
        { studentFirstName: { $regex: pattern, $options: 'i' } },
        { studentLastName: { $regex: pattern, $options: 'i' } },
      ];
    }
    const totalCount = await this.studentModel.countDocuments(filter).exec();
    const { skip, limit, pagination } = buildPagination(
      totalCount,
      parsePage(pageRaw),
    );
    const students = await this.studentModel
      .find(filter)
      .collation(CI_COLLATION)
      .sort(STUDENT_SORT)
      .skip(skip)
      .limit(limit)
      .exec();
    return {
      items: students.map((student) => toStudentDto(student, classroom)),
      pagination,
    };
  }

  /** Students matching the (already ObjectId-validated) ids, tolerant of stray invalid strings. */
  private async findByIds(
    ids: string[],
    extraFilter: QueryFilter<Student> = {},
  ): Promise<StudentDocument[]> {
    const castable = ids.filter((value) => isValidObjectId(value));
    if (castable.length === 0) {
      return [];
    }
    return this.studentModel
      .find({
        _id: { $in: castable.map((value) => new Types.ObjectId(value)) },
        ...extraFilter,
      })
      .exec();
  }
}
