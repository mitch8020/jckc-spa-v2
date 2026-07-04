import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type {
  GuardianDto,
  GuardianLiteDto,
} from '../../common/dto/guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { GuardiansService } from './guardians.service';

/**
 * Guardians REST surface (API-CONTRACT.md "Guardians") — admin-only
 * across the board (DESIGN.md decision 3; fixes legacy Q1). Guardian
 * CREATION stays student-scoped (POST /api/students/:studentId/guardians,
 * owned by the students module) — legacy parity: a guardian is always
 * born with a student link.
 */
@Controller('guardians')
@Roles('admin')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get()
  list(): Promise<GuardianLiteDto[]> {
    return this.guardiansService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<GuardianDto> {
    return this.guardiansService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
  ): Promise<GuardianDto> {
    return this.guardiansService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.guardiansService.remove(id);
  }

  @Delete(':id/students/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLink(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ): Promise<void> {
    return this.guardiansService.removeLink(id, studentId);
  }
}
