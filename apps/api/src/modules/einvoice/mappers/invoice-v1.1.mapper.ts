/**
 * MyInvois UBL 2.1 JSON Invoice (v1.1) mapper.
 *
 * Maps a CustomerInvoice + its lines + customer + taxCodes into the canonical
 * UBL 2.1 JSON shape expected by the MyInvois documentSubmissions API.
 *
 * Reference: https://sdk.myinvois.hasil.gov.my/ (UBL 2.1 JSON Spec, v1.1)
 */
import type { CustomerInvoice, Customer, Item, TaxCode } from '@prisma/client';

export type UblDocument = Record<string, unknown>;

interface MapperLine {
  item?: Item | null;
  taxCode?: TaxCode | null;
  taxCodeId?: string | null;
  description: string;
  quantity: unknown;
  unitPrice: unknown;
  discount: unknown;
  taxAmount: unknown;
  lineNo: number;
}

export interface MapperContext {
  invoice: CustomerInvoice & { lines: MapperLine[] };
  customer: Customer;
  supplier: { tin: string; brn?: string | null; name: string };
  taxCodes: Map<string, TaxCode>;
  documentType?: 'invoice' | 'credit-note' | 'debit-note' | 'refund-note';
  version?: '1.0' | '1.1';
  format?: 'JSON' | 'XML';
}

const MSIC = '00000';
const COUNTRY_MY = 'MYS';
const CURRENCY_DEFAULT = 'MYR';

export function buildUblInvoice(ctx: MapperContext): UblDocument {
  const v = ctx.version ?? '1.1';
  return {
    _D: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    _A: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    _B: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    Invoice: [
      {
        ID: [{ _: ctx.invoice.number }],
        IssueDate: [{ _: ctx.invoice.date.toISOString().slice(0, 10) }],
        IssueTime: [{ _: ctx.invoice.date.toISOString().slice(11, 19) }],
        DueDate: [{ _: ctx.invoice.dueDate.toISOString().slice(0, 10) }],
        InvoiceTypeCode: [{ _: '01', listVersionID: v }],
        DocumentCurrencyCode: [{ _: ctx.invoice.currency ?? CURRENCY_DEFAULT }],
        TaxCurrencyCode: [{ _: ctx.invoice.currency ?? CURRENCY_DEFAULT }],
        AccountingSupplierParty: [buildSupplier(ctx.supplier)],
        AccountingCustomerParty: [buildCustomer(ctx.customer)],
        InvoiceLine: ctx.invoice.lines.map((l) => buildLine(l, ctx.taxCodes)),
        LegalMonetaryTotal: [
          {
            LineExtensionAmount: [{ _: toString(ctx.invoice.subtotal), currencyID: ctx.invoice.currency }],
            TaxExclusiveAmount: [{ _: toString(ctx.invoice.subtotal), currencyID: ctx.invoice.currency }],
            TaxInclusiveAmount: [{ _: toString(ctx.invoice.total), currencyID: ctx.invoice.currency }],
            AllowanceTotalAmount: [{ _: '0.00', currencyID: ctx.invoice.currency }],
            ChargeTotalAmount: [{ _: '0.00', currencyID: ctx.invoice.currency }],
            PayableAmount: [{ _: toString(ctx.invoice.total), currencyID: ctx.invoice.currency }],
          },
        ],
        TaxTotal: [
          {
            TaxAmount: [{ _: toString(ctx.invoice.taxTotal), currencyID: ctx.invoice.currency }],
            TaxSubtotal: groupTaxSubtotals(ctx.invoice.lines, ctx.taxCodes, ctx.invoice.currency),
          },
        ],
      },
    ],
  };
}

function buildSupplier(s: { tin: string; brn?: string | null; name: string }): UblDocument {
  return {
    Party: [
      {
        IndustryClassificationCode: [{ _: MSIC, name: 'Generic' }],
        PartyIdentification: [{ ID: [{ _: s.brn ?? '', schemeID: 'BRN' }] }],
        PartyName: [{ Name: [{ _: s.name }] }],
        PostalAddress: [
          {
            CityName: [{ _: 'NA' }],
            PostalZone: [{ _: '00000' }],
            CountrySubentityCode: [{ _: '17' }],
            Country: [{ IdentificationCode: [{ _: COUNTRY_MY }] }],
          },
        ],
        PartyTaxScheme: [
          {
            RegistrationName: [{ _: s.name }],
            CompanyID: [{ _: s.tin, schemeID: 'TIN' }],
            TaxScheme: [{ ID: [{ _: 'VAT', schemeID: 'UN/ECE 5153', schemeAgencyID: '6' }] }],
          },
        ],
        PartyLegalEntity: [
          {
            RegistrationName: [{ _: s.name }],
            CompanyID: [{ _: s.brn ?? '', schemeID: 'BRN' }],
          },
        ],
        Contact: [{ ElectronicMail: [{ _: 'ap@example.com' }] }],
      },
    ],
  };
}

function buildCustomer(c: Customer): UblDocument {
  return {
    Party: [
      {
        PartyIdentification: c.taxId
          ? [{ ID: [{ _: c.taxId, schemeID: 'TIN' }] }]
          : c.brn
            ? [{ ID: [{ _: c.brn, schemeID: 'BRN' }] }]
            : [],
        PartyName: [{ Name: [{ _: c.name }] }],
        PostalAddress: [
          {
            CityName: [{ _: c.city ?? 'NA' }],
            PostalZone: [{ _: c.postalCode ?? '00000' }],
            CountrySubentityCode: [{ _: '17' }],
            Country: [{ IdentificationCode: [{ _: c.country ?? COUNTRY_MY }] }],
          },
        ],
        PartyTaxScheme: c.taxId
          ? [
              {
                RegistrationName: [{ _: c.name }],
                CompanyID: [{ _: c.taxId, schemeID: 'TIN' }],
                TaxScheme: [{ ID: [{ _: 'VAT', schemeID: 'UN/ECE 5153', schemeAgencyID: '6' }] }],
              },
            ]
          : [],
        PartyLegalEntity: [
          {
            RegistrationName: [{ _: c.name }],
            CompanyID: [{ _: c.brn ?? c.taxId ?? '', schemeID: c.brn ? 'BRN' : 'TIN' }],
          },
        ],
        Contact: c.email ? [{ ElectronicMail: [{ _: c.email }] }] : [],
      },
    ],
  };
}

function buildLine(line: MapperLine, taxCodes: Map<string, TaxCode>): UblDocument {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  const discount = Number(line.discount ?? 0);
  const lineSub = qty * price - discount;
  const tc = line.taxCodeId ? taxCodes.get(line.taxCodeId) : undefined;
  const taxAmount = Number(line.taxAmount ?? 0);
  const lineTotal = lineSub + taxAmount;

  const out: UblDocument = {
    ID: [{ _: String(line.lineNo) }],
    InvoicedQuantity: [{ _: String(qty), unitCode: line.item?.uom ?? 'C62' }],
    LineExtensionAmount: [{ _: toString(lineSub), currencyID: 'MYR' }],
    Item: [
      {
        Description: [{ _: line.description }],
        Name: [{ _: line.item?.name ?? line.description }],
        CommodityClassification: line.item?.classification
          ? [{ CommodityCode: [{ _: line.item.classification, listID: 'CLASS' }] }]
          : [],
      },
    ],
    Price: [
      {
        PriceAmount: [{ _: toString(price), currencyID: 'MYR' }],
      },
    ],
  };
  if (tc) {
    (out as Record<string, unknown[]>)['TaxTotal'] = [
      {
        TaxAmount: [{ _: toString(taxAmount), currencyID: 'MYR' }],
        RoundingAmount: [{ _: toString(lineTotal), currencyID: 'MYR' }],
        TaxSubtotal: [
          {
            TaxableAmount: [{ _: toString(lineSub), currencyID: 'MYR' }],
            TaxAmount: [{ _: toString(taxAmount), currencyID: 'MYR' }],
            TaxCategory: [
              {
                ID: [{ _: tc.code }],
                Name: [{ _: tc.name }],
                Percent: [{ _: String(Number(tc.rate) * 100) }],
                TaxScheme: [{ ID: [{ _: 'VAT', schemeID: 'UN/ECE 5153', schemeAgencyID: '6' }] }],
              },
            ],
          },
        ],
      },
    ];
  }
  return out;
}

function groupTaxSubtotals(
  lines: MapperLine[],
  taxCodes: Map<string, TaxCode>,
  currency: string,
): UblDocument[] {
  const buckets = new Map<string, { taxable: number; tax: number; tc: TaxCode }>();
  for (const l of lines) {
    if (!l.taxCodeId) continue;
    const tc = taxCodes.get(l.taxCodeId);
    if (!tc) continue;
    const lineSub = Number(l.quantity) * Number(l.unitPrice) - Number(l.discount ?? 0);
    const tax = Number(l.taxAmount ?? 0);
    const cur = buckets.get(tc.id) ?? { taxable: 0, tax: 0, tc };
    cur.taxable += lineSub;
    cur.tax += tax;
    buckets.set(tc.id, cur);
  }
  return Array.from(buckets.values()).map((b) => ({
    TaxableAmount: [{ _: toString(b.taxable), currencyID: currency }],
    TaxAmount: [{ _: toString(b.tax), currencyID: currency }],
    TaxCategory: [
      {
        ID: [{ _: b.tc.code }],
        Name: [{ _: b.tc.name }],
        Percent: [{ _: String(Number(b.tc.rate) * 100) }],
        TaxScheme: [{ ID: [{ _: 'VAT', schemeID: 'UN/ECE 5153', schemeAgencyID: '6' }] }],
      },
    ],
  }));
}

function toString(n: unknown): string {
  return Number(n ?? 0).toFixed(2);
}
