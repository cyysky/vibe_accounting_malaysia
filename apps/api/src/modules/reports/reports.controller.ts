import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('pnl')
  pnl() {
    return this.svc.profitAndLoss();
  }

  @Get('balance-sheet')
  balanceSheet() {
    return this.svc.balanceSheet();
  }

  @Get('executive-summary')
  executiveSummary() {
    return this.svc.executiveSummary();
  }
}
