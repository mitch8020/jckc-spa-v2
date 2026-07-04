import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Guardian,
  GuardianSchema,
} from '../../database/schemas/guardian.schema';
import { Student, StudentSchema } from '../../database/schemas/student.schema';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Guardian.name, schema: GuardianSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [GuardiansController],
  providers: [GuardiansService],
  // Exported for the students module (guardian read on student details,
  // student-scoped guardian creation returning a GuardianDto).
  exports: [GuardiansService],
})
export class GuardiansModule {}
