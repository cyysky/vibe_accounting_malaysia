import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get('orders')
  orders(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listOrders(user.accountBookId, Number(page ?? 1), Number(pageSize ?? 50));
  }

  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.svc.getOrder(id);
  }

  @Post('orders')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesOrderDto) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createOrder(user.accountBookId, dto);
  }

  @Put('orders/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSalesOrderDto) {
    return this.svc.updateOrder(id, dto);
  }

  @Delete('orders/:id')
  remove(@Param('id') id: string) {
    return this.svc.deleteOrder(id);
  }
}
