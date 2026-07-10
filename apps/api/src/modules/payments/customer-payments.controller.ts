import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { CreateCustomerPaymentDto } from "./dto/payment.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "@account/shared";

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ar/payments')
export class CustomerPaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listCustomerPayments(user.accountBookId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getCustomerPayment(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerPaymentDto) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createCustomerPayment(user.accountBookId, dto);
  }
}
