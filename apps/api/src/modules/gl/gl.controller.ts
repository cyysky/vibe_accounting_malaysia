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

  private bookIdOrThrow(user: AuthUser): string {
    if (!user.accountBookId) throw new Error('User has no account book');
    return user.accountBookId;
  }

  @Get('accounts')
  accounts(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listAccounts(this.bookIdOrThrow(user));
  }

  @Post('accounts')
  createAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAccountDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createAccount(this.bookIdOrThrow(user), dto);
  }

  @Put('accounts/:id')
  updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<Record<string, unknown>> {
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
  journals(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.listJournals(this.bookIdOrThrow(user), Number(page ?? 1), Number(pageSize ?? 50));
  }

  @Post('journals')
  createJournal(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateJournalDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createJournal(this.bookIdOrThrow(user), dto);
  }

  @Get('journals/:id')
  journal(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getJournal(id);
  }

  @Get('trial-balance')
  trialBalance(@CurrentUser() user: AuthUser) {
    return this.svc.trialBalance(this.bookIdOrThrow(user));
  }

  // --- Tax codes ---
  @Get('tax-codes')
  taxCodes(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listTaxCodes(this.bookIdOrThrow(user));
  }

  @Post('tax-codes')
  createTaxCode(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaxCodeDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createTaxCode(this.bookIdOrThrow(user), dto);
  }

  @Put('tax-codes/:id')
  updateTaxCode(
    @Param('id') id: string,
    @Body() dto: UpdateTaxCodeDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.updateTaxCode(id, dto);
  }

  @Delete('tax-codes/:id')
  deleteTaxCode(@Param('id') id: string): Promise<void> {
    return this.svc.deleteTaxCode(id);
  }

  // --- Fiscal years ---
  @Get('fiscal-years')
  fiscalYears(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listFiscalYears(this.bookIdOrThrow(user));
  }

  @Post('fiscal-years')
  createFiscalYear(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFiscalYearDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createFiscalYear(this.bookIdOrThrow(user), dto);
  }

  @Put('fiscal-years/:id')
  updateFiscalYear(
    @Param('id') id: string,
    @Body() dto: UpdateFiscalYearDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.updateFiscalYear(id, dto);
  }

  @Delete('fiscal-years/:id')
  deleteFiscalYear(@Param('id') id: string): Promise<void> {
    return this.svc.deleteFiscalYear(id);
  }
}
