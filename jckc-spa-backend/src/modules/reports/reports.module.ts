import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Classroom,
  ClassroomSchema,
} from '../../database/schemas/classroom.schema';
import { Student, StudentSchema } from '../../database/schemas/student.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * PDF report generation (reports.md / API-CONTRACT.md "Reports").
 * PDFs are built in memory per request with pdfmake's PdfPrinter; the
 * Roboto fonts live in src/assets/fonts (copied to dist/assets/fonts
 * by the nest-cli asset copy) and are resolved relative to the module.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
