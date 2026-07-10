import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { StockMovementsService } from "./stock-movements.service";
import { CreateStockMovementDto } from "./dto/stock-movement.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock/movements')
export class StockMovementsController {
  constructor(private readonly svc: StockMovementsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.list(user.accountBookId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockMovementDto) {
    if (!user.accountBookId) throw new Error("User has no account book");
    return this.svc.create(user.accountBookId, dto);
  }
}
