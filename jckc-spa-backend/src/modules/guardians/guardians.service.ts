import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { Collection } from 'mongodb';
import {
  findStudentsForLinks,
  toGuardianDto,
} from '../../common/dto/guardian.dto';
import type {
  GuardianDto,
  GuardianLiteDto,
} from '../../common/dto/guardian.dto';
import { CI_COLLATION } from '../../common/utils/collation';
import {
  Guardian,
  GuardianDocument,
} from '../../database/schemas/guardian.schema';
import {
  Student,
  StudentDocument,
} from '../../database/schemas/student.schema';
import type { UpdateGuardianDto } from './dto/update-guardian.dto';

/**
 * Raw (lean) shapes tolerant of legacy data: the legacy `students` array
 * was schemaless, and the 2026-03-15 import stored `student` ids as
 * plain STRINGS (scripts/normalize-guardian-links.ts casts them; until
 * run, every id comparison must String()-normalize both sides). Reads
 * and the students-array write deliberately bypass mongoose hydration/
 * casting so such documents round-trip byte-for-byte. Serialization to
 * the wire shape lives in common/dto/guardian.dto.
 * (Type aliases, not interfaces, so they satisfy the mongodb driver's
 * `Record<string, any>`-constrained filter/update generics.)
 */
type RawGuardianLink = {
  student?: Types.ObjectId | string | null;
  relationshipToStudent?: string;
  authorizedToPickUp?: boolean;
};

type RawGuardian = {
  _id: Types.ObjectId;
  guardianFirstName?: string;
  guardianLastName?: string;
  phoneNumber?: string;
  guardianStreetAddress?: string;
  guardianCity?: string;
  guardianState?: string;
  guardianZIP?: string;
  students?: RawGuardianLink[];
  createdAt?: Date;
};

@Injectable()
export class GuardiansService {
  constructor(
    @InjectModel(Guardian.name)
    private readonly guardianModel: Model<GuardianDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  /**
   * GET /api/guardians — lite list for the "add guardian to student"
   * picker, sorted by first name ascending case-insensitively (fixes the
   * legacy byte-order sort, Q10), last name then _id as tiebreakers.
   */
  async list(): Promise<GuardianLiteDto[]> {
    const guardians = await this.guardianModel
      .find({}, { guardianFirstName: 1, guardianLastName: 1, students: 1 })
      .collation(CI_COLLATION)
      .sort({ guardianFirstName: 1, guardianLastName: 1, _id: 1 })
      .lean<RawGuardian[]>()
      .exec();

    return guardians.map((guardian) => ({
      id: guardian._id.toString(),
      guardianFirstName: guardian.guardianFirstName ?? '',
      guardianLastName: guardian.guardianLastName ?? '',
      studentIds: (guardian.students ?? [])
        .filter((link) => link.student != null)
        .map((link) => String(link.student)),
    }));
  }

  /**
   * GET /api/guardians/:id — full GuardianDto with links resolved to
   * student snippets; dangling links surface as `student: null`.
   */
  async findOne(id: string): Promise<GuardianDto> {
    const guardian = await this.findRawGuardian(id);
    return toGuardianDto(this.studentModel, guardian);
  }

  /**
   * PATCH /api/guardians/:id — full replace of the 7 personal fields
   * (legacy R5 parity). Optional `links[]` updates relationship/pickup
   * ONLY on links whose student still exists; dangling links are
   * preserved verbatim and links can never be added or removed here.
   */
  async update(id: string, dto: UpdateGuardianDto): Promise<GuardianDto> {
    const guardian = await this.findRawGuardian(id);

    const set: Partial<RawGuardian> = {
      guardianFirstName: dto.guardianFirstName,
      guardianLastName: dto.guardianLastName,
      phoneNumber: dto.phoneNumber,
      guardianStreetAddress: dto.guardianStreetAddress,
      guardianCity: dto.guardianCity,
      guardianState: dto.guardianState,
      guardianZIP: dto.guardianZIP,
    };

    const links = guardian.students ?? [];
    if (dto.links && dto.links.length > 0 && links.length > 0) {
      const existing = await findStudentsForLinks(this.studentModel, links);
      const editableIds = new Set(
        existing.map((student) => student._id.toString()),
      );
      const patchByStudentId = new Map(
        dto.links.map((link) => [link.studentId, link]),
      );

      let changed = false;
      const rebuilt = links.map((link) => {
        const key = link.student == null ? '' : String(link.student);
        if (!editableIds.has(key)) {
          // Dangling link — preserved verbatim (legacy R5 parity).
          return link;
        }
        const patch = patchByStudentId.get(key);
        if (!patch) {
          return link;
        }
        changed = true;
        return {
          ...link,
          relationshipToStudent: patch.relationshipToStudent,
          authorizedToPickUp: patch.authorizedToPickUp,
        };
      });
      if (changed) {
        set.students = rebuilt;
      }
    }

    // Native-driver write: a mongoose `$set` would re-cast every link,
    // coercing legacy string-stored student ids to ObjectIds (and
    // throwing on non-castable dangling ids). The contract requires
    // dangling links preserved verbatim, so schema casting is bypassed.
    const result = await this.rawGuardians.updateOne(
      { _id: guardian._id },
      { $set: set },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Guardian not found');
    }
    return this.findOne(id);
  }

  /** DELETE /api/guardians/:id → 204; 404 on malformed/unknown id. */
  async remove(id: string): Promise<void> {
    const objectId = this.castId(id, 'Guardian not found');
    const result = await this.guardianModel.deleteOne({ _id: objectId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Guardian not found');
    }
  }

  /**
   * DELETE /api/guardians/:id/students/:studentId — removes one
   * guardian↔student link → 204; 404 if the guardian or link is absent.
   */
  async removeLink(guardianId: string, studentId: string): Promise<void> {
    const guardianObjectId = this.castId(guardianId, 'Guardian not found');
    if (!isValidObjectId(studentId)) {
      throw new NotFoundException('Guardian link not found');
    }

    // Native-driver $pull so the $in keeps BOTH storage forms: a
    // mongoose update would cast the string arm to an ObjectId and
    // legacy string-stored links would never match.
    const result = await this.rawGuardians.updateOne(
      { _id: guardianObjectId },
      {
        $pull: {
          students: {
            student: { $in: [studentId, new Types.ObjectId(studentId)] },
          },
        },
      },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Guardian not found');
    }
    if (result.modifiedCount === 0) {
      throw new NotFoundException('Guardian link not found');
    }
  }

  /**
   * The guardians collection through the NATIVE driver, typed against
   * the raw legacy-tolerant shape. Writes through it skip mongoose
   * schema casting — required to round-trip string-stored/dangling link
   * ids byte-for-byte.
   */
  private get rawGuardians(): Collection<RawGuardian> {
    return this.guardianModel.collection as unknown as Collection<RawGuardian>;
  }

  /** Loads a guardian lean; 404 on malformed or unknown id. */
  private async findRawGuardian(id: string): Promise<RawGuardian> {
    const objectId = this.castId(id, 'Guardian not found');
    const guardian = await this.guardianModel
      .findById(objectId)
      .lean<RawGuardian>()
      .exec();
    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }
    return guardian;
  }

  private castId(id: string, notFoundMessage: string): Types.ObjectId {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(notFoundMessage);
    }
    return new Types.ObjectId(id);
  }
}
