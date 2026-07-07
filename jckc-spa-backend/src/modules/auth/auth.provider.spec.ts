import { ConfigService } from '@nestjs/config';
import type { FactoryProvider } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { authProvider, createAuth, AUTH_INSTANCE } from './auth.provider';
import type { AuthInstance } from './auth.provider';

const mockBetterAuth = jest.fn((options: unknown) => ({ options }));
const mockMongodbAdapter = jest.fn((db: unknown) => ({ db }));

jest.mock('better-auth', () => ({
  betterAuth: (options: unknown) => mockBetterAuth(options),
}));

jest.mock('better-auth/adapters/mongodb', () => ({
  mongodbAdapter: (db: unknown) => mockMongodbAdapter(db),
}));

function makeConnection(db: unknown): Connection {
  return {
    getClient: () => ({
      db: () => db,
    }),
  } as unknown as Connection;
}

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Missing ${key}`);
      }
      return value;
    }),
  } as unknown as ConfigService;
}

describe('createAuth', () => {
  beforeEach(() => {
    mockBetterAuth.mockClear();
    mockMongodbAdapter.mockClear();
  });

  it('enables Google when both OAuth credentials are configured', () => {
    const db = { name: 'jckc' };
    const auth = createAuth(
      makeConnection(db),
      makeConfig({
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        BETTER_AUTH_URL: 'http://localhost:3001',
        BETTER_AUTH_SECRET: 'secret',
        FRONTEND_ORIGIN: 'http://localhost:3000, http://localhost:5173',
      }),
    );

    expect(mockMongodbAdapter).toHaveBeenCalledWith(db);
    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        database: { db },
        baseURL: 'http://localhost:3001',
        basePath: '/api/auth',
        secret: 'secret',
        trustedOrigins: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ],
        emailAndPassword: { enabled: true },
        socialProviders: {
          google: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
          },
        },
      }),
    );
    expect(auth).toBeDefined();
  });

  it('omits social providers when either Google credential is missing', () => {
    createAuth(
      makeConnection({}),
      makeConfig({
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: undefined,
        BETTER_AUTH_URL: 'http://localhost:3001',
        BETTER_AUTH_SECRET: 'secret',
        FRONTEND_ORIGIN: 'http://localhost:3000',
      }),
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({ socialProviders: undefined }),
    );
  });

  it('exposes a Nest provider factory for the auth instance', () => {
    const provider = authProvider as FactoryProvider<AuthInstance>;

    expect(provider.provide).toBe(AUTH_INSTANCE);
    const auth = provider.useFactory(
      makeConnection({}),
      makeConfig({
        BETTER_AUTH_URL: 'http://localhost:3001',
        BETTER_AUTH_SECRET: 'secret',
        FRONTEND_ORIGIN: 'http://localhost:3000',
      }),
    );

    expect(auth).toBeDefined();
  });
});
