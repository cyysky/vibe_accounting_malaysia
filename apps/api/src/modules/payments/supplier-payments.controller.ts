import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { CreateSupplierPaymentDto } from "./dto/payment.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ap/payments')
export class SupplierPaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listSupplierPayments(user.accountBookId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getSupplierPayment(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierPaymentDto) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createSupplierPayment(user.accountBookId, dto);
  }
}
