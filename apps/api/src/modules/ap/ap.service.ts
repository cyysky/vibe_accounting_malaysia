import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../../database/data-store.service';
import type { Paginated, Supplier, SupplierInvoice } from '@account/shared';

@Injectable()
export class ApService {
  constructor(private readonly store: DataStore) {}

  listSuppliers(): Supplier[] {
    return this.store.suppliers;
  }

  getSupplier(id: string): Supplier {
    const s = this.store.suppliers.find((x) => x.id === id);
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
    return s;
  }

  listInvoices(): Paginated<SupplierInvoice> {
    const invoices = this.store.supplierInvoices.map((i) => ({
      ...i,
      supplierName: this.store.suppliers.find((s) => s.id === i.supplierId)?.name,
    }));
    return {
      data: invoices,
      total: invoices.length,
      page: 1,
      pageSize: invoices.length || 50,
    };
  }
}
