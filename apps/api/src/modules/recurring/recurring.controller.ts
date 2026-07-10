import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RecurringService } from "./recurring.service";
import { CreateRecurringDto, UpdateRecurringDto } from "./dto/recurring.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags("recurring")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("recurring")
export class RecurringController {
  constructor(private readonly svc: RecurringService) {}

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
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRecurringDto) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.create(user.accountBookId, dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRecurringDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }

  @Post("run-due")
  runDue(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.runDue(user.accountBookId);
  }

  @Post(":id/run")
  run(@Param("id") id: string) {
    return this.svc.run(id);
  }
}
