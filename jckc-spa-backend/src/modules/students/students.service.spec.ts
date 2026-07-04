import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Guardian } from '../../database/schemas/guardian.schema';
import { Student } from '../../database/schemas/student.schema';
import type { SessionUser } from '../auth/session-user.type';
import { StudentsService } from './students.service';

const STUDENT_ID = new Types.ObjectId('64c000000000000000000001');
const OTHER_STUDENT_ID = new Types.ObjectId('64c000000000000000000002');
const GUARDIAN_ID = new Types.ObjectId('64d000000000000000000001');
const CLASSROOM_ID = new Types.ObjectId('64e000000000000000000001');

function makeStudentDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: STUDENT_ID,
    studentFirstName: 'Ada',
    studentLastName: 'Lovelace',
    dateOfBirth: '2024-03-15',
    studentStreetAddress: '1 Main St',
    studentCity: 'Johnson City',
    studentState: 'TN',
    studentZIP: '37604',
    classroom: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeGuardianFields() {
  return {
    guardianFirstName: 'Grace',
    guardianLastName: 'Hopper',
    phoneNumber: '423-926-2221',
    guardianStreetAddress: '2 Harbor Ln',
    guardianCity: 'Johnson City',
    guardianState: 'TN',
    guardianZIP: '37604',
  };
}

function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    name: 'Jane Doe',
    image: null,
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    role: 'parent',
    registrationStatus: true,
    firstName: 'Jane',
    lastName: 'Doe',
    phoneNumber: '',
    dateOfBirth: '',
    parentPermission: true,
    teacherPermission: false,
    adminPermission: false,
    ...overrides,
  };
}

const exec = <T>(value: T) => ({ exec: jest.fn().mockResolvedValue(value) });

interface FindChain {
  collation: jest.Mock;
  sort: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  populate: jest.Mock;
  lean: jest.Mock;
  exec: jest.Mock;
}

function makeFindChain(docs: unknown): FindChain {
  const chain: FindChain = {
    collation: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    populate: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(docs),
  };
  chain.collation.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  chain.lean.mockReturnValue(chain);
  return chain;
}

describe('StudentsService', () => {
  let service: StudentsService;
  let studentModel: {
    countDocuments: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    create: jest.Mock;
    exists: jest.Mock;
  };
  let guardianModel: {
    find: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    collection: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    studentModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      create: jest.fn(),
      exists: jest.fn(),
    };
    guardianModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      collection: { updateMany: jest.fn().mockResolvedValue({}) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: getModelToken(Student.name), useValue: studentModel },
        { provide: getModelToken(Guardian.name), useValue: guardianModel },
      ],
    }).compile();

    service = moduleRef.get(StudentsService);
  });

  describe('list', () => {
    it('applies the legacy pagination math (page 3 of 23) and serializes _id -> id', async () => {
      studentModel.countDocuments.mockReturnValue(exec(23));
      const chain = makeFindChain([
        makeStudentDoc({
          ageGroup: 'toddler',
          classroom: {
            _id: CLASSROOM_ID,
            classroomName: 'Seahorses',
            ageGroup: 'toddler',
            teacherName: 'Ms. Kay',
            createdAt: new Date('2025-06-01T00:00:00.000Z'),
          },
        }),
      ]);
      studentModel.find.mockReturnValue(chain);

      const result = await service.list('3', 'all', undefined, undefined);

      expect(studentModel.countDocuments).toHaveBeenCalledWith({});
      expect(chain.collation).toHaveBeenCalledWith({
        locale: 'en',
        strength: 2,
      });
      expect(chain.sort).toHaveBeenCalledWith({
        studentFirstName: 1,
        studentLastName: 1,
        _id: 1,
      });
      expect(chain.skip).toHaveBeenCalledWith(20);
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(chain.populate).toHaveBeenCalledWith('classroom');
      expect(result.pagination).toEqual({
        currentPage: 3,
        totalPages: 3,
        totalCount: 23,
        pageSize: 10,
        startIndex: 21,
        endIndex: 23,
        hasPrevious: true,
        hasNext: false,
      });
      expect(result.items[0]).toEqual({
        id: STUDENT_ID.toHexString(),
        studentFirstName: 'Ada',
        studentLastName: 'Lovelace',
        dateOfBirth: '2024-03-15',
        studentStreetAddress: '1 Main St',
        studentCity: 'Johnson City',
        studentState: 'TN',
        studentZIP: '37604',
        ageGroup: 'toddler',
        classroom: {
          id: CLASSROOM_ID.toHexString(),
          classroomName: 'Seahorses',
          ageGroup: 'toddler',
          teacherName: 'Ms. Kay',
          createdAt: '2025-06-01T00:00:00.000Z',
        },
        applicationApprovalStatus: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('clamps an over-large page to the last page', async () => {
      studentModel.countDocuments.mockReturnValue(exec(11));
      const chain = makeFindChain([]);
      studentModel.find.mockReturnValue(chain);

      const result = await service.list('99', 'all', undefined, undefined);

      expect(chain.skip).toHaveBeenCalledWith(10);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('resolves non-numeric/zero pages to 1 and reports page 1 of 1 with startIndex 0 when empty', async () => {
      studentModel.countDocuments.mockReturnValue(exec(0));
      const chain = makeFindChain([]);
      studentModel.find.mockReturnValue(chain);

      const result = await service.list('0', 'all', undefined, undefined);

      expect(chain.skip).toHaveBeenCalledWith(0);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        pageSize: 10,
        startIndex: 0,
        endIndex: 0,
        hasPrevious: false,
        hasNext: false,
      });
    });

    it.each([
      ['active', { classroom: { $ne: null } }],
      ['inactive', { classroom: null }],
      ['all', {}],
      [undefined, { classroom: { $ne: null } }],
      ['Active', { classroom: { $ne: null } }], // case-sensitive -> default
      ['bogus', { classroom: { $ne: null } }],
    ])('status %p builds filter %p', async (status, expected) => {
      studentModel.countDocuments.mockReturnValue(exec(0));
      studentModel.find.mockReturnValue(makeFindChain([]));

      await service.list(undefined, status, undefined, undefined);

      expect(studentModel.countDocuments).toHaveBeenCalledWith(expected);
      expect(studentModel.find).toHaveBeenCalledWith(expected);
    });

    it("sorts descending only for the exact string 'desc'", async () => {
      studentModel.countDocuments.mockReturnValue(exec(0));
      const descChain = makeFindChain([]);
      studentModel.find.mockReturnValue(descChain);
      await service.list(undefined, 'all', undefined, 'desc');
      expect(descChain.sort).toHaveBeenCalledWith({
        studentFirstName: -1,
        studentLastName: -1,
        _id: -1,
      });

      const ascChain = makeFindChain([]);
      studentModel.find.mockReturnValue(ascChain);
      await service.list(undefined, 'all', undefined, 'DESC');
      expect(ascChain.sort).toHaveBeenCalledWith({
        studentFirstName: 1,
        studentLastName: 1,
        _id: 1,
      });
    });

    it('trims and regex-escapes the search across both name fields', async () => {
      studentModel.countDocuments.mockReturnValue(exec(0));
      studentModel.find.mockReturnValue(makeFindChain([]));

      await service.list(undefined, 'active', ' a+b(c* ', undefined);

      const expected = {
        classroom: { $ne: null },
        $or: [
          {
            studentFirstName: {
              $regex: 'a\\+b\\(c\\*',
              $options: 'i',
            },
          },
          {
            studentLastName: {
              $regex: 'a\\+b\\(c\\*',
              $options: 'i',
            },
          },
        ],
      };
      expect(studentModel.countDocuments).toHaveBeenCalledWith(expected);
      expect(studentModel.find).toHaveBeenCalledWith(expected);
    });

    it('serializes a missing/dangling classroom as null and false approval as false', async () => {
      studentModel.countDocuments.mockReturnValue(exec(1));
      studentModel.find.mockReturnValue(
        makeFindChain([
          makeStudentDoc({
            classroom: null,
            applicationApprovalStatus: false,
          }),
        ]),
      );

      const result = await service.list('1', 'all', undefined, undefined);

      expect(result.items[0].classroom).toBeNull();
      expect(result.items[0].ageGroup).toBeNull();
      expect(result.items[0].applicationApprovalStatus).toBe(false);
    });
  });

  describe('listMine', () => {
    it('queries createdByUserId OR guardian-linked ids (both stored forms) and splits on approval', async () => {
      guardianModel.find.mockReturnValue(
        exec([
          {
            students: [
              { student: STUDENT_ID }, // ObjectId form
              { student: OTHER_STUDENT_ID.toHexString() }, // string form
              { student: null }, // dangling
              {}, // malformed legacy element
              { student: 'not-an-object-id' }, // unparseable
            ],
          },
        ]),
      );
      const chain = makeFindChain([
        makeStudentDoc(), // approval missing -> registered
        makeStudentDoc({
          _id: OTHER_STUDENT_ID,
          studentFirstName: 'Ben',
          applicationApprovalStatus: false, // -> pending
        }),
      ]);
      studentModel.find.mockReturnValue(chain);

      const result = await service.listMine('user-1');

      expect(guardianModel.find).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { students: 1 },
      );
      expect(studentModel.find).toHaveBeenCalledWith({
        $or: [
          { createdByUserId: 'user-1' },
          {
            _id: {
              $in: [STUDENT_ID.toHexString(), OTHER_STUDENT_ID.toHexString()],
            },
          },
        ],
      });
      expect(chain.sort).toHaveBeenCalledWith({
        studentFirstName: 1,
        studentLastName: 1,
        _id: 1,
      });
      expect(result.registered.map((s) => s.id)).toEqual([
        STUDENT_ID.toHexString(),
      ]);
      expect(result.registered[0].applicationApprovalStatus).toBe(true);
      expect(result.pending.map((s) => s.id)).toEqual([
        OTHER_STUDENT_ID.toHexString(),
      ]);
    });

    it('omits the $in condition when the parent has no guardian links', async () => {
      guardianModel.find.mockReturnValue(exec([]));
      studentModel.find.mockReturnValue(makeFindChain([]));

      const result = await service.listMine('user-1');

      expect(studentModel.find).toHaveBeenCalledWith({
        $or: [{ createdByUserId: 'user-1' }],
      });
      expect(result).toEqual({ registered: [], pending: [] });
    });
  });

  describe('getById', () => {
    it('throws 404 for a malformed id without querying', async () => {
      await expect(service.getById('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(studentModel.findById).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown id', async () => {
      studentModel.findById.mockReturnValue(makeFindChain(null));
      await expect(
        service.getById(STUDENT_ID.toHexString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
      dateOfBirth: '2024-03-15',
      studentStreetAddress: '1 Main St',
      studentCity: 'Johnson City',
      studentState: 'TN',
      studentZIP: '37604',
    };

    it('parent create -> pending application with createdByUserId', async () => {
      studentModel.create.mockResolvedValue(
        makeStudentDoc({ applicationApprovalStatus: false }),
      );

      const result = await service.create(makeSessionUser(), dto);

      expect(studentModel.create).toHaveBeenCalledWith({
        ...dto,
        applicationApprovalStatus: false,
        createdByUserId: 'user-1',
      });
      expect(result.applicationApprovalStatus).toBe(false);
      expect(result.classroom).toBeNull();
    });

    it('admin create -> approved, no createdByUserId', async () => {
      studentModel.create.mockResolvedValue(
        makeStudentDoc({ applicationApprovalStatus: true }),
      );

      await service.create(
        makeSessionUser({ role: 'admin', id: 'admin-1' }),
        dto,
      );

      expect(studentModel.create).toHaveBeenCalledWith({
        ...dto,
        applicationApprovalStatus: true,
      });
    });
  });

  describe('update', () => {
    it('$sets only the submitted subset plus the approve flag', async () => {
      studentModel.findByIdAndUpdate.mockReturnValue(
        makeFindChain(
          makeStudentDoc({
            studentCity: 'Erwin',
            applicationApprovalStatus: true,
          }),
        ),
      );

      const result = await service.update(STUDENT_ID.toHexString(), {
        studentCity: 'Erwin',
        applicationApprovalStatus: true,
      });

      const [id, update, options] = studentModel.findByIdAndUpdate.mock
        .calls[0] as [Types.ObjectId, Record<string, unknown>, unknown];
      expect(id).toBeInstanceOf(Types.ObjectId);
      expect(id.toHexString()).toBe(STUDENT_ID.toHexString());
      expect(update).toEqual({
        $set: { studentCity: 'Erwin', applicationApprovalStatus: true },
      });
      expect(options).toEqual({ returnDocument: 'after' });
      expect(result.studentCity).toBe('Erwin');
    });

    it('throws 404 for a malformed id without querying', async () => {
      await expect(
        service.update('bad-id', { studentCity: 'Erwin' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(studentModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown id', async () => {
      studentModel.findByIdAndUpdate.mockReturnValue(makeFindChain(null));
      await expect(
        service.update(STUDENT_ID.toHexString(), { studentCity: 'Erwin' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats an empty patch as a plain read (no update issued)', async () => {
      studentModel.findById.mockReturnValue(makeFindChain(makeStudentDoc()));

      const result = await service.update(STUDENT_ID.toHexString(), {});

      expect(studentModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result.id).toBe(STUDENT_ID.toHexString());
    });
  });

  describe('remove', () => {
    it('deletes and cascades a $pull matching BOTH ObjectId and string link ids', async () => {
      studentModel.findByIdAndDelete.mockReturnValue(exec(makeStudentDoc()));

      await service.remove(STUDENT_ID.toHexString());

      expect(studentModel.findByIdAndDelete).toHaveBeenCalledTimes(1);
      expect(guardianModel.collection.updateMany).toHaveBeenCalledTimes(1);
      const [filter, update] = guardianModel.collection.updateMany.mock
        .calls[0] as [
        { 'students.student': { $in: unknown[] } },
        { $pull: { students: { student: { $in: unknown[] } } } },
      ];

      const expectedForms = [STUDENT_ID, STUDENT_ID.toHexString()];
      expect(filter).toEqual({ 'students.student': { $in: expectedForms } });
      expect(update).toEqual({
        $pull: { students: { student: { $in: expectedForms } } },
      });

      const forms = update.$pull.students.student.$in;
      expect(forms).toHaveLength(2);
      expect(forms[0]).toBeInstanceOf(Types.ObjectId);
      expect(String(forms[0])).toBe(STUDENT_ID.toHexString());
      expect(forms[1]).toBe(STUDENT_ID.toHexString());
    });

    it('throws 404 for a malformed id without deleting or cascading', async () => {
      await expect(service.remove('bad-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(studentModel.findByIdAndDelete).not.toHaveBeenCalled();
      expect(guardianModel.collection.updateMany).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown id and does NOT cascade', async () => {
      studentModel.findByIdAndDelete.mockReturnValue(exec(null));

      await expect(
        service.remove(STUDENT_ID.toHexString()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(guardianModel.collection.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('listGuardiansOfStudent', () => {
    it('matches links stored as ObjectId OR string and maps the link fields', async () => {
      studentModel.exists.mockReturnValue(exec({ _id: STUDENT_ID }));
      const chain = makeFindChain([
        {
          _id: GUARDIAN_ID,
          ...makeGuardianFields(),
          students: [
            {
              student: STUDENT_ID,
              relationshipToStudent: 'Mother',
              authorizedToPickUp: true,
            },
          ],
        },
        {
          _id: OTHER_STUDENT_ID, // reused id value; shape is what matters
          ...makeGuardianFields(),
          guardianFirstName: 'Unrelated',
          students: [{ student: new Types.ObjectId() }],
        },
        {
          _id: CLASSROOM_ID, // reused id value; shape is what matters
          ...makeGuardianFields(),
          guardianFirstName: 'Stringy',
          students: [
            {
              student: STUDENT_ID.toHexString(),
              relationshipToStudent: 'Father',
            },
          ],
        },
      ]);
      guardianModel.find.mockReturnValue(chain);

      const result = await service.listGuardiansOfStudent(
        STUDENT_ID.toHexString(),
      );

      expect(chain.collation).toHaveBeenCalledWith({
        locale: 'en',
        strength: 2,
      });
      expect(chain.sort).toHaveBeenCalledWith({ guardianFirstName: 1 });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: GUARDIAN_ID.toHexString(),
        ...makeGuardianFields(),
        relationshipToStudent: 'Mother',
        authorizedToPickUp: true,
      });
      // string-stored link matched; missing pickup flag -> false
      expect(result[1].guardianFirstName).toBe('Stringy');
      expect(result[1].relationshipToStudent).toBe('Father');
      expect(result[1].authorizedToPickUp).toBe(false);
    });

    it('throws 404 when the student does not exist', async () => {
      studentModel.exists.mockReturnValue(exec(null));
      await expect(
        service.listGuardiansOfStudent(STUDENT_ID.toHexString()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(guardianModel.find).not.toHaveBeenCalled();
    });
  });

  describe('addGuardianToStudent', () => {
    const linkFields = {
      relationshipToStudent: 'Grandmother',
      authorizedToPickUp: false,
    };

    it('rejects neither/both of guardianId and guardian with 400', async () => {
      await expect(
        service.addGuardianToStudent(STUDENT_ID.toHexString(), {
          ...linkFields,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.addGuardianToStudent(STUDENT_ID.toHexString(), {
          guardianId: GUARDIAN_ID.toHexString(),
          guardian: makeGuardianFields(),
          ...linkFields,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(studentModel.findById).not.toHaveBeenCalled();
    });

    it('throws 409 when the guardian is already linked (even via a string-stored id)', async () => {
      studentModel.findById.mockReturnValue(exec(makeStudentDoc()));
      guardianModel.findById.mockReturnValue(
        exec({
          _id: GUARDIAN_ID,
          ...makeGuardianFields(),
          students: [
            {
              student: STUDENT_ID.toHexString(),
              relationshipToStudent: 'Mother',
              authorizedToPickUp: true,
            },
          ],
          save: jest.fn(),
        }),
      );

      await expect(
        service.addGuardianToStudent(STUDENT_ID.toHexString(), {
          guardianId: GUARDIAN_ID.toHexString(),
          ...linkFields,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('appends the link to an existing guardian, honoring authorizedToPickUp=false', async () => {
      studentModel.findById.mockReturnValue(exec(makeStudentDoc()));
      const guardianDoc = {
        _id: GUARDIAN_ID,
        ...makeGuardianFields(),
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        students: [] as unknown[],
        save: jest.fn(),
      };
      guardianDoc.save.mockResolvedValue(guardianDoc);
      guardianModel.findById.mockReturnValue(exec(guardianDoc));
      studentModel.find.mockReturnValue(
        makeFindChain([
          {
            _id: STUDENT_ID,
            studentFirstName: 'Ada',
            studentLastName: 'Lovelace',
            dateOfBirth: '2024-03-15',
          },
        ]),
      );

      const result = await service.addGuardianToStudent(
        STUDENT_ID.toHexString(),
        { guardianId: GUARDIAN_ID.toHexString(), ...linkFields },
      );

      expect(guardianDoc.students).toEqual([
        {
          student: STUDENT_ID,
          relationshipToStudent: 'Grandmother',
          authorizedToPickUp: false,
        },
      ]);
      expect(guardianDoc.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: GUARDIAN_ID.toHexString(),
        ...makeGuardianFields(),
        createdAt: '2026-02-01T00:00:00.000Z',
        students: [
          {
            studentId: STUDENT_ID.toHexString(),
            relationshipToStudent: 'Grandmother',
            authorizedToPickUp: false,
            student: {
              id: STUDENT_ID.toHexString(),
              studentFirstName: 'Ada',
              studentLastName: 'Lovelace',
              dateOfBirth: '2024-03-15',
            },
          },
        ],
      });
    });

    it('creates a new guardian with the initial link', async () => {
      studentModel.findById.mockReturnValue(exec(makeStudentDoc()));
      const created = {
        _id: GUARDIAN_ID,
        ...makeGuardianFields(),
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        students: [
          {
            student: STUDENT_ID,
            relationshipToStudent: 'Grandmother',
            authorizedToPickUp: false,
          },
        ],
      };
      guardianModel.create.mockResolvedValue(created);
      studentModel.find.mockReturnValue(
        makeFindChain([
          {
            _id: STUDENT_ID,
            studentFirstName: 'Ada',
            studentLastName: 'Lovelace',
            dateOfBirth: '2024-03-15',
          },
        ]),
      );

      const result = await service.addGuardianToStudent(
        STUDENT_ID.toHexString(),
        { guardian: makeGuardianFields(), ...linkFields },
      );

      expect(guardianModel.create).toHaveBeenCalledWith({
        ...makeGuardianFields(),
        students: [
          {
            student: STUDENT_ID,
            relationshipToStudent: 'Grandmother',
            authorizedToPickUp: false,
          },
        ],
      });
      expect(result.students[0].studentId).toBe(STUDENT_ID.toHexString());
    });

    it('throws 404 for an unknown guardianId', async () => {
      studentModel.findById.mockReturnValue(exec(makeStudentDoc()));
      guardianModel.findById.mockReturnValue(exec(null));

      await expect(
        service.addGuardianToStudent(STUDENT_ID.toHexString(), {
          guardianId: GUARDIAN_ID.toHexString(),
          ...linkFields,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
