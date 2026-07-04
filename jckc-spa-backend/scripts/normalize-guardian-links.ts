/**
 * Casts string `students[].student` ids on guardian docs to ObjectIds
 * (DESIGN.md decision 13). The 2026-03-15 legacy import wrote link ids as
 * plain STRINGS because the legacy schema declared `students` as an
 * untyped Array (core.md §7.4); the new typed schema expects ObjectIds.
 *
 * Idempotent: ObjectId links are untouched; non-castable strings are
 * reported and left as-is; nothing is deleted.
 *
 * Usage:
 *   npm run migrate:guardian-links -- --dry-run
 *   npm run migrate:guardian-links -- --write
 */
import mongoose from 'mongoose';
import { loadEnv, parseMode } from './load-env';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

interface GuardianLinkRaw {
  student?: unknown;
  relationshipToStudent?: unknown;
  authorizedToPickUp?: unknown;
  [key: string]: unknown;
}

interface GuardianRaw {
  _id: mongoose.mongo.ObjectId;
  guardianFirstName?: string;
  guardianLastName?: string;
  students?: unknown;
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

  const guardianCol = db.collection<GuardianRaw>('guardians');
  const guardians = await guardianCol.find({}).toArray();

  const actions: {
    guardianId: string;
    guardianName: string;
    linksCast: number;
  }[] = [];
  const warnings: string[] = [];
  let guardiansUpdated = 0;
  let totalLinksCast = 0;

  for (const guardian of guardians) {
    const guardianId = guardian._id.toString();
    const guardianName =
      `${guardian.guardianFirstName ?? ''} ${guardian.guardianLastName ?? ''}`.trim();
    if (!Array.isArray(guardian.students)) {
      if (guardian.students !== undefined && guardian.students !== null) {
        warnings.push(
          `guardian ${guardianId} (${guardianName}): students is not an array — skipped`,
        );
      }
      continue;
    }

    let linksCast = 0;
    const newLinks = (guardian.students as GuardianLinkRaw[]).map(
      (link, index) => {
        if (link === null || typeof link !== 'object') {
          warnings.push(
            `guardian ${guardianId} (${guardianName}): students[${index}] is not an object — left as-is`,
          );
          return link;
        }
        if (typeof link.student === 'string') {
          if (OBJECT_ID_REGEX.test(link.student)) {
            linksCast += 1;
            return {
              ...link,
              student: new mongoose.mongo.ObjectId(link.student),
            };
          }
          warnings.push(
            `guardian ${guardianId} (${guardianName}): students[${index}].student '${link.student}' is not a castable ObjectId — left as-is`,
          );
        } else if (link.student === undefined || link.student === null) {
          warnings.push(
            `guardian ${guardianId} (${guardianName}): students[${index}] has no student id — left as-is`,
          );
        }
        return link;
      },
    );

    if (linksCast > 0) {
      actions.push({ guardianId, guardianName, linksCast });
      guardiansUpdated += 1;
      totalLinksCast += linksCast;
      if (mode === 'write') {
        await guardianCol.updateOne(
          { _id: guardian._id },
          { $set: { students: newLinks } },
        );
      }
    }
  }

  const report = {
    mode,
    summary: {
      totalGuardians: guardians.length,
      guardiansUpdated,
      linksCast: totalLinksCast,
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
