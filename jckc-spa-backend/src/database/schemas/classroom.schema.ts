import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Collection `classrooms` — field-for-field compatible with the legacy
 * schema (core.md §7.3).
 */
@Schema({ collection: 'classrooms' })
export class Classroom {
  @Prop({ required: true })
  classroomName: string;

  /** 'infant' | 'toddler' | 'preschool' (validated at the DTO layer). */
  @Prop({ required: true })
  ageGroup: string;

  /** Free-text teacher name (not a User ref — legacy parity). */
  @Prop()
  teacherName?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export type ClassroomDocument = HydratedDocument<Classroom>;
export const ClassroomSchema = SchemaFactory.createForClass(Classroom);
