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
      taxCodes: new Map([['t1', { id: 't1', accountBookId: 'b1', code: 'SVAT-08', name: 'Sales 8%', rate: D(0.08), description: null, active: true, taxTypeCode: '01' }]]),
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

  it('uses credit-note document type code 02', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
      documentType: 'credit-note',
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    expect((inv.InvoiceTypeCode as Array<{ _: string; listVersionID: string }>)[0]._).toBe('02');
  });

  it('uses self-billed-invoice document type code 11', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
      documentType: 'self-billed-invoice',
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    expect((inv.InvoiceTypeCode as Array<{ _: string; listVersionID: string }>)[0]._).toBe('11');
  });

  it('emits AllowanceCharge on a discounted line', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 10, taxAmount: 0, lineNo: 1 }] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
    });
    const line = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0].InvoiceLine as Array<Record<string, unknown>>;
    const ac = (line[0].AllowanceCharge as Array<Record<string, unknown>>)[0];
    expect((ac.ChargeIndicator as Array<{ _: boolean }>)[0]._).toBe(false);
    expect((ac.Amount as Array<{ _: string }>)[0]._).toBe('10.00');
  });

  it('respects invoice currency on monetary totals and lines', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, currency: 'USD', lines: [] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    expect((inv.DocumentCurrencyCode as Array<{ _: string }>)[0]._).toBe('USD');
    const monetary = (inv.LegalMonetaryTotal as Array<Record<string, unknown>>)[0];
    expect((monetary.PayableAmount as Array<{ currencyID: string }>)[0].currencyID).toBe('USD');
  });

  it('includes supplier MSIC and contact when provided', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co', msic: '62010', email: 'ap@demo.test', phone: '+60 3-1234 5678' },
      taxCodes: new Map(),
    });
    const supplier = ((((doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0].AccountingSupplierParty as Array<Record<string, unknown>>)[0].Party as Array<Record<string, unknown>>)[0]);
    expect((supplier.IndustryClassificationCode as Array<{ _: string }>)[0]._).toBe('62010');
    const contact = (supplier.Contact as Array<Record<string, unknown>>)[0];
    expect((contact.ElectronicMail as Array<{ _: string }>)[0]._).toBe('ap@demo.test');
    expect((contact.Telephone as Array<{ _: string }>)[0]._).toBe('+60 3-1234 5678');
  });

  it('throws if supplier TIN is missing', () => {
    expect(() =>
      buildUblInvoice({
        invoice: { ...invoice, lines: [] },
        customer: baseCustomer,
        supplier: { tin: '', name: 'Demo Co' },
        taxCodes: new Map(),
      }),
    ).toThrow(/TIN/);
  });

  it('emits BillingReference when supplied', () => {
    const doc = buildUblInvoice({
      invoice: { ...invoice, lines: [] },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
      billingReferenceId: 'INV-00001',
    });
    const inv = (doc as { Invoice: Array<Record<string, unknown>> }).Invoice[0];
    const ref = (inv.BillingReference as Array<Record<string, unknown>>)[0];
    expect((ref.InvoiceDocumentReference as Array<{ ID: Array<{ _: string }> }>)[0].ID[0]._).toBe('INV-00001');
  });
});
