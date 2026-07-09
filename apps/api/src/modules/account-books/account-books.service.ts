import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';
import type { AccountBook } from '@account/shared';

@Injectable()
export class AccountBooksService {
  constructor(private readonly store: DataStore) {}

  list(): AccountBook[] {
    return this.store.accountBooks;
  }

  get(id: string): AccountBook {
    const b = this.store.accountBooks.find((x) => x.id === id);
    if (!b) throw new NotFoundException(`Account book ${id} not found`);
    return b;
  }
}
