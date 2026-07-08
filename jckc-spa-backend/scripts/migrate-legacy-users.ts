/**
 * Normalizes legacy `users` collection docs (Passport/Google era, core.md
 * section 7.1) in place for better-auth, then creates matching `account`
 * documents.
 *
 * - googleId            -> account { providerId: 'google', accountId }
 * - accountType         -> users.role
 * - firstNameApp/...    -> users.firstName / lastName / phoneNumber / dateOfBirth
 * - emailAddress        -> users.email, or placeholder
 *   `legacy-<_id>@placeholder.invalid` with a warning.
 *
 * Idempotent: already-normalized fields are preserved, existing google
 * accounts are skipped, and missing account docs are added. Nothing is ever
 * deleted, and this script never writes to a singular `user` collection.
 *
 * Usage:
 *   npm run migrate:users -- --dry-run
 *   npm run migrate:users -- --write
 */
import mongoose from 'mongoose';
import { loadEnv, parseMode } from './load-env';

interface UserCollectionDoc {
  _id: mongoose.mongo.ObjectId;
  googleId?: string;
  displayName?: string;
  firstNameGoog?: string;
  lastNameGoog?: string;
  firstNameApp?: string;
  lastNameApp?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  emailAddress?: string;
  accountType?: string;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  parentPermission?: boolean;
  teacherPermission?: boolean;
  adminPermission?: boolean;
  registrationStatus?: boolean;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  firstName?: string;
  lastName?: string;
}

interface Action {
  type:
    | 'update-user-and-create-account'
    | 'update-user'
    | 'create-missing-account'
    | 'skip';
  userId: string;
  email: string;
  role: string;
  reason?: string;
  updatedFields?: string[];
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.map((value) => value?.trim() ?? '').find(Boolean) ?? '';
}

function setIfMissing(
  target: Record<string, unknown>,
  doc: UserCollectionDoc,
  field: keyof UserCollectionDoc,
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

function buildUserUpdate(
  user: UserCollectionDoc,
  email: string,
  now: Date,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  const firstName = firstNonEmpty(user.firstName, user.firstNameApp);
  const lastName = firstNonEmpty(user.lastName, user.lastNameApp);
  const name = firstNonEmpty(
    user.name,
    user.displayName,
    [user.firstNameGoog, user.lastNameGoog].filter(Boolean).join(' '),
    [firstName, lastName].filter(Boolean).join(' '),
    email,
  );

  setIfMissing(update, user, 'name', name);
  setIfMissing(update, user, 'email', email);
  setIfMissing(update, user, 'image', user.image ?? null);
  setIfMissing(update, user, 'firstName', firstName);
  setIfMissing(update, user, 'lastName', lastName);
  setIfMissing(update, user, 'phoneNumber', user.phoneNumber ?? '');
  setIfMissing(update, user, 'dateOfBirth', user.dateOfBirth ?? '');

  if (typeof user.emailVerified !== 'boolean') {
    update.emailVerified = false;
  }
  if (!(user.createdAt instanceof Date)) {
    update.createdAt = now;
  }
  if (!(user.updatedAt instanceof Date)) {
    update.updatedAt = now;
  }
  if (!user.role && user.accountType) {
    update.role = user.accountType;
  }
  if (user.registrationStatus === undefined) {
    update.registrationStatus = false;
  }
  if (user.parentPermission === undefined) {
    update.parentPermission = false;
  }
  if (user.teacherPermission === undefined) {
    update.teacherPermission = false;
  }
  if (user.adminPermission === undefined) {
    update.adminPermission = false;
  }

  const changedFields = Object.keys(update).filter(
    (field) => field !== 'updatedAt',
  );
  if (changedFields.length > 0 && !('updatedAt' in update)) {
    update.updatedAt = now;
  }

  return update;
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  loadEnv();

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set (env var or .env file required)');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Mongoose connection has no db handle');
  }

  const usersCol = db.collection<UserCollectionDoc>('users');
  const accountCol = db.collection('account');

  const users = await usersCol.find({}).toArray();
  const actions: Action[] = [];
  const warnings: string[] = [];
  let usersUpdated = 0;
  let accountsAdded = 0;
  let skipped = 0;

  for (const user of users) {
    const userId = user._id.toString();
    const googleId = (user.googleId ?? '').trim();
    let email = firstNonEmpty(user.email, user.emailAddress).toLowerCase();
    if (!email) {
      email = `legacy-${userId}@placeholder.invalid`;
      warnings.push(
        `user ${userId} (${user.displayName ?? 'unnamed'}) has no email/emailAddress; assigned placeholder ${email}`,
      );
    }

    const now = new Date();
    const userUpdate = buildUserUpdate(user, email, now);
    const updatedFields = Object.keys(userUpdate).sort();
    const role = user.role || user.accountType || '';

    if (updatedFields.length > 0) {
      if (mode === 'write') {
        await usersCol.updateOne({ _id: user._id }, { $set: userUpdate });
      }
      usersUpdated += 1;
    }

    if (!googleId) {
      if (updatedFields.length > 0) {
        warnings.push(
          `user ${userId} has no googleId; normalized user fields only`,
        );
        actions.push({
          type: 'update-user',
          userId,
          email,
          role,
          reason: 'missing googleId',
          updatedFields,
        });
      } else {
        actions.push({
          type: 'skip',
          userId,
          email,
          role,
          reason: 'missing googleId',
        });
        skipped += 1;
      }
      continue;
    }

    const existingAccount = await accountCol.findOne({
      providerId: 'google',
      accountId: googleId,
    });
    if (existingAccount) {
      actions.push({
        type: updatedFields.length > 0 ? 'update-user' : 'skip',
        userId,
        email,
        role,
        reason: 'google account already migrated',
        ...(updatedFields.length > 0 ? { updatedFields } : {}),
      });
      if (updatedFields.length === 0) {
        skipped += 1;
      }
      continue;
    }

    actions.push({
      type:
        updatedFields.length > 0
          ? 'update-user-and-create-account'
          : 'create-missing-account',
      userId,
      email,
      role,
      ...(updatedFields.length > 0 ? { updatedFields } : {}),
    });
    if (mode === 'write') {
      await accountCol.insertOne({
        _id: new mongoose.mongo.ObjectId(),
        accountId: googleId,
        providerId: 'google',
        userId: user._id,
        createdAt: user.createdAt ?? now,
        updatedAt: now,
      });
    }
    accountsAdded += 1;
  }

  const report = {
    mode,
    summary: {
      totalUsers: users.length,
      usersUpdated,
      accountsAdded,
      skipped,
      warnings: warnings.length,
    },
    actions,
    warnings,
  };
  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
