import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('purchase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly svc: PurchaseService) {}

  @Get('orders')
  orders(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listOrders(user.accountBookId, Number(page ?? 1), Number(pageSize ?? 50));
  }

  @ApiOperation({ summary: "Get a purchase order by id" })
  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.svc.getOrder(id);
  }

  @Post('orders')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createOrder(user.accountBookId, dto);
  }

  @Put('orders/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.svc.updateOrder(id, dto);
  }

  @Delete('orders/:id')
  remove(@Param('id') id: string) {
    return this.svc.deleteOrder(id);
  }
}
