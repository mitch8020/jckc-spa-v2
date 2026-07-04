import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Collection `students` — field-for-field compatible with the legacy
 * schema (core.md §7.2). No timestamps option (legacy has only
 * `createdAt`, default Date.now). New OPTIONAL fields per DESIGN.md
 * decision 2: `createdByUserId` + `applicationApprovalStatus` (missing
 * on all legacy docs = treated as approved).
 */
@Schema({ collection: 'students' })
export class Student {
  @Prop({ required: true })
  studentFirstName: string;

  @Prop({ required: true })
  studentLastName: string;

  /** Stored as a `YYYY-MM-DD` STRING (legacy format — never a Date). */
  @Prop({ required: true })
  dateOfBirth: string;

  @Prop({ required: true })
  studentStreetAddress: string;

  @Prop({ required: true })
  studentCity: string;

  @Prop({ required: true })
  studentState: string;

  /** ZIP stored as a String (legacy quirk preserved). */
  @Prop({ required: true })
  studentZIP: string;

  /** Legacy denormalized field — never written by the new app, kept for data compatibility. */
  @Prop()
  teacherName?: string;

  /** 'infant' | 'toddler' | 'preschool' — written at classroom-assignment time. */
  @Prop()
  ageGroup?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Classroom' })
  classroom?: Types.ObjectId | null;

  @Prop({ default: Date.now })
  createdAt: Date;

  /** NEW (optional): better-auth user id of the parent who created this student. */
  @Prop()
  createdByUserId?: string;

  /** NEW (optional): pending-application flag; missing (all legacy docs) = approved. */
  @Prop()
  applicationApprovalStatus?: boolean;
}

export type StudentDocument = HydratedDocument<Student>;
export const StudentSchema = SchemaFactory.createForClass(Student);
