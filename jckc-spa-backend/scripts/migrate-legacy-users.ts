/**
 * Maps legacy `users` collection docs (Passport/Google era, core.md §7.1)
 * to better-auth `user` + `account` documents (DESIGN.md decision 13).
 *
 * - googleId            -> account { providerId: 'google', accountId }
 * - accountType         -> user.role
 * - firstNameApp/...    -> user.firstName / lastName / phoneNumber / dateOfBirth
 * - emailAddress ('' allowed) -> user.email, or placeholder
 *   `legacy-<_id>@placeholder.invalid` with a warning.
 *
 * Idempotent: already-migrated users (matching google account, or user doc
 * with the same _id/email) are skipped or completed (missing account doc
 * added). Nothing is ever deleted.
 *
 * Usage:
 *   npm run migrate:users -- --dry-run
 *   npm run migrate:users -- --write
 */
import mongoose from 'mongoose';
import { loadEnv, parseMode } from './load-env';

interface LegacyUser {
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
  image?: string;
  createdAt?: Date;
  parentPermission?: boolean;
  teacherPermission?: boolean;
  adminPermission?: boolean;
  registrationStatus?: boolean;
}

interface Action {
  type: 'create-user-and-account' | 'create-missing-account' | 'skip';
  legacyId: string;
  email: string;
  role: string;
  reason?: string;
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

  const legacyUsersCol = db.collection<LegacyUser>('users');
  const userCol = db.collection('user');
  const accountCol = db.collection('account');

  const legacyUsers = await legacyUsersCol.find({}).toArray();
  const actions: Action[] = [];
  const warnings: string[] = [];
  let created = 0;
  let accountsAdded = 0;
  let skipped = 0;

  for (const legacy of legacyUsers) {
    const legacyId = legacy._id.toString();
    const googleId = (legacy.googleId ?? '').trim();
    let email = (legacy.emailAddress ?? '').trim().toLowerCase();
    if (!email) {
      email = `legacy-${legacyId}@placeholder.invalid`;
      warnings.push(
        `legacy user ${legacyId} (${legacy.displayName ?? 'unnamed'}) has no emailAddress — assigned placeholder ${email}`,
      );
    }
    if (!googleId) {
      warnings.push(`legacy user ${legacyId} has no googleId — skipped`);
      actions.push({
        type: 'skip',
        legacyId,
        email,
        role: legacy.accountType ?? '',
        reason: 'missing googleId',
      });
      skipped += 1;
      continue;
    }

    const existingAccount = await accountCol.findOne({
      providerId: 'google',
      accountId: googleId,
    });
    if (existingAccount) {
      actions.push({
        type: 'skip',
        legacyId,
        email,
        role: legacy.accountType ?? '',
        reason: 'google account already migrated',
      });
      skipped += 1;
      continue;
    }

    // Find (or plan) the target better-auth user doc.
    let targetUserId: mongoose.mongo.ObjectId | null = null;
    const existingById = await userCol.findOne({ _id: legacy._id });
    if (existingById) {
      targetUserId = legacy._id;
    } else {
      const existingByEmail = await userCol.findOne({ email });
      if (existingByEmail) {
        targetUserId = existingByEmail._id;
        warnings.push(
          `legacy user ${legacyId}: better-auth user already exists for ${email} — linking google account to it`,
        );
      }
    }

    const now = new Date();
    if (targetUserId) {
      actions.push({
        type: 'create-missing-account',
        legacyId,
        email,
        role: legacy.accountType ?? '',
      });
      if (mode === 'write') {
        await accountCol.insertOne({
          _id: new mongoose.mongo.ObjectId(),
          accountId: googleId,
          providerId: 'google',
          userId: targetUserId,
          createdAt: legacy.createdAt ?? now,
          updatedAt: now,
        });
      }
      accountsAdded += 1;
      continue;
    }

    actions.push({
      type: 'create-user-and-account',
      legacyId,
      email,
      role: legacy.accountType ?? '',
    });
    if (mode === 'write') {
      await userCol.insertOne({
        _id: legacy._id, // reuse the legacy id for traceability
        name: legacy.displayName ?? '',
        email,
        emailVerified: false,
        image: legacy.image ?? null,
        createdAt: legacy.createdAt ?? now,
        updatedAt: now,
        role: legacy.accountType ?? '',
        registrationStatus: legacy.registrationStatus === true,
        firstName: legacy.firstNameApp ?? '',
        lastName: legacy.lastNameApp ?? '',
        phoneNumber: legacy.phoneNumber ?? '',
        dateOfBirth: legacy.dateOfBirth ?? '',
        parentPermission: legacy.parentPermission === true,
        teacherPermission: legacy.teacherPermission === true,
        adminPermission: legacy.adminPermission === true,
      });
      await accountCol.insertOne({
        _id: new mongoose.mongo.ObjectId(),
        accountId: googleId,
        providerId: 'google',
        userId: legacy._id,
        createdAt: legacy.createdAt ?? now,
        updatedAt: now,
      });
    }
    created += 1;
  }

  const report = {
    mode,
    summary: {
      totalLegacyUsers: legacyUsers.length,
      usersCreated: created,
      accountsAddedToExistingUsers: accountsAdded,
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
