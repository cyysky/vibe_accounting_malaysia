import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountBooksService } from './account-books.service';
import type { AccountBook } from '@account/shared';

@ApiTags('account-books')
@Controller('account-books')
export class AccountBooksController {
  constructor(private readonly svc: AccountBooksService) {}

  @Get()
  list(): AccountBook[] {
    return this.svc.list();
  }

  @Get(':id')
  get(@Param('id') id: string): AccountBook {
    return this.svc.get(id);
  }
}
