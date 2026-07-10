import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags("audit-log")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audit-log")
export class AuditLogController {
  constructor(private readonly svc: AuditLogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("limit") limit?: string, @Query("entity") entity?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.list(user.accountBookId, Number(limit ?? 100), entity);
  }

  @Get(":entity/:entityId")
  forEntity(
    @CurrentUser() user: AuthUser,
    @Param("entity") entity: string,
    @Param("entityId") entityId: string,
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.forEntity(user.accountBookId, entity, entityId);
  }
}
