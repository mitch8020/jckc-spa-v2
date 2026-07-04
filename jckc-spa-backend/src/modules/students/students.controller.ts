import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type {
  GuardianDto,
  GuardianForStudentDto,
} from '../../common/dto/guardian.dto';
import type { MyStudentsDto, StudentDto } from '../../common/dto/student.dto';
import type { Paginated } from '../../common/utils/pagination';
import type { SessionUser } from '../auth/session-user.type';
import { AddGuardianToStudentDto } from './dto/add-guardian-to-student.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

/**
 * REST surface per API-CONTRACT.md "Students" (role matrix from
 * DESIGN.md decision 3). NOTE: 'mine' must stay declared before ':id'.
 */
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles('admin', 'teacher')
  list(
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('order') order?: string,
  ): Promise<Paginated<StudentDto>> {
    return this.studentsService.list(page, status, search, order);
  }

  @Get('mine')
  @Roles('parent')
  listMine(@CurrentUser() user: SessionUser): Promise<MyStudentsDto> {
    return this.studentsService.listMine(user.id);
  }

  @Get(':id')
  @Roles('admin', 'teacher')
  getById(@Param('id') id: string): Promise<StudentDto> {
    return this.studentsService.getById(id);
  }

  @Get(':id/guardians')
  @Roles('admin', 'teacher')
  listGuardians(@Param('id') id: string): Promise<GuardianForStudentDto[]> {
    return this.studentsService.listGuardiansOfStudent(id);
  }

  @Post()
  @Roles('admin', 'parent')
  create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateStudentDto,
  ): Promise<StudentDto> {
    return this.studentsService.create(user, dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentDto> {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.studentsService.remove(id);
  }

  @Post(':studentId/guardians')
  @Roles('admin')
  addGuardian(
    @Param('studentId') studentId: string,
    @Body() dto: AddGuardianToStudentDto,
  ): Promise<GuardianDto> {
    return this.studentsService.addGuardianToStudent(studentId, dto);
  }
}
