import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter } from 'mongoose';
import type { AppRole } from '../../common/decorators/roles.decorator';
import { escapeRegex } from '../../common/utils/escape-regex';
import { buildPagination, parsePage } from '../../common/utils/pagination';
import type { Paginated } from '../../common/utils/pagination';
import {
  AuthUser,
  AuthUserDocument,
} from '../../database/schemas/auth-user.schema';
import type { SessionUser, UserRole } from '../auth/session-user.type';
import type { RegisterUserDto } from './dto/register-user.dto';
import type { UpdateMeDto } from './dto/update-me.dto';
import type { UserDto } from './dto/user.dto';

/** Legacy permission boolean kept in sync for data continuity (DESIGN.md decision 1). */
const PERMISSION_FIELD: Record<AppRole, string> = {
  parent: 'parentPermission',
  teacher: 'teacherPermission',
  admin: 'adminPermission',
};

const SEARCH_FIELDS = ['name', 'email', 'firstName', 'lastName'] as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(AuthUser.name)
    private readonly userModel: Model<AuthUserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async getMe(userId: string): Promise<UserDto> {
    if (!isValidObjectId(userId)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toDto(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<UserDto> {
    if (!isValidObjectId(userId)) {
      throw new NotFoundException('User not found');
    }
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.firstName !== undefined) {
      set.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      set.lastName = dto.lastName;
    }
    if (dto.dateOfBirth !== undefined) {
      set.dateOfBirth = dto.dateOfBirth;
    }
    if (dto.phoneNumber !== undefined) {
      set.phoneNumber = dto.phoneNumber;
    }
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: set }, { returnDocument: 'after' })
      .exec();
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return this.toDto(updated);
  }

  /**
   * Completes in-app registration for the AUTHENTICATED user (fixes the
   * legacy IDOR). Single atomic update: profile fields + role +
   * registrationStatus + the matching legacy permission boolean. 409 if
   * already registered; ADMIN_EMAILS bootstrap overrides the requested
   * role with 'admin'.
   */
  async register(user: SessionUser, dto: RegisterUserDto): Promise<UserDto> {
    if (!isValidObjectId(user.id)) {
      throw new NotFoundException('User not found');
    }
    if (user.registrationStatus) {
      throw new ConflictException('User is already registered');
    }

    const role: AppRole = this.isBootstrapAdmin(user.email)
      ? 'admin'
      : dto.role;

    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: user.id, registrationStatus: { $ne: true } },
        {
          $set: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: dto.dateOfBirth,
            phoneNumber: dto.phoneNumber,
            role,
            registrationStatus: true,
            [PERMISSION_FIELD[role]]: true,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      const exists = await this.userModel.exists({ _id: user.id }).exec();
      if (exists) {
        throw new ConflictException('User is already registered');
      }
      throw new NotFoundException('User not found');
    }
    return this.toDto(updated);
  }

  /**
   * Admin user list: page size 10, search on name/email/firstName/
   * lastName (trimmed, regex-escaped, case-insensitive), sorted by
   * createdAt desc.
   */
  async list(
    pageRaw?: string,
    searchRaw?: string,
  ): Promise<Paginated<UserDto>> {
    const page = parsePage(pageRaw);
    const search = (searchRaw ?? '').trim();

    const filter: QueryFilter<AuthUser> = {};
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = SEARCH_FIELDS.map((field) => ({
        [field]: { $regex: pattern, $options: 'i' },
      }));
    }

    const totalCount = await this.userModel.countDocuments(filter).exec();
    const { skip, limit, pagination } = buildPagination(totalCount, page);
    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { items: users.map((user) => this.toDto(user)), pagination };
  }

  /**
   * Admin role change; 400 when an admin demotes THEMSELVES (self-lockout
   * guard). Also sets the matching legacy permission boolean (legacy
   * flags only ever accumulate to true).
   */
  async updateRole(
    actingUser: SessionUser,
    id: string,
    role: AppRole,
  ): Promise<UserDto> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('User not found');
    }
    if (actingUser.id === id && role !== 'admin') {
      throw new BadRequestException('Admins cannot demote their own account');
    }
    const updated = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            role,
            [PERMISSION_FIELD[role]]: true,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return this.toDto(updated);
  }

  private isBootstrapAdmin(email: string): boolean {
    const adminEmails = (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);
    return adminEmails.includes(email.trim().toLowerCase());
  }

  private toDto(user: AuthUserDocument): UserDto {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      image: user.image ?? null,
      role: (user.role ?? '') as UserRole,
      registrationStatus: user.registrationStatus === true,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phoneNumber: user.phoneNumber ?? '',
      dateOfBirth: user.dateOfBirth ?? '',
      createdAt:
        user.createdAt instanceof Date ? user.createdAt.toISOString() : '',
    };
  }
}
