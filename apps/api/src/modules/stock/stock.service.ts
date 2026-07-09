import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';
import type { Item } from '@account/shared';

@Injectable()
export class StockService {
  constructor(private readonly store: DataStore) {}

  list(): Item[] {
    return this.store.items;
  }

  get(id: string): Item {
    const i = this.store.items.find((x) => x.id === id);
    if (!i) throw new NotFoundException(`Item ${id} not found`);
    return i;
  }

  lowStock(): Item[] {
    return this.store.items.filter((i) => i.onHand <= i.reorderLevel);
  }
}
