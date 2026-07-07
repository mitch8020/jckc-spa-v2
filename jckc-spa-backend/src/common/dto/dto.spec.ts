import { Types } from 'mongoose';
import { toClassroomDto, toPopulatedClassroomDto } from './classroom.dto';
import { resolveGuardianLinks, toGuardianDto } from './guardian.dto';
import { toStudentDto } from './student.dto';

const STUDENT_ID = new Types.ObjectId('64f000000000000000000001');

function studentFindResult(students: unknown[]) {
  return {
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(students),
    }),
  };
}

describe('common DTO serializers', () => {
  it('serializes classrooms with empty fallbacks and rejects unpopulated refs', () => {
    const classroom = {
      _id: new Types.ObjectId('64e000000000000000000001'),
      classroomName: 'Infants',
      ageGroup: 'infant',
      teacherName: null,
    };

    expect(toClassroomDto(classroom)).toEqual({
      id: classroom._id.toString(),
      classroomName: 'Infants',
      ageGroup: 'infant',
      teacherName: '',
      createdAt: '',
    });
    expect(toPopulatedClassroomDto(null)).toBeNull();
    expect(toPopulatedClassroomDto(undefined)).toBeNull();
    expect(toPopulatedClassroomDto(classroom._id)).toBeNull();
    expect(toPopulatedClassroomDto(classroom._id.toString())).toBeNull();
    expect(toPopulatedClassroomDto(classroom)).toEqual(
      toClassroomDto(classroom),
    );
  });

  it('resolves guardian links with missing student/link fields as empty strings', async () => {
    const studentModel = {
      find: jest.fn().mockReturnValue(studentFindResult([{ _id: STUDENT_ID }])),
    };

    await expect(
      resolveGuardianLinks(studentModel as never, [
        {
          student: STUDENT_ID,
          relationshipToStudent: undefined,
          authorizedToPickUp: false,
        },
        {
          student: null,
          relationshipToStudent: 'Dangling',
          authorizedToPickUp: true,
        },
      ]),
    ).resolves.toEqual([
      {
        studentId: STUDENT_ID.toString(),
        relationshipToStudent: '',
        authorizedToPickUp: false,
        student: {
          id: STUDENT_ID.toString(),
          studentFirstName: '',
          studentLastName: '',
          dateOfBirth: '',
        },
      },
      {
        studentId: '',
        relationshipToStudent: 'Dangling',
        authorizedToPickUp: true,
        student: null,
      },
    ]);
  });

  it('serializes schemaless guardians with empty personal-field fallbacks', async () => {
    const studentModel = { find: jest.fn() };
    const id = new Types.ObjectId('64e000000000000000000002');

    await expect(
      toGuardianDto(studentModel as never, {
        _id: id,
        students: undefined,
      }),
    ).resolves.toEqual({
      id: id.toString(),
      guardianFirstName: '',
      guardianLastName: '',
      phoneNumber: '',
      guardianStreetAddress: '',
      guardianCity: '',
      guardianState: '',
      guardianZIP: '',
      createdAt: '',
      students: [],
    });
    expect(studentModel.find).not.toHaveBeenCalled();
  });

  it('serializes students with null/default fallbacks', () => {
    const id = new Types.ObjectId('64e000000000000000000003');

    expect(
      toStudentDto(
        {
          _id: id,
          studentFirstName: 'Ada',
          studentLastName: 'Lovelace',
          dateOfBirth: '2024-03-15',
          studentStreetAddress: '1 Main St',
          studentCity: 'Johnson City',
          studentState: 'TN',
          studentZIP: '37604',
        },
        null,
      ),
    ).toEqual({
      id: id.toString(),
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
      dateOfBirth: '2024-03-15',
      studentStreetAddress: '1 Main St',
      studentCity: 'Johnson City',
      studentState: 'TN',
      studentZIP: '37604',
      ageGroup: null,
      classroom: null,
      applicationApprovalStatus: true,
      createdAt: '',
    });
  });
});
