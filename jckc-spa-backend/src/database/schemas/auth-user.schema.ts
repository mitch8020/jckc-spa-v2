import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mongoose view over better-auth's `user` collection (better-auth's
 * mongodb adapter owns writes for signup/session flows; the Users module
 * reads and updates profile/role fields through this model). Field names
 * mirror better-auth core fields + the configured `additionalFields`
 * (DESIGN.md "Auth" section).
 */
@Schema({ collection: 'user' })
export class AuthUser {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: String, default: null })
  image?: string | null;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  /** '' | 'parent' | 'teacher' | 'admin' (legacy accountType semantics). */
  @Prop({ default: '' })
  role: string;

  /** True once the in-app registration form has been completed. */
  @Prop({ default: false })
  registrationStatus: boolean;

  @Prop({ default: '' })
  firstName: string;

  @Prop({ default: '' })
  lastName: string;

  @Prop({ default: '' })
  phoneNumber: string;

  /** `YYYY-MM-DD` string (legacy format). */
  @Prop({ default: '' })
  dateOfBirth: string;

  @Prop({ default: false })
  parentPermission: boolean;

  @Prop({ default: false })
  teacherPermission: boolean;

  @Prop({ default: false })
  adminPermission: boolean;
}

export type AuthUserDocument = HydratedDocument<AuthUser>;
export const AuthUserSchema = SchemaFactory.createForClass(AuthUser);
