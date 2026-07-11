import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GlService } from "./gl.service";
import { CreateAccountDto, UpdateAccountDto } from "./dto/account.dto";
import { CreateJournalDto } from "./dto/journal.dto";
import { CreateTaxCodeDto, UpdateTaxCodeDto } from "./dto/tax-code.dto";
import { CreateFiscalYearDto, UpdateFiscalYearDto } from "./dto/fiscal-year.dto";
import { ReverseJournalDto } from "./dto/reverse-journal.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags("gl")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("gl")
export class GlController {
  constructor(private readonly svc: GlService) {}

  private bookIdOrThrow(user: AuthUser): string {
    if (!user.accountBookId) throw new Error("User has no account book");
    return user.accountBookId;
  }

  // --- Chart of accounts ---------------------------------------------------
  @Get("accounts")
  accounts(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listAccounts(this.bookIdOrThrow(user));
  }

  @Post("accounts")
  createAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAccountDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createAccount(this.bookIdOrThrow(user), dto);
  }

  @Put("accounts/:id")
  updateAccount(
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.updateAccount(id, dto);
  }

  @Delete("accounts/:id")
  deleteAccount(@Param("id") id: string): Promise<void> {
    return this.svc.deleteAccount(id);
  }

  @Get("accounts/:id")
  account(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.svc.getAccount(id);
  }

  // --- Journal entries -----------------------------------------------------
  @Get("journals")
  journals(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listJournals(this.bookIdOrThrow(user), Number(page ?? 1), Number(pageSize ?? 50));
  }

  @Post("journals")
  createJournal(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateJournalDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createJournal(this.bookIdOrThrow(user), dto);
  }

  @Get("journals/:id")
  journal(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.svc.getJournal(id);
  }

  /**
   * Reverse a posted journal entry.  Flips every line, creates a new
   * posting entry and marks the original as REVERSED.
   */
  @Post("journals/:id/reverse")
  @ApiOperation({ summary: "Reverse a posted journal entry", description: "Flips every line, creates a new posting entry and marks the original as REVERSED." })
  @ApiResponse({ status: 201, description: "Reversal entry created." })
  @ApiResponse({ status: 404, description: "Journal not found." })
  reverseJournal(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReverseJournalDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.reverseJournal(this.bookIdOrThrow(user), id, dto?.reason);
  }

  @Get("trial-balance")
  @ApiOperation({ summary: "Trial balance", description: "Sum of debit / credit per account as of an optional cutoff date (defaults to today)." })
  @ApiResponse({ status: 200, description: "Array of { account, debit, credit }." })
  trialBalance(
    @CurrentUser() user: AuthUser,
    @Query("asOf") asOf?: string,
  ) {
    return this.svc.trialBalance(
      this.bookIdOrThrow(user),
      asOf ? new Date(asOf) : undefined,
    );
  }

  // --- Tax codes -----------------------------------------------------------
  @Get("tax-codes")
  taxCodes(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listTaxCodes(this.bookIdOrThrow(user));
  }

  @Post("tax-codes")
  createTaxCode(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaxCodeDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createTaxCode(this.bookIdOrThrow(user), dto);
  }

  @Put("tax-codes/:id")
  updateTaxCode(
    @Param("id") id: string,
    @Body() dto: UpdateTaxCodeDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.updateTaxCode(id, dto);
  }

  @Delete("tax-codes/:id")
  deleteTaxCode(@Param("id") id: string): Promise<void> {
    return this.svc.deleteTaxCode(id);
  }

  // --- Fiscal years --------------------------------------------------------
  @Get("fiscal-years")
  fiscalYears(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listFiscalYears(this.bookIdOrThrow(user));
  }

  @Post("fiscal-years")
  createFiscalYear(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFiscalYearDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.createFiscalYear(this.bookIdOrThrow(user), dto);
  }

  @Put("fiscal-years/:id")
  updateFiscalYear(
    @Param("id") id: string,
    @Body() dto: UpdateFiscalYearDto,
  ): Promise<Record<string, unknown>> {
    return this.svc.updateFiscalYear(id, dto);
  }

  @Post("fiscal-years/:id/close")
  @ApiOperation({ summary: "Close a fiscal year", description: "Marks the period as closed; postings will be blocked thereafter." })
  @ApiResponse({ status: 200, description: "Updated fiscal year with closed=true." })
  @ApiResponse({ status: 404, description: "Fiscal year not found." })
  closeFiscalYear(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.svc.closeFiscalYear(id);
  }

  @Post("fiscal-years/:id/reopen")
  @ApiOperation({ summary: "Re-open a closed fiscal year", description: "Marks the period as open again so postings are permitted." })
  @ApiResponse({ status: 200, description: "Updated fiscal year with closed=false." })
  @ApiResponse({ status: 404, description: "Fiscal year not found." })
  reopenFiscalYear(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.svc.reopenFiscalYear(id);
  }

  @Delete("fiscal-years/:id")
  deleteFiscalYear(@Param("id") id: string): Promise<void> {
    return this.svc.deleteFiscalYear(id);
  }
}
