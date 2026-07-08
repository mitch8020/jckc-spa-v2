import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Document as MongoDocument, UpdateFilter } from 'mongodb';
import { Model, QueryFilter, Types } from 'mongoose';
import { toPopulatedClassroomDto } from '../../common/dto/classroom.dto';
import type { ClassroomLike } from '../../common/dto/classroom.dto';
import { toGuardianDto } from '../../common/dto/guardian.dto';
import type {
  GuardianDto,
  GuardianForStudentDto,
} from '../../common/dto/guardian.dto';
import { toStudentDto } from '../../common/dto/student.dto';
import type { MyStudentsDto, StudentDto } from '../../common/dto/student.dto';
import { CI_COLLATION } from '../../common/utils/collation';
import { escapeRegex } from '../../common/utils/escape-regex';
import { buildPagination, parsePage } from '../../common/utils/pagination';
import type { Paginated } from '../../common/utils/pagination';
import {
  Guardian,
  GuardianDocument,
} from '../../database/schemas/guardian.schema';
import type { GuardianStudentLink } from '../../database/schemas/guardian.schema';
import {
  Student,
  StudentDocument,
} from '../../database/schemas/student.schema';
import type { SessionUser } from '../auth/session-user.type';
import type { AddGuardianToStudentDto } from './dto/add-guardian-to-student.dto';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';

/** Strict 24-hex ObjectId check (malformed route/body ids -> 404). */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** The 7 legacy student fields written by create/update. */
const STUDENT_FIELDS = [
  'studentFirstName',
  'studentLastName',
  'dateOfBirth',
  'studentStreetAddress',
  'studentCity',
  'studentState',
  'studentZIP',
] as const;

type StudentStatus = 'active' | 'inactive' | 'all';

@Injectable()
export class StudentsService {
  private readonly studentModel: Model<StudentDocument>;
  private readonly guardianModel: Model<GuardianDocument>;

  constructor(
    @InjectModel(Student.name) studentModel: Model<StudentDocument>,
    @InjectModel(Guardian.name) guardianModel: Model<GuardianDocument>,
  ) {
    this.studentModel = studentModel;
    this.guardianModel = guardianModel;
  }

  /**
   * Admin/teacher list (students.md §3-R4c semantics, Q6/Q7 fixed):
   * page size 10 with the legacy clamp math; `status` defaults to
   * 'active' (anything but the exact strings 'inactive'/'all' -> active);
   * `order` is descending only for the exact string 'desc'; search is
   * trimmed + regex-escaped and matches EITHER name case-insensitively.
   */
  async list(
    pageRaw?: string,
    statusRaw?: string,
    searchRaw?: string,
    orderRaw?: string,
  ): Promise<Paginated<StudentDto>> {
    const page = parsePage(pageRaw);
    const status: StudentStatus =
      statusRaw === 'inactive' || statusRaw === 'all' ? statusRaw : 'active';
    const direction: 1 | -1 = orderRaw === 'desc' ? -1 : 1;
    const search = (searchRaw ?? '').trim();

    const filter: QueryFilter<Student> = {};
    if (status === 'active') {
      // Excludes both null and missing-field docs (legacy semantics).
      filter.classroom = { $ne: null };
    } else if (status === 'inactive') {
      // Matches null AND missing-field docs (legacy semantics).
      filter.classroom = null;
    }
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = [
        { studentFirstName: { $regex: pattern, $options: 'i' } },
        { studentLastName: { $regex: pattern, $options: 'i' } },
      ];
    }

    const totalCount = await this.studentModel.countDocuments(filter).exec();
    const { skip, limit, pagination } = buildPagination(totalCount, page);
    const students = await this.studentModel
      .find(filter)
      .collation(CI_COLLATION)
      .sort({
        studentFirstName: direction,
        studentLastName: direction,
        _id: direction,
      })
      .skip(skip)
      .limit(limit)
      .populate<{ classroom: ClassroomLike | null }>('classroom')
      .exec();

    return {
      items: students.map((student) =>
        toStudentDto(student, toPopulatedClassroomDto(student.classroom)),
      ),
      pagination,
    };
  }

  /**
   * Parent's own students (DESIGN.md decision 2, fixes legacy Q1):
   * students the parent created OR students linked via a guardian whose
   * `userId` is the parent, split into registered (approved — a MISSING
   * approval field counts as approved) and pending sections.
   */
  async listMine(userId: string): Promise<MyStudentsDto> {
    const guardians = await this.guardianModel
      .find({ userId }, { students: 1 })
      .exec();

    const linkedIds = new Set<string>();
    for (const guardian of guardians) {
      for (const link of guardian.students ?? []) {
        if (link.student == null) {
          continue;
        }
        const idString = String(link.student);
        if (OBJECT_ID_PATTERN.test(idString)) {
          linkedIds.add(idString);
        }
      }
    }

    const conditions: QueryFilter<Student>[] = [{ createdByUserId: userId }];
    if (linkedIds.size > 0) {
      conditions.push({ _id: { $in: [...linkedIds] } });
    }

    const students = await this.studentModel
      .find({ $or: conditions })
      .collation(CI_COLLATION)
      .sort({ studentFirstName: 1, studentLastName: 1, _id: 1 })
      .populate<{ classroom: ClassroomLike | null }>('classroom')
      .exec();

    const registered: StudentDto[] = [];
    const pending: StudentDto[] = [];
    for (const student of students) {
      const dto = toStudentDto(
        student,
        toPopulatedClassroomDto(student.classroom),
      );
      if (dto.applicationApprovalStatus) {
        registered.push(dto);
      } else {
        pending.push(dto);
      }
    }
    return { registered, pending };
  }

  async getById(id: string): Promise<StudentDto> {
    const objectId = this.castStudentId(id);
    const student = await this.studentModel
      .findById(objectId)
      .populate<{ classroom: ClassroomLike | null }>('classroom')
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return toStudentDto(student, toPopulatedClassroomDto(student.classroom));
  }

  /**
   * Guardians linked to a student, first-name ascending case-insensitive.
   * The join is done in JS (like legacy) so link ids stored as STRINGS by
   * the 2026-03-15 import match alongside proper ObjectIds.
   */
  async listGuardiansOfStudent(id: string): Promise<GuardianForStudentDto[]> {
    const objectId = this.castStudentId(id);
    const idString = objectId.toHexString();
    const exists = await this.studentModel.exists({ _id: objectId }).exec();
    if (!exists) {
      throw new NotFoundException('Student not found');
    }

    const guardians = await this.guardianModel
      .find()
      .collation(CI_COLLATION)
      .sort({ guardianFirstName: 1 })
      .exec();

    const result: GuardianForStudentDto[] = [];
    for (const guardian of guardians) {
      const link = (guardian.students ?? []).find(
        (entry) => entry.student != null && String(entry.student) === idString,
      );
      if (!link) {
        continue;
      }
      result.push({
        id: guardian._id.toString(),
        guardianFirstName: guardian.guardianFirstName,
        guardianLastName: guardian.guardianLastName,
        phoneNumber: guardian.phoneNumber,
        guardianStreetAddress: guardian.guardianStreetAddress,
        guardianCity: guardian.guardianCity,
        guardianState: guardian.guardianState,
        guardianZIP: guardian.guardianZIP,
        relationshipToStudent: link.relationshipToStudent ?? '',
        authorizedToPickUp: link.authorizedToPickUp === true,
      });
    }
    return result;
  }

  /**
   * Creates a student from the 7 legacy fields, optionally with the initial
   * parent/guardian record collected by the new-student application. Parents
   * create a PENDING application (`applicationApprovalStatus: false` +
   * `createdByUserId`); admins create approved students (DESIGN.md decision 2).
   * No classroom is assigned, so new students start "Inactive" (legacy parity).
   */
  async create(user: SessionUser, dto: CreateStudentDto): Promise<StudentDto> {
    const hasGuardianId = dto.guardianId !== undefined;
    const hasNewGuardian = dto.guardian !== undefined;
    const hasGuardianInfo =
      hasGuardianId ||
      hasNewGuardian ||
      dto.relationshipToStudent !== undefined ||
      dto.authorizedToPickUp !== undefined;

    if (hasGuardianInfo && hasGuardianId === hasNewGuardian) {
      throw new BadRequestException(
        'Provide exactly one of guardianId or guardian',
      );
    }
    if (
      hasGuardianInfo &&
      (dto.relationshipToStudent === undefined ||
        dto.authorizedToPickUp === undefined)
    ) {
      throw new BadRequestException(
        'guardian link fields must be provided together',
      );
    }
    if (hasGuardianId && user.role !== 'admin') {
      throw new ForbiddenException(
        'Only admins can link existing guardians while creating a student',
      );
    }

    let existingGuardian: GuardianDocument | null = null;
    if (dto.guardianId !== undefined) {
      if (!OBJECT_ID_PATTERN.test(dto.guardianId)) {
        throw new NotFoundException('Guardian not found');
      }
      existingGuardian = await this.guardianModel
        .findById(dto.guardianId)
        .exec();
      if (!existingGuardian) {
        throw new NotFoundException('Guardian not found');
      }
    }

    const created = await this.studentModel.create({
      studentFirstName: dto.studentFirstName,
      studentLastName: dto.studentLastName,
      dateOfBirth: dto.dateOfBirth,
      studentStreetAddress: dto.studentStreetAddress,
      studentCity: dto.studentCity,
      studentState: dto.studentState,
      studentZIP: dto.studentZIP,
      ...(user.role === 'admin'
        ? { applicationApprovalStatus: true }
        : { applicationApprovalStatus: false, createdByUserId: user.id }),
    });

    if (hasGuardianInfo) {
      const link: GuardianStudentLink = {
        student: created._id,
        relationshipToStudent: dto.relationshipToStudent,
        authorizedToPickUp: dto.authorizedToPickUp,
      };
      if (existingGuardian) {
        existingGuardian.students ??= [];
        existingGuardian.students.push(link);
        await existingGuardian.save();
        return toStudentDto(
          created,
          toPopulatedClassroomDto(created.classroom),
        );
      }

      await this.guardianModel.create({
        guardianFirstName: dto.guardian!.guardianFirstName,
        guardianLastName: dto.guardian!.guardianLastName,
        phoneNumber: dto.guardian!.phoneNumber,
        guardianStreetAddress: dto.guardian!.guardianStreetAddress,
        guardianCity: dto.guardian!.guardianCity,
        guardianState: dto.guardian!.guardianState,
        guardianZIP: dto.guardian!.guardianZIP,
        students: [link],
        ...(user.role === 'parent' ? { userId: user.id } : {}),
      });
    }

    return toStudentDto(created, toPopulatedClassroomDto(created.classroom));
  }

  /** PATCH: only the submitted subset of fields is written ($set). */
  async update(id: string, dto: UpdateStudentDto): Promise<StudentDto> {
    const objectId = this.castStudentId(id);

    const set: Record<string, unknown> = {};
    for (const field of STUDENT_FIELDS) {
      const value = dto[field];
      if (value !== undefined) {
        set[field] = value;
      }
    }
    if (dto.applicationApprovalStatus !== undefined) {
      set.applicationApprovalStatus = dto.applicationApprovalStatus;
    }
    if (Object.keys(set).length === 0) {
      return this.getById(id);
    }

    const updated = await this.studentModel
      .findByIdAndUpdate(objectId, { $set: set }, { returnDocument: 'after' })
      .populate<{ classroom: ClassroomLike | null }>('classroom')
      .exec();
    if (!updated) {
      throw new NotFoundException('Student not found');
    }
    return toStudentDto(updated, toPopulatedClassroomDto(updated.classroom));
  }

  /**
   * DELETE with the guardian-link cascade (fixes legacy Q8): 404 for
   * unknown ids, then `$pull`s this student's links from every guardian.
   * Runs on the NATIVE collection because mongoose would cast the string
   * id form to an ObjectId — legacy imports stored some `students[].student`
   * values as plain STRINGS, and both forms must be pulled.
   */
  async remove(id: string): Promise<void> {
    const objectId = this.castStudentId(id);
    const deleted = await this.studentModel.findByIdAndDelete(objectId).exec();
    if (!deleted) {
      throw new NotFoundException('Student not found');
    }

    const idForms: (Types.ObjectId | string)[] = [
      objectId,
      objectId.toHexString(),
    ];
    // Cast: the driver's PullOperator<Document> typing rejects dotted/
    // mixed-type conditions that MongoDB itself accepts.
    const pullLinks = {
      $pull: { students: { student: { $in: idForms } } },
    } as unknown as UpdateFilter<MongoDocument>;
    await this.guardianModel.collection.updateMany(
      { 'students.student': { $in: idForms } },
      pullLinks,
    );
  }

  /**
   * POST /api/students/:studentId/guardians — link an existing guardian
   * or create a new one with this initial link (guardians only exist in
   * the context of a student — guardians.md §6.1). Duplicate links are
   * rejected with 409 (fixes legacy Q3); `authorizedToPickUp` honors the
   * submitted value (fixes legacy Q2).
   */
  async addGuardianToStudent(
    studentId: string,
    dto: AddGuardianToStudentDto,
  ): Promise<GuardianDto> {
    const hasGuardianId = dto.guardianId !== undefined;
    const hasNewGuardian = dto.guardian !== undefined;
    if (hasGuardianId === hasNewGuardian) {
      throw new BadRequestException(
        'Provide exactly one of guardianId or guardian',
      );
    }

    const objectId = this.castStudentId(studentId);
    const idString = objectId.toHexString();
    const student = await this.studentModel.findById(objectId).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const link: GuardianStudentLink = {
      student: student._id,
      relationshipToStudent: dto.relationshipToStudent,
      authorizedToPickUp: dto.authorizedToPickUp,
    };

    if (dto.guardianId !== undefined) {
      if (!OBJECT_ID_PATTERN.test(dto.guardianId)) {
        throw new NotFoundException('Guardian not found');
      }
      const guardian = await this.guardianModel.findById(dto.guardianId).exec();
      if (!guardian) {
        throw new NotFoundException('Guardian not found');
      }
      guardian.students ??= [];
      const alreadyLinked = guardian.students.some(
        (entry) => entry.student != null && String(entry.student) === idString,
      );
      if (alreadyLinked) {
        throw new ConflictException(
          'Guardian is already linked to this student',
        );
      }
      guardian.students.push(link);
      await guardian.save();
      return toGuardianDto(this.studentModel, guardian);
    }

    const created = await this.guardianModel.create({
      guardianFirstName: dto.guardian!.guardianFirstName,
      guardianLastName: dto.guardian!.guardianLastName,
      phoneNumber: dto.guardian!.phoneNumber,
      guardianStreetAddress: dto.guardian!.guardianStreetAddress,
      guardianCity: dto.guardian!.guardianCity,
      guardianState: dto.guardian!.guardianState,
      guardianZIP: dto.guardian!.guardianZIP,
      students: [link],
    });
    return toGuardianDto(this.studentModel, created);
  }

  /** Malformed ObjectId route param -> 404 (API-CONTRACT.md conventions). */
  private castStudentId(id: string): Types.ObjectId {
    if (!OBJECT_ID_PATTERN.test(id)) {
      throw new NotFoundException('Student not found');
    }
    return new Types.ObjectId(id);
  }
}
