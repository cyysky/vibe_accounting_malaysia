import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GlService } from './gl.service';
import type {
  Account,
  CreateJournalDto,
  JournalEntry,
  Paginated,
  PaginationQuery,
} from '@account/shared';

@ApiTags('gl')
@Controller('gl')
export class GlController {
  constructor(private readonly svc: GlService) {}

  @Get('accounts')
  accounts(): Account[] {
    return this.svc.listAccounts();
  }

  @Get('journals')
  journals(@Query() q: PaginationQuery): Paginated<JournalEntry> {
    return this.svc.listJournals(q);
  }

  @Post('journals')
  createJournal(@Body() dto: CreateJournalDto): JournalEntry {
    return this.svc.createJournal(dto);
  }

  @Get('trial-balance')
  trialBalance() {
    return this.svc.trialBalance();
  }
}
