import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreditNotesService } from "./credit-notes.service";
import { CreateCreditNoteDto, UpdateCreditNoteDto } from "./dto/credit-note.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags("credit-notes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("ar/credit-notes")
export class CreditNotesController {
  constructor(private readonly svc: CreditNotesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("customerId") customerId?: string) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.list(user.accountBookId, customerId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCreditNoteDto) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.create(user.accountBookId, dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCreditNoteDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}
