import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Typed link subdocument replacing the legacy untyped `students` Array
 * (core.md §7.4). `_id: false` keeps new writes byte-compatible with
 * legacy elements (plain objects, no per-element _id).
 *
 * NOTE: legacy data may store `student` as a plain STRING id (2026-03-15
 * import) — `scripts/normalize-guardian-links.ts` casts those to
 * ObjectIds; until run, joins must tolerate both. Dangling refs to
 * deleted students must be tolerated on read (populate -> null).
 */
@Schema({ _id: false })
export class GuardianStudentLink {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student' })
  student?: Types.ObjectId;

  @Prop()
  relationshipToStudent?: string;

  @Prop()
  authorizedToPickUp?: boolean;
}

export const GuardianStudentLinkSchema =
  SchemaFactory.createForClass(GuardianStudentLink);

/**
 * Collection `guardians` — field-for-field compatible with the legacy
 * schema. New OPTIONAL field per DESIGN.md decision 2: `userId`
 * (better-auth user id) for parent <-> guardian linking.
 */
@Schema({ collection: 'guardians' })
export class Guardian {
  @Prop({ required: true })
  guardianFirstName: string;

  @Prop({ required: true })
  guardianLastName: string;

  /** Canonical display format `XXX-XXX-XXXX` (established by the legacy migration). */
  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ required: true })
  guardianStreetAddress: string;

  @Prop({ required: true })
  guardianCity: string;

  @Prop({ required: true })
  guardianState: string;

  @Prop({ required: true })
  guardianZIP: string;

  @Prop({ type: [GuardianStudentLinkSchema], default: [] })
  students: GuardianStudentLink[];

  @Prop({ default: Date.now })
  createdAt: Date;

  /** NEW (optional): better-auth user id of the linked parent account. */
  @Prop()
  userId?: string;
}

export type GuardianDocument = HydratedDocument<Guardian>;
export const GuardianSchema = SchemaFactory.createForClass(Guardian);
