import { Controller, Get, Header, Param, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
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
  list(
    @CurrentUser() user: AuthUser,
    @Query("limit") limit?: string,
    @Query("entity") entity?: string,
    @Query("action") action?: string,
    @Query("since") since?: string,
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.list(user.accountBookId, Number(limit ?? 100), entity, action, since);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="audit-log.csv"')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query("limit") limit?: string,
    @Query("entity") entity?: string,
    @Query("action") action?: string,
    @Query("since") since?: string,
  ) {
    if (!user.accountBookId) throw new Error("User has no account book");
    const rows = await this.svc.list(
      user.accountBookId,
      Math.min(2000, Number(limit ?? 1000)),
      entity,
      action,
      since,
    );
    const header = ["id", "createdAt", "action", "entity", "entityId", "user", "message"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        r.id,
        r.createdAt.toISOString(),
        r.action,
        r.entity,
        r.entityId,
        r.user ? (r.user.email ?? "") : "",
        r.message ?? "",
      ].map((v) => {
        const s = String(v ?? "");
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      });
      lines.push(cells.join(","));
    }
    res.send(lines.join("\n"));
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
