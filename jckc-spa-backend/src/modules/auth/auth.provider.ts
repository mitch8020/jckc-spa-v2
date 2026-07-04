import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { betterAuth } from 'better-auth';
import type { Auth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import type { Db } from 'mongodb';
import type { Connection } from 'mongoose';

/** Injection token for the better-auth instance. */
export const AUTH_INSTANCE = 'AUTH_INSTANCE';

export type AuthInstance = Auth;

/**
 * Builds the better-auth instance on top of the existing mongoose
 * connection (DESIGN.md "Auth" section). Google OAuth is only enabled
 * when credentials are configured; better-auth's Google provider
 * requests the openid/email/profile scopes by default, so the user's
 * email IS captured (fixes the legacy profile-only-scope quirk).
 */
export function createAuth(
  connection: Connection,
  config: ConfigService,
): AuthInstance {
  const googleClientId = config.get<string>('GOOGLE_CLIENT_ID');
  const googleClientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
  const socialProviders =
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined;

  return betterAuth({
    database: mongodbAdapter(connection.getClient().db() as unknown as Db),
    baseURL: config.getOrThrow<string>('BETTER_AUTH_URL'),
    basePath: '/api/auth',
    secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
    trustedOrigins: [config.getOrThrow<string>('FRONTEND_ORIGIN')],
    emailAndPassword: { enabled: true },
    socialProviders,
    user: {
      additionalFields: {
        // Privileged fields are input: false so a signup request cannot
        // self-assign a role/registration/permissions — they change only
        // through POST /api/users/register and the admin Users endpoints.
        role: { type: 'string', defaultValue: '', input: false },
        registrationStatus: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        firstName: { type: 'string', defaultValue: '' },
        lastName: { type: 'string', defaultValue: '' },
        phoneNumber: { type: 'string', defaultValue: '' },
        dateOfBirth: { type: 'string', defaultValue: '' },
        parentPermission: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        teacherPermission: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        adminPermission: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
      },
    },
  }) as unknown as AuthInstance;
}

export const authProvider: Provider = {
  provide: AUTH_INSTANCE,
  inject: [getConnectionToken(), ConfigService],
  useFactory: (connection: Connection, config: ConfigService) =>
    createAuth(connection, config),
};
