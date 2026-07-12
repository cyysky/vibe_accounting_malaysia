import { DashboardService } from './dashboard.service';

function makePrisma() {
  return {
    customer: { findMany: jest.fn() },
    supplier: { findMany: jest.fn() },
    item: { findMany: jest.fn() },
    customerInvoice: { findMany: jest.fn() },
    supplierInvoice: { findMany: jest.fn() },
    journalEntry: { findMany: jest.fn() },
    creditNote: { findMany: jest.fn() },
    debitNote: { findMany: jest.fn() },
    salesOrder: { findMany: jest.fn() },
    purchaseOrder: { findMany: jest.fn() },
    bankAccount: { findMany: jest.fn() },
    customerPayment: { findMany: jest.fn() },
    supplierPayment: { findMany: jest.fn() },
    einvoiceSubmission: { findMany: jest.fn() },
    account: { findMany: jest.fn() },
  };
}

describe('DashboardService', () => {
  it('summary returns zeroed defaults when no bookId is provided', async () => {
    const prisma = makePrisma();
    const svc = new DashboardService(prisma as never);
    const out = await svc.summary();
    expect(out.cashPosition).toBe(0);
    expect(out.revenueMtd).toBe(0);
    expect(out.expenseMtd).toBe(0);
    expect(out.topCustomers).toEqual([]);
    expect(out.recentInvoices).toEqual([]);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('summary aggregates AR/AP/inventory, cash, MTD revenue & expense', async () => {
    const prisma = makePrisma();
    prisma.customer.findMany.mockResolvedValue([
      { id: 'c1', name: 'A', outstanding: 100 },
      { id: 'c2', name: 'B', outstanding: 50 },
    ]);
    prisma.supplier.findMany.mockResolvedValue([
      { id: 's1', outstanding: 200 },
    ]);
    prisma.item.findMany.mockResolvedValue([
      { id: 'i1', name: 'X', onHand: 5, cost: 2, reorderLevel: 10, active: true },
    ]);
    prisma.customerInvoice.findMany.mockResolvedValue([
      { id: 'inv-1', number: 'INV-001', customer: { name: 'A' }, total: 100, date: new Date('2025-01-15'), status: 'ISSUED' },
    ]);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oldDate = new Date(firstOfMonth.getTime() - 86400_000);
    prisma.journalEntry.findMany.mockResolvedValue([
      {
        id: 'j1', date: firstOfMonth, status: 'POSTED',
        lines: [
          { accountId: 'cash', account: { type: 'ASSET' }, debit: 500, credit: 0 },
          { accountId: 'rev', account: { type: 'REVENUE' }, debit: 0, credit: 500 },
        ],
      },
      {
        id: 'j2', date: oldDate, status: 'POSTED',
        lines: [
          { accountId: 'cash', account: { type: 'ASSET' }, debit: 1000, credit: 0 },
          { accountId: 'rev', account: { type: 'REVENUE' }, debit: 0, credit: 1000 },
        ],
      },
    ]);
    prisma.einvoiceSubmission.findMany.mockResolvedValue([
      { documentStatus: 1 },
      { documentStatus: 2 },
      { documentStatus: null },
    ]);
    prisma.account.findMany.mockResolvedValue([{ id: 'cash' }]);
    const svc = new DashboardService(prisma as never);
    const out = await svc.summary('book-1');
    expect(out.arOutstanding).toBe(150);
    expect(out.apOutstanding).toBe(200);
    expect(out.inventoryValue).toBe(10);
    expect(out.cashPosition).toBe(1500);
    expect(out.revenueMtd).toBe(500);
    expect(out.expenseMtd).toBe(0);
    expect(out.einvoicePending).toBe(2);
    expect(out.einvoiceValid).toBe(1);
    expect(out.topCustomers).toEqual([{ customerId: 'c1', name: 'A', balance: 100 }, { customerId: 'c2', name: 'B', balance: 50 }]);
    expect(out.topItems).toHaveLength(1);
    expect(out.topItems[0]).toEqual({ itemId: 'i1', name: 'X', onHand: 5, reorderLevel: 10 });
    expect(out.recentInvoices).toHaveLength(1);
  });

  it('summary returns only items at or below reorder level', async () => {
    const prisma = makePrisma();
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.supplier.findMany.mockResolvedValue([]);
    prisma.item.findMany.mockResolvedValue([
      { id: 'i1', name: 'Low', onHand: 2, cost: 0, reorderLevel: 10, active: true },
      { id: 'i2', name: 'High', onHand: 100, cost: 0, reorderLevel: 10, active: true },
    ]);
    prisma.customerInvoice.findMany.mockResolvedValue([]);
    prisma.journalEntry.findMany.mockResolvedValue([]);
    prisma.einvoiceSubmission.findMany.mockResolvedValue([]);
    prisma.account.findMany.mockResolvedValue([]);
    const svc = new DashboardService(prisma as never);
    const out = await svc.summary('book-1');
    expect(out.topItems).toEqual([{ itemId: 'i1', name: 'Low', onHand: 2, reorderLevel: 10 }]);
  });

  describe('search', () => {
    it('returns empty buckets for too-short queries', async () => {
      const prisma = makePrisma();
      const svc = new DashboardService(prisma as never);
      const out = await svc.search('book-1', 'a');
      expect(out.customers).toEqual([]);
      expect(out.suppliers).toEqual([]);
      expect(out.items).toEqual([]);
      expect(out.invoices).toEqual([]);
      expect(out.bills).toEqual([]);
      expect(out.journals).toEqual([]);
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
    });

    it('queries customers, suppliers, items, invoices, bills, journals in parallel', async () => {
      const prisma = makePrisma();
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'Acme' }]);
      prisma.supplier.findMany.mockResolvedValue([{ id: 's1', name: 'Supplier' }]);
      prisma.item.findMany.mockResolvedValue([{ id: 'i1', name: 'Widget' }]);
      prisma.customerInvoice.findMany.mockResolvedValue([]);
      prisma.supplierInvoice.findMany.mockResolvedValue([]);
      prisma.journalEntry.findMany.mockResolvedValue([]);
      prisma.creditNote.findMany.mockResolvedValue([]);
      prisma.debitNote.findMany.mockResolvedValue([]);
      prisma.salesOrder.findMany.mockResolvedValue([]);
      prisma.purchaseOrder.findMany.mockResolvedValue([]);
      prisma.bankAccount.findMany.mockResolvedValue([]);
      prisma.customerPayment.findMany.mockResolvedValue([]);
      prisma.supplierPayment.findMany.mockResolvedValue([]);
      const svc = new DashboardService(prisma as never);
      const out = await svc.search('book-1', 'acme');
      expect(out.customers).toHaveLength(1);
      expect(out.suppliers).toHaveLength(1);
      expect(out.items).toHaveLength(1);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ accountBookId: 'book-1' }),
        take: 5,
      }));
    });
  });
});
