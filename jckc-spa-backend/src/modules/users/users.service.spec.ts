import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuthUser } from '../../database/schemas/auth-user.schema';
import type { SessionUser } from '../auth/session-user.type';
import { UsersService } from './users.service';

const USER_ID = new Types.ObjectId('64b000000000000000000001');
const OTHER_ID = new Types.ObjectId('64b000000000000000000002');

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: USER_ID,
    email: 'jane@example.com',
    name: 'Jane Doe',
    image: null,
    role: '',
    registrationStatus: false,
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dateOfBirth: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: USER_ID.toString(),
    email: 'jane@example.com',
    name: 'Jane Doe',
    image: null,
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    role: '',
    registrationStatus: false,
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dateOfBirth: '',
    parentPermission: false,
    teacherPermission: false,
    adminPermission: false,
    ...overrides,
  };
}

const exec = <T>(value: T) => ({ exec: jest.fn().mockResolvedValue(value) });

describe('UsersService', () => {
  let service: UsersService;
  let userModel: {
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
    find: jest.Mock;
    exists: jest.Mock;
  };
  let configGet: jest.Mock;

  beforeEach(async () => {
    userModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      exists: jest.fn(),
    };
    configGet = jest.fn().mockReturnValue('');

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(AuthUser.name), useValue: userModel },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('getMe', () => {
    it('maps the mongoose doc to a UserDto', async () => {
      userModel.findById.mockReturnValue(exec(makeUserDoc()));

      await expect(service.getMe(USER_ID.toString())).resolves.toEqual({
        id: USER_ID.toString(),
        email: 'jane@example.com',
        name: 'Jane Doe',
        image: null,
        role: '',
        registrationStatus: false,
        firstName: '',
        lastName: '',
        phoneNumber: '',
        dateOfBirth: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(userModel.findById).toHaveBeenCalledWith(USER_ID.toString());
    });

    it('throws 404 for a malformed id without querying', async () => {
      await expect(service.getMe('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('throws 404 when the user does not exist', async () => {
      userModel.findById.mockReturnValue(exec(null));
      await expect(service.getMe(USER_ID.toString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('only $sets the provided fields (plus updatedAt)', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(
        exec(makeUserDoc({ firstName: 'Janet' })),
      );

      await service.updateMe(USER_ID.toString(), { firstName: 'Janet' });

      const [id, update, options] = userModel.findByIdAndUpdate.mock
        .calls[0] as [string, { $set: Record<string, unknown> }, unknown];
      expect(id).toBe(USER_ID.toString());
      expect(update.$set.firstName).toBe('Janet');
      expect(update.$set.updatedAt).toBeInstanceOf(Date);
      expect(update.$set).not.toHaveProperty('lastName');
      expect(update.$set).not.toHaveProperty('dateOfBirth');
      expect(update.$set).not.toHaveProperty('phoneNumber');
      expect(options).toEqual({ returnDocument: 'after' });
    });
  });

  describe('register', () => {
    const dto = {
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'parent' as const,
      dateOfBirth: '1990-04-05',
      phoneNumber: '423-612-1245',
    };

    it('performs a single atomic update setting role, registrationStatus and the legacy permission boolean', async () => {
      userModel.findOneAndUpdate.mockReturnValue(
        exec(
          makeUserDoc({
            role: 'parent',
            registrationStatus: true,
            firstName: 'Jane',
            lastName: 'Doe',
          }),
        ),
      );

      const result = await service.register(makeSessionUser(), dto);

      expect(userModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
      ];
      expect(filter).toEqual({
        _id: USER_ID.toString(),
        registrationStatus: { $ne: true },
      });
      expect(update.$set).toMatchObject({
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-04-05',
        phoneNumber: '423-612-1245',
        role: 'parent',
        registrationStatus: true,
        parentPermission: true,
      });
      expect(result.role).toBe('parent');
    });

    it('sets teacherPermission for teacher registrations', async () => {
      userModel.findOneAndUpdate.mockReturnValue(
        exec(makeUserDoc({ role: 'teacher', registrationStatus: true })),
      );

      await service.register(makeSessionUser(), { ...dto, role: 'teacher' });

      const [, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      expect(update.$set.role).toBe('teacher');
      expect(update.$set.teacherPermission).toBe(true);
      expect(update.$set).not.toHaveProperty('parentPermission');
    });

    it('bootstraps admin when the email is in ADMIN_EMAILS (case-insensitive)', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'ADMIN_EMAILS' ? ' Boss@JCKC.com , other@x.com' : '',
      );
      userModel.findOneAndUpdate.mockReturnValue(
        exec(makeUserDoc({ role: 'admin', registrationStatus: true })),
      );

      await service.register(makeSessionUser({ email: 'boss@jckc.com' }), dto);

      const [, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      expect(update.$set.role).toBe('admin');
      expect(update.$set.adminPermission).toBe(true);
    });

    it('throws 409 when the session already shows registrationStatus true', async () => {
      await expect(
        service.register(makeSessionUser({ registrationStatus: true }), dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('throws 409 when the atomic update loses the race but the user exists', async () => {
      userModel.findOneAndUpdate.mockReturnValue(exec(null));
      userModel.exists.mockReturnValue(exec({ _id: USER_ID }));

      await expect(
        service.register(makeSessionUser(), dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 404 when the user document is gone', async () => {
      userModel.findOneAndUpdate.mockReturnValue(exec(null));
      userModel.exists.mockReturnValue(exec(null));

      await expect(
        service.register(makeSessionUser(), dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    function mockFindChain(docs: unknown[]) {
      const chain = {
        sort: jest.fn(),
        skip: jest.fn(),
        limit: jest.fn(),
        exec: jest.fn().mockResolvedValue(docs),
      };
      chain.sort.mockReturnValue(chain);
      chain.skip.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      userModel.find.mockReturnValue(chain);
      return chain;
    }

    it('applies the legacy pagination math (page 3 of 23 users)', async () => {
      userModel.countDocuments.mockReturnValue(exec(23));
      const chain = mockFindChain([makeUserDoc()]);

      const result = await service.list('3', undefined);

      expect(userModel.countDocuments).toHaveBeenCalledWith({});
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(chain.skip).toHaveBeenCalledWith(20);
      expect(chain.limit).toHaveBeenCalledWith(10);
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
    });

    it('clamps an over-large page to the last page', async () => {
      userModel.countDocuments.mockReturnValue(exec(11));
      const chain = mockFindChain([]);

      const result = await service.list('99', undefined);

      expect(chain.skip).toHaveBeenCalledWith(10);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('reports page 1 of 1 with startIndex 0 for an empty result set', async () => {
      userModel.countDocuments.mockReturnValue(exec(0));
      mockFindChain([]);

      const result = await service.list(undefined, undefined);

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

    it('trims and regex-escapes the search across name/email/firstName/lastName', async () => {
      userModel.countDocuments.mockReturnValue(exec(1));
      mockFindChain([makeUserDoc()]);

      await service.list('1', ' a+b ');

      const expectedFilter = {
        $or: [
          { name: { $regex: 'a\\+b', $options: 'i' } },
          { email: { $regex: 'a\\+b', $options: 'i' } },
          { firstName: { $regex: 'a\\+b', $options: 'i' } },
          { lastName: { $regex: 'a\\+b', $options: 'i' } },
        ],
      };
      expect(userModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
      expect(userModel.find).toHaveBeenCalledWith(expectedFilter);
    });
  });

  describe('updateRole', () => {
    const admin = makeSessionUser({ role: 'admin', registrationStatus: true });

    it('rejects self-demotion with 400 without touching the DB', async () => {
      await expect(
        service.updateRole(admin, USER_ID.toString(), 'parent'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows a self "change" to admin (no-op demotion guard)', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(
        exec(makeUserDoc({ role: 'admin' })),
      );
      await expect(
        service.updateRole(admin, USER_ID.toString(), 'admin'),
      ).resolves.toMatchObject({ role: 'admin' });
    });

    it('updates another user and sets the legacy permission boolean', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(
        exec(makeUserDoc({ _id: OTHER_ID, role: 'teacher' })),
      );

      await service.updateRole(admin, OTHER_ID.toString(), 'teacher');

      const [id, update] = userModel.findByIdAndUpdate.mock.calls[0] as [
        string,
        { $set: Record<string, unknown> },
      ];
      expect(id).toBe(OTHER_ID.toString());
      expect(update.$set.role).toBe('teacher');
      expect(update.$set.teacherPermission).toBe(true);
    });

    it('throws 404 for a malformed id', async () => {
      await expect(
        service.updateRole(admin, 'not-an-object-id', 'parent'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown id', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(exec(null));
      await expect(
        service.updateRole(admin, OTHER_ID.toString(), 'parent'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
