import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DebitNotesService } from "./debit-notes.service";
import { CreateDebitNoteDto, UpdateDebitNoteDto } from "./dto/debit-note.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags("debit-notes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("ap/debit-notes")
export class DebitNotesController {
  constructor(private readonly svc: DebitNotesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("supplierId") supplierId?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.list(user.accountBookId, supplierId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDebitNoteDto) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.create(user.accountBookId, dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDebitNoteDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}
