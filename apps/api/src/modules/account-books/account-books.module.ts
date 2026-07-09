import { Module } from '@nestjs/common';
import { AccountBooksController } from './account-books.controller';
import { AccountBooksService } from './account-books.service';

@Module({
  controllers: [AccountBooksController],
  providers: [AccountBooksService],
  exports: [AccountBooksService],
})
export class AccountBooksModule {}
