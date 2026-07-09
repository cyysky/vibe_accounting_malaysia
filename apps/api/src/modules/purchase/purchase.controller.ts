import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PurchaseService, PurchaseOrder } from './purchase.service';

@ApiTags('purchase')
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly svc: PurchaseService) {}

  @Get('orders')
  orders(): PurchaseOrder[] {
    return this.svc.list();
  }

  @Get('orders/:id')
  order(@Param('id') id: string): PurchaseOrder {
    return this.svc.get(id);
  }
}
