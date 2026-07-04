import type { UserRole } from '../../auth/session-user.type';

/** Wire shape per API-CONTRACT.md "Shared DTO shapes". */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: UserRole;
  registrationStatus: boolean;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
  createdAt: string;
}
