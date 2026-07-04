import { Controller, Get, StreamableFile } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

/**
 * Reports endpoints (API-CONTRACT.md "Reports"): both admin+teacher,
 * both generated per request and returned as an attachment download.
 */
@Controller('reports')
@Roles('admin', 'teacher')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sign-in-sheet')
  async getSignInSheet(): Promise<StreamableFile> {
    const pdf = await this.reportsService.generateSignInSheet();
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="sign-in-sheet.pdf"',
    });
  }

  @Get('roll-call-sheet')
  async getRollCallSheet(): Promise<StreamableFile> {
    const pdf = await this.reportsService.generateRollCallSheet();
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="roll-call-sheet.pdf"',
    });
  }
}
