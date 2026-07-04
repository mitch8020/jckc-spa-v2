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
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard feature (auth-dashboards.md §4.6 / API-CONTRACT.md).
 * Classroom is registered here too so `populate('classroom')` always
 * has the model available; ClassroomsModule supplies the shared
 * classrooms-with-counts aggregation.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Guardian.name, schema: GuardianSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
    ClassroomsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
