import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Guardian } from '../../database/schemas/guardian.schema';
import { Student } from '../../database/schemas/student.schema';
import type { UpdateGuardianDto } from './dto/update-guardian.dto';
import { GuardiansService } from './guardians.service';

const GUARDIAN_ID = new Types.ObjectId('64a000000000000000000001');
const STUDENT_A = new Types.ObjectId('64a000000000000000000011');
const STUDENT_B = new Types.ObjectId('64a000000000000000000012');
const DANGLING_ID = new Types.ObjectId('64a000000000000000000013');
const UNLINKED_ID = new Types.ObjectId('64a000000000000000000014');

const PERSONAL_FIELDS = {
  guardianFirstName: 'Dana',
  guardianLastName: 'Smith',
  phoneNumber: '423-926-2221',
  guardianStreetAddress: '408 W Market St',
  guardianCity: 'Johnson City',
  guardianState: 'TN',
  guardianZIP: '37604',
};

function makeGuardianDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: GUARDIAN_ID,
    ...PERSONAL_FIELDS,
    students: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeStudentDoc(id: Types.ObjectId, first: string, last: string) {
  return {
    _id: id,
    studentFirstName: first,
    studentLastName: last,
    dateOfBirth: '2024-01-15',
  };
}

/** Chainable stand-in for a mongoose Query (collation/sort/lean/exec). */
function queryOf(result: unknown) {
  const chain = {
    collation: jest.fn(),
    sort: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  };
  chain.collation.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.lean.mockReturnValue(chain);
  return chain;
}

describe('GuardiansService', () => {
  let service: GuardiansService;
  let guardianModel: {
    find: jest.Mock;
    findById: jest.Mock;
    deleteOne: jest.Mock;
    collection: { updateOne: jest.Mock };
  };
  let studentModel: { find: jest.Mock };

  beforeEach(async () => {
    guardianModel = {
      find: jest.fn(),
      findById: jest.fn(),
      deleteOne: jest.fn(),
      collection: { updateOne: jest.fn() },
    };
    studentModel = { find: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GuardiansService,
        { provide: getModelToken(Guardian.name), useValue: guardianModel },
        { provide: getModelToken(Student.name), useValue: studentModel },
      ],
    }).compile();

    service = moduleRef.get(GuardiansService);
  });

  describe('list', () => {
    it('maps to the lite shape, String()-normalizing ObjectId- and string-stored link ids', async () => {
      guardianModel.find.mockReturnValue(
        queryOf([
          makeGuardianDoc({
            students: [
              { student: STUDENT_A, relationshipToStudent: 'Mother' },
              { student: STUDENT_B.toString(), relationshipToStudent: 'Mom' },
              { relationshipToStudent: 'broken link without id' },
            ],
          }),
        ]),
      );

      await expect(service.list()).resolves.toEqual([
        {
          id: GUARDIAN_ID.toString(),
          guardianFirstName: 'Dana',
          guardianLastName: 'Smith',
          studentIds: [STUDENT_A.toString(), STUDENT_B.toString()],
        },
      ]);
    });

    it('sorts by first name with the case-insensitive collation, last name and _id tiebreakers', async () => {
      const chain = queryOf([]);
      guardianModel.find.mockReturnValue(chain);

      await service.list();

      expect(chain.collation).toHaveBeenCalledWith({
        locale: 'en',
        strength: 2,
      });
      expect(chain.sort).toHaveBeenCalledWith({
        guardianFirstName: 1,
        guardianLastName: 1,
        _id: 1,
      });
    });
  });

  describe('findOne', () => {
    it('throws 404 for a malformed id without querying', async () => {
      await expect(service.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(guardianModel.findById).not.toHaveBeenCalled();
    });

    it('throws 404 when the guardian does not exist', async () => {
      guardianModel.findById.mockReturnValue(queryOf(null));
      await expect(
        service.findOne(GUARDIAN_ID.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves links to student snippets, tolerating dangling and string-stored ids', async () => {
      guardianModel.findById.mockReturnValue(
        queryOf(
          makeGuardianDoc({
            students: [
              {
                student: STUDENT_A,
                relationshipToStudent: 'Mother',
                authorizedToPickUp: true,
              },
              {
                student: DANGLING_ID,
                relationshipToStudent: 'Aunt',
                authorizedToPickUp: true,
              },
              {
                // Legacy 2026-03-15 import: id stored as a STRING.
                student: STUDENT_B.toString(),
                relationshipToStudent: 'Father',
                authorizedToPickUp: false,
              },
              { student: 'not-an-object-id' },
            ],
          }),
        ),
      );
      studentModel.find.mockReturnValue(
        queryOf([
          makeStudentDoc(STUDENT_A, 'Ada', 'Smith'),
          makeStudentDoc(STUDENT_B, 'Ben', 'Smith'),
        ]),
      );

      const dto = await service.findOne(GUARDIAN_ID.toString());

      expect(dto).toMatchObject({
        id: GUARDIAN_ID.toString(),
        ...PERSONAL_FIELDS,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(dto.students).toEqual([
        {
          studentId: STUDENT_A.toString(),
          relationshipToStudent: 'Mother',
          authorizedToPickUp: true,
          student: {
            id: STUDENT_A.toString(),
            studentFirstName: 'Ada',
            studentLastName: 'Smith',
            dateOfBirth: '2024-01-15',
          },
        },
        {
          studentId: DANGLING_ID.toString(),
          relationshipToStudent: 'Aunt',
          authorizedToPickUp: true,
          student: null,
        },
        {
          // String-stored id still resolves (String()-compare join).
          studentId: STUDENT_B.toString(),
          relationshipToStudent: 'Father',
          authorizedToPickUp: false,
          student: {
            id: STUDENT_B.toString(),
            studentFirstName: 'Ben',
            studentLastName: 'Smith',
            dateOfBirth: '2024-01-15',
          },
        },
        {
          studentId: 'not-an-object-id',
          relationshipToStudent: '',
          authorizedToPickUp: false,
          student: null,
        },
      ]);

      // Non-castable ids never reach the $in (it would CastError).
      const [filter] = studentModel.find.mock.calls[0] as [
        { _id: { $in: Types.ObjectId[] } },
      ];
      expect(filter._id.$in.map(String).sort()).toEqual(
        [STUDENT_A, DANGLING_ID, STUDENT_B].map(String).sort(),
      );
    });

    it('returns an empty students array when the legacy doc has none', async () => {
      guardianModel.findById.mockReturnValue(
        queryOf(makeGuardianDoc({ students: undefined })),
      );

      const dto = await service.findOne(GUARDIAN_ID.toString());

      expect(dto.students).toEqual([]);
      expect(studentModel.find).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const baseDto: UpdateGuardianDto = { ...PERSONAL_FIELDS };
    const updateResult = { matchedCount: 1, modifiedCount: 1 };

    it('throws 404 for a malformed id without writing', async () => {
      await expect(service.update('bad', baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(guardianModel.collection.updateOne).not.toHaveBeenCalled();
    });

    it('throws 404 when the guardian does not exist', async () => {
      guardianModel.findById.mockReturnValue(queryOf(null));
      await expect(
        service.update(GUARDIAN_ID.toString(), baseDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('full-replaces the 7 personal fields WITHOUT touching the stored links when no links are submitted', async () => {
      const stored = makeGuardianDoc({
        students: [{ student: DANGLING_ID, relationshipToStudent: 'Aunt' }],
      });
      guardianModel.findById.mockImplementation(() => queryOf(stored));
      guardianModel.collection.updateOne.mockResolvedValue(updateResult);
      studentModel.find.mockImplementation(() => queryOf([]));

      const dto = { ...baseDto, guardianFirstName: 'Renamed' };
      await service.update(GUARDIAN_ID.toString(), dto);

      const [filter, update] = guardianModel.collection.updateOne.mock
        .calls[0] as [
        { _id: Types.ObjectId },
        { $set: Record<string, unknown> },
      ];
      expect(filter).toEqual({ _id: GUARDIAN_ID });
      expect(update.$set).toEqual({
        ...PERSONAL_FIELDS,
        guardianFirstName: 'Renamed',
      });
      expect(update.$set).not.toHaveProperty('students');
    });

    it('updates only existing non-dangling links, preserves dangling links verbatim, and never adds or removes', async () => {
      const objectIdLink = {
        student: STUDENT_A,
        relationshipToStudent: 'Mother',
        authorizedToPickUp: true,
      };
      const danglingLink = {
        student: DANGLING_ID,
        relationshipToStudent: 'Aunt',
        authorizedToPickUp: true,
        legacyExtraField: 'kept as-is',
      };
      // Editable link whose id is string-stored (unmigrated import).
      const stringLink = {
        student: STUDENT_B.toString(),
        relationshipToStudent: 'Father',
        authorizedToPickUp: false,
      };
      const stored = makeGuardianDoc({
        students: [objectIdLink, danglingLink, stringLink],
      });
      guardianModel.findById.mockImplementation(() => queryOf(stored));
      guardianModel.collection.updateOne.mockResolvedValue(updateResult);
      studentModel.find.mockImplementation(() =>
        queryOf([
          makeStudentDoc(STUDENT_A, 'Ada', 'Smith'),
          makeStudentDoc(STUDENT_B, 'Ben', 'Smith'),
        ]),
      );

      await service.update(GUARDIAN_ID.toString(), {
        ...baseDto,
        links: [
          {
            studentId: STUDENT_A.toString(),
            relationshipToStudent: 'Stepmother',
            authorizedToPickUp: false,
          },
          {
            // Targets a DANGLING link — must be ignored.
            studentId: DANGLING_ID.toString(),
            relationshipToStudent: 'Hijacked',
            authorizedToPickUp: false,
          },
          {
            // String-stored link — matched via String()-compare.
            studentId: STUDENT_B.toString(),
            relationshipToStudent: 'Father',
            authorizedToPickUp: true,
          },
          {
            // Not linked at all — cannot ADD a link via PATCH.
            studentId: UNLINKED_ID.toString(),
            relationshipToStudent: 'Uncle',
            authorizedToPickUp: true,
          },
        ],
      });

      const [, update] = guardianModel.collection.updateOne.mock.calls[0] as [
        unknown,
        { $set: { students: unknown[] } },
      ];
      const students = update.$set.students;

      // Never adds or removes: same 3 links, same order.
      expect(students).toHaveLength(3);
      expect(students[0]).toEqual({
        student: STUDENT_A,
        relationshipToStudent: 'Stepmother',
        authorizedToPickUp: false,
      });
      // Dangling link is the SAME object, byte-for-byte untouched.
      expect(students[1]).toBe(danglingLink);
      expect(danglingLink.relationshipToStudent).toBe('Aunt');
      // String-stored id stays a STRING after the update.
      expect(students[2]).toEqual({
        student: STUDENT_B.toString(),
        relationshipToStudent: 'Father',
        authorizedToPickUp: true,
      });
      expect(typeof (students[2] as { student: unknown }).student).toBe(
        'string',
      );
    });

    it('leaves links unmentioned in the body unchanged', async () => {
      const untouched = {
        student: STUDENT_B,
        relationshipToStudent: 'Father',
        authorizedToPickUp: false,
      };
      const stored = makeGuardianDoc({
        students: [
          {
            student: STUDENT_A,
            relationshipToStudent: 'Mother',
            authorizedToPickUp: true,
          },
          untouched,
        ],
      });
      guardianModel.findById.mockImplementation(() => queryOf(stored));
      guardianModel.collection.updateOne.mockResolvedValue(updateResult);
      studentModel.find.mockImplementation(() =>
        queryOf([
          makeStudentDoc(STUDENT_A, 'Ada', 'Smith'),
          makeStudentDoc(STUDENT_B, 'Ben', 'Smith'),
        ]),
      );

      await service.update(GUARDIAN_ID.toString(), {
        ...baseDto,
        links: [
          {
            studentId: STUDENT_A.toString(),
            relationshipToStudent: 'Guardian',
            authorizedToPickUp: true,
          },
        ],
      });

      const [, update] = guardianModel.collection.updateOne.mock.calls[0] as [
        unknown,
        { $set: { students: unknown[] } },
      ];
      expect(update.$set.students).toHaveLength(2);
      expect(update.$set.students[1]).toBe(untouched);
    });

    it('does not rewrite the students array when submitted links match nothing editable', async () => {
      const stored = makeGuardianDoc({
        students: [{ student: DANGLING_ID, relationshipToStudent: 'Aunt' }],
      });
      guardianModel.findById.mockImplementation(() => queryOf(stored));
      guardianModel.collection.updateOne.mockResolvedValue(updateResult);
      studentModel.find.mockImplementation(() => queryOf([]));

      await service.update(GUARDIAN_ID.toString(), {
        ...baseDto,
        links: [
          {
            studentId: DANGLING_ID.toString(),
            relationshipToStudent: 'Hijacked',
            authorizedToPickUp: false,
          },
        ],
      });

      const [, update] = guardianModel.collection.updateOne.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      expect(update.$set).not.toHaveProperty('students');
    });

    it('returns the refreshed GuardianDto', async () => {
      guardianModel.findById
        .mockReturnValueOnce(queryOf(makeGuardianDoc()))
        .mockReturnValueOnce(
          queryOf(makeGuardianDoc({ guardianFirstName: 'Renamed' })),
        );
      guardianModel.collection.updateOne.mockResolvedValue(updateResult);

      const dto = await service.update(GUARDIAN_ID.toString(), {
        ...baseDto,
        guardianFirstName: 'Renamed',
      });

      expect(dto.guardianFirstName).toBe('Renamed');
      expect(dto.id).toBe(GUARDIAN_ID.toString());
    });
  });

  describe('remove', () => {
    it('deletes the guardian', async () => {
      guardianModel.deleteOne.mockReturnValue(queryOf({ deletedCount: 1 }));

      await expect(
        service.remove(GUARDIAN_ID.toString()),
      ).resolves.toBeUndefined();

      const [filter] = guardianModel.deleteOne.mock.calls[0] as [
        { _id: Types.ObjectId },
      ];
      expect(filter._id).toBeInstanceOf(Types.ObjectId);
      expect(filter._id.toString()).toBe(GUARDIAN_ID.toString());
    });

    it('throws 404 for a malformed id without querying', async () => {
      await expect(service.remove('bad')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(guardianModel.deleteOne).not.toHaveBeenCalled();
    });

    it('throws 404 when nothing was deleted', async () => {
      guardianModel.deleteOne.mockReturnValue(queryOf({ deletedCount: 0 }));
      await expect(
        service.remove(GUARDIAN_ID.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeLink', () => {
    it('pulls the link matching BOTH the string and ObjectId storage forms', async () => {
      guardianModel.collection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      await expect(
        service.removeLink(GUARDIAN_ID.toString(), STUDENT_A.toString()),
      ).resolves.toBeUndefined();

      const [filter, update] = guardianModel.collection.updateOne.mock
        .calls[0] as [
        { _id: Types.ObjectId },
        {
          $pull: {
            students: { student: { $in: [string, Types.ObjectId] } };
          };
        },
      ];
      expect(filter._id).toBeInstanceOf(Types.ObjectId);
      expect(filter._id.toString()).toBe(GUARDIAN_ID.toString());

      const inList = update.$pull.students.student.$in;
      expect(inList).toHaveLength(2);
      // String form first (matches unmigrated legacy links)...
      expect(inList[0]).toBe(STUDENT_A.toString());
      // ...and the ObjectId form (matches app-written links).
      expect(inList[1]).toBeInstanceOf(Types.ObjectId);
      expect(inList[1].toString()).toBe(STUDENT_A.toString());
    });

    it('throws 404 for a malformed guardian id without writing', async () => {
      await expect(
        service.removeLink('bad', STUDENT_A.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(guardianModel.collection.updateOne).not.toHaveBeenCalled();
    });

    it('throws 404 for a malformed student id without writing', async () => {
      await expect(
        service.removeLink(GUARDIAN_ID.toString(), 'bad'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(guardianModel.collection.updateOne).not.toHaveBeenCalled();
    });

    it('throws 404 when the guardian does not exist', async () => {
      guardianModel.collection.updateOne.mockResolvedValue({
        matchedCount: 0,
        modifiedCount: 0,
      });
      await expect(
        service.removeLink(GUARDIAN_ID.toString(), STUDENT_A.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 when the link is absent', async () => {
      guardianModel.collection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 0,
      });
      await expect(
        service.removeLink(GUARDIAN_ID.toString(), STUDENT_A.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
