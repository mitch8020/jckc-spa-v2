import { StreamableFile } from '@nestjs/common';
import { DashboardController } from './dashboard/dashboard.controller';
import { ClassroomsController } from './classrooms/classrooms.controller';
import { GuardiansController } from './guardians/guardians.controller';
import { HealthController } from './health/health.controller';
import { ReportsController } from './reports/reports.controller';
import { StudentsController } from './students/students.controller';
import { UsersController } from './users/users.controller';

jest.mock('./reports/reports.service', () => ({
  ReportsService: class ReportsService {},
}));

describe('controllers', () => {
  it('delegates classrooms endpoints to ClassroomsService', async () => {
    const service = {
      list: jest.fn().mockResolvedValue(['list']),
      getRoster: jest.fn().mockResolvedValue('roster'),
      getDetails: jest.fn().mockResolvedValue('details'),
      create: jest.fn().mockResolvedValue('created'),
      update: jest.fn().mockResolvedValue('updated'),
      remove: jest.fn().mockResolvedValue(undefined),
      assignStudents: jest.fn().mockResolvedValue('assigned'),
      removeStudents: jest.fn().mockResolvedValue('removed'),
    };
    const controller = new ClassroomsController(service as never);

    await expect(controller.list()).resolves.toEqual(['list']);
    await expect(
      controller.getRoster('room-1', '2', 'ada', '3', 'ben'),
    ).resolves.toBe('roster');
    await expect(controller.getDetails('room-1')).resolves.toBe('details');
    await expect(
      controller.create({
        classroomName: 'Infants',
        ageGroup: 'infant',
        teacherName: 'Ms. Kim',
      }),
    ).resolves.toBe('created');
    await expect(
      controller.update('room-1', {
        classroomName: 'Toddlers',
        ageGroup: 'toddler',
        teacherName: 'Ms. Kay',
      }),
    ).resolves.toBe('updated');
    await expect(controller.remove('room-1')).resolves.toBeUndefined();
    await expect(
      controller.assignStudents('room-1', { studentIds: ['student-1'] }),
    ).resolves.toBe('assigned');
    await expect(
      controller.removeStudents('room-1', { studentIds: ['student-1'] }),
    ).resolves.toBe('removed');

    expect(service.getRoster).toHaveBeenCalledWith('room-1', {
      addPage: '2',
      addSearch: 'ada',
      removePage: '3',
      removeSearch: 'ben',
    });
    expect(service.assignStudents).toHaveBeenCalledWith('room-1', [
      'student-1',
    ]);
    expect(service.removeStudents).toHaveBeenCalledWith('room-1', [
      'student-1',
    ]);
  });

  it('delegates guardian endpoints to GuardiansService', async () => {
    const service = {
      list: jest.fn().mockResolvedValue(['guardian']),
      findOne: jest.fn().mockResolvedValue('one'),
      update: jest.fn().mockResolvedValue('updated'),
      remove: jest.fn().mockResolvedValue(undefined),
      removeLink: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new GuardiansController(service as never);
    const dto = {
      guardianFirstName: 'Grace',
      guardianLastName: 'Hopper',
      phoneNumber: '423-555-1212',
      guardianStreetAddress: '1 Harbor Ln',
      guardianCity: 'Johnson City',
      guardianState: 'TN',
      guardianZIP: '37604',
    };

    await expect(controller.list()).resolves.toEqual(['guardian']);
    await expect(controller.findOne('guardian-1')).resolves.toBe('one');
    await expect(controller.update('guardian-1', dto)).resolves.toBe('updated');
    await expect(controller.remove('guardian-1')).resolves.toBeUndefined();
    await expect(
      controller.removeLink('guardian-1', 'student-1'),
    ).resolves.toBeUndefined();

    expect(service.update).toHaveBeenCalledWith('guardian-1', dto);
    expect(service.removeLink).toHaveBeenCalledWith('guardian-1', 'student-1');
  });

  it('delegates student endpoints to StudentsService', async () => {
    const service = {
      list: jest.fn().mockResolvedValue('list'),
      listMine: jest.fn().mockResolvedValue('mine'),
      getById: jest.fn().mockResolvedValue('student'),
      listGuardiansOfStudent: jest.fn().mockResolvedValue(['guardian']),
      create: jest.fn().mockResolvedValue('created'),
      update: jest.fn().mockResolvedValue('updated'),
      remove: jest.fn().mockResolvedValue(undefined),
      addGuardianToStudent: jest.fn().mockResolvedValue('linked'),
    };
    const controller = new StudentsController(service as never);
    const user = { id: 'user-1' } as never;
    const studentDto = {
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
      dateOfBirth: '2024-03-15',
      studentStreetAddress: '1 Main St',
      studentCity: 'Johnson City',
      studentState: 'TN',
      studentZIP: '37604',
    };
    const guardianDto = {
      guardianId: 'guardian-1',
      relationshipToStudent: 'Mother',
      authorizedToPickUp: true,
    };

    await expect(controller.list('2', 'active', 'ada', 'desc')).resolves.toBe(
      'list',
    );
    await expect(controller.listMine(user)).resolves.toBe('mine');
    await expect(controller.getById('student-1')).resolves.toBe('student');
    await expect(controller.listGuardians('student-1')).resolves.toEqual([
      'guardian',
    ]);
    await expect(controller.create(user, studentDto)).resolves.toBe('created');
    await expect(controller.update('student-1', studentDto)).resolves.toBe(
      'updated',
    );
    await expect(controller.remove('student-1')).resolves.toBeUndefined();
    await expect(
      controller.addGuardian('student-1', guardianDto),
    ).resolves.toBe('linked');

    expect(service.list).toHaveBeenCalledWith('2', 'active', 'ada', 'desc');
    expect(service.listMine).toHaveBeenCalledWith('user-1');
    expect(service.create).toHaveBeenCalledWith(user, studentDto);
    expect(service.addGuardianToStudent).toHaveBeenCalledWith(
      'student-1',
      guardianDto,
    );
  });

  it('delegates user endpoints to UsersService', async () => {
    const service = {
      getMe: jest.fn().mockResolvedValue('me'),
      updateMe: jest.fn().mockResolvedValue('updated-me'),
      register: jest.fn().mockResolvedValue('registered'),
      list: jest.fn().mockResolvedValue('list'),
      updateRole: jest.fn().mockResolvedValue('role'),
    };
    const controller = new UsersController(service as never);
    const user = { id: 'user-1' } as never;
    const updateMe = { firstName: 'Jane' };
    const register = {
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'parent' as const,
      dateOfBirth: '1990-01-01',
      phoneNumber: '423-555-1212',
    };

    await expect(controller.getMe(user)).resolves.toBe('me');
    await expect(controller.updateMe(user, updateMe)).resolves.toBe(
      'updated-me',
    );
    await expect(controller.register(user, register)).resolves.toBe(
      'registered',
    );
    await expect(controller.list('2', 'jane')).resolves.toBe('list');
    await expect(
      controller.updateRole(user, 'target-1', { role: 'teacher' }),
    ).resolves.toBe('role');

    expect(service.getMe).toHaveBeenCalledWith('user-1');
    expect(service.updateMe).toHaveBeenCalledWith('user-1', updateMe);
    expect(service.register).toHaveBeenCalledWith(user, register);
    expect(service.list).toHaveBeenCalledWith('2', 'jane');
    expect(service.updateRole).toHaveBeenCalledWith(
      user,
      'target-1',
      'teacher',
    );
  });

  it('delegates the dashboard endpoint to DashboardService', async () => {
    const service = { getDashboard: jest.fn().mockResolvedValue('dashboard') };
    const controller = new DashboardController(service as never);
    const user = { id: 'user-1' } as never;

    await expect(controller.getDashboard(user)).resolves.toBe('dashboard');

    expect(service.getDashboard).toHaveBeenCalledWith(user);
  });

  it('returns the health payload directly', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });

  it('wraps report PDFs as attachment StreamableFiles', async () => {
    const signIn = Buffer.from('sign-in');
    const rollCall = Buffer.from('roll-call');
    const service = {
      generateSignInSheet: jest.fn().mockResolvedValue(signIn),
      generateRollCallSheet: jest.fn().mockResolvedValue(rollCall),
    };
    const controller = new ReportsController(service as never);

    await expect(controller.getSignInSheet()).resolves.toBeInstanceOf(
      StreamableFile,
    );
    await expect(controller.getRollCallSheet()).resolves.toBeInstanceOf(
      StreamableFile,
    );

    expect(service.generateSignInSheet).toHaveBeenCalledTimes(1);
    expect(service.generateRollCallSheet).toHaveBeenCalledTimes(1);
  });
});
