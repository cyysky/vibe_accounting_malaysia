import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly svc: StockService) {}

  @Get('items')
  items(@CurrentUser() user: AuthUser): Promise<Array<Record<string, unknown>>> {
    return this.svc.listItems(user.accountBookId);
  }

  @Get('items/low-stock')
  lowStock(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.lowStock(user.accountBookId);
  }

  @Get('items/:id')
  item(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.getItem(id);
  }

  @Post('items')
  createItem(@CurrentUser() user: AuthUser, @Body() dto: CreateItemDto): Promise<Record<string, unknown>> {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.createItem(user.accountBookId, dto);
  }

  @Put('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<Record<string, unknown>> {
    return this.svc.updateItem(id, dto);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string): Promise<void> {
    return this.svc.deleteItem(id);
  }
}
