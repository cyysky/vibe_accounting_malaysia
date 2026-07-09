import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';
import type { Customer, CustomerInvoice, Paginated } from '@account/shared';

@Injectable()
export class ArService {
  constructor(private readonly store: DataStore) {}

  listCustomers(): Customer[] {
    return this.store.customers;
  }

  getCustomer(id: string): Customer {
    const c = this.store.customers.find((x) => x.id === id);
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  listInvoices(): Paginated<CustomerInvoice> {
    const invoices = this.store.customerInvoices.map((i) => ({
      ...i,
      customerName: this.store.customers.find((c) => c.id === i.customerId)?.name,
    }));
    return {
      data: invoices,
      total: invoices.length,
      page: 1,
      pageSize: invoices.length || 50,
    };
  }
}
