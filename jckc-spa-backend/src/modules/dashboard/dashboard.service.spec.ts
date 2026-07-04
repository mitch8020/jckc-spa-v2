import { ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Guardian } from '../../database/schemas/guardian.schema';
import { Student } from '../../database/schemas/student.schema';
import type { SessionUser } from '../auth/session-user.type';
import { ClassroomsService } from '../classrooms/classrooms.service';
import type { ClassroomWithCountDto } from '../../common/dto/classroom.dto';
import { DashboardService } from './dashboard.service';

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'pat@example.com',
    name: 'Pat Parent',
    image: null,
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    role: 'parent',
    registrationStatus: true,
    firstName: 'Pat',
    lastName: 'Parent',
    phoneNumber: '423-612-1245',
    dateOfBirth: '1990-01-01',
    parentPermission: true,
    teacherPermission: false,
    adminPermission: false,
    ...overrides,
  };
}

function makeClassroomWithCount(
  overrides: Partial<ClassroomWithCountDto> = {},
): ClassroomWithCountDto {
  return {
    id: '64c000000000000000000001',
    classroomName: 'Seahorses',
    ageGroup: 'infant',
    teacherName: 'Ms. Kim',
    createdAt: '2026-01-01T00:00:00.000Z',
    studentCount: 0,
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
    classroom: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

const exec = <T>(value: T) => ({ exec: jest.fn().mockResolvedValue(value) });

describe('DashboardService', () => {
  let service: DashboardService;
  let studentModel: { countDocuments: jest.Mock; find: jest.Mock };
  let guardianModel: { find: jest.Mock };
  let classroomsList: jest.Mock;

  function mockMineChain(docs: unknown[]) {
    const chain = {
      collation: jest.fn(),
      sort: jest.fn(),
      populate: jest.fn(),
      exec: jest.fn().mockResolvedValue(docs),
    };
    chain.collation.mockReturnValue(chain);
    chain.sort.mockReturnValue(chain);
    chain.populate.mockReturnValue(chain);
    studentModel.find.mockReturnValue(chain);
    return chain;
  }

  beforeEach(async () => {
    studentModel = { countDocuments: jest.fn(), find: jest.fn() };
    guardianModel = { find: jest.fn() };
    classroomsList = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Student.name), useValue: studentModel },
        { provide: getModelToken(Guardian.name), useValue: guardianModel },
        { provide: ClassroomsService, useValue: { list: classroomsList } },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('throws 403 with message REGISTRATION_REQUIRED for an unregistered user', async () => {
    const user = makeUser({ registrationStatus: false, role: '' });
    await expect(service.getDashboard(user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getDashboard(user)).rejects.toMatchObject({
      message: 'REGISTRATION_REQUIRED',
    });
  });

  it('throws a plain 403 for a registered user without a recognized role', async () => {
    await expect(
      service.getDashboard(makeUser({ role: '' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(classroomsList).not.toHaveBeenCalled();
    expect(studentModel.find).not.toHaveBeenCalled();
  });

  describe('admin/teacher dashboard', () => {
    it('computes the stat formulas: in-rooms by the CLASSROOM ageGroup, active/inactive by assignment', async () => {
      const classrooms = [
        makeClassroomWithCount({ ageGroup: 'infant', studentCount: 3 }),
        makeClassroomWithCount({ ageGroup: 'infant', studentCount: 2 }),
        makeClassroomWithCount({ ageGroup: 'toddler', studentCount: 5 }),
        makeClassroomWithCount({ ageGroup: 'preschool', studentCount: 1 }),
      ];
      classroomsList.mockResolvedValue(classrooms);
      // 12 active vs 11 in rooms: one student points at a DELETED
      // classroom — active, but in no room (legacy template semantics).
      studentModel.countDocuments.mockImplementation(
        (filter: { classroom: unknown }) =>
          exec(filter.classroom === null ? 4 : 12),
      );

      const result = await service.getDashboard(makeUser({ role: 'admin' }));

      expect(result).toEqual({
        role: 'admin',
        stats: {
          infantsInRooms: 5,
          toddlersInRooms: 5,
          preschoolersInRooms: 1,
          activeStudents: 12,
          inactiveStudents: 4,
        },
        classrooms,
      });
      expect(studentModel.countDocuments).toHaveBeenCalledWith({
        classroom: { $ne: null },
      });
      expect(studentModel.countDocuments).toHaveBeenCalledWith({
        classroom: null,
      });
    });

    it('serves the same dashboard shape to teachers', async () => {
      classroomsList.mockResolvedValue([]);
      studentModel.countDocuments.mockReturnValue(exec(0));

      const result = await service.getDashboard(makeUser({ role: 'teacher' }));

      expect(result).toEqual({
        role: 'teacher',
        stats: {
          infantsInRooms: 0,
          toddlersInRooms: 0,
          preschoolersInRooms: 0,
          activeStudents: 0,
          inactiveStudents: 0,
        },
        classrooms: [],
      });
    });
  });

  describe('parent dashboard', () => {
    const LINKED_ID = new Types.ObjectId('64f000000000000000000001');
    const PENDING_ID = new Types.ObjectId('64f000000000000000000002');

    it('unions createdByUserId with guardian-linked students and splits on approval status', async () => {
      guardianModel.find.mockReturnValue(
        exec([
          {
            userId: 'user-1',
            students: [
              {
                student: LINKED_ID,
                relationshipToStudent: 'Mother',
                authorizedToPickUp: true,
              },
              { student: undefined }, // dangling legacy link tolerated
            ],
          },
        ]),
      );
      const classroomDoc = {
        _id: new Types.ObjectId('64c000000000000000000009'),
        classroomName: 'Otters',
        ageGroup: 'toddler',
        teacherName: 'Ms. Lee',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      const chain = mockMineChain([
        // approvalStatus missing (legacy doc) -> registered
        makeStudentDoc({ _id: LINKED_ID, classroom: classroomDoc }),
        makeStudentDoc({
          _id: PENDING_ID,
          studentFirstName: 'Zoe',
          applicationApprovalStatus: false,
        }),
      ]);

      const result = await service.getDashboard(makeUser());

      expect(guardianModel.find).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(studentModel.find).toHaveBeenCalledWith({
        $or: [{ createdByUserId: 'user-1' }, { _id: { $in: [LINKED_ID] } }],
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
      expect(chain.populate).toHaveBeenCalledWith('classroom');

      if (result.role !== 'parent') {
        throw new Error('expected the parent dashboard variant');
      }
      expect(result.students.registered).toHaveLength(1);
      expect(result.students.registered[0]).toMatchObject({
        id: LINKED_ID.toString(),
        applicationApprovalStatus: true,
        classroom: {
          id: '64c000000000000000000009',
          classroomName: 'Otters',
          ageGroup: 'toddler',
        },
      });
      expect(result.students.pending).toHaveLength(1);
      expect(result.students.pending[0]).toMatchObject({
        id: PENDING_ID.toString(),
        studentFirstName: 'Zoe',
        applicationApprovalStatus: false,
        classroom: null,
      });
    });

    it('queries only createdByUserId when the parent has no guardian links', async () => {
      guardianModel.find.mockReturnValue(exec([]));
      mockMineChain([]);

      const result = await service.getDashboard(makeUser());

      expect(studentModel.find).toHaveBeenCalledWith({
        $or: [{ createdByUserId: 'user-1' }],
      });
      expect(result).toEqual({
        role: 'parent',
        students: { registered: [], pending: [] },
      });
    });
  });
});
