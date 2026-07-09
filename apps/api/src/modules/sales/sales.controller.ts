import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesService, SalesOrder } from './sales.service';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get('orders')
  orders(): SalesOrder[] {
    return this.svc.list();
  }

  @Get('orders/:id')
  order(@Param('id') id: string): SalesOrder {
    return this.svc.get(id);
  }
}
