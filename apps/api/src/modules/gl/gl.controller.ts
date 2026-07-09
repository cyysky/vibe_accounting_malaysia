import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GlService } from './gl.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { CreateJournalDto } from './dto/journal.dto';
import { CreateTaxCodeDto, UpdateTaxCodeDto } from './dto/tax-code.dto';
import { CreateFiscalYearDto, UpdateFiscalYearDto } from './dto/fiscal-year.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('gl')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gl')
export class GlController {
  constructor(private readonly svc: GlService) {}

  @Get('accounts')
  accounts(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listAccounts(user.accountBookId);
  }

  @Post('accounts')
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createAccount(user.accountBookId, dto);
  }

  @Put('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto): Promise<Record<string, unknown>> {
    return this.svc.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string): Promise<void> {
    return this.svc.deleteAccount(id);
  }

  @Get('accounts/:id')
  account(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getAccount(id);
  }

  @Get('journals')
  journals(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listJournals(user.accountBookId, Number(page ?? 1), Number(pageSize ?? 50));
  }

  @Post('journals')
  createJournal(@CurrentUser() user: AuthUser, @Body() dto: CreateJournalDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createJournal(user.accountBookId, dto);
  }

  @Get('trial-balance')
  trialBalance(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.trialBalance(user.accountBookId);
  }

  // --- Tax codes ---
  @Get('tax-codes')
  taxCodes(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listTaxCodes(user.accountBookId);
  }

  @Post('tax-codes')
  createTaxCode(@CurrentUser() user: AuthUser, @Body() dto: CreateTaxCodeDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createTaxCode(user.accountBookId, dto);
  }

  @Put('tax-codes/:id')
  updateTaxCode(@Param('id') id: string, @Body() dto: UpdateTaxCodeDto): Promise<Record<string, unknown>> {
    return this.svc.updateTaxCode(id, dto);
  }

  @Delete('tax-codes/:id')
  deleteTaxCode(@Param('id') id: string): Promise<void> {
    return this.svc.deleteTaxCode(id);
  }

  // --- Fiscal years ---
  @Get('fiscal-years')
  fiscalYears(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listFiscalYears(user.accountBookId);
  }

  @Post('fiscal-years')
  createFiscalYear(@CurrentUser() user: AuthUser, @Body() dto: CreateFiscalYearDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createFiscalYear(user.accountBookId, dto);
  }

  @Put('fiscal-years/:id')
  updateFiscalYear(@Param('id') id: string, @Body() dto: UpdateFiscalYearDto): Promise<Record<string, unknown>> {
    return this.svc.updateFiscalYear(id, dto);
  }

  @Delete('fiscal-years/:id')
  deleteFiscalYear(@Param('id') id: string): Promise<void> {
    return this.svc.deleteFiscalYear(id);
  }
}
