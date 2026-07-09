import { buildUblInvoice } from './invoice-v1.1.mapper';
import type { Customer, CustomerInvoice } from '@prisma/client';
import { Prisma } from '@prisma/client';

describe('UBL 2.1 v1.1 mapper', () => {
  const D = (v: number) => new Prisma.Decimal(v);
  const baseCustomer: Customer = {
    id: 'c1', accountBookId: 'b1', code: 'C001', name: 'Acme',
    email: 'ap@acme.test', phone: null, taxId: 'C123', brn: null,
    addressLine1: null, addressLine2: null, city: 'KL', state: 'Selangor',
    postalCode: '50000', country: 'MY', currency: 'MYR',
    creditLimit: D(0), outstanding: D(0), active: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  const invoice: CustomerInvoice = {
    id: 'i1', accountBookId: 'b1', customerId: 'c1', number: 'INV-0001',
    date: new Date('2025-01-15T00:00:00Z'), dueDate: new Date('2025-02-15T00:00:00Z'),
    currency: 'MYR', exchangeRate: D(1), subtotal: D(100), taxTotal: D(8), total: D(108),
    paid: D(0), balance: D(108), status: 'ISSUED', notes: null,
    einvoiceStatus: 'NOT_SUBMITTED', einvoiceUuid: null, einvoiceLongId: null,
    einvoiceQR: null, einvoiceValidatedAt: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  it('emits UBL Invoice with header and totals', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 2, unitPrice: 50, discount: 0, taxAmount: 8, lineNo: 1, taxCodeId: 't1', taxCode: null, item: null }] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map([['t1', { id: 't1', accountBookId: 'b1', code: 'SVAT-08', name: 'Sales 8%', rate: D(0.08), description: null, active: true }]]),
      version: '1.1',
    });
    const ubl = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    expect((ubl.ID as Array<{ _: string }>)[0]._).toBe('INV-0001');
    expect((ubl.InvoiceTypeCode as Array<{ listVersionID: string }>)[0].listVersionID).toBe('1.1');
    const monetary = (ubl.LegalMonetaryTotal as Array<Record<string, unknown>>)[0];
    expect((monetary.PayableAmount as Array<{ _: string }>)[0]._).toBe('108.00');
  });

  it('uses TIN as PartyIdentification when present', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
    });
    const customerParty = ((((doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0].AccountingCustomerParty as Array<Record<string, unknown>>)[0].Party as Array<Record<string, unknown>>)[0]);
    expect((customerParty.PartyIdentification as Array<{ ID: Array<{ _: string }> }>)[0].ID[0]._).toBe('C123');
  });
});
