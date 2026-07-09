import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import type { DashboardSummary } from '@account/shared';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('summary')
  summary(): DashboardSummary {
    return this.svc.summary();
  }
}
