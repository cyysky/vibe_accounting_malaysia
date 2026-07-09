import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';
import type { Item } from '@account/shared';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly svc: StockService) {}

  @Get('items')
  items(): Item[] {
    return this.svc.list();
  }

  @Get('items/:id')
  item(@Param('id') id: string): Item {
    return this.svc.get(id);
  }

  @Get('low-stock')
  lowStock(): Item[] {
    return this.svc.lowStock();
  }
}
