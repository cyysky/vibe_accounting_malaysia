import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  status(): { status: string; version: string; uptime: number } {
    return { status: 'ok', version: '0.1.0', uptime: process.uptime() };
  }
}
