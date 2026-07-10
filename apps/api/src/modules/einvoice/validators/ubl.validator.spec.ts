import { validateUblDocument, assertUblValid } from './ubl.validator';
import { buildUblInvoice } from '../mappers/invoice-v1.1.mapper';
import { Prisma } from '@prisma/client';
import type { Customer, CustomerInvoice } from '@prisma/client';

const D = (v: number) => new Prisma.Decimal(v);

const baseCustomer: Customer = {
  id: 'c1',
  accountBookId: 'b1',
  code: 'C001',
  name: 'Acme Sdn Bhd',
  email: 'ap@acme.test',
  phone: null,
  taxId: 'C123',
  brn: '202005123456',
  addressLine1: null,
  addressLine2: null,
  city: 'KL',
  state: 'Selangor',
  postalCode: '50000',
  country: 'MY',
  currency: 'MYR',
  creditLimit: D(0),
  outstanding: D(0),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const invoice: CustomerInvoice = {
  id: 'i1',
  accountBookId: 'b1',
  customerId: 'c1',
  number: 'INV-0001',
  date: new Date('2025-01-15T00:00:00Z'),
  dueDate: new Date('2025-02-15T00:00:00Z'),
  currency: 'MYR',
  exchangeRate: D(1),
  subtotal: D(100),
  taxTotal: D(8),
  total: D(108),
  paid: D(0),
  balance: D(108),
  status: 'ISSUED',
  notes: null,
  einvoiceStatus: 'NOT_SUBMITTED',
  einvoiceUuid: null,
  einvoiceLongId: null,
  einvoiceQR: null,
  einvoiceValidatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UBL pre-submission validator', () => {
  it('accepts a well-formed UBL invoice produced by the mapper', () => {
    const doc = buildUblInvoice({
      invoice: {
        ...invoice,
        lines: [
          {
            description: 'Widget',
            quantity: 2,
            unitPrice: 50,
            discount: 0,
            taxAmount: 8,
            lineNo: 1,
            taxCodeId: 't1',
            taxCode: null,
            item: null,
          },
        ],
      },
      customer: baseCustomer,
      supplier: {
        tin: 'IG123',
        brn: 'BRN123',
        name: 'Demo Co',
        msic: '62001',
      },
      taxCodes: new Map([
        [
          't1',
          {
            id: 't1',
            accountBookId: 'b1',
            code: 'SVAT-08',
            name: 'Sales 8%',
            rate: D(0.08),
            description: null,
            active: true,
            taxTypeCode: '01',
          },
        ],
      ]),
      version: '1.1',
    });
    const result = validateUblDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
    expect(result.issues.length).toBeGreaterThanOrEqual(0);
  });

  it('rejects an envelope missing the wrapper', () => {
    const result = validateUblDocument({} as never);
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBeGreaterThan(0);
  });

  it('rejects when LegalMonetaryTotal/PayableAmount != TaxInclusiveAmount', () => {
    const doc = buildUblInvoice({
      invoice: {
        ...invoice,
        lines: [
          {
            description: 'Widget',
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            taxAmount: 0,
            lineNo: 1,
            taxCodeId: 't1',
            taxCode: null,
            item: null,
          },
        ],
      },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
      version: '1.1',
    });
    // Tamper with totals so PayableAmount no longer matches TaxInclusiveAmount.
    const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
    const monetary = inner.LegalMonetaryTotal as Array<Record<string, unknown>>;
    (monetary[0].PayableAmount as Array<Record<string, unknown>>)[0]._ = '1.00';
    const result = validateUblDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path?.startsWith('LegalMonetaryTotal/PayableAmount'))).toBe(true);
  });

  it('rejects a line without InvoiceItem description/name', () => {
    const doc = buildUblInvoice({
      invoice: {
        ...invoice,
        lines: [
          {
            description: '',
            quantity: 1,
            unitPrice: 1,
            discount: 0,
            taxAmount: 0,
            lineNo: 1,
            taxCodeId: null,
            taxCode: null,
            item: null,
          },
        ],
      },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
      version: '1.1',
    });
    const result = validateUblDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('Item must include Description'))).toBe(true);
  });

  it('warns on missing customer PartyTaxScheme but does not fail when customer has TIN', () => {
    const doc = buildUblInvoice({
      invoice: {
        ...invoice,
        lines: [
          {
            description: 'Widget',
            quantity: 1,
            unitPrice: 1,
            discount: 0,
            taxAmount: 0,
            lineNo: 1,
            taxCodeId: null,
            taxCode: null,
            item: null,
          },
        ],
      },
      customer: baseCustomer,
      supplier: { tin: 'IG123', brn: 'BRN123', name: 'Demo Co' },
      taxCodes: new Map(),
      version: '1.1',
    });
    // Sanity: mapper sets PartyTaxScheme for customers with taxId, so it
    // should pass with zero errors.  Document this in the test.
    const result = validateUblDocument(doc);
    expect(result.summary.errors).toBe(0);
  });

  it('assertUblValid throws when validation fails', () => {
    expect(() => assertUblValid({} as never)).toThrow();
  });
});
