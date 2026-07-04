import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Classroom,
  ClassroomSchema,
} from '../../database/schemas/classroom.schema';
import { Student, StudentSchema } from '../../database/schemas/student.schema';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomsService } from './classrooms.service';

/**
 * Classrooms feature (classrooms.md / API-CONTRACT.md): CRUD + the
 * dual-pane roster management endpoints. Exports the service so the
 * dashboard can reuse the classrooms-with-counts aggregation.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [ClassroomsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}
