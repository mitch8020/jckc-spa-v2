import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import PdfPrinter from 'pdfmake/js/Printer';
import URLResolver from 'pdfmake/js/URLResolver';
import {
  Classroom,
  ClassroomDocument,
} from '../../database/schemas/classroom.schema';
import {
  Student,
  StudentDocument,
} from '../../database/schemas/student.schema';
import {
  buildRollCallSheetDefinition,
  buildSignInSheetDefinition,
} from './reports.documents';
import type { ReportClassroom, ReportStudent } from './reports.documents';

/**
 * The Roboto TTFs live in `src/assets/fonts` and are copied to
 * `dist/assets/fonts` by the nest-cli asset copy (DESIGN.md decision
 * 10). Resolved relative to THIS module — never `process.cwd()` — so
 * report generation works from any launch directory, both under
 * ts-jest (src/) and compiled (dist/).
 */
const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');

/**
 * 'bold' deliberately maps to Roboto-Medium, not Roboto-Bold — legacy
 * visual parity (reports.md quirk 12).
 */
const REPORT_FONTS: TFontDictionary = {
  Roboto: {
    normal: join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: join(FONT_DIR, 'Roboto-Medium.ttf'),
    italics: join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
  },
};

/**
 * Generates both report PDFs on demand, fully in memory (DESIGN.md
 * decision 10 — no `public/reports` disk writes, no staleness, no
 * unauthenticated exposure).
 */
@Injectable()
export class ReportsService {
  private readonly classroomModel: Model<ClassroomDocument>;
  private readonly studentModel: Model<StudentDocument>;

  constructor(
    @InjectModel(Classroom.name) classroomModel: Model<ClassroomDocument>,
    @InjectModel(Student.name) studentModel: Model<StudentDocument>,
  ) {
    this.classroomModel = classroomModel;
    this.studentModel = studentModel;
  }

  async generateSignInSheet(): Promise<Buffer> {
    const { classrooms, students } = await this.loadReportData();
    return this.renderPdf(buildSignInSheetDefinition(classrooms, students));
  }

  async generateRollCallSheet(): Promise<Buffer> {
    const { classrooms, students } = await this.loadReportData();
    return this.renderPdf(buildRollCallSheetDefinition(classrooms, students));
  }

  /** All classrooms + all students (legacy: unfiltered finds). */
  private async loadReportData(): Promise<{
    classrooms: ReportClassroom[];
    students: ReportStudent[];
  }> {
    const [classroomDocs, studentDocs] = await Promise.all([
      this.classroomModel.find().lean().exec(),
      this.studentModel.find().lean().exec(),
    ]);
    return {
      classrooms: classroomDocs.map((doc) => ({
        id: String(doc._id),
        classroomName: doc.classroomName,
        ageGroup: doc.ageGroup,
        teacherName: doc.teacherName,
      })),
      students: studentDocs.map((doc) => ({
        studentFirstName: doc.studentFirstName,
        studentLastName: doc.studentLastName,
        dateOfBirth: doc.dateOfBirth,
        classroomId: doc.classroom ? String(doc.classroom) : null,
      })),
    };
  }

  /** Renders a document definition to a Buffer via pdfmake's PdfPrinter. */
  private async renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
    // pdfmake 0.3 requires a URLResolver (no-op for local font paths).
    const printer = new PdfPrinter(REPORT_FONTS, undefined, new URLResolver());
    const doc = await printer.createPdfKitDocument(definition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error: Error) => reject(error));
      doc.end();
    });
  }
}
