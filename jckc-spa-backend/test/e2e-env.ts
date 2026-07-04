import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Boots an in-memory MongoDB and points MONGO_URI at it, plus sets every
 * env var required by src/config/env.validation.ts.
 *
 * IMPORTANT: specs must NOT import src/app.module at the top level —
 * ConfigModule.forRoot() evaluates eagerly when that module is first
 * loaded and its validated config outranks later process.env changes, so
 * a top-level import would silently connect to the repo .env's real
 * MONGO_URI. Call this function first, then `await import('../src/app.module')`.
 */
export async function startTestEnvironment(): Promise<MongoMemoryServer> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('jckc-e2e');
  process.env.BETTER_AUTH_SECRET =
    'e2e-test-secret-0123456789abcdef0123456789abcdef';
  process.env.BETTER_AUTH_URL = 'http://localhost:3001';
  process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
  process.env.ADMIN_EMAILS = '';
  return mongod;
}
