/**
 * Targeted test coverage for the MyInvois SDK updates introduced in 2025-2026:
 *   - Currency Exchange Rate required for non-MYR invoices
 *     (release note 1 Aug 2025; effective Sandbox 9 Aug 2025 / Production 1 Sep 2025).
 *   - Scientific notation banned in amount fields
 *     (release note 30 April 2026).
 *   - TIN/BRN validation tightened
 *     (release note 12 June 2026; effective 1 Aug 2026).
 *   - Field validation rules deployed to Production on 15 August 2026
 *     (release note 03 July 2026).
 *
 * Reference: https://sdk.myinvois.hasil.gov.my/
 */
import { buildUblInvoice } from '../mappers/invoice-v1.1.mapper';
import { validateUblDocument } from './ubl.validator';
import { Prisma } from '@prisma/client';
import type { Customer, CustomerInvoice } from '@prisma/client';

const D = (v: number) => new Prisma.Decimal(v);

const baseCustomer: Customer = {
  id: 'c1', accountBookId: 'b1', code: 'C001', name: 'Acme Sdn Bhd',
  email: 'ap@acme.test', phone: null, taxId: 'C12345678', brn: '202005123456',
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

describe('MyInvois SDK 2025/2026 rule updates', () => {
  describe('Currency Exchange Rate (release note 1 Aug 2025)', () => {
    it('emits TaxExchangeRate with rate=1 for MYR invoices', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const tx = (inner.TaxExchangeRate as Array<Record<string, unknown>>)[0];
      expect(tx).toBeDefined();
      const src = (tx.SourceCurrencyCode as Array<{ _: string }>)[0]._;
      const tgt = (tx.TargetCurrencyCode as Array<{ _: string }>)[0]._;
      const rate = (tx.CalculationRate as Array<{ _: string }>)[0]._;
      expect(src).toBe('MYR');
      expect(tgt).toBe('MYR');
      expect(rate).toBe('1.000000');
    });

    it('emits TaxExchangeRate with the supplied rate for non-MYR invoices', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, currency: 'USD', lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
        exchangeRate: 4.7,
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const tx = (inner.TaxExchangeRate as Array<Record<string, unknown>>)[0];
      const src = (tx.SourceCurrencyCode as Array<{ _: string }>)[0]._;
      const tgt = (tx.TargetCurrencyCode as Array<{ _: string }>)[0]._;
      const rate = (tx.CalculationRate as Array<{ _: string }>)[0]._;
      expect(src).toBe('USD');
      expect(tgt).toBe('MYR');
      expect(rate).toBe('4.700000');
    });

    it('honours an explicit exchangeRate context argument over the invoice field', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, currency: 'SGD', lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
        exchangeRate: 3.45,
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const tx = (inner.TaxExchangeRate as Array<Record<string, unknown>>)[0];
      expect((tx.CalculationRate as Array<{ _: string }>)[0]._).toBe('3.450000');
    });

    it('validator errors when TaxExchangeRate is missing for non-MYR', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, currency: 'USD', lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      delete (inner as Record<string, unknown>).TaxExchangeRate;
      const result = validateUblDocument(doc);
      expect(result.valid).toBe(false);
      expect(
        result.issues.some((i) => i.path === 'TaxExchangeRate' && /required/i.test(i.message)),
      ).toBe(true);
    });

    it('validator errors on non-MYR target currency', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const tx = (inner.TaxExchangeRate as Array<Record<string, unknown>>)[0];
      tx.TargetCurrencyCode = [{ _: 'USD' }];
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => typeof i.path === 'string' && i.path.startsWith('TaxExchangeRate') && /TargetCurrencyCode must be MYR/.test(i.message)),
      ).toBe(true);
    });
  });

  describe('Scientific notation (release note 30 Apr 2026)', () => {
    it('emits plain decimal strings for monetary amounts (no scientific notation)', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, subtotal: D(0.00001), taxTotal: D(0), total: D(0.00001), lines: [{ description: 'Widget', quantity: 1, unitPrice: 0.00001, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const monetary = (inner.LegalMonetaryTotal as Array<Record<string, unknown>>)[0];
      const payable = (monetary.PayableAmount as Array<{ _: string }>)[0]._;
      expect(/[eE]/.test(payable)).toBe(false);
    });

    it('validator errors on scientific notation in CalculationRate', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const inner = (doc.Invoice as Array<Record<string, unknown>>)[0];
      const tx = (inner.TaxExchangeRate as Array<Record<string, unknown>>)[0];
      tx.CalculationRate = [{ _: '1e-5' }];
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => /scientific notation/i.test(i.message)),
      ).toBe(true);
    });
  });

  describe('TIN / BRN validation (release note 12 Jun 2026)', () => {
    it('accepts a 2-letter + 8-digit LHDNM TIN', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => i.path === 'Supplier/PartyTaxScheme/CompanyID' && /LHDNM pattern/.test(i.message)),
      ).toBe(false);
    });

    it('rejects TIN with fewer than 8 digits', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG1234567', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => i.severity === 'error' && i.path === 'Supplier/PartyTaxScheme/CompanyID'),
      ).toBe(true);
    });

    it('rejects TIN with non-digit characters', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345-678', brn: null, name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => i.severity === 'error' && i.path === 'Supplier/PartyTaxScheme/CompanyID'),
      ).toBe(true);
    });

    it('rejects BRN that is not 9-12 digits', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: 'BRN123', name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => i.severity === 'error' && typeof i.path === 'string' && /BRN/.test(i.path)),
      ).toBe(true);
    });

    it('accepts BRN that is exactly 9 digits', () => {
      const doc = buildUblInvoice({
        invoice: { ...invoice, lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, discount: 0, taxAmount: 0, lineNo: 1 }] },
        customer: baseCustomer,
        supplier: { tin: 'IG12345678', brn: '123456789', name: 'Demo Co' },
        taxCodes: new Map(),
        version: '1.1',
      });
      const result = validateUblDocument(doc);
      expect(
        result.issues.some((i) => typeof i.path === 'string' && /BRN/.test(i.path) && /must be 9-12 digits/.test(i.message)),
      ).toBe(false);
    });
  });
});
