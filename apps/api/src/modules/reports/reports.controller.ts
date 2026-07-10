import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.generalLedger(user.accountBookId, from, to);
  }
}
