import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { GlModule } from '../gl/gl.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [GlModule, DashboardModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
