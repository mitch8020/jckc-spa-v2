import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SessionUser } from '../auth/session-user.type';
import { DashboardService } from './dashboard.service';
import type { DashboardDto } from './dto/dashboard.dto';

/**
 * GET /api/dashboard — any authenticated user (no @Roles); the service
 * gates on registrationStatus and branches per role.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: SessionUser): Promise<DashboardDto> {
    return this.dashboardService.getDashboard(user);
  }
}
