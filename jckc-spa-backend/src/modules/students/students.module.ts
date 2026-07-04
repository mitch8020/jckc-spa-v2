import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Classroom,
  ClassroomSchema,
} from '../../database/schemas/classroom.schema';
import {
  Guardian,
  GuardianSchema,
} from '../../database/schemas/guardian.schema';
import { Student, StudentSchema } from '../../database/schemas/student.schema';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

/**
 * Students feature (students.md / API-CONTRACT.md "Students").
 * Registers the Classroom model too so `.populate('classroom')` always
 * resolves, and the Guardian model for linkage + the delete cascade.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Guardian.name, schema: GuardianSchema },
    ]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
