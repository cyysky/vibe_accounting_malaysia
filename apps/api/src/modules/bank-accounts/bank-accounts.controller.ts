import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BankAccountsService } from "./bank-accounts.service";
import { CreateBankAccountDto, UpdateBankAccountDto } from "./dto/bank-account.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags("bank-accounts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("bank-accounts")
export class BankAccountsController {
  constructor(private readonly svc: BankAccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.list(user.accountBookId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBankAccountDto) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.create(user.accountBookId, dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBankAccountDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
  @Get(":id/reconciliation")
  reconciliation(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.reconciliation(user.accountBookId, id);
  }

}
