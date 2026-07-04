import { SetMetadata } from '@nestjs/common';

/** Canonical role enum (DESIGN.md decision 1). */
export type AppRole = 'parent' | 'teacher' | 'admin';

export const ROLES_KEY = 'roles';

/** Restricts a route (or controller) to users holding one of the roles. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
