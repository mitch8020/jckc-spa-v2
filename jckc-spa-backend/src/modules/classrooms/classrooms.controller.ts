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
import { Roles } from '../../common/decorators/roles.decorator';
import type {
  ClassroomDto,
  ClassroomWithCountDto,
} from '../../common/dto/classroom.dto';
import { ClassroomsService } from './classrooms.service';
import type {
  AssignResultDto,
  ClassroomDetailsDto,
  RemoveResultDto,
  RosterDto,
} from './classrooms.service';
import { StudentIdsDto } from './dto/student-ids.dto';
import { UpsertClassroomDto } from './dto/upsert-classroom.dto';

/**
 * Classrooms REST surface per API-CONTRACT.md: reads for admin+teacher,
 * mutations (incl. roster management) admin-only (DESIGN.md decision 3).
 */
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @Roles('admin', 'teacher')
  list(): Promise<ClassroomWithCountDto[]> {
    return this.classroomsService.list();
  }

  @Get(':id/roster')
  @Roles('admin')
  getRoster(
    @Param('id') id: string,
    @Query('addPage') addPage?: string,
    @Query('addSearch') addSearch?: string,
    @Query('removePage') removePage?: string,
    @Query('removeSearch') removeSearch?: string,
  ): Promise<RosterDto> {
    return this.classroomsService.getRoster(id, {
      addPage,
      addSearch,
      removePage,
      removeSearch,
    });
  }

  @Get(':id')
  @Roles('admin', 'teacher')
  getDetails(@Param('id') id: string): Promise<ClassroomDetailsDto> {
    return this.classroomsService.getDetails(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: UpsertClassroomDto): Promise<ClassroomDto> {
    return this.classroomsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertClassroomDto,
  ): Promise<ClassroomDto> {
    return this.classroomsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.classroomsService.remove(id);
  }

  @Post(':id/students')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  assignStudents(
    @Param('id') id: string,
    @Body() dto: StudentIdsDto,
  ): Promise<AssignResultDto> {
    return this.classroomsService.assignStudents(id, dto.studentIds);
  }

  @Post(':id/students/remove')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  removeStudents(
    @Param('id') id: string,
    @Body() dto: StudentIdsDto,
  ): Promise<RemoveResultDto> {
    return this.classroomsService.removeStudents(id, dto.studentIds);
  }
}
