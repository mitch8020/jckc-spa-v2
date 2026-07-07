import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { StudentIdsDto } from './classrooms/dto/student-ids.dto';
import { UpsertClassroomDto } from './classrooms/dto/upsert-classroom.dto';
import {
  UpdateGuardianDto,
  UpdateGuardianLinkDto,
} from './guardians/dto/update-guardian.dto';
import {
  AddGuardianToStudentDto,
  GuardianFieldsDto,
} from './students/dto/add-guardian-to-student.dto';
import { CreateStudentDto } from './students/dto/create-student.dto';
import { UpdateStudentDto } from './students/dto/update-student.dto';
import { RegisterUserDto } from './users/dto/register-user.dto';
import { UpdateMeDto } from './users/dto/update-me.dto';
import { UpdateUserRoleDto } from './users/dto/update-user-role.dto';

const OBJECT_ID = '64c000000000000000000001';

function errorsFor<T extends object>(cls: new () => T, value: object) {
  return validateSync(plainToInstance(cls, value), {
    whitelist: false,
    forbidUnknownValues: false,
  });
}

describe('DTO validation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-07T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('validates classroom upserts and roster id bodies', () => {
    expect(
      errorsFor(UpsertClassroomDto, {
        classroomName: 'Infants',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
      }),
    ).toEqual([]);
    expect(
      errorsFor(UpsertClassroomDto, {
        classroomName: '',
        ageGroup: 'babies',
        teacherName: '',
      }),
    ).toHaveLength(3);

    expect(errorsFor(StudentIdsDto, { studentIds: [OBJECT_ID] })).toEqual([]);
    expect(errorsFor(StudentIdsDto, { studentIds: [] })).toHaveLength(1);
    expect(errorsFor(StudentIdsDto, { studentIds: ['bad-id'] })).toHaveLength(
      1,
    );
  });

  it('validates create/update student bodies', () => {
    const student = {
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
      dateOfBirth: '2024-03-15',
      studentStreetAddress: '1 Main St',
      studentCity: 'Johnson City',
      studentState: 'TN',
      studentZIP: '37604',
    };

    expect(errorsFor(CreateStudentDto, student)).toEqual([]);
    expect(
      errorsFor(CreateStudentDto, {
        ...student,
        dateOfBirth: '2027-01-01',
        studentState: 'XX',
        studentZIP: '1234',
      }),
    ).toHaveLength(3);

    expect(
      errorsFor(UpdateStudentDto, {
        studentFirstName: 'Ada',
        applicationApprovalStatus: false,
      }),
    ).toEqual([]);
    expect(
      errorsFor(UpdateStudentDto, {
        studentFirstName: '',
        applicationApprovalStatus: 'yes',
      }),
    ).toHaveLength(2);
  });

  it('validates student-scoped guardian creation bodies', () => {
    const guardian = {
      guardianFirstName: 'Grace',
      guardianLastName: 'Hopper',
      phoneNumber: '423-555-1212',
      guardianStreetAddress: '1 Harbor Ln',
      guardianCity: 'Johnson City',
      guardianState: 'TN',
      guardianZIP: '37604',
    };

    expect(errorsFor(GuardianFieldsDto, guardian)).toEqual([]);
    expect(
      errorsFor(AddGuardianToStudentDto, {
        guardian,
        relationshipToStudent: 'Mother',
        authorizedToPickUp: false,
      }),
    ).toEqual([]);
    expect(
      errorsFor(AddGuardianToStudentDto, {
        guardian: { ...guardian, guardianZIP: 'bad' },
        relationshipToStudent: '',
        authorizedToPickUp: 'no',
      }),
    ).toHaveLength(3);
  });

  it('trims and validates guardian edit bodies and nested link edits', () => {
    const dto = plainToInstance(UpdateGuardianDto, {
      guardianFirstName: ' Grace ',
      guardianLastName: ' Hopper ',
      phoneNumber: ' 423-555-1212 ',
      guardianStreetAddress: ' 1 Harbor Ln ',
      guardianCity: ' Johnson City ',
      guardianState: ' TN ',
      guardianZIP: ' 37604 ',
      links: [
        {
          studentId: OBJECT_ID,
          relationshipToStudent: ' Mother ',
          authorizedToPickUp: true,
        },
      ],
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.guardianFirstName).toBe('Grace');
    expect(dto.phoneNumber).toBe('423-555-1212');
    expect(dto.links?.[0]).toBeInstanceOf(UpdateGuardianLinkDto);
    expect(dto.links?.[0].relationshipToStudent).toBe('Mother');

    expect(
      errorsFor(UpdateGuardianDto, {
        guardianFirstName: '',
        guardianLastName: '',
        phoneNumber: 'bad',
        guardianStreetAddress: '',
        guardianCity: '',
        guardianState: 'XX',
        guardianZIP: 'bad',
        links: [
          {
            studentId: 'bad',
            relationshipToStudent: '',
            authorizedToPickUp: 'yes',
          },
        ],
      }),
    ).toHaveLength(8);
  });

  it('validates user profile, registration and role bodies', () => {
    expect(
      errorsFor(RegisterUserDto, {
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'parent',
        dateOfBirth: '1990-04-05',
        phoneNumber: '423-555-1212',
      }),
    ).toEqual([]);
    expect(
      errorsFor(RegisterUserDto, {
        firstName: '',
        lastName: '',
        role: 'admin',
        dateOfBirth: 'bad',
        phoneNumber: '',
      }),
    ).toHaveLength(5);

    expect(errorsFor(UpdateMeDto, { firstName: 'Jane' })).toEqual([]);
    expect(errorsFor(UpdateMeDto, { firstName: '' })).toHaveLength(1);

    expect(errorsFor(UpdateUserRoleDto, { role: 'admin' })).toEqual([]);
    expect(errorsFor(UpdateUserRoleDto, { role: 'owner' })).toHaveLength(1);
  });
});
