import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  total: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}

@Injectable()
export class PurchaseService {
  constructor(private readonly store: DataStore) {}

  list(): PurchaseOrder[] {
    return this.store.purchaseOrders.map((o) => ({
      ...o,
      supplierName: this.store.suppliers.find((s) => s.id === o.supplierId)?.name,
    }));
  }

  get(id: string): PurchaseOrder {
    const o = this.store.purchaseOrders.find((x) => x.id === id);
    if (!o) throw new NotFoundException(`Purchase order ${id} not found`);
    return {
      ...o,
      supplierName: this.store.suppliers.find((s) => s.id === o.supplierId)?.name,
    };
  }
}
