import { ObjectId, type Collection, type Db } from 'mongodb';

export const DEFAULT_AUTH_ALLOWED_EMAILS = [
  'jpmitra.swe@gmail.com',
  'mitrajs@yahoo.com',
  'khinson60@yahoo.com',
] as const;

type AppRole = 'parent' | 'teacher' | 'admin';

interface GoogleProfile {
  sub?: string;
  email?: string | null;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

interface AuthUserCollectionDoc {
  _id: ObjectId | string;
  email?: string;
  emailAddress?: string;
  emailVerified?: boolean;
  name?: string;
  displayName?: string;
  image?: string | null;
  firstName?: string;
  lastName?: string;
  firstNameApp?: string;
  lastNameApp?: string;
  firstNameGoog?: string;
  lastNameGoog?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  role?: string;
  accountType?: string;
  registrationStatus?: boolean;
  parentPermission?: boolean;
  teacherPermission?: boolean;
  adminPermission?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type AuthUsersCollection = Collection<AuthUserCollectionDoc>;
type AuthAccountsCollection = Collection<{
  _id: ObjectId;
  providerId: string;
  accountId: string;
  userId: ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}>;

export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function parseAllowedAuthEmails(
  raw: string | undefined,
): ReadonlySet<string> {
  const source =
    raw && raw.trim().length > 0 ? raw : DEFAULT_AUTH_ALLOWED_EMAILS.join(',');
  return new Set(
    source
      .split(',')
      .map((email) => normalizeAuthEmail(email))
      .filter(Boolean),
  );
}

export function isAllowedAuthEmail(
  email: string | null | undefined,
  allowedEmails: ReadonlySet<string>,
): boolean {
  return allowedEmails.has(normalizeAuthEmail(email));
}

export function buildGoogleProfileMapper(
  db: Db,
  allowedEmails: ReadonlySet<string>,
) {
  return async (profile: GoogleProfile): Promise<Record<string, unknown>> => {
    const email = normalizeAuthEmail(profile.email);
    if (!isAllowedAuthEmail(email, allowedEmails)) {
      throw new Error('Google account is not authorized for this app');
    }
    if (profile.email_verified !== true) {
      throw new Error('Google account email is not verified');
    }

    const existing = await normalizeExistingGoogleUser(
      db.collection('users'),
      profile,
      email,
    );
    if (existing && profile.sub) {
      await linkGoogleAccountToUser(
        db.collection('account'),
        profile.sub,
        existing._id,
      );
    }

    return {
      email,
      emailVerified: profile.email_verified === true,
      name: firstNonEmpty(profile.name, email),
      image: profile.picture,
    };
  };
}

export function buildAuthDatabaseHooks(
  db: Db,
  allowedEmails: ReadonlySet<string>,
) {
  const users = db.collection<AuthUserCollectionDoc>('users');

  return {
    user: {
      create: {
        before: (user: { email?: string | null }) =>
          Promise.resolve(isAllowedAuthEmail(user.email, allowedEmails)),
      },
    },
    session: {
      create: {
        before: async (session: { userId?: string | null }) => {
          const user = await findAuthUserById(users, session.userId);
          return isAllowedAuthEmail(
            user?.email ?? user?.emailAddress,
            allowedEmails,
          );
        },
      },
    },
  };
}

async function normalizeExistingGoogleUser(
  users: AuthUsersCollection,
  profile: GoogleProfile,
  email: string,
): Promise<AuthUserCollectionDoc | null> {
  const existing = await findBestAuthUserByEmail(users, email);
  if (!existing) {
    return null;
  }

  const role =
    normalizeRole(existing.role) || normalizeRole(existing.accountType);
  const firstName = firstNonEmpty(
    existing.firstName,
    existing.firstNameApp,
    profile.given_name,
    existing.firstNameGoog,
  );
  const lastName = firstNonEmpty(
    existing.lastName,
    existing.lastNameApp,
    profile.family_name,
    existing.lastNameGoog,
  );
  const set: Record<string, unknown> = {
    email,
    updatedAt: new Date(),
  };

  if (profile.email_verified === true) {
    set.emailVerified = true;
  } else if (typeof existing.emailVerified !== 'boolean') {
    set.emailVerified = false;
  }
  setIfBlank(
    set,
    existing,
    'name',
    firstNonEmpty(existing.displayName, profile.name, email),
  );
  setIfBlank(set, existing, 'image', profile.picture ?? null);
  setIfBlank(set, existing, 'firstName', firstName);
  setIfBlank(set, existing, 'lastName', lastName);
  setIfBlank(set, existing, 'phoneNumber', existing.phoneNumber ?? '');
  setIfBlank(set, existing, 'dateOfBirth', existing.dateOfBirth ?? '');
  if (role) {
    set.role = role;
    set.registrationStatus = true;
    set[`${role}Permission`] = true;
  } else if (existing.registrationStatus === undefined) {
    set.registrationStatus = false;
  }
  if (existing.parentPermission === undefined) {
    set.parentPermission = role === 'parent';
  }
  if (existing.teacherPermission === undefined) {
    set.teacherPermission = role === 'teacher';
  }
  if (existing.adminPermission === undefined) {
    set.adminPermission = role === 'admin';
  }
  if (!(existing.createdAt instanceof Date)) {
    set.createdAt = new Date();
  }

  await users.updateOne({ _id: existing._id }, { $set: set });
  return existing;
}

async function findBestAuthUserByEmail(
  users: AuthUsersCollection,
  email: string,
): Promise<AuthUserCollectionDoc | null> {
  const emailPattern = new RegExp(`^${escapeRegex(email)}$`, 'i');
  const candidates = await users
    .find({
      $or: [{ email: emailPattern }, { emailAddress: emailPattern }],
    })
    .toArray();
  return (
    candidates.sort((a, b) => userPriority(b) - userPriority(a))[0] ?? null
  );
}

async function linkGoogleAccountToUser(
  accounts: AuthAccountsCollection,
  googleAccountId: string,
  userId: ObjectId | string,
): Promise<void> {
  const now = new Date();
  await accounts.updateOne(
    { providerId: 'google', accountId: googleAccountId },
    {
      $set: { userId, updatedAt: now },
      $setOnInsert: {
        _id: new ObjectId(),
        providerId: 'google',
        accountId: googleAccountId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

function userPriority(user: AuthUserCollectionDoc): number {
  const role = normalizeRole(user.role) || normalizeRole(user.accountType);
  return (
    (role ? 100 : 0) +
    (user.registrationStatus === true ? 10 : 0) +
    (user.emailAddress ? 1 : 0)
  );
}

async function findAuthUserById(
  users: AuthUsersCollection,
  userId: string | null | undefined,
): Promise<AuthUserCollectionDoc | null> {
  const id = (userId ?? '').trim();
  if (!id) {
    return null;
  }
  const ids: Array<string | ObjectId> = [id];
  if (ObjectId.isValid(id)) {
    ids.unshift(new ObjectId(id));
  }
  return users.findOne({ _id: { $in: ids } });
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  return values.map((value) => value?.trim() ?? '').find(Boolean) ?? '';
}

function normalizeRole(value: string | null | undefined): AppRole | '' {
  return value === 'parent' || value === 'teacher' || value === 'admin'
    ? value
    : '';
}

function setIfBlank(
  target: Record<string, unknown>,
  doc: AuthUserCollectionDoc,
  field: keyof AuthUserCollectionDoc,
  value: unknown,
): void {
  const current = doc[field];
  if (
    current === undefined ||
    current === null ||
    (typeof current === 'string' && current.trim() === '')
  ) {
    target[field] = value;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
