import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';

export interface SalesOrder {
  id: string;
  number: string;
  customerId: string;
  customerName?: string;
  date: string;
  total: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}

@Injectable()
export class SalesService {
  constructor(private readonly store: DataStore) {}

  list(): SalesOrder[] {
    return this.store.salesOrders.map((o) => ({
      ...o,
      customerName: this.store.customers.find((c) => c.id === o.customerId)?.name,
    }));
  }

  get(id: string): SalesOrder {
    const o = this.store.salesOrders.find((x) => x.id === id);
    if (!o) throw new NotFoundException(`Sales order ${id} not found`);
    return {
      ...o,
      customerName: this.store.customers.find((c) => c.id === o.customerId)?.name,
    };
  }
}
