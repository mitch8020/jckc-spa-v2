import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Classroom } from '../../database/schemas/classroom.schema';
import { Student } from '../../database/schemas/student.schema';
import { ClassroomsService } from './classrooms.service';

const CLASSROOM_ID = new Types.ObjectId('64c000000000000000000001');

function makeClassroomDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CLASSROOM_ID,
    classroomName: 'Seahorses',
    ageGroup: 'infant',
    teacherName: 'Ms. Kim',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeStudentDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    studentFirstName: 'Ada',
    studentLastName: 'Lovelace',
    dateOfBirth: '2024-01-01',
    studentStreetAddress: '1 Main St',
    studentCity: 'Johnson City',
    studentState: 'TN',
    studentZIP: '37604',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

const exec = <T>(value: T) => ({ exec: jest.fn().mockResolvedValue(value) });

describe('ClassroomsService', () => {
  let service: ClassroomsService;
  let classroomModel: {
    find: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
  let studentModel: {
    aggregate: jest.Mock;
    countDocuments: jest.Mock;
    find: jest.Mock;
    updateMany: jest.Mock;
    bulkWrite: jest.Mock;
  };

  function mockStudentFindChain(docs: unknown[]) {
    const chain = {
      collation: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      exec: jest.fn().mockResolvedValue(docs),
    };
    chain.collation.mockReturnValue(chain);
    chain.sort.mockReturnValue(chain);
    chain.skip.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    return chain;
  }

  beforeEach(async () => {
    classroomModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    studentModel = {
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      updateMany: jest.fn(),
      bulkWrite: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ClassroomsService,
        { provide: getModelToken(Classroom.name), useValue: classroomModel },
        { provide: getModelToken(Student.name), useValue: studentModel },
      ],
    }).compile();

    service = moduleRef.get(ClassroomsService);
  });

  describe('list', () => {
    it('sorts by ageGroup rank (infant, toddler, preschool) then name and maps aggregated counts', async () => {
      const ID_ANTS = new Types.ObjectId('64c000000000000000000002');
      const ID_BEES = new Types.ObjectId('64c000000000000000000003');
      const ID_APPLES = new Types.ObjectId('64c000000000000000000004');
      classroomModel.find.mockReturnValue(
        exec([
          makeClassroomDoc({
            _id: ID_APPLES,
            classroomName: 'Apples',
            ageGroup: 'preschool',
          }),
          makeClassroomDoc({
            _id: ID_BEES,
            classroomName: 'Bees',
            ageGroup: 'toddler',
          }),
          makeClassroomDoc(),
          makeClassroomDoc({
            _id: ID_ANTS,
            classroomName: 'Ants',
            ageGroup: 'toddler',
          }),
        ]),
      );
      studentModel.aggregate.mockReturnValue(
        exec([
          { _id: CLASSROOM_ID, count: 4 },
          { _id: ID_ANTS, count: 2 },
        ]),
      );

      const result = await service.list();

      expect(studentModel.aggregate).toHaveBeenCalledWith([
        { $match: { classroom: { $ne: null } } },
        { $group: { _id: '$classroom', count: { $sum: 1 } } },
      ]);
      expect(result.map((c) => c.classroomName)).toEqual([
        'Seahorses',
        'Ants',
        'Bees',
        'Apples',
      ]);
      expect(result.map((c) => c.studentCount)).toEqual([4, 2, 0, 0]);
      expect(result[0]).toEqual({
        id: CLASSROOM_ID.toString(),
        classroomName: 'Seahorses',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
        createdAt: '2026-01-01T00:00:00.000Z',
        studentCount: 4,
      });
    });
  });

  describe('getDetails', () => {
    it('returns the classroom and its students sorted first-name asc with ci collation', async () => {
      const STUDENT_ID = new Types.ObjectId('64d000000000000000000010');
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      const chain = mockStudentFindChain([
        makeStudentDoc({ _id: STUDENT_ID, classroom: CLASSROOM_ID }),
      ]);
      studentModel.find.mockReturnValue(chain);

      const result = await service.getDetails(CLASSROOM_ID.toString());

      expect(classroomModel.findById).toHaveBeenCalledWith(
        CLASSROOM_ID.toString(),
      );
      expect(studentModel.find).toHaveBeenCalledWith({
        classroom: CLASSROOM_ID,
      });
      expect(chain.collation).toHaveBeenCalledWith({
        locale: 'en',
        strength: 2,
      });
      expect(chain.sort).toHaveBeenCalledWith({
        studentFirstName: 1,
        studentLastName: 1,
        _id: 1,
      });
      expect(result.classroom.id).toBe(CLASSROOM_ID.toString());
      expect(result.students).toHaveLength(1);
      expect(result.students[0]).toMatchObject({
        id: STUDENT_ID.toString(),
        studentFirstName: 'Ada',
        ageGroup: null,
        applicationApprovalStatus: true,
        classroom: { id: CLASSROOM_ID.toString() },
      });
    });

    it('throws 404 for a malformed id without querying', async () => {
      await expect(service.getDetails('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(classroomModel.findById).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown id', async () => {
      classroomModel.findById.mockReturnValue(exec(null));
      await expect(
        service.getDetails(CLASSROOM_ID.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and serializes the classroom', async () => {
      classroomModel.create.mockResolvedValue(makeClassroomDoc());

      const result = await service.create({
        classroomName: 'Seahorses',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
      });

      expect(classroomModel.create).toHaveBeenCalledWith({
        classroomName: 'Seahorses',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
      });
      expect(result).toEqual({
        id: CLASSROOM_ID.toString(),
        classroomName: 'Seahorses',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  describe('update', () => {
    it('updates all three fields with runValidators and returns the new doc', async () => {
      classroomModel.findByIdAndUpdate.mockReturnValue(
        exec(makeClassroomDoc({ classroomName: 'Otters' })),
      );

      const result = await service.update(CLASSROOM_ID.toString(), {
        classroomName: 'Otters',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
      });

      expect(classroomModel.findByIdAndUpdate).toHaveBeenCalledWith(
        CLASSROOM_ID.toString(),
        {
          $set: {
            classroomName: 'Otters',
            ageGroup: 'infant',
            teacherName: 'Ms. Kim',
          },
        },
        { returnDocument: 'after', runValidators: true },
      );
      expect(result.classroomName).toBe('Otters');
    });

    it('throws 404 when the classroom does not exist', async () => {
      classroomModel.findByIdAndUpdate.mockReturnValue(exec(null));
      await expect(
        service.update(CLASSROOM_ID.toString(), {
          classroomName: 'Otters',
          ageGroup: 'infant',
          teacherName: 'Ms. Kim',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 for a malformed id without querying', async () => {
      await expect(
        service.update('bad', {
          classroomName: 'Otters',
          ageGroup: 'infant',
          teacherName: 'Ms. Kim',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(classroomModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the classroom and unassigns its students (classroom -> null)', async () => {
      classroomModel.findByIdAndDelete.mockReturnValue(
        exec(makeClassroomDoc()),
      );
      studentModel.updateMany.mockReturnValue(exec({ modifiedCount: 3 }));

      await service.remove(CLASSROOM_ID.toString());

      expect(classroomModel.findByIdAndDelete).toHaveBeenCalledWith(
        CLASSROOM_ID.toString(),
      );
      expect(studentModel.updateMany).toHaveBeenCalledWith(
        { classroom: CLASSROOM_ID },
        { $set: { classroom: null } },
      );
    });

    it('throws 404 for an unknown id without touching students', async () => {
      classroomModel.findByIdAndDelete.mockReturnValue(exec(null));
      await expect(
        service.remove(CLASSROOM_ID.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(studentModel.updateMany).not.toHaveBeenCalled();
    });

    it('throws 404 for a malformed id without querying', async () => {
      await expect(service.remove('bad')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(classroomModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('getRoster', () => {
    it('builds independent panes: unassigned-vs-member filters, escaped search, clamped pagination', async () => {
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      studentModel.countDocuments
        .mockReturnValueOnce(exec(0)) // add pane
        .mockReturnValueOnce(exec(25)); // remove pane
      const addChain = mockStudentFindChain([]);
      const removeChain = mockStudentFindChain([
        makeStudentDoc({ classroom: CLASSROOM_ID }),
      ]);
      studentModel.find
        .mockReturnValueOnce(addChain)
        .mockReturnValueOnce(removeChain);

      const result = await service.getRoster(CLASSROOM_ID.toString(), {
        addPage: '2',
        addSearch: ' a+b ',
        removePage: '99',
        removeSearch: '',
      });

      const expectedAddFilter = {
        classroom: null,
        $or: [
          { studentFirstName: { $regex: 'a\\+b', $options: 'i' } },
          { studentLastName: { $regex: 'a\\+b', $options: 'i' } },
        ],
      };
      expect(studentModel.countDocuments).toHaveBeenNthCalledWith(
        1,
        expectedAddFilter,
      );
      expect(studentModel.find).toHaveBeenNthCalledWith(1, expectedAddFilter);
      expect(studentModel.countDocuments).toHaveBeenNthCalledWith(2, {
        classroom: CLASSROOM_ID,
      });
      expect(studentModel.find).toHaveBeenNthCalledWith(2, {
        classroom: CLASSROOM_ID,
      });

      // Add pane: empty result -> requested page 2 clamps to 1, startIndex 0.
      expect(addChain.skip).toHaveBeenCalledWith(0);
      expect(addChain.limit).toHaveBeenCalledWith(10);
      expect(result.add.items).toEqual([]);
      expect(result.add.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        pageSize: 10,
        startIndex: 0,
        endIndex: 0,
        hasPrevious: false,
        hasNext: false,
      });

      // Remove pane: page 99 of 3 clamps to the last page independently.
      expect(removeChain.skip).toHaveBeenCalledWith(20);
      expect(removeChain.limit).toHaveBeenCalledWith(10);
      expect(result.remove.pagination).toEqual({
        currentPage: 3,
        totalPages: 3,
        totalCount: 25,
        pageSize: 10,
        startIndex: 21,
        endIndex: 25,
        hasPrevious: true,
        hasNext: false,
      });

      // Remove-pane students embed this classroom; add-pane would be null.
      expect(result.remove.items[0].classroom).toMatchObject({
        id: CLASSROOM_ID.toString(),
        classroomName: 'Seahorses',
      });
    });

    it('throws 404 for an unknown classroom', async () => {
      classroomModel.findById.mockReturnValue(exec(null));
      await expect(
        service.getRoster(CLASSROOM_ID.toString(), {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(studentModel.countDocuments).not.toHaveBeenCalled();
    });

    it('omits search filters when pane search values are undefined', async () => {
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      studentModel.countDocuments
        .mockReturnValueOnce(exec(0))
        .mockReturnValueOnce(exec(0));
      studentModel.find
        .mockReturnValueOnce(mockStudentFindChain([]))
        .mockReturnValueOnce(mockStudentFindChain([]));

      await service.getRoster(CLASSROOM_ID.toString(), {});

      expect(studentModel.countDocuments).toHaveBeenNthCalledWith(1, {
        classroom: null,
      });
      expect(studentModel.countDocuments).toHaveBeenNthCalledWith(2, {
        classroom: CLASSROOM_ID,
      });
    });
  });

  describe('assignStudents', () => {
    const NOW = new Date('2026-07-01T00:00:00.000Z');
    const ID_INFANT = new Types.ObjectId('64d000000000000000000001');
    const ID_TODDLER_LOW = new Types.ObjectId('64d000000000000000000002');
    const ID_TODDLER_HIGH = new Types.ObjectId('64d000000000000000000003');
    const ID_PRESCHOOL = new Types.ObjectId('64d000000000000000000004');
    const ID_MISSING = '64d0000000000000000000ff';

    it('recomputes ageGroup from DOB at the exact 11/30-month legacy thresholds and reports unknown ids', async () => {
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      studentModel.find.mockReturnValue(
        exec([
          // 334 days ≈ 10.98 "months" -> infant (just under the 11 threshold)
          makeStudentDoc({ _id: ID_INFANT, dateOfBirth: '2025-08-01' }),
          // 335 days ≈ 11.01 "months" -> toddler (just over)
          makeStudentDoc({ _id: ID_TODDLER_LOW, dateOfBirth: '2025-07-31' }),
          // 912 days ≈ 29.98 "months" -> toddler (just under the 30 threshold)
          makeStudentDoc({ _id: ID_TODDLER_HIGH, dateOfBirth: '2024-01-01' }),
          // 913 days ≈ 30.02 "months" -> preschool (just over)
          makeStudentDoc({ _id: ID_PRESCHOOL, dateOfBirth: '2023-12-31' }),
        ]),
      );
      studentModel.bulkWrite.mockResolvedValue({});

      const result = await service.assignStudents(
        CLASSROOM_ID.toString(),
        [
          ID_INFANT.toString(),
          ID_TODDLER_LOW.toString(),
          ID_TODDLER_HIGH.toString(),
          ID_PRESCHOOL.toString(),
          ID_MISSING,
        ],
        NOW,
      );

      expect(result).toEqual({ added: 4, notFound: [ID_MISSING] });
      expect(studentModel.find).toHaveBeenCalledWith({
        _id: {
          $in: [
            ID_INFANT,
            ID_TODDLER_LOW,
            ID_TODDLER_HIGH,
            ID_PRESCHOOL,
            new Types.ObjectId(ID_MISSING),
          ],
        },
      });
      const [ops] = studentModel.bulkWrite.mock.calls[0] as [
        Array<{
          updateOne: {
            filter: { _id: Types.ObjectId };
            update: { $set: { classroom: Types.ObjectId; ageGroup: string } };
          };
        }>,
      ];
      expect(
        ops.map((op) => [
          op.updateOne.filter._id.toString(),
          op.updateOne.update.$set.ageGroup,
        ]),
      ).toEqual([
        [ID_INFANT.toString(), 'infant'],
        [ID_TODDLER_LOW.toString(), 'toddler'],
        [ID_TODDLER_HIGH.toString(), 'toddler'],
        [ID_PRESCHOOL.toString(), 'preschool'],
      ]);
      expect(
        ops.every((op) =>
          op.updateOne.update.$set.classroom.equals(CLASSROOM_ID),
        ),
      ).toBe(true);
    });

    it('reports every id as notFound (and skips the write) when none exist', async () => {
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      studentModel.find.mockReturnValue(exec([]));

      const result = await service.assignStudents(CLASSROOM_ID.toString(), [
        ID_MISSING,
      ]);

      expect(result).toEqual({ added: 0, notFound: [ID_MISSING] });
      expect(studentModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('treats uncastable student ids as notFound without querying students', async () => {
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));

      const result = await service.assignStudents(CLASSROOM_ID.toString(), [
        'not-an-object-id',
      ]);

      expect(result).toEqual({ added: 0, notFound: ['not-an-object-id'] });
      expect(studentModel.find).not.toHaveBeenCalled();
      expect(studentModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown classroom before touching students', async () => {
      classroomModel.findById.mockReturnValue(exec(null));
      await expect(
        service.assignStudents(CLASSROOM_ID.toString(), [ID_MISSING]),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(studentModel.find).not.toHaveBeenCalled();
    });
  });

  describe('removeStudents', () => {
    it('only unassigns members of THIS classroom, leaves ageGroup untouched, reports skipped ids', async () => {
      const ID_MEMBER = new Types.ObjectId('64e000000000000000000001');
      const ID_ELSEWHERE = '64e000000000000000000002';
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      studentModel.find.mockReturnValue(
        exec([
          makeStudentDoc({
            _id: ID_MEMBER,
            classroom: CLASSROOM_ID,
            ageGroup: 'toddler',
          }),
        ]),
      );
      studentModel.updateMany.mockReturnValue(exec({ modifiedCount: 1 }));

      const result = await service.removeStudents(CLASSROOM_ID.toString(), [
        ID_MEMBER.toString(),
        ID_ELSEWHERE,
      ]);

      expect(result).toEqual({ removed: 1, skipped: [ID_ELSEWHERE] });
      // Membership is checked against THIS classroom (legacy fix #7).
      expect(studentModel.find).toHaveBeenCalledWith({
        _id: { $in: [ID_MEMBER, new Types.ObjectId(ID_ELSEWHERE)] },
        classroom: CLASSROOM_ID,
      });
      const [filter, update] = studentModel.updateMany.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
      ];
      expect(filter).toEqual({
        _id: { $in: [ID_MEMBER] },
        classroom: CLASSROOM_ID,
      });
      // ageGroup is deliberately left stale (legacy parity, ledger #4).
      expect(update.$set).toEqual({ classroom: null });
    });

    it('skips the write when no ids belong to the classroom', async () => {
      const ID_ELSEWHERE = '64e000000000000000000002';
      classroomModel.findById.mockReturnValue(exec(makeClassroomDoc()));
      studentModel.find.mockReturnValue(exec([]));

      const result = await service.removeStudents(CLASSROOM_ID.toString(), [
        ID_ELSEWHERE,
      ]);

      expect(result).toEqual({ removed: 0, skipped: [ID_ELSEWHERE] });
      expect(studentModel.updateMany).not.toHaveBeenCalled();
    });
  });
});
