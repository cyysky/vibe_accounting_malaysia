import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountBooksService } from './account-books.service';
import { CreateAccountBookDto, UpdateAccountBookDto } from './dto/account-book.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('account-books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('account-books')
export class AccountBooksController {
  constructor(private readonly svc: AccountBooksService) {}

  @Get()
  list(): Promise<Array<Record<string, unknown>>> {
    return this.svc.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.svc.get(id);
  }

  @Post()
  create(@Body() dto: CreateAccountBookDto): Promise<Record<string, unknown>> {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccountBookDto): Promise<Record<string, unknown>> {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
