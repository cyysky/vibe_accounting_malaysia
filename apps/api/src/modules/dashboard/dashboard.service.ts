import { Injectable } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';
import type { DashboardSummary } from '@account/shared';

@Injectable()
export class DashboardService {
  constructor(private readonly store: DataStore) {}

  summary(): DashboardSummary {
    const arOutstanding = this.store.customers.reduce((s, c) => s + c.outstanding, 0);
    const apOutstanding = this.store.suppliers.reduce((s, c) => s + c.outstanding, 0);
    const topCustomers = [...this.store.customers]
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5)
      .map((c) => ({ customerId: c.id, name: c.name, balance: c.outstanding }));
    const topItems = [...this.store.items]
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, 5)
      .map((i) => ({ itemId: i.id, name: i.name, soldQty: i.onHand }));
    return {
      cashPosition: 100000,
      arOutstanding,
      apOutstanding,
      revenueMtd: 48000,
      expenseMtd: 21000,
      topCustomers,
      topItems,
    };
  }
}
