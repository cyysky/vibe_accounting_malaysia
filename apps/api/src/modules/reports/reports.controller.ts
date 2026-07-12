import { Controller, Get, Header, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('pnl')
  pnl(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.profitAndLoss(user.accountBookId);
  }

  @Get('balance-sheet')
  balanceSheet(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.balanceSheet(user.accountBookId);
  }

  @Get('cash-flow')
  cashFlow(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.cashFlow(user.accountBookId, from, to);
  }

  @Get('executive-summary')
  executiveSummary(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.executiveSummary(user.accountBookId);
  }

  @Get('ar-aging')
  arAging(@CurrentUser() user: AuthUser, @Query('asOf') asOf?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.arAging(user.accountBookId, asOf);
  }

  @Get('ap-aging')
  apAging(@CurrentUser() user: AuthUser, @Query('asOf') asOf?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.apAging(user.accountBookId, asOf);
  }

  @Get('general-ledger')
  generalLedger(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('account') account?: string,
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.generalLedger(user.accountBookId, from, to, account);
  }

  @Get('export/ar-aging.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ar-aging.csv"')
  async arAgingCsv(@CurrentUser() user: AuthUser, @Res() res: Response, @Query('asOf') asOf?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    const data = await this.svc.arAging(user.accountBookId, asOf);
    const csv = this.toAgingCsv(data.rows, 'customerName');
    res.send(csv);
  }

  @Get('export/ap-aging.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ap-aging.csv"')
  async apAgingCsv(@CurrentUser() user: AuthUser, @Res() res: Response, @Query('asOf') asOf?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    const data = await this.svc.apAging(user.accountBookId, asOf);
    const csv = this.toAgingCsv(data.rows, 'supplierName');
    res.send(csv);
  }

  @Get('export/general-ledger.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="general-ledger.csv"')
  async glCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('account') account?: string,
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    const data = await this.svc.generalLedger(user.accountBookId, from, to, account);
    const out: string[] = ['account_code,account_name,date,journal_number,description,debit,credit,running_balance'];
    for (const ln of data.lines) {
      out.push([
        this.csvCell(ln.accountCode),
        this.csvCell(ln.accountName),
        this.csvCell(ln.date),
        this.csvCell(ln.journalNumber ?? ''),
        this.csvCell(ln.description ?? ''),
        ln.debit.toFixed(2),
        ln.credit.toFixed(2),
        (ln.runningBalance ?? 0).toFixed(2),
      ].join(','));
    }
    res.send(out.join('\n'));
  }

  @Get('export/profit-and-loss.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="profit-and-loss.csv"')
  async pnlCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    if (!user.accountBookId) throw new Error("User has no account book");
    const data = await this.svc.profitAndLoss(user.accountBookId);
    res.send([
      'metric,amount',
      `revenue,${data.revenue.toFixed(2)}`,
      `expenses,${data.expenses.toFixed(2)}`,
      `net_income,${data.netIncome.toFixed(2)}`,
    ].join('\n'));
  }

  @Get('export/balance-sheet.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="balance-sheet.csv"')
  async bsCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    if (!user.accountBookId) throw new Error("User has no account book");
    const data = await this.svc.balanceSheet(user.accountBookId);
    res.send([
      'metric,amount',
      `assets,${data.assets.toFixed(2)}`,
      `liabilities,${data.liabilities.toFixed(2)}`,
      `equity,${data.equity.toFixed(2)}`,
      `balanced,${data.balanced}`,
    ].join('\n'));
  }

  private toAgingCsv(rows: Array<{ [k: string]: unknown }>, nameKey: string): string {
    const lines = ['name,current,1_30,31_60,61_90,90_plus,total'];
    for (const r of rows) {
      const b = (r.buckets as Record<string, number>) ?? {};
      lines.push([
        this.csvCell(String(r[nameKey] ?? '')),
        (b.current ?? 0).toFixed(2),
        (b.d1_30 ?? 0).toFixed(2),
        (b.d31_60 ?? 0).toFixed(2),
        (b.d61_90 ?? 0).toFixed(2),
        (b.d90_plus ?? 0).toFixed(2),
        (b.total ?? 0).toFixed(2),
      ].join(','));
    }
    return lines.join('\n');
  }

  private csvCell(s: string): string {
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
}
