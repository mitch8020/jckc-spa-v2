import { MongoClient, ObjectId, type Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  buildAuthDatabaseHooks,
  buildGoogleProfileMapper,
  isAllowedAuthEmail,
  parseAllowedAuthEmails,
} from './auth-email-access';

describe('auth email access', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('auth-email-access');
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    await db.collection('account').deleteMany({});
  });

  it('uses the configured allowed emails case-insensitively', () => {
    const allowed = parseAllowedAuthEmails(' JPmitra.SWE@gmail.com , ');

    expect(isAllowedAuthEmail('jpmitra.swe@gmail.com', allowed)).toBe(true);
    expect(isAllowedAuthEmail('other@example.com', allowed)).toBe(false);
  });

  it('normalizes an allowed legacy Google user before Better Auth links it', async () => {
    const userId = new ObjectId();
    const pendingUserId = new ObjectId();
    await db.collection('users').insertMany([
      {
        _id: pendingUserId,
        email: 'jpmitra.swe@gmail.com',
        name: 'Pending OAuth User',
      },
      {
        _id: userId,
        emailAddress: 'JPMitra.SWE@gmail.com',
        accountType: 'admin',
        firstNameApp: 'JP',
        lastNameApp: 'Mitra',
        phoneNumber: '4235550100',
        dateOfBirth: '1990-01-01',
      },
    ]);

    const allowed = parseAllowedAuthEmails(undefined);
    const mapProfileToUser = buildGoogleProfileMapper(db, allowed);

    await expect(
      mapProfileToUser({
        sub: 'google-account-1',
        email: 'jpmitra.swe@gmail.com',
        email_verified: true,
        name: 'JP Mitra',
        picture: 'https://example.com/avatar.png',
      }),
    ).resolves.toMatchObject({
      email: 'jpmitra.swe@gmail.com',
      emailVerified: true,
      name: 'JP Mitra',
    });

    const user = await db.collection('users').findOne({ _id: userId });
    expect(user).toMatchObject({
      email: 'jpmitra.swe@gmail.com',
      emailVerified: true,
      role: 'admin',
      registrationStatus: true,
      adminPermission: true,
      firstName: 'JP',
      lastName: 'Mitra',
    });

    const pendingUser = await db
      .collection('users')
      .findOne({ _id: pendingUserId });
    expect(pendingUser).not.toMatchObject({
      role: 'admin',
      registrationStatus: true,
    });

    const linkedAccount = await db
      .collection<{ userId: ObjectId | string }>('account')
      .findOne({
        providerId: 'google',
        accountId: 'google-account-1',
      });
    expect(String(linkedAccount?.userId)).toBe(userId.toString());

    const hooks = buildAuthDatabaseHooks(db, allowed);
    await expect(
      hooks.session.create.before({ userId: userId.toString() }),
    ).resolves.toBe(true);
  });

  it('rejects users and sessions for emails outside the allowed list', async () => {
    const userId = new ObjectId();
    await db.collection('users').insertOne({
      _id: userId,
      email: 'blocked@example.com',
    });

    const allowed = parseAllowedAuthEmails(undefined);
    const hooks = buildAuthDatabaseHooks(db, allowed);

    await expect(
      hooks.user.create.before({ email: 'blocked@example.com' }),
    ).resolves.toBe(false);
    await expect(
      hooks.session.create.before({ userId: userId.toString() }),
    ).resolves.toBe(false);
    await expect(
      buildGoogleProfileMapper(
        db,
        allowed,
      )({
        email: 'blocked@example.com',
        email_verified: true,
      }),
    ).rejects.toThrow('not authorized');
  });

  it('does not link an allowed Google account when the email is unverified', async () => {
    await db.collection('users').insertOne({
      _id: new ObjectId(),
      emailAddress: 'jpmitra.swe@gmail.com',
      accountType: 'admin',
    });

    const allowed = parseAllowedAuthEmails(undefined);
    await expect(
      buildGoogleProfileMapper(
        db,
        allowed,
      )({
        sub: 'unverified-google-account',
        email: 'jpmitra.swe@gmail.com',
        email_verified: false,
      }),
    ).rejects.toThrow('email is not verified');

    await expect(
      db.collection('account').findOne({
        providerId: 'google',
        accountId: 'unverified-google-account',
      }),
    ).resolves.toBeNull();
  });
});
