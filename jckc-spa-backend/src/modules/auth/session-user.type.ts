import type { Request } from 'express';
import type { AppRole } from '../../common/decorators/roles.decorator';

/** '' = authenticated but not yet registered in-app. */
export type UserRole = '' | AppRole;

/**
 * Shape of the better-auth session user attached to `req.user` by the
 * global AuthGuard (core fields + the configured additionalFields).
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
  registrationStatus: boolean;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
  parentPermission: boolean;
  teacherPermission: boolean;
  adminPermission: boolean;
}

export interface RequestWithUser extends Request {
  user?: SessionUser;
}
